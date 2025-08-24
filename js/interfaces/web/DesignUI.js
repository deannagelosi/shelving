class DesignUI {
    constructor() {
        //== state variables
        this.savedAnnealElements = [];

        // Debug flag for bent wall testing - set to true to use golden path test data
        this.useGoldenPathDebugData = false;
        // dom elements
        this.html = {};
        this.shapeElements = [];
        this.shapesDisabled = false;

        //== renderer instances
        this.solutionRenderer = new SolutionRenderer();
        this.cellularRenderer = new CellularRenderer();
        this.bendWallRenderer = new BendWallRenderer();
        this.cubbyRenderer = new CubbyRenderer();
        this.goldenPathData = null;

        //== web worker setup
        this.solutionWorker = null;
        this.initializeWorker();

        //== initialize UI elements
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

        // listen for fabrication type changes to update UI
        appEvents.on('fabricationTypeChanged', ({ fabricationType }) => {
            this.updateFabricationTypeUI(fabricationType);
        });

        // listen for cubby mode changes to update UI
        appEvents.on('cubbyModeChanged', ({ cubbyMode }) => {
            this.updateCubbyModeUI(cubbyMode);
        });

        //== movement debouncing
        this.moveDebounceTimer = null;
        this.moveDebounceDelay = 150; // milliseconds

        // this.loadGoldenPath();
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
        }

        // re-enable shape selection
        this.shapesDisabled = false;
        // Ensure shapes list exists before trying to enable it
        if (this.shapeElements.length === 0) {
            this.updateShapesList();
        }
        this.shapeElements.forEach(element => {
            element.removeClass('disabled');
        });

        // Note: Perimeter and aspect ratio controls remain locked until 'Clear' is clicked
    }

    //== helper methods

    //== show/hide methods
    // manage visibility and screen-specific setup
    show() {
        // show all design screen elements
        Object.values(this.html).forEach(element => element.removeClass('hidden'));

        // keep restore button hidden by default (only show when manual edits are made)
        this.hideRestoreButton();

        // reset the canvas
        clear();
        background(255);

        // Sync UI with appState (single source of truth)
        if (this.html.fabricationTypeSelect) {
            const fabricationType = appState.generationConfig.fabricationType;
            console.log(`[DesignUI.show] Setting dropdown to appState value: ${fabricationType}`);
            
            // Force update using both p5 method and direct DOM access
            this.html.fabricationTypeSelect.selected(fabricationType);
            
            // Double-check and force if needed using underlying element
            if (this.html.fabricationTypeSelect.value() !== fabricationType) {
                console.log(`[DesignUI.show] Dropdown didn't update, forcing via DOM`);
                this.html.fabricationTypeSelect.elt.value = fabricationType;
            }
            
            // Update UI visibility to match current fabrication type
            this.updateFabricationTypeUI(fabricationType);
        }

        // start with all shapes enabled in the select list
        appState.shapes.forEach((shape, index) => {
            appState.shapes[index].enabled = true;
        });


        // Initialize the sidebars to ensure all DOM elements exist before use.
        this.createShapeList();
        this.initializeResultsPanel();

        // Draw current state - either blank grid or current solution
        if (appState.currentViewedAnnealIndex !== null && appState.currentAnneal) {
            this.displayResult();
        } else {
            this.drawBlankGrid();
        }
    }

    hide() {
        // hide all design screen elements
        Object.values(this.html).forEach(element => element.addClass('hidden'));
    }

    update() {
        // update button states based on current appState
        const state = this.computeState();
        updateButton(this.html.nextButton, state.canNext);

        // Update save button in Results panel
        updateButton(this.html.saveButton, state.canSave);

        // update dynamic lists
        this.updateShapesList();
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
        const config = this.solutionRenderer.calculateLayoutProperties(solution, canvasWidth, canvasHeight);

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
            bendRadius: currentSolution.bendRadius,
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
            appState.display.detailView = true;
        } else {
            toggle.value(0);
            appState.display.detailView = false;
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

        // Disable perimeter controls during generation
        if (this.html.usePerimeterCheckbox) {
            this.html.usePerimeterCheckbox.attribute('disabled', true);
        }
        if (this.html.perimeterWidthInput) {
            this.html.perimeterWidthInput.attribute('disabled', '');
        }
        if (this.html.perimeterHeightInput) {
            this.html.perimeterHeightInput.attribute('disabled', '');
        }

        // Disable aspect ratio controls during generation
        this.html.tallButton.addClass('disabled');
        this.html.squareButton.addClass('disabled');
        this.html.wideButton.addClass('disabled');

        // disable shape selection changes while annealing
        this.shapesDisabled = true;
        // Ensure shapes list exists before trying to disable it
        if (this.shapeElements.length === 0) {
            this.updateShapesList();
        }
        this.shapeElements.forEach(element => {
            element.addClass('disabled');
        });
        // unselect solutions from list
        this.viewSavedAnneal(null);

        //== start the annealing process
        this.html.saveButton.attribute('disabled', '');

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

            // get fabrication and wall generation parameters from UI to appState
            const fabricationType = this.html.fabricationTypeSelect ? this.html.fabricationTypeSelect.value() : 'boards';
            const wallAlgorithm = this.html.wallAlgorithmSelect ? this.html.wallAlgorithmSelect.value() : 'cellular';

            appState.setFabricationType(fabricationType);
            
            if (fabricationType === 'boards' || fabricationType === 'cubbies') {
                appState.generationConfig.wallAlgorithm = wallAlgorithm === 'cellular' ? 'cellular-organic' : 'cellular-rectilinear';
            } else {
                appState.generationConfig.wallAlgorithm = 'bend';
            }

            // Update curve radius for cubbies
            if (fabricationType === 'cubbies' && this.html.cubbyCurveRadiusInput) {
                appState.generationConfig.cubbyCurveRadius = parseFloat(this.html.cubbyCurveRadiusInput.value());
            }

            // Update bend parameters if they exist
            if (this.html.bendRadiusInput) {
                appState.generationConfig.bendRadius = parseFloat(this.html.bendRadiusInput.value());
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
                    // Fabrication and Walls
                    fabricationType: appState.generationConfig.fabricationType,
                    wallAlgorithm: appState.generationConfig.wallAlgorithm,
                    cubbyCurveRadius: appState.generationConfig.cubbyCurveRadius,
                    wallBendRadius: appState.generationConfig.bendRadius,
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
            // Note: Generation config is stored in the Solution object itself
        };
        appState.savedAnneals.push(savedData);

        this.viewSavedAnneal(appState.savedAnneals.length - 1);

        // notify ui update manager
        appEvents.emit('stateChanged');
    }
    //== end button handlers

    drawBlankGrid() {
        // reset ui to cleared initial state
        // clear current selection
        appState.currentViewedAnnealIndex = null;
        appState.currentAnneal = null;

        // Re-enable perimeter controls
        if (this.html.usePerimeterCheckbox) {
            this.html.usePerimeterCheckbox.removeAttribute('disabled');
        }
        if (this.html.perimeterWidthInput) {
            this.html.perimeterWidthInput.removeAttribute('disabled');
        }
        if (this.html.perimeterHeightInput) {
            this.html.perimeterHeightInput.removeAttribute('disabled');
        }

        // Re-enable aspect ratio controls
        this.html.tallButton.removeClass('disabled');
        this.html.squareButton.removeClass('disabled');
        this.html.wideButton.removeClass('disabled');

        // enable shape selection
        this.shapesDisabled = false;
        // Ensure shapes list exists before trying to enable it
        if (this.shapeElements.length === 0) {
            this.updateShapesList();
        }
        this.shapeElements.forEach(element => {
            element.removeClass('disabled');
        });


        // use renderer to display blank grid
        let canvas = { height: canvasHeight, width: canvasWidth };
        let layoutProps = this.solutionRenderer.calculateLayoutProperties(null, canvasWidth, canvasHeight); // null will return default values
        this.solutionRenderer.renderBlankGrid(canvas, layoutProps, 20);

        // notify ui update manager
        appEvents.emit('stateChanged');
    }

    updateDisplayCallback(_solution) {
        // receives a solution from the web worker and updates the display
        let layoutProps = this.solutionRenderer.calculateLayoutProperties(_solution, canvasWidth, canvasHeight);
        let canvas = { height: canvasHeight, width: canvasWidth };
        let perimeterConfig = {
            useCustomPerimeter: appState.generationConfig.useCustomPerimeter,
            perimeterWidth: appState.generationConfig.perimeterWidth,
            perimeterHeight: appState.generationConfig.perimeterHeight
        };

        // use renderer to display the solution with perimeter handling
        this.solutionRenderer.renderSolutionProgress(_solution, canvas, layoutProps, perimeterConfig, true);
    }

    displayResult() {
        // show shapes and grid but not annealing scores
        if (appState.currentAnneal && appState.currentAnneal.finalSolution) {
            let solution = appState.currentAnneal.finalSolution;
            let layoutProps = this.solutionRenderer.calculateLayoutProperties(solution, canvasWidth, canvasHeight);
            let canvas = { height: canvasHeight, width: canvasWidth };

            let perimeterConfig = {
                useCustomPerimeter: appState.generationConfig.useCustomPerimeter,
                perimeterWidth: appState.generationConfig.perimeterWidth,
                perimeterHeight: appState.generationConfig.perimeterHeight
            };

            let wallRenderers = {
                bendWallRenderer: this.bendWallRenderer,
                cellularRenderer: this.cellularRenderer,
                cubbyRenderer: this.cubbyRenderer
            };

            let wallRenderData = {
                currCellular: appState.currentAnneal.cellular ? Cellular.fromDataObject(appState.currentAnneal.cellular, solution) : appState.currCellular,
                goldenPathData: this.goldenPathData,
                useGoldenPathDebugData: this.useGoldenPathDebugData
            };

            // Use renderer to display complete solution with walls
            const updatedCellular = this.solutionRenderer.renderCompleteSolution(
                solution, canvas, layoutProps, perimeterConfig, wallRenderers, wallRenderData
            );

            // updates app state when cellular data is generated
            if (updatedCellular) {
                appState.currCellular = updatedCellular;

                // Store cellular data in appState if it's a saved anneal
                if (appState.savedAnneals.includes(appState.currentAnneal)) {
                    appState.currentAnneal.cellular = {
                        cellSpace: updatedCellular.cellSpace,
                        maxTerrain: updatedCellular.maxTerrain,
                        numAlive: updatedCellular.numAlive
                    };
                }
            }
        }
    }

    createShapeList() {
        // create list of shapes to select from
        if (!htmlRefs.left) return;
        if (appState.currentScreen !== ScreenState.DESIGN) return;

        // Always recreate the sidebar structure to ensure a clean state.
        this.initializeLeftSidebar();

        // Always update the shapes list
        this.updateShapesList();
    }

    initializeLeftSidebar() {
        // Clear the sidebar and set up flexbox layout (same pattern as right sidebar)
        htmlRefs.left.list.html('');
        this.shapeElements = [];

        // Set up flexbox layout for the left sidebar - inherits from .sidebar-list base styles
        htmlRefs.left.list.addClass('sidebar-with-controls');

        // Create a fixed controls container for perimeter settings
        this.html.leftControlsContainer = createDiv()
            .addClass('sidebar-controls')
            .parent(htmlRefs.left.list);

        // Create the aspect ratio controls and perimeter controls in the fixed container
        this.createAspectRatioControls();
        this.createPerimeterControls();

        // Create scrollable container for shapes
        this.html.leftScrollContainer = createDiv()
            .addClass('sidebar-scroll')
            .parent(htmlRefs.left.list);
    }

    updateShapesList() {
        // Update only the shapes list without recreating controls
        if (!htmlRefs.left) return;
        if (appState.currentScreen !== ScreenState.DESIGN) return;
        if (!this.html.leftScrollContainer) return;

        // Clear the scroll container
        this.html.leftScrollContainer.html('');

        // Add the shapes label
        createSpan('Shapes')
            .addClass('settings-label')
            .style('padding', '0 10px')
            .parent(this.html.leftScrollContainer);

        // Create the shapes container
        this.html.shapesContainer = createDiv()
            .addClass('shapes-container')
            .style('padding', '0 10px')
            .parent(this.html.leftScrollContainer);

        this.shapeElements = [];

        // Create the shapes list
        appState.shapes.forEach((shape, index) => {
            let shapeItem = createDiv()
                .parent(this.html.shapesContainer)
                .addClass(shape.enabled ? 'shape-item highlighted' : 'shape-item')
                .mousePressed(() => this.toggleShapeSelection(index));

            createSpan(shape.data.title)
                .addClass('shape-title')
                .parent(shapeItem);

            this.shapeElements.push(shapeItem);
        });

        // Preserve disabled state if shapes should be disabled
        if (this.shapesDisabled) {
            this.shapeElements.forEach(element => {
                element.addClass('disabled');
            });
        }
    }

    createAspectRatioControls() {
        // Target Aspect Ratio section
        const aspectRatioGroup = createDiv()
            .addClass('settings-group')
            .parent(this.html.leftControlsContainer);

        createSpan('Target Aspect Ratio')
            .addClass('settings-label')
            .parent(aspectRatioGroup);

        // Orientation buttons container
        this.html.orientationButtons = createDiv()
            .addClass('orientation-buttons')
            .parent(aspectRatioGroup);

        this.html.tallButton = createDiv()
            .addClass('orientation-button tall')
            .parent(this.html.orientationButtons)
            .mousePressed(() => this.handleAspectRatioChange(-1));

        this.html.squareButton = createDiv()
            .addClass('orientation-button square')
            .parent(this.html.orientationButtons)
            .mousePressed(() => this.handleAspectRatioChange(0));

        this.html.wideButton = createDiv()
            .addClass('orientation-button wide')
            .parent(this.html.orientationButtons)
            .mousePressed(() => this.handleAspectRatioChange(1));

        // Initialize selected state based on appState
        this.handleAspectRatioChange(appState.generationConfig.aspectRatioPref);
    }

    createPerimeterControls() {
        // Custom Perimeter section using clean, semantic CSS classes
        const perimeterGroup = createDiv()
            .addClass('settings-group')
            .parent(this.html.leftControlsContainer);

        createSpan('Custom Perimeter')
            .addClass('settings-label')
            .parent(perimeterGroup);

        // Checkbox for enabling/disabling
        const checkboxContainer = createDiv()
            .addClass('checkbox-group')
            .parent(perimeterGroup);

        this.html.usePerimeterCheckbox = createCheckbox(' Use Custom Perimeter', appState.generationConfig.useCustomPerimeter)
            .parent(checkboxContainer)
            .changed(() => { this.togglePerimeterInputs() });

        // Ensure checkbox state is always synchronized with appState
        this.html.usePerimeterCheckbox.checked(appState.generationConfig.useCustomPerimeter);

        // Container for the width/height inputs (initially hidden)
        this.html.perimeterInputsContainer = createDiv()
            .addClass(appState.generationConfig.useCustomPerimeter ? '' : 'hidden')
            .parent(perimeterGroup);

        // Two-column container for width and height
        const dimensionsRow = createDiv()
            .addClass('dimensions-row')
            .parent(this.html.perimeterInputsContainer);

        // Width input column
        const widthColumn = createDiv()
            .addClass('dimension-column')
            .parent(dimensionsRow);
        createSpan('Target Width')
            .addClass('dimension-label')
            .parent(widthColumn);
        this.html.perimeterWidthInput = createInput(appState.generationConfig.perimeterWidth.toString(), 'number')
            .addClass('dimension-input')
            .parent(widthColumn)
            .attribute('min', '1')
            .changed(() => this.updatePerimeterWidth());

        // Height input column
        const heightColumn = createDiv()
            .addClass('dimension-column')
            .parent(dimensionsRow);
        createSpan('Target Height')
            .addClass('dimension-label')
            .parent(heightColumn);
        this.html.perimeterHeightInput = createInput(appState.generationConfig.perimeterHeight.toString(), 'number')
            .addClass('dimension-input')
            .parent(heightColumn)
            .attribute('min', '1')
            .changed(() => this.updatePerimeterHeight());
    }

    togglePerimeterInputs() {
        // Don't allow changes if the checkbox is disabled
        if (this.html.usePerimeterCheckbox.attribute('disabled')) {
            // Reset checkbox to its previous state
            this.html.usePerimeterCheckbox.checked(appState.generationConfig.useCustomPerimeter);
            return;
        }

        appState.generationConfig.useCustomPerimeter = this.html.usePerimeterCheckbox.checked();
        if (appState.generationConfig.useCustomPerimeter) {
            this.html.perimeterInputsContainer.removeClass('hidden');
        } else {
            this.html.perimeterInputsContainer.addClass('hidden');
        }
    }

    updatePerimeterWidth() {
        const value = parseInt(this.html.perimeterWidthInput.value());
        if (!isNaN(value) && value >= 1) {
            appState.generationConfig.perimeterWidth = value;
        }
    }

    updatePerimeterHeight() {
        const value = parseInt(this.html.perimeterHeightInput.value());
        if (!isNaN(value) && value >= 1) {
            appState.generationConfig.perimeterHeight = value;
        }
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

        // Set up flexbox layout for the results panel - inherits from .sidebar-list base styles
        htmlRefs.right.list.addClass('sidebar-with-controls');

        // Create a fixed controls container
        this.html.controlsContainer = createDiv()
            .addClass('sidebar-controls')
            .parent(htmlRefs.right.list);

        // create detail toggle and wall generation controls in the fixed container
        this.createDetailToggleControls();
        this.createWallGenerationControls();

        // Create scrollable container for solutions
        this.html.scrollContainer = createDiv()
            .addClass('sidebar-scroll')
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
            .addClass('settings-label')
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
                            // displays blank grid when currently viewed anneal is deleted
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

    createDetailToggleControls() {
        // Detail View Toggle section
        const detailToggleGroup = createDiv()
            .addClass('settings-group')
            .parent(this.html.controlsContainer);

        // slider toggle
        this.html.sliderDiv = createDiv()
            .id('slider-div')
            .parent(detailToggleGroup)
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
    }

    createWallGenerationControls() {
        // create fabrication type controls in the Results panel

        // Master fabrication type dropdown
        const modeGroup = createDiv()
            .addClass('settings-group')
            .parent(this.html.controlsContainer);
        createSpan('Fabrication Type')
            .addClass('settings-label')
            .parent(modeGroup);

        this.html.fabricationTypeSelect = createSelect()
            .addClass('settings-select')
            .parent(modeGroup)
            .changed(() => this.handleFabricationTypeChange());
        this.html.fabricationTypeSelect.option('Boards (Laser Cut)', 'boards');
        this.html.fabricationTypeSelect.option('Cubbies (3D Print)', 'cubbies');
        this.html.fabricationTypeSelect.option('Bent Wall', 'bent');
        // Set to appState value or default to ensure it has a valid value
        this.html.fabricationTypeSelect.selected(appState.generationConfig.fabricationType || 'boards');
        
        // Cubby Mode selection (only shown for cubbies fabrication type)
        this.html.cubbyModeGroup = createDiv()
            .addClass('settings-group cubby-mode-group')
            .parent(this.html.controlsContainer);
        createSpan('Cubby Mode')
            .addClass('settings-label')
            .parent(this.html.cubbyModeGroup);
        this.html.cubbyModeSelect = createSelect()
            .addClass('settings-select')
            .parent(this.html.cubbyModeGroup)
            .changed(() => this.handleCubbyModeChange());
        this.html.cubbyModeSelect.option('One (Merge)', 'one');
        this.html.cubbyModeSelect.option('Many (Individual)', 'many');
        // Set to appState value or default
        this.html.cubbyModeSelect.selected(appState.generationConfig.cubbyMode || 'one');

        // Wall Algorithm sub-options (for Boards and Cubbies)
        this.html.algorithmGroup = createDiv()
            .addClass('settings-group')
            .parent(this.html.controlsContainer);
        createSpan('Wall Algorithm')
            .addClass('settings-label')
            .parent(this.html.algorithmGroup);

        this.html.wallAlgorithmSelect = createSelect()
            .addClass('settings-select')
            .parent(this.html.algorithmGroup)
            .changed(() => this.handleWallAlgorithmChange());
        this.html.wallAlgorithmSelect.option('Cellular (Organic)', 'cellular');
        this.html.wallAlgorithmSelect.option('Rectilinear (Grid)', 'rectilinear');
        this.html.wallAlgorithmSelect.selected('cellular'); // Default to cellular

        // Corner Radius for Cubbies
        this.html.cubbyGroup = createDiv()
            .addClass('settings-group hidden') // Start hidden
            .parent(this.html.controlsContainer);
        const cubbyCurveRadiusWrapper = createDiv()
            .addClass('settings-group')
            .parent(this.html.cubbyGroup);
        createSpan('Curve Radius')
            .addClass('settings-label')
            .parent(cubbyCurveRadiusWrapper);
        this.html.cubbyCurveRadiusInput = createInput(appState.generationConfig.cubbyCurveRadius.toString(), 'number')
            .addClass('settings-input')
            .parent(cubbyCurveRadiusWrapper)
            .attribute('min', '0')
            .attribute('max', '1.0')
            .attribute('step', '0.1')
            .input(() => this.handleCubbyCurveRadiusChange());

        // Curve sub-options
        this.html.curveGroup = createDiv()
            .addClass('settings-group hidden') // Start hidden
            .parent(this.html.controlsContainer);

        // Wrapper for Radius
        const radiusWrapper = createDiv()
            .addClass('settings-group')
            .parent(this.html.curveGroup);
        createSpan('Curve Radius (inches)')
            .addClass('settings-label')
            .parent(radiusWrapper);
        this.html.curveRadiusInput = createInput('1.0', 'number')
            .addClass('settings-input')
            .parent(radiusWrapper)
            .attribute('min', '0.1')
            .attribute('max', '10.0')
            .attribute('step', '0.1')
            .input(() => this.handleBendParameterChange());

        // Wrapper for Bends
        const bendsWrapper = createDiv()
            .addClass('settings-group')
            .parent(this.html.curveGroup);
        createSpan('Max Sequential Bends')
            .addClass('settings-label')
            .parent(bendsWrapper);
        this.html.maxBendsInput = createInput('4', 'number')
            .addClass('settings-input')
            .parent(bendsWrapper)
            .attribute('min', '2')
            .attribute('max', '10')
            .attribute('step', '1')
            .input(() => this.handleBendParameterChange());

        // Save button in Results panel
        this.html.saveButton = createButton('Save')
            .addClass('primary-button button settings-button')
            .parent(this.html.controlsContainer)
            .attribute('disabled', '') // until annealing is complete
            .mousePressed(() => this.handleSaveSolution());

        // No separator needed since we have separate containers now
    }

    handleFabricationTypeChange() {
        const selectedType = this.html.fabricationTypeSelect.value();

        // Update appState using centralized method
        appState.setFabricationType(selectedType);

        // If there's a current solution, update its fabrication type
        if (appState.currentAnneal && appState.currentAnneal.finalSolution) {
            const solution = appState.currentAnneal.finalSolution;
            solution.fabricationType = selectedType;
            
            if (selectedType === 'boards' || selectedType === 'cubbies') {
                const algorithm = this.html.wallAlgorithmSelect.value();
                solution.wallAlgorithm = algorithm === 'cellular' ? 'cellular-organic' : 'cellular-rectilinear';
            } else {
                solution.wallAlgorithm = 'bend';
            }
            
            if (selectedType === 'cubbies') {
                appState.generationConfig.cubbyCurveRadius = parseFloat(this.html.cubbyCurveRadiusInput.value());
            }
            
            this.displayResult(); // Redraw with the new fabrication type
        }
    }

    handleCubbyModeChange() {
        const selectedMode = this.html.cubbyModeSelect.value();
        
        // Update appState using centralized method
        appState.setCubbyMode(selectedMode);
        
        // If there's a current solution and it's cubbies type, regenerate
        if (appState.currentAnneal && appState.currentAnneal.finalSolution && 
            appState.generationConfig.fabricationType === 'cubbies') {
            this.displayResult();
        }
    }

    updateFabricationTypeUI(fabricationType) {
        // Update dropdown to match state (in case changed from elsewhere)
        if (this.html.fabricationTypeSelect) {
            this.html.fabricationTypeSelect.selected(fabricationType);
            
            // Force update if p5.js didn't update properly
            if (this.html.fabricationTypeSelect.value() !== fabricationType) {
                this.html.fabricationTypeSelect.elt.value = fabricationType;
            }
        }

        // Show/hide appropriate sub-options based on fabrication type
        if (fabricationType === 'boards' || fabricationType === 'cubbies') {
            this.html.algorithmGroup.removeClass('hidden');
            this.html.curveGroup.addClass('hidden');
            
            // Show corner radius and mode only for cubbies
            if (fabricationType === 'cubbies') {
                this.html.cubbyGroup.removeClass('hidden');
                this.html.cubbyModeGroup.removeClass('hidden');
            } else {
                this.html.cubbyGroup.addClass('hidden');
                this.html.cubbyModeGroup.addClass('hidden');
            }
        } else if (fabricationType === 'bent') {
            this.html.algorithmGroup.addClass('hidden');
            this.html.cubbyGroup.addClass('hidden');
            this.html.cubbyModeGroup.addClass('hidden');
            this.html.curveGroup.removeClass('hidden');
        }
    }

    updateCubbyModeUI(cubbyMode) {
        // Update dropdown to match state (in case changed from elsewhere)
        if (this.html.cubbyModeSelect) {
            this.html.cubbyModeSelect.selected(cubbyMode);
            
            // Force update if p5.js didn't update properly
            if (this.html.cubbyModeSelect.value() !== cubbyMode) {
                this.html.cubbyModeSelect.elt.value = cubbyMode;
            }
        }
    }

    handleBendParameterChange() {
        // Only regenerate if we have a current solution
        if (!appState.currentAnneal || !appState.currentAnneal.finalSolution) {
            return;
        }

        const solution = appState.currentAnneal.finalSolution;

        // Update solution with new values from UI
        solution.bendRadius = parseFloat(this.html.bendRadiusInput.value());
        solution.maxBends = parseInt(this.html.maxBendsInput.value());

        // Redraw the canvas with new walls without triggering a full UI update
        this.displayResult();
    }

    handleWallAlgorithmChange() {
        // Only regenerate if we have a current solution
        if (!appState.currentAnneal || !appState.currentAnneal.finalSolution) {
            return;
        }

        console.log('[UI] Wall algorithm changed');

        const solution = appState.currentAnneal.finalSolution;
        const selectedAlgorithm = this.html.wallAlgorithmSelect.value();
        const fabricationType = this.html.fabricationTypeSelect.value();

        // Update the wall algorithm
        solution.wallAlgorithm = selectedAlgorithm === 'cellular' ? 'cellular-organic' : 'cellular-rectilinear';
        solution.fabricationType = fabricationType;

        // Create new cellular instance with the selected algorithm
        const cellular = new Cellular(solution, false, 1);

        // Run appropriate growth algorithm
        console.log(`Regenerating walls with ${selectedAlgorithm} algorithm`);

        if (selectedAlgorithm === 'cellular') {
            cellular.growCells();
        } else {
            cellular.growRectilinear();
        }

        // Update the stored cellular data
        appState.currentAnneal.cellular = {
            cellSpace: cellular.cellSpace,
            maxTerrain: cellular.maxTerrain,
            numAlive: cellular.numAlive || 0
        };
        appState.currCellular = cellular;

        // Redraw with new cellular walls
        this.displayResult();
    }

    handleCubbyCurveRadiusChange() {
        // Only update if we have a current solution and are in cubbies mode
        if (!appState.currentAnneal || !appState.currentAnneal.finalSolution) {
            return;
        }

        const fabricationType = this.html.fabricationTypeSelect.value();
        if (fabricationType !== 'cubbies') {
            return;
        }

        const newCurveRadius = parseFloat(this.html.cubbyCurveRadiusInput.value());
        appState.generationConfig.cubbyCurveRadius = newCurveRadius;

        console.log(`[UI] Cubby curve radius changed to: ${newCurveRadius}`);

        // Redraw with new curve radius
        this.displayResult();
    }

    handleCellularAlgorithmChange() {
        // Delegate to the wall algorithm handler
        this.handleWallAlgorithmChange();
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

        // update fabrication UI to match loaded solution
        const solution = appState.currentAnneal.finalSolution;
        
        // Ensure solution has fabricationType set
        if (!solution.fabricationType) {
            // Infer from wall algorithm for old saves
            if (solution.wallAlgorithm === 'bend') {
                solution.fabricationType = 'bent';
            } else {
                solution.fabricationType = 'boards'; // default for old cellular saves
            }
        }
        
        if (this.html.fabricationTypeSelect) {
            // Use centralized method to update appState and trigger events
            // This will set appState.generationConfig.fabricationType and emit the event
            appState.loadSolutionConfig(solution);
            
            // Set solution-specific UI values (the general UI visibility is handled by the event)
            if (solution.fabricationType === 'boards' || solution.fabricationType === 'cubbies') {
                // Set wall algorithm from solution
                if (this.html.wallAlgorithmSelect && solution.wallAlgorithm) {
                    const isRectilinear = solution.wallAlgorithm.includes('rectilinear');
                    this.html.wallAlgorithmSelect.selected(isRectilinear ? 'rectilinear' : 'cellular');
                }
                
                // Set curve radius for cubbies
                if (solution.fabricationType === 'cubbies' && this.html.cubbyCurveRadiusInput) {
                    this.html.cubbyCurveRadiusInput.value(appState.generationConfig.cubbyCurveRadius.toString());
                }
            }
        }

        // Restore generation configuration from the Solution object
        // Update aspect ratio preference and UI
        this.handleAspectRatioChange(solution.aspectRatioPref);

        // Update perimeter settings in appState (but UI will show locked values)
        appState.generationConfig.useCustomPerimeter = solution.useCustomPerimeter;
        appState.generationConfig.perimeterWidth = solution.perimeterWidth;
        appState.generationConfig.perimeterHeight = solution.perimeterHeight;

        // Update perimeter UI to show the saved values (but keep them disabled)
        if (this.html.usePerimeterCheckbox) {
            this.html.usePerimeterCheckbox.checked(solution.useCustomPerimeter);
        }
        if (this.html.perimeterWidthInput) {
            this.html.perimeterWidthInput.value(solution.perimeterWidth.toString());
        }
        if (this.html.perimeterHeightInput) {
            this.html.perimeterHeightInput.value(solution.perimeterHeight.toString());
        }

        // Disable generation controls while viewing saved anneal
        if (this.html.usePerimeterCheckbox) {
            this.html.usePerimeterCheckbox.attribute('disabled', true);
        }
        if (this.html.perimeterWidthInput) {
            this.html.perimeterWidthInput.attribute('disabled', '');
        }
        if (this.html.perimeterHeightInput) {
            this.html.perimeterHeightInput.attribute('disabled', '');
        }
        this.html.tallButton.addClass('disabled');
        this.html.squareButton.addClass('disabled');
        this.html.wideButton.addClass('disabled');

        // disable shape selection changes while viewing saved anneal
        this.shapesDisabled = true;
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
            if (i === appState.currentViewedAnnealIndex) {
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