class DesignUI {
    constructor() {
        //== state variables
        this.savedAnnealElements = [];

        // Debug flag for curve wall testing - set to true to use golden path test data
        this.useGoldenPathDebugData = false;
        // dom elements
        this.html = {};
        this.shapeElements = [];

        //== renderer instances
        this.solutionRenderer = new SolutionRenderer();
        this.cellularRenderer = new CellularRenderer();
        this.curveWallRenderer = new CurveWallRenderer();
        this.goldenPathData = null;

        //== web worker setup
        this.solutionWorker = null;
        this.initializeWorker();

        //== initialize UI elements
        this.initHeaderUI();
        this.initBottomUI();
        this.initSidebarButtons();

        //== event listeners
        // listen for screen changes to manage visibility
        appEvents.on('screenChanged', ({ screen }) => {
            if (screen === ScreenState.DESIGN) {
                this.show();
            } else {
                this.hide();
            }
        });

        //== movement debouncing
        this.moveDebounceTimer = null;
        this.moveDebounceDelay = 150; // milliseconds

        this.loadGoldenPath();
    }

    loadGoldenPath() {
        // Load golden path test data for visual validation debugging
        // To use this data instead of the actual algorithm, set this.useGoldenPathDebugData = true
        fetch('tests/fixtures/curved_walls_check.json')
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                this.goldenPathData = data;
                console.log('[LoadGoldenPath] Golden path test data loaded. Set useGoldenPathDebugData=true to use it for rendering.');
                // If a solution is already being displayed, re-render it with the new data.
                if (appState.currentScreen === ScreenState.DESIGN && appState.currentAnneal) {
                    this.displayResult();
                }
            })
            .catch(error => console.error('Error loading golden path data:', error));
    }

    computeState() {
        // centralized UI button state logic
        return {
            canNext: appState.savedAnneals.length >= 1 && (appState.currentViewedAnnealIndex !== null || appState.currentAnneal !== null),
            canSave: appState.currentAnneal && appState.currentAnneal.finalSolution && !appState.savedAnneals.includes(appState.currentAnneal),
            hasShapes: appState.shapes.length > 0,
            hasSavedAnneals: appState.savedAnneals.length > 0
        };
    }

    initSidebarButtons() {
        // create sidebar buttons
        // set hidden until screen is shown
        this.html.backButton = createButton('Back')
            .addClass('button secondary-button hidden')
            .parent(htmlRefs.left.buttons)
            .mousePressed(() => this.handleBack());

        this.html.restoreButton = createButton('Restore Layout')
            .addClass('button secondary-button hidden')
            .parent(htmlRefs.left.buttons)
            .mousePressed(() => this.handleRestore());

        this.html.nextButton = createButton('Next')
            .addClass('button primary-button hidden')
            .parent(htmlRefs.right.buttons)
            .mousePressed(() => this.handleNext());
    }

    initHeaderUI() {
        // create header elements (hidden until screen is shown)
        // slider toggle
        this.html.sliderDiv = createDiv()
            .id('slider-div')
            .addClass('hidden')
            .parent(htmlRefs.headerControls)
            .mousePressed(this.handleSlider.bind(this));

        // Simple label
        this.html.simpleLabel = createSpan('Simple')
            .addClass('toggle-label')
            .parent(this.html.sliderDiv);

        // create and append the slider
        // min, max, default, step
        this.html.toggleSlider = createSlider(0, 1, 0, 1)
            .id('toggleSlider')
            .addClass('toggle-slider')
            .parent(this.html.sliderDiv);

        // Detail label
        this.html.detailLabel = createSpan('Detail')
            .addClass('toggle-label')
            .parent(this.html.sliderDiv);

        // Orientation buttons
        this.html.orientationDiv = createDiv()
            .id('orientation-div')
            .addClass('hidden')
            .parent(htmlRefs.headerControls);

        this.html.orientationButtons = createDiv()
            .addClass('orientation-buttons')
            .parent(this.html.orientationDiv);

        this.html.tallButton = createDiv()
            .addClass('orientation-button tall')
            .parent(this.html.orientationButtons)
            .mousePressed(() => this.handleAspectRatioChange(-1));

        this.html.squareButton = createDiv()
            .addClass('orientation-button square selected')
            .parent(this.html.orientationButtons)
            .mousePressed(() => this.handleAspectRatioChange(0));

        this.html.wideButton = createDiv()
            .addClass('orientation-button wide')
            .parent(this.html.orientationButtons)
            .mousePressed(() => this.handleAspectRatioChange(1));
    }

    initBottomUI() {
        // create bottom elements (under canvas)
        // hidden until screen is shown
        this.html.designDiv = createDiv()
            .id('design-div')
            .addClass('hidden')
            .parent(htmlRefs.bottomDiv);

        this.html.buttonRow = createDiv()
            .parent(this.html.designDiv)
            .addClass('button-row');

        // Generate button
        this.html.annealButton = createButton('Generate')
            .parent(this.html.buttonRow).addClass('primary-button button')
            .mousePressed(() => this.handleStartAnneal());

        // Save button
        this.html.saveButton = createButton('Save')
            .parent(this.html.buttonRow).addClass('primary-button button')
            .attribute('disabled', '') // until annealing is complete
            .mousePressed(() => this.handleSaveSolution());

        // Clear + Stop button
        this.html.clearButton = createButton('Clear')
            .parent(this.html.buttonRow).addClass('secondary-button button')
            .mousePressed(() => this.drawBlankGrid());

        // // info text
        // this.html.diagnosticText = createP("(toggle 'd' key for diagnostics)")
        //     .parent(this.html.designDiv).addClass('info-text');

        // this.html.growthText = createP("(press 'g' to grow cells)")
        //     .parent(this.html.designDiv).addClass('info-text');
    }

    //== web worker methods
    initializeWorker() {
        try {
            this.solutionWorker = new Worker('js/workers/solution-worker.js');

            // set up message handling
            this.solutionWorker.onmessage = (event) => {
                this.handleWorkerMessage(event.data);
            };
            // set up error handling
            this.solutionWorker.onerror = (error) => {
                console.error('Worker error:', error);
                this.handleWorkerError(error);
            };
            // initialize worker in single mode
            this.solutionWorker.postMessage({
                type: 'SET_MODE',
                payload: { mode: 'single', config: {} }
            });
        } catch (error) {
            console.error('Failed to initialize solution worker:', error);
            this.solutionWorker = null;
        }
    }

    handleWorkerMessage(data) {
        const { type, payload } = data;

        switch (type) {
            case 'MODE_SET':
                console.log('Worker mode set:', payload.mode);
                break;
            case 'PROGRESS':
                this.handleWorkerProgress(payload);
                break;
            case 'RESULT':
                this.handleWorkerResult(payload);
                break;
            case 'ERROR':
                this.handleWorkerError(payload);
                break;
            default:
                console.warn('Unknown worker message type:', type);
        }
    }

    handleWorkerProgress(progress) {
        const { progressType, mode, phase, message, score, valid, visualData } = progress;

        switch (progressType) {
            case 'PHASE_START':
                console.log(`Starting ${phase}: ${message}`);
                break;
            case 'ANNEAL_PROGRESS':
                if (mode === 'single' && visualData) {
                    // handle visual updates in single mode (web)
                    try {
                        // create a minimal solution object for rendering
                        const minimalSolution = {
                            layout: visualData.layout,
                            shapes: visualData.shapes,
                            score: score,
                            valid: valid,
                            // Include perimeter properties from visualData
                            useCustomPerimeter: visualData.useCustomPerimeter,
                            perimeterWidth: visualData.perimeterWidth,
                            perimeterHeight: visualData.perimeterHeight,
                            goalPerimeter: visualData.goalPerimeter
                        };
                        // call the display update with the minimal solution
                        this.updateDisplayCallback(minimalSolution);
                    } catch (error) {
                        console.error('Error handling visual progress:', error);
                        // don't throw error, annealing process still continues
                    }
                } else {
                    // handle progress updates if no visual data
                    console.log(`Annealing progress: score=${score}, valid=${valid}, mode=${mode}`);
                }
                break;
            case 'PHASE_COMPLETE':
                console.log(`Completed ${phase}:`, progress);
                break;
        }
    }

    handleWorkerResult(result) {
        const { finalSolution, cellular, metadata } = result;

        try {
            // convert the json worker result into a Solution object
            const solution = Solution.fromDataObject(finalSolution);
            // store a copy of the final solution as the original annealed solution
            appState.originalAnnealedSolution = Solution.fromDataObject(finalSolution);

            const anneal = {
                finalSolution: solution,
                cellular: cellular // store pre-computed cellular data from worker
            };
            // store results in appState
            appState.currentAnneal = anneal;

            console.log("Worker annealing complete:", solution.score);
            // update UI to show completed state
            this.finishAnnealing();
            this.displayResult();
        } catch (error) {
            console.error('Error processing worker result:', error);
            this.handleWorkerError({ message: `Result processing failed: ${error.message}` });
        }
    }

    handleWorkerError(error) {
        console.error('Worker error:', error.message);
        alert(`Generation failed: ${error.message}`);
        // reset UI to cleared state
        this.drawBlankGrid();
        this.finishAnnealing();
    }

    finishAnnealing() {
        // Restore UI to non-annealing state
        // switch buttons back:
        // - regenerate -> generate
        // - stop and clear -> just clear
        // - save button enabled (if generation was successful)
        this.html.annealButton.html('Generate');
        this.html.annealButton.mousePressed(() => this.handleStartAnneal());
        this.html.clearButton.mousePressed(() => this.drawBlankGrid());

        if (appState.currentAnneal && appState.currentAnneal.finalSolution) {
            this.html.saveButton.removeAttribute('disabled');
            if (this.html.saveButtonResults) {
                this.html.saveButtonResults.removeAttribute('disabled');
            }
        }

        // re-enable shape selection
        this.shapeElements.forEach(element => {
            element.removeClass('disabled');
        });
    }

    //== helper methods
    calculateLayoutProperties(solution) {
        // calculate display properties for Solutions
        if (!solution || !solution.layout || solution.layout.length === 0) {
            // default values for empty/blank layouts
            return {
                squareSize: 25,
                buffer: 25,
                xPadding: (canvasWidth - (20 * 25)) / 2 - 25,
                yPadding: (canvasHeight - (20 * 25)) / 2 - 25
            };
        }

        let layoutHeight = solution.layout.length;
        let layoutWidth = solution.layout[0].length;
        let squareHeight = canvasHeight / (layoutHeight + 2); // + 2 makes room for top/bottom buffer
        let squareWidth = canvasWidth / (layoutWidth + 2); // + 2 makes room for left/right buffer
        let squareSize = Math.min(squareHeight, squareWidth);
        let buffer = squareSize;
        let yPadding = ((canvasHeight - (layoutHeight * squareSize)) / 2) - buffer;
        let xPadding = ((canvasWidth - (layoutWidth * squareSize)) / 2) - buffer;

        return { squareSize, buffer, xPadding, yPadding, layoutHeight, layoutWidth };
    }

    //== show/hide methods
    // manage visibility and screen-specific setup
    show() {
        // show all design screen elements
        Object.values(this.html).forEach(element => element.removeClass('hidden'));

        // keep restore button hidden by default (only show when manual edits are made)
        this.hideRestoreButton();

        // hide the old save button (now moved to Results panel)
        this.html.saveButton.addClass('hidden');

        // reset the canvas
        clear();
        background(255);

        // start with all shapes enabled in the select list
        appState.shapes.forEach((shape, index) => {
            appState.shapes[index].enabled = true;
        });

        // Initialize the results panel if not already done
        if (!this.html.wallModeSelect) {
            this.initializeResultsPanel();
        }

        // draw the blank grid
        this.drawBlankGrid();
    }

    hide() {
        // hide all design screen elements
        Object.values(this.html).forEach(element => element.addClass('hidden'));
    }

    update() {
        // update button states based on current appState
        const state = this.computeState();
        updateButton(this.html.nextButton, state.canNext);

        // Update both save buttons (old one hidden, new one in Results panel)
        updateButton(this.html.saveButton, state.canSave);
        if (this.html.saveButtonResults) {
            updateButton(this.html.saveButtonResults, state.canSave);
        }

        // update dynamic lists
        this.createShapeList();
        this.updateSavedSolutionsList();
    }

    //== button handlers
    handleBack() {
        // change to input screen
        changeScreen(ScreenState.INPUT);
    }

    handleNext() {
        // change to export screen
        changeScreen(ScreenState.EXPORT);
    }

    handleRestore() {
        // Restore the original annealed solution
        if (!appState.originalAnnealedSolution) {
            return;
        }

        // Create a deep copy of the original solution
        const restoredSolution = Solution.fromDataObject(appState.originalAnnealedSolution.toDataObject());

        // Update the current solution
        appState.currentAnneal.finalSolution = restoredSolution;

        // Clear selection
        appState.selectedShapeId = null;

        this.regenerateCellular(restoredSolution);
        this.hideRestoreButton();
        this.displayResult();

        // Emit state change event
        appEvents.emit('stateChanged');
    }

    handleCanvasClick(mouseX, mouseY) {
        // Only handle clicks when we have a current solution
        if (!appState.currentAnneal || !appState.currentAnneal.finalSolution) {
            return;
        }

        const solution = appState.currentAnneal.finalSolution;
        const canvas = { width: canvasWidth, height: canvasHeight };

        // Get the same config values used for rendering
        const config = this.calculateLayoutProperties(solution);

        // Check each shape to see if the click is within its bounds
        for (let i = 0; i < solution.shapes.length; i++) {
            const shape = solution.shapes[i];
            const startX = shape.posX;
            const startY = shape.posY;
            const smallSquare = config.squareSize; // use full low-res square size for bufferShape

            // Calculate the bounding box of the shape footprint (bufferShape)
            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

            for (let y = 0; y < shape.data.bufferShape.length; y++) {
                for (let x = 0; x < shape.data.bufferShape[y].length; x++) {
                    if (shape.data.bufferShape[y][x]) {
                        // Calculate canvas position for this buffer pixel (low-res grid square)
                        let rectX = (startX * config.squareSize) + (x * smallSquare) + config.buffer + config.xPadding + (config.squareSize / 2);
                        let yOffset = ((canvas.height - config.yPadding) - smallSquare - config.buffer);
                        let yStart = (startY * config.squareSize);
                        let yRect = (y * smallSquare);
                        let rectY = yOffset - yStart - yRect - (config.squareSize / 2);

                        minX = Math.min(minX, rectX);
                        maxX = Math.max(maxX, rectX + smallSquare);
                        minY = Math.min(minY, rectY);
                        maxY = Math.max(maxY, rectY + smallSquare);
                    }
                }
            }

            // Check if click is within this shape's bounding box
            if (mouseX >= minX && mouseX <= maxX && mouseY >= minY && mouseY <= maxY) {
                // Shape clicked - update selection
                appState.selectedShapeId = shape.id;
                this.displayResult();
                appEvents.emit('stateChanged');
                return;
            }
        }

        // No shape was clicked - clear selection
        appState.selectedShapeId = null;
        this.displayResult();
        appEvents.emit('stateChanged');
    }

    handleArrowKey(direction) {
        // Only handle arrow keys when a shape is selected
        if (appState.selectedShapeId === null || !appState.currentAnneal || !appState.currentAnneal.finalSolution) {
            return;
        }

        // Debounce the movement to prevent performance issues
        if (this.moveDebounceTimer) {
            clearTimeout(this.moveDebounceTimer);
        }

        this.moveDebounceTimer = setTimeout(() => {
            this.performShapeMovement(direction);
        }, this.moveDebounceDelay);
    }

    performShapeMovement(direction) {
        const currentSolution = appState.currentAnneal.finalSolution;

        // Find the selected shape
        const selectedShape = currentSolution.shapes.find(shape => shape.id === appState.selectedShapeId);
        if (!selectedShape) {
            return;
        }

        // Create a new solution from the current state
        const shapesCopy = currentSolution.shapes.map(shape => {
            const newShape = Object.create(Object.getPrototypeOf(shape));
            Object.assign(newShape, shape);
            return newShape;
        });

        // Prepare configuration using current UI settings and solution wall settings
        const layoutConfig = {
            aspectRatioPref: currentSolution.aspectRatioPref,
            useCustomPerimeter: appState.generationConfig.useCustomPerimeter,
            perimeterWidth: appState.generationConfig.perimeterWidth,
            perimeterHeight: appState.generationConfig.perimeterHeight
        };
        const wallConfig = {
            algorithm: currentSolution.wallAlgorithm,
            curveRadius: currentSolution.curveRadius,
            maxBends: currentSolution.maxBends
        };

        const newSolution = new Solution(shapesCopy, currentSolution.startID, layoutConfig, wallConfig);

        // Find the selected shape in the new solution
        const newSelectedShape = newSolution.shapes.find(shape => shape.id === appState.selectedShapeId);

        // Update position based on direction (1 unit = 1 inch on low-resolution grid)
        switch (direction) {
            case 'left':
                newSelectedShape.posX -= 1;
                break;
            case 'right':
                newSelectedShape.posX += 1;
                break;
            case 'up':
                newSelectedShape.posY += 1;
                break;
            case 'down':
                newSelectedShape.posY -= 1;
                break;
        }

        // Apply coordinate normalization
        newSolution.normalizeCoordinates();

        // Calculate new layout and score
        newSolution.makeLayout();
        newSolution.calcScore();

        // Update the current solution
        appState.currentAnneal.finalSolution = newSolution;

        // Trigger cellular regeneration
        this.regenerateCellular(newSolution);

        this.showRestoreButton();
        this.displayResult();
    }

    regenerateCellular(solution) {
        // Create new cellular instance and regenerate walls (pass the entire Solution object)
        const cellular = new Cellular(solution);
        cellular.makeInitialCells();
        cellular.growCells();

        // Update the stored cellular data
        appState.currentAnneal.cellular = cellular;
    }

    showRestoreButton() {
        this.html.restoreButton.removeClass('hidden');
    }

    hideRestoreButton() {
        this.html.restoreButton.addClass('hidden');
    }

    handleAspectRatioChange(pref) {
        appState.generationConfig.aspectRatioPref = pref;

        // Update selected state
        this.html.tallButton.removeClass('selected');
        this.html.squareButton.removeClass('selected');
        this.html.wideButton.removeClass('selected');

        if (pref === -1) {
            this.html.tallButton.addClass('selected');
        } else if (pref === 0) {
            this.html.squareButton.addClass('selected');
        } else if (pref === 1) {
            this.html.wideButton.addClass('selected');
        }
    }

    handleSlider() {
        let toggle = this.html.toggleSlider;

        // toggle the slider value
        if (toggle.value() === 0) {
            toggle.value(1);
            detailView = true;
        } else {
            toggle.value(0);
            detailView = false;
        }
        // update the screen
        this.displayResult();
    }

    async handleStartAnneal() {
        // clear the original annealed solution when starting a new generation
        appState.originalAnnealedSolution = null;
        appState.selectedShapeId = null;

        // check if worker is available
        if (!this.solutionWorker) {
            alert('Solution worker is not available.');
            return;
        }

        // disable shape selection changes while annealing
        this.shapeElements.forEach(element => {
            element.addClass('disabled');
        });
        // unselect solutions from list
        this.viewSavedAnneal(null);

        //== start the annealing process
        this.html.saveButton.attribute('disabled', '');
        if (this.html.saveButtonResults) {
            this.html.saveButtonResults.attribute('disabled', '');
        }

        // check if each shape has all it's grid data
        for (let shape of appState.shapes) {
            if (!shape.data.lowResShape || !shape.data.bufferShape) {
                // if missing, generate it
                shape.saveUserInput(shape.data.title, shape.data.highResShape);
            }
        }

        // find only selected (enabled) shapes
        // - filter() returns shallow copy of all shapes
        // - shallow copy keeps shape specific data while allowing unique position data
        let selectedShapes = appState.shapes.filter(shape => shape.enabled);
        if (selectedShapes.length < 2) {
            alert('Select at least two shapes to generate');
            return;
        }

        try {
            // update UI to show annealing state
            this.html.annealButton.html('Regenerate');
            this.html.annealButton.mousePressed(() => this.handleStopAnneal());
            this.html.clearButton.mousePressed(() => this.handleStopAnneal());

            // convert shapes to plain data objects for worker
            const shapesData = selectedShapes.map(shape => shape.toDataObject());

            // get wall generation parameters from UI to appState
            const wallMode = this.html.wallModeSelect ? this.html.wallModeSelect.value() : 'cellular';
            const cellularAlgorithm = this.html.cellularAlgorithmSelect ? this.html.cellularAlgorithmSelect.value() : 'organic';

            if (wallMode === 'cellular') {
                appState.generationConfig.wallAlgorithm = `cellular-${cellularAlgorithm}`;
            } else {
                appState.generationConfig.wallAlgorithm = wallMode;
            }

            // Update curve parameters if they exist
            if (this.html.curveRadiusInput) {
                appState.generationConfig.curveRadius = parseFloat(this.html.curveRadiusInput.value());
            }
            if (this.html.maxBendsInput) {
                appState.generationConfig.maxBends = parseInt(this.html.maxBendsInput.value());
            }

            // send generation request to worker
            this.solutionWorker.postMessage({
                type: 'GENERATE_SOLUTION',
                payload: {
                    shapes: shapesData,
                    jobId: `single-${Date.now()}`,
                    startId: 0,
                    aspectRatioPref: appState.generationConfig.aspectRatioPref,
                    // Perimeter
                    useCustomPerimeter: appState.generationConfig.useCustomPerimeter,
                    perimeterWidth: appState.generationConfig.perimeterWidth,
                    perimeterHeight: appState.generationConfig.perimeterHeight,
                    // Walls
                    wallAlgorithm: appState.generationConfig.wallAlgorithm,
                    curveRadius: appState.generationConfig.curveRadius,
                    maxBends: appState.generationConfig.maxBends
                }
            });

            console.log("Generation request sent to worker...");

        } catch (error) {
            console.error('Failed to start annealing:', error);
            alert(`Failed to start generation: ${error.message}`);
            this.finishAnnealing();
        }
    }

    handleStopAnneal() {
        // terminate and restart the worker
        console.log("Stopping annealing...");

        if (this.solutionWorker) {
            this.solutionWorker.terminate();
            this.initializeWorker();
        }

        this.drawBlankGrid();
        this.finishAnnealing();
    }

    handleSaveSolution() {
        // save the current solution to the array
        appState.totalSavedAnneals++;

        // Create deep copy using toDataObject/fromDataObject
        const dataObject = appState.currentAnneal.finalSolution.toDataObject();
        const deepCopySolution = Solution.fromDataObject(dataObject);

        // save only the necessary data for each anneal
        let savedData = {
            title: `solution-${appState.totalSavedAnneals}`,
            finalSolution: deepCopySolution,
            enabledShapes: appState.shapes.map(shape => shape.enabled)
        };
        appState.savedAnneals.push(savedData);

        this.viewSavedAnneal(appState.savedAnneals.length - 1);

        // notify ui update manager
        appEvents.emit('stateChanged');
    }
    //== end button handlers

    drawBlankGrid() {
        clear();
        background(255);

        // reset ui to cleared initial state
        // clear current selection
        appState.currentViewedAnnealIndex = null;
        appState.currentAnneal = null;

        // enable shape selection
        this.shapeElements.forEach(element => {
            element.removeClass('disabled');
        });

        // create empty solution and display grid only
        let emptySolution = new Solution([], 0, aspectRatioPref);
        emptySolution.makeBlankLayout(20);

        // calculate layout properties and set up config for renderer
        let layoutProps = this.calculateLayoutProperties(emptySolution);
        let canvas = { height: canvasHeight, width: canvasWidth };
        let config = {
            devMode: false,
            detailView: false,
            ...layoutProps
        };
        let colors = {
            lineColor: "rgb(198, 198, 197)",
            bkrdColor: "rgb(229, 229, 229)"
        };

        // use renderer to display the grid on the canvas
        this.solutionRenderer.renderGridSquares(emptySolution.layout, canvas, config, colors);

        // notify ui update manager
        appEvents.emit('stateChanged');
    }

    updateDisplayCallback(_solution) {
        // receives a solution from the web worker and updates the display
        clear();
        background(255);
        // calculate layout properties and set up config for renderer
        let layoutProps = this.calculateLayoutProperties(_solution);
        let canvas = { height: canvasHeight, width: canvasWidth };
        let config = {
            devMode: devMode,
            detailView: detailView,
            ...layoutProps
        };

        // use renderer to display the layout on the canvas
        this.solutionRenderer.renderLayout(_solution, canvas, config);
        this.solutionRenderer.renderScores(_solution.layout, canvas, config);
    }

    displayResult() {
        // show shapes and grid but not annealing scores
        if (appState.currentAnneal && appState.currentAnneal.finalSolution) {
            clear();
            background(255);

            // calculate layout properties and set up config for renderer
            let solution = appState.currentAnneal.finalSolution;
            let layoutProps = this.calculateLayoutProperties(solution);
            let canvas = { height: canvasHeight, width: canvasWidth };
            let config = {
                devMode: devMode,
                detailView: detailView,
                ...layoutProps,
                canvasHeight: canvas.height // Pass canvas height for renderer calculations
            };

            // use renderer to display the layout on the canvas
            this.solutionRenderer.renderLayout(solution, canvas, config);

            // Handle wall generation rendering based on mode
            const wallAlgorithm = solution.wallAlgorithm || 'cellular-organic';

            console.log(`[DisplayResult] wallAlgorithm=${wallAlgorithm}`);

            if (wallAlgorithm === 'curve') {
                // Handle curve wall rendering
                let wallPath;

                if (this.useGoldenPathDebugData && this.goldenPathData) {
                    // Use test data for visual validation
                    wallPath = this.goldenPathData;
                    console.log('[DisplayResult] Using golden path test data for visual validation');
                } else {
                    // Use actual algorithm output
                    const curveGenerator = new CurveWall(solution);
                    const stepLimit = devMode ? curveStep : -1;
                    if (devMode) {
                        curveGenerator.setDebugMode(true);
                    }
                    wallPath = curveGenerator.generate(solution.maxBends, solution.curveRadius, stepLimit);
                    console.log('[DisplayResult] Using actual CurveWall algorithm output');
                }

                // For debug mode, we render the groups and partial path.
                // For non-debug, we just render the final path.
                if (devMode) {
                    // Create a generator instance just to get the group data for debugging
                    const curveGenerator = new CurveWall(solution);
                    curveGenerator._groupShapesByY(solution.shapes); // Run grouping
                    this.curveWallRenderer.renderDebugState(
                        null, // No specific debug state object anymore
                        curveGenerator.groups,
                        canvas,
                        config
                    );
                    this.curveWallRenderer.renderWallPath(wallPath, canvas, config);
                } else {
                    if (wallPath && wallPath.length > 0) {
                        this.curveWallRenderer.renderWallPath(wallPath, canvas, config);
                    } else {
                        console.warn('[DisplayResult] No curve wall path to render');
                    }
                }
            } else {
                // Handle cellular wall rendering (existing logic)
                if (devMode) {
                    // create temporary cellular instance for step-by-step growth preview
                    appState.currCellular = new Cellular(solution, devMode, numGrow);

                    // Use the appropriate cellular algorithm
                    if (wallAlgorithm === 'cellular-rectilinear') {
                        appState.currCellular.growRectilinear();
                    } else {
                        appState.currCellular.growCells();
                    }
                } else if (appState.currentAnneal.cellular) {
                    // worker result, use returned cellular data
                    // convert the cellular data into a full Cellular instance
                    appState.currCellular = Cellular.fromDataObject(appState.currentAnneal.cellular, solution);
                } else {
                    // imported solution, recalculate cellular data
                    appState.currCellular = new Cellular(solution, devMode, numGrow);

                    // Use the appropriate cellular algorithm
                    if (wallAlgorithm === 'cellular-rectilinear') {
                        appState.currCellular.growRectilinear();
                    } else {
                        appState.currCellular.growCells();
                    }

                    // store cellular data in appState
                    if (appState.savedAnneals.includes(appState.currentAnneal)) {
                        appState.currentAnneal.cellular = {
                            cellSpace: appState.currCellular.cellSpace,
                            maxTerrain: appState.currCellular.maxTerrain,
                            numAlive: appState.currCellular.numAlive
                        };
                    }
                }

                // use renderer to display the cellular lines on the canvas
                // get formatted line data from the cellular instance
                const cellLines = appState.currCellular.getCellRenderLines();
                this.cellularRenderer.renderCellLines(cellLines, canvas, config);

                // display cells and terrain (cellular scores)
                if (devMode) {
                    this.cellularRenderer.renderTerrain(solution.layout, canvas, { ...config, maxTerrain: appState.currCellular.maxTerrain });
                    this.cellularRenderer.renderCells(appState.currCellular.cellSpace, canvas, config);
                }
            }
        }
    }

    createShapeList() {
        // create list of shapes to select from
        if (!htmlRefs.left) return;
        if (appState.currentScreen !== ScreenState.DESIGN) return;

        // clear the list
        htmlRefs.left.list.html('');
        this.shapeElements = [];

        // create the list
        appState.shapes.forEach((shape, index) => {
            let shapeItem = createDiv()
                .parent(htmlRefs.left.list)
                .addClass(shape.enabled ? 'shape-item highlighted' : 'shape-item')
                .mousePressed(() => this.toggleShapeSelection(index));

            createSpan(shape.data.title)
                .addClass('shape-title')
                .parent(shapeItem);

            this.shapeElements.push(shapeItem);
        });
    }

    toggleShapeSelection(index) {
        if (this.shapeElements[index].hasClass('disabled')) return;

        appState.shapes[index].enabled = !appState.shapes[index].enabled;
        this.shapeElements[index].toggleClass('highlighted');
    }

    initializeResultsPanel() {
        // Initialize the results panel with wall generation controls
        if (!htmlRefs.right) return;
        if (appState.currentScreen !== ScreenState.DESIGN) return;

        // clear the list
        htmlRefs.right.list.html('');
        this.savedAnnealElements = [];

        // Set up flexbox layout for the results panel
        htmlRefs.right.list
            .style('display', 'flex')
            .style('flex-direction', 'column')
            .style('height', '100%')
            .style('overflow', 'hidden');

        // Create a fixed controls container
        this.html.controlsContainer = createDiv()
            .addClass('controls-container')
            .style('flex-shrink', '0')
            .style('padding', '10px')
            .style('background-color', '#fefefe')
            .parent(htmlRefs.right.list);

        // create wall generation controls in the fixed container
        this.createWallGenerationControls();

        // Create scrollable container for solutions
        this.html.scrollContainer = createDiv()
            .addClass('scroll-container')
            .style('flex-grow', '1')
            .style('overflow-y', 'auto')
            .style('min-height', '0')
            .parent(htmlRefs.right.list);

        // create the saved solutions list
        this.updateSavedSolutionsList();
    }

    updateSavedSolutionsList() {
        // Update only the saved solutions list without recreating controls
        if (!htmlRefs.right) return;
        if (appState.currentScreen !== ScreenState.DESIGN) return;
        if (!this.html.scrollContainer) return;

        // Clear the scroll container
        this.html.scrollContainer.html('');

        // Add the saved solutions label
        createSpan('Saved Solutions')
            .addClass('control-label saved-solutions-label')
            .style('display', 'block')
            .style('margin-bottom', '10px')
            .style('font-weight', 'bold')
            .style('padding', '0 10px')
            .parent(this.html.scrollContainer);

        // Create the solutions container
        this.html.solutionsContainer = createDiv()
            .addClass('solutions-container')
            .style('padding', '0 10px')
            .parent(this.html.scrollContainer);

        this.savedAnnealElements = [];

        // create the list
        for (let i = 0; i < appState.savedAnneals.length; i++) {
            let savedAnnealItem = createDiv().addClass('saved-anneal-item');
            if (i === appState.currentViewedAnnealIndex) {
                savedAnnealItem.addClass('highlighted');
            }
            savedAnnealItem.parent(this.html.solutionsContainer);

            let viewIcon = createImg('img/view.svg', 'View')
                .addClass('icon-button')
                .size(24, 24)
                .parent(savedAnnealItem)
                .mousePressed(() => this.viewSavedAnneal(i));

            let titleSpan = createSpan(appState.savedAnneals[i].title)
                .addClass('anneal-title')
                .parent(savedAnnealItem);

            let trashIcon = createImg('img/trash.svg', 'Delete')
                .addClass('icon-button')
                .size(24, 24)
                .parent(savedAnnealItem)
                .mousePressed(() => {
                    if (confirm(`Are you sure you want to delete "${appState.savedAnneals[i].title}"?`)) {
                        appState.savedAnneals.splice(i, 1);
                        if (i === appState.currentViewedAnnealIndex) {
                            // currently viewed anneal was deleted, display blank grid
                            appState.currentViewedAnnealIndex = null;
                            appState.currentAnneal = null;
                            this.drawBlankGrid();
                        } else if (i < appState.currentViewedAnnealIndex) {
                            // deleted before currently viewed, move the index down
                            appState.currentViewedAnnealIndex--;
                            this.viewSavedAnneal(appState.currentViewedAnnealIndex);
                        }
                        // notify ui update manager
                        appEvents.emit('stateChanged');
                    }
                });

            this.savedAnnealElements.push(savedAnnealItem);
        }
    }

    createWallGenerationControls() {
        // create wall generation mode controls in the Results panel

        // Preserve previous selections if they exist
        const previousWallMode = this.html.wallModeSelect ? this.html.wallModeSelect.value() : 'cellular';
        const previousCellularAlgorithm = this.html.cellularAlgorithmSelect ? this.html.cellularAlgorithmSelect.value() : 'organic';

        // Master wall generation mode dropdown
        const modeGroup = createDiv()
            .addClass('control-group')
            .style('margin-bottom', '15px')
            .parent(this.html.controlsContainer);
        createSpan('Wall Generation Mode')
            .addClass('control-label')
            .style('display', 'block')
            .style('margin-bottom', '5px')
            .style('font-weight', 'bold')
            .parent(modeGroup);

        this.html.wallModeSelect = createSelect()
            .addClass('control-select')
            .style('width', '100%')
            .style('padding', '5px')
            .parent(modeGroup)
            .changed(() => this.handleWallModeChange());
        this.html.wallModeSelect.option('Cellular Automata', 'cellular');
        this.html.wallModeSelect.option('Curve', 'curve');
        this.html.wallModeSelect.selected(previousWallMode);

        // Cellular Automata sub-options
        this.html.cellularGroup = createDiv()
            .addClass('control-group')
            .style('margin-bottom', '15px')
            .parent(this.html.controlsContainer);
        if (previousWallMode !== 'cellular') {
            this.html.cellularGroup.addClass('hidden');
        }
        createSpan('Algorithm')
            .addClass('control-label')
            .style('display', 'block')
            .style('margin-bottom', '5px')
            .style('font-weight', 'bold')
            .parent(this.html.cellularGroup);

        this.html.cellularAlgorithmSelect = createSelect()
            .addClass('control-select')
            .style('width', '100%')
            .style('padding', '5px')
            .parent(this.html.cellularGroup)
            .changed(() => this.handleCellularAlgorithmChange());
        this.html.cellularAlgorithmSelect.option('Organic', 'organic');
        this.html.cellularAlgorithmSelect.option('Rectilinear', 'rectilinear');
        this.html.cellularAlgorithmSelect.selected(previousCellularAlgorithm);

        // Curve sub-options
        this.html.curveGroup = createDiv()
            .addClass('control-group')
            .parent(this.html.controlsContainer);
        if (previousWallMode !== 'curve') {
            this.html.curveGroup.addClass('hidden');
        }

        // Wrapper for Radius
        const radiusWrapper = createDiv()
            .parent(this.html.curveGroup)
            .style('margin-bottom', '15px');
        createSpan('Curve Radius (inches)')
            .addClass('control-label')
            .style('display', 'block')
            .style('margin-bottom', '5px')
            .parent(radiusWrapper);
        this.html.curveRadiusInput = createInput('1.0', 'number')
            .addClass('control-input')
            .style('width', '100%')
            .parent(radiusWrapper)
            .attribute('min', '0.1')
            .attribute('max', '10.0')
            .attribute('step', '0.1')
            .input(() => this.handleCurveParameterChange());

        // Wrapper for Bends
        const bendsWrapper = createDiv()
            .parent(this.html.curveGroup)
            .style('margin-bottom', '15px');
        createSpan('Max Sequential Bends')
            .addClass('control-label')
            .style('display', 'block')
            .style('margin-bottom', '5px')
            .parent(bendsWrapper);
        this.html.maxBendsInput = createInput('4', 'number')
            .addClass('control-input')
            .style('width', '100%')
            .parent(bendsWrapper)
            .attribute('min', '2')
            .attribute('max', '10')
            .attribute('step', '1')
            .input(() => this.handleCurveParameterChange());

        // Save button in Results panel
        this.html.saveButtonResults = createButton('Save')
            .addClass('primary-button button')
            .style('margin-bottom', '20px')
            .style('width', '100%')
            .parent(this.html.controlsContainer)
            .attribute('disabled', '') // until annealing is complete
            .mousePressed(() => this.handleSaveSolution());

        // No separator needed since we have separate containers now
    }

    handleWallModeChange() {
        const selectedMode = this.html.wallModeSelect.value();

        console.log(`[UI] Wall mode changed to: ${selectedMode}`);

        if (selectedMode === 'cellular') {
            this.html.cellularGroup.removeClass('hidden');
            this.html.curveGroup.addClass('hidden');
        } else if (selectedMode === 'curve') {
            this.html.cellularGroup.addClass('hidden');
            this.html.curveGroup.removeClass('hidden');
        }

        // Also update the wall generation mode on the solution object
        if (appState.currentAnneal && appState.currentAnneal.finalSolution) {
            const solution = appState.currentAnneal.finalSolution;
            if (selectedMode === 'cellular') {
                const cellularAlgorithm = this.html.cellularAlgorithmSelect.value();
                solution.wallAlgorithm = `cellular-${cellularAlgorithm}`;
            } else {
                solution.wallAlgorithm = selectedMode;
            }
            this.displayResult(); // Redraw with the new wall type
        }
    }

    handleCurveParameterChange() {
        // Only regenerate if we have a current solution
        if (!appState.currentAnneal || !appState.currentAnneal.finalSolution) {
            return;
        }

        const solution = appState.currentAnneal.finalSolution;

        // Update solution with new values from UI
        solution.curveRadius = parseFloat(this.html.curveRadiusInput.value());
        solution.maxBends = parseInt(this.html.maxBendsInput.value());

        // Redraw the canvas with new walls without triggering a full UI update
        this.displayResult();
    }

    handleCellularAlgorithmChange() {
        // Only regenerate if we have a current solution
        if (!appState.currentAnneal || !appState.currentAnneal.finalSolution) {
            return;
        }

        const selectedAlgorithm = this.html.cellularAlgorithmSelect.value();
        const solution = appState.currentAnneal.finalSolution;

        // Create new cellular instance with the selected algorithm
        const cellular = new Cellular(solution);

        if (selectedAlgorithm === 'organic') {
            cellular.growCells();
        } else if (selectedAlgorithm === 'rectilinear') {
            cellular.growRectilinear();
        }

        // Update the stored cellular data
        appState.currentAnneal.cellular = {
            cellSpace: cellular.cellSpace,
            maxTerrain: cellular.maxTerrain,
            numAlive: cellular.numAlive || 0
        };
        appState.currCellular = cellular;

        // also update the wall algorithm on the solution object
        solution.wallAlgorithm = `cellular-${selectedAlgorithm}`;

        // Redraw the canvas with new walls without triggering a full UI update
        this.displayResult();
    }

    viewSavedAnneal(index) {
        if (index === null) {
            // clear the viewed anneal
            appState.currentViewedAnnealIndex = null;
            appState.currentAnneal = null;
            // notify ui update manager
            appEvents.emit('stateChanged');
            return;
        }

        // display selected saved anneal
        appState.currentViewedAnnealIndex = index;
        // Create a deep copy of the saved anneal to prevent modifications
        const savedAnneal = appState.savedAnneals[index];

        appState.currentAnneal = {
            title: savedAnneal.title,
            finalSolution: Solution.fromDataObject(savedAnneal.finalSolution.toDataObject()),
            enabledShapes: [...savedAnneal.enabledShapes] // shallow copy is fine for boolean array
        };

        // update wall generation UI to match loaded solution
        const solution = appState.currentAnneal.finalSolution;
        if (solution.wallAlgorithm) {
            if (solution.wallAlgorithm.startsWith('cellular')) {
                const cellularType = solution.wallAlgorithm.split('-')[1] || 'organic';
                this.html.wallModeSelect.selected('cellular');
                this.html.cellularAlgorithmSelect.selected(cellularType);
                this.html.cellularGroup.removeClass('hidden');
                this.html.curveGroup.addClass('hidden');
            } else if (solution.wallAlgorithm === 'curve') {
                this.html.wallModeSelect.selected('curve');
                this.html.cellularGroup.addClass('hidden');
                this.html.curveGroup.removeClass('hidden');
            }
        }

        // disable shape selection changes while viewing saved anneal
        if (this.shapeElements.length === 0) {
            this.createShapeList();
        }
        this.shapeElements.forEach(element => {
            element.addClass('disabled');
        });
        // set which shapes are enabled for this saved solution
        let enableShapes = appState.currentAnneal.enabledShapes;

        if (enableShapes && Array.isArray(enableShapes)) {
            enableShapes.forEach((_enabled, i) => {
                // set the enabled states for this saved solution
                appState.shapes[i].enabled = _enabled;
                if (_enabled) {
                    this.shapeElements[i].addClass('highlighted');
                } else {
                    this.shapeElements[i].removeClass('highlighted');
                }
            });
        } else {
            console.error('Error: enableShapes is not an array or is undefined');
        }

        // update display
        this.displayResult();
        this.updateSavedAnnealHighlight();
        // notify ui update manager
        appEvents.emit('stateChanged');
    }

    updateSavedAnnealHighlight() {
        for (let i = 0; i < this.savedAnnealElements.length; i++) {
            if (appState.currentAnneal === appState.savedAnneals[i]) {
                this.savedAnnealElements[i].addClass('highlighted');
            } else {
                this.savedAnnealElements[i].removeClass('highlighted');
            }
        }
    }
}

// only export the class when in a Node.js environment (e.g., during Jest tests)
// ignored when the app is running in the browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DesignUI;
}