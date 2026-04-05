class DesignUI {
    constructor() {
        //== state variables
        this.savedAnnealElements = [];

        // dom elements
        this.html = {};
        this.shapeElements = [];

        //== renderer instances
        this.solutionRenderer = new SolutionRenderer();
        this.shapeRenderer = new ShapeRenderer();
        this.cellularRenderer = new CellularRenderer();

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

        // listen for shape preview changes
        appEvents.on('shapePreviewChanged', () => {
            this.updateShapePreview();
        });

        // Central settings change handler - simple switch for all reactions
        appEvents.on('settingsChanged', ({ setting, value }) => {
            switch (setting) {
                // Shape processing settings that require regeneration
                case 'customBufferSize':
                case 'minWallLength':
                    this.regenerateShapesWithNewSettings();
                    break;

                // Settings that don't need additional reactions (yet)
                case 'aspectRatioPref':
                case 'useCustomPerimeter':
                case 'perimeterWidthInches':
                case 'perimeterHeightInches':
                    break;

                default:
                    console.log(`[DesignUI] Unhandled setting change: ${setting} = ${value}`);
                    break;
            }
        });

        //== movement debouncing
        this.moveDebounceTimer = null;
        this.moveDebounceDelay = 150; // milliseconds

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
                            perimeterWidthInches: visualData.perimeterWidthInches,
                            perimeterHeightInches: visualData.perimeterHeightInches,
                            goalPerimeterGrid: visualData.goalPerimeterGrid,
                            minWallLength: visualData.minWallLength
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
        appState.display.shapesDisabled = false;
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

        // refresh shape preview if active (detail toggle auto-refresh)
        if (appState.display.previewMode && this.displayShapePreview) {
            this.displayShapePreview();
        }
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

        // Check each shape using shape and buffer click detection
        for (let i = 0; i < solution.shapes.length; i++) {
            const shape = solution.shapes[i];

            // use ShapeRenderer's pixel hit detection
            if (this.solutionRenderer.shapeRenderer.isPointOnShape(shape, mouseX, mouseY, canvas, config)) {
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
            perimeterWidthInches: appState.generationConfig.perimeterWidthInches,
            perimeterHeightInches: appState.generationConfig.perimeterHeightInches
        };
        const wallConfig = {
            algorithm: 'cellular-organic'
        };
        const bufferConfig = {
            customBufferSize: currentSolution.customBufferSize,
            centerShape: currentSolution.centerShape,
            minWallLength: currentSolution.minWallLength
        };

        const newSolution = new Solution(shapesCopy, currentSolution.startID, layoutConfig, wallConfig, bufferConfig);

        // Find the selected shape in the new solution
        const newSelectedShape = newSolution.shapes.find(shape => shape.id === appState.selectedShapeId);

        // Update position based on direction (1 unit = 1 grid square)
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
        // emit state change event to refresh shape preview if active
        appEvents.emit('stateChanged');
    }

    async handleStartAnneal() {
        // Start with clean slate (clears preview, solution, and resets UI)
        this.drawBlankGrid();

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
        appState.display.shapesDisabled = true;
        // Ensure shapes list exists before trying to disable it
        if (this.shapeElements.length === 0) {
            this.updateShapesList();
        }
        this.shapeElements.forEach(element => {
            element.addClass('disabled');
        });

        //== start the annealing process
        this.html.saveButton.attribute('disabled', '');

        // check if each shape has all it's grid data
        const config = {
            customBufferSize: appState.generationConfig.customBufferSize,
            centerShape: appState.generationConfig.centerShape,
            minWallLength: appState.generationConfig.minWallLength
        };

        for (let shape of appState.shapes) {
            if (!shape.data.lowResShape || !shape.data.bufferShape) {
                // if missing, generate it
                shape.saveUserInput(shape.data.title, shape.data.highResShape, config);
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

            // appState.generationConfig is kept current by reactive form handlers
            // no need to read from DOM - all form changes immediately sync to appState

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
                    perimeterWidthInches: appState.generationConfig.perimeterWidthInches,
                    perimeterHeightInches: appState.generationConfig.perimeterHeightInches,
                    // Buffer Configuration
                    customBufferSize: appState.generationConfig.customBufferSize,
                    centerShape: appState.generationConfig.centerShape,
                    minWallLength: appState.generationConfig.minWallLength
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
            enabledShapes: appState.shapes.map(shape => shape.enabled),
            // Preserve fabrication context for this solution
            fabricationContext: {
                bufferSettings: {
                    customBufferSize: appState.generationConfig.customBufferSize,
                    centerShape: appState.generationConfig.centerShape,
                    minWallLength: appState.generationConfig.minWallLength
                },
                materialType: appState.generationConfig.materialType
            }
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
        // clear shape preview state
        appState.clearShapePreview();

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
        appState.display.shapesDisabled = false;
        // Ensure shapes list exists before trying to enable it
        if (this.shapeElements.length === 0) {
            this.updateShapesList();
        }
        this.shapeElements.forEach(element => {
            element.removeClass('disabled');
        });


        // use renderer to display blank grid
        const config = this.getRenderConfig(); // null is default for solution parameter
        this.solutionRenderer.renderBlankGrid(config, 20);

        // notify ui update manager
        appEvents.emit('stateChanged');
    }

    getRenderConfig(solution = null) {
        // centralized configuration for all rendering methods - flat structure
        const layoutProps = this.solutionRenderer.calculateLayoutProperties(solution, canvasWidth, canvasHeight);
        return {
            // Canvas dimensions
            canvasWidth: canvasWidth,
            canvasHeight: canvasHeight,

            // Layout properties (flattened from layoutProps)
            squareSize: layoutProps.squareSize,
            buffer: layoutProps.buffer,
            xPadding: layoutProps.xPadding,
            yPadding: layoutProps.yPadding,
            layoutHeight: layoutProps.layoutHeight,
            layoutWidth: layoutProps.layoutWidth,

            // Perimeter configuration (flattened from perimeterConfig)
            useCustomPerimeter: appState.generationConfig.useCustomPerimeter,
            perimeterWidthInches: appState.generationConfig.perimeterWidthInches,
            perimeterHeightInches: appState.generationConfig.perimeterHeightInches
        };
    }

    updateDisplayCallback(_solution) {
        // receives a solution from the web worker and updates the display
        const config = this.getRenderConfig(_solution);

        // use unified renderer to display the solution with scores for annealing progress
        this.solutionRenderer.renderSolution(_solution, config, true);
    }

    displayResult() {
        // show shapes and grid but not annealing scores
        if (appState.currentAnneal && appState.currentAnneal.finalSolution) {
            let solution = appState.currentAnneal.finalSolution;
            const config = this.getRenderConfig(solution);

            let wallRenderers = {
                cellularRenderer: this.cellularRenderer
            };

            let wallRenderData = {
                currCellular: appState.currentAnneal.cellular ? Cellular.fromDataObject(appState.currentAnneal.cellular, solution) : appState.currCellular
            };

            // Use unified renderer to display solution layout (without scores)
            this.solutionRenderer.renderSolution(solution, config, false);

            // Render walls
            const updatedCellular = this.solutionRenderer.renderWalls(
                solution, config, wallRenderers, wallRenderData
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

        // Create pre-anneal settings controls
        this.createAspectRatioControls();
        this.createPerimeterControls();
        this.createShapeProcessingControls();

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

            // Add eyeball preview icon
            let previewIcon = createImg('img/view.svg', 'Preview shape')
                .addClass('shape-preview-icon')
                .size(16, 16)
                .parent(shapeItem)
                .style('margin-left', 'auto')
                .style('padding', '0 5px')
                .style('cursor', 'pointer')
                .style('user-select', 'none')
                .mousePressed((event) => {
                    event.stopPropagation(); // Prevent shape selection toggle
                    this.previewShape(shape.id);
                });

            this.shapeElements.push(shapeItem);
        });

        // Preserve disabled state if shapes should be disabled
        if (appState.display.shapesDisabled) {
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
            .changed(() => this.handleUseCustomPerimeterChange());

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
        createSpan('Target Width (in)')
            .addClass('dimension-label')
            .parent(widthColumn);
        this.html.perimeterWidthInput = createInput(appState.generationConfig.perimeterWidthInches.toString(), 'number')
            .addClass('dimension-input')
            .parent(widthColumn)
            .attribute('min', '1')
            .changed(() => this.handlePerimeterWidthChange());

        // Height input column
        const heightColumn = createDiv()
            .addClass('dimension-column')
            .parent(dimensionsRow);
        createSpan('Target Height (in)')
            .addClass('dimension-label')
            .parent(heightColumn);
        this.html.perimeterHeightInput = createInput(appState.generationConfig.perimeterHeightInches.toString(), 'number')
            .addClass('dimension-input')
            .parent(heightColumn)
            .attribute('min', '1')
            .changed(() => this.handlePerimeterHeightChange());
    }

    createShapeProcessingControls() {
        // Shape Processing Options section
        const processingGroup = createDiv()
            .addClass('settings-group')
            .parent(this.html.leftControlsContainer);

        createSpan('Shape Processing Options')
            .addClass('settings-label')
            .parent(processingGroup);

        // Custom Buffer Size input
        const bufferSizeRow = createDiv()
            .addClass('input-row')
            .parent(processingGroup);
        createSpan('Custom Buffer (in)')
            .addClass('input-label')
            .parent(bufferSizeRow);
        this.html.customBufferSizeInput = createInput(appState.generationConfig.customBufferSize.toString(), 'number')
            .addClass('number-input')
            .parent(bufferSizeRow)
            .attribute('min', '0')
            .attribute('max', '1')
            .attribute('step', '0.25')
            .changed(() => this.handleCustomBufferSizeChange());

        // Minimum Wall Length dropdown
        const wallLengthRow = createDiv()
            .addClass('input-row')
            .parent(processingGroup);
        createSpan('Minimum Wall Length (in)')
            .addClass('input-label')
            .parent(wallLengthRow);
        this.html.minWallLengthSelect = createSelect()
            .addClass('select-input')
            .parent(wallLengthRow)
            .changed(() => this.handleMinWallLengthChange());

        // Add grid square size options in ascending order
        // Values use String() output to match programmatic selected() calls
        this.html.minWallLengthSelect.option('0.25', '0.25');
        this.html.minWallLengthSelect.option('0.5', '0.5');
        this.html.minWallLengthSelect.option('1.0', '1');
        this.html.minWallLengthSelect.option('1.5', '1.5');
        this.html.minWallLengthSelect.option('2.0', '2');

        // Set initial value
        this.html.minWallLengthSelect.selected(String(appState.generationConfig.minWallLength));
    }

    updateCustomBufferSize() {
        const value = parseFloat(this.html.customBufferSizeInput.value());
        if (!isNaN(value) && value >= 0 && value <= 1) {
            appState.setCustomBufferSize(value);
        }
    }

    updateMinWallLength() {
        const gridSquareSize = parseFloat(this.html.minWallLengthSelect.selected());
        if (!isNaN(gridSquareSize)) {
            appState.setMinWallLength(gridSquareSize);
        }
    }

    // ============= Form Change Handlers (Write-Through to AppState) =============
    // These handlers are the ONLY place that reads from DOM elements
    // All other code must read from appState.generationConfig

    handleAspectRatioChange(value) {
        // Update UI buttons
        this.html.tallButton.removeClass('selected');
        this.html.squareButton.removeClass('selected');
        this.html.wideButton.removeClass('selected');

        if (value === -1) this.html.tallButton.addClass('selected');
        else if (value === 0) this.html.squareButton.addClass('selected');
        else if (value === 1) this.html.wideButton.addClass('selected');

        // Write directly to appState
        appState.generationConfig.aspectRatioPref = value;
        appEvents.emit('settingsChanged', { setting: 'aspectRatioPref', value });
    }

    handleUseCustomPerimeterChange() {
        const enabled = this.html.usePerimeterCheckbox.checked();
        appState.generationConfig.useCustomPerimeter = enabled;
        appEvents.emit('settingsChanged', { setting: 'useCustomPerimeter', value: enabled });
        this.togglePerimeterInputs(); // UI visibility update
    }

    handlePerimeterWidthChange() {
        const value = parseInt(this.html.perimeterWidthInput.value());
        if (!isNaN(value) && value >= 1) {
            appState.generationConfig.perimeterWidthInches = value;
            appEvents.emit('settingsChanged', { setting: 'perimeterWidthInches', value });
        }
    }

    handlePerimeterHeightChange() {
        const value = parseInt(this.html.perimeterHeightInput.value());
        if (!isNaN(value) && value >= 1) {
            appState.generationConfig.perimeterHeightInches = value;
            appEvents.emit('settingsChanged', { setting: 'perimeterHeightInches', value });
        }
    }

    handleCustomBufferSizeChange() {
        const value = parseFloat(this.html.customBufferSizeInput.value());
        if (!isNaN(value) && value >= 0) {
            appState.setCustomBufferSize(value);
            appEvents.emit('settingsChanged', { setting: 'customBufferSize', value });
        }
    }

    handleMinWallLengthChange() {
        const value = parseFloat(this.html.minWallLengthSelect.value());
        if (!isNaN(value)) {
            appState.setMinWallLength(value);
            appEvents.emit('settingsChanged', { setting: 'minWallLength', value });
        }
    }

    togglePerimeterInputs() {
        // Don't allow changes if the checkbox is disabled
        if (this.html.usePerimeterCheckbox.attribute('disabled')) {
            // Reset checkbox to its previous state
            this.html.usePerimeterCheckbox.checked(appState.generationConfig.useCustomPerimeter);
            return;
        }

        // Handle UI visibility based on current appState value
        if (appState.generationConfig.useCustomPerimeter) {
            this.html.perimeterInputsContainer.removeClass('hidden');
        } else {
            this.html.perimeterInputsContainer.addClass('hidden');
        }
    }


    toggleShapeSelection(index) {
        if (this.shapeElements[index].hasClass('disabled')) return;

        appState.shapes[index].enabled = !appState.shapes[index].enabled;
        this.shapeElements[index].toggleClass('highlighted');
    }

    previewShape(shapeId) {
        // Set the shape preview in appState
        appState.setShapePreview(shapeId);

        // Clear any current solution display and show preview
        appState.currentAnneal = null;
        appState.currentViewedAnnealIndex = null;

        // Trigger display update
        this.displayShapePreview();
    }

    displayShapePreview() {
        if (!appState.display.previewMode || appState.display.previewShapeId === null || appState.display.previewShapeId === undefined) {
            return;
        }

        // Find the shape to preview
        const shapeToPreview = appState.shapes.find(shape => shape.id === appState.display.previewShapeId);
        if (!shapeToPreview) {
            console.error(`Shape with ID ${appState.display.previewShapeId} not found`);
            return;
        }


        // Check if shape needs regeneration with current settings
        const currentConfig = {
            customBufferSize: appState.generationConfig.customBufferSize,
            centerShape: appState.generationConfig.centerShape,
            minWallLength: appState.generationConfig.minWallLength
        };

        // Check if shape's cached config differs from current config
        // Shapes don't currently store their generation config, so we need to check if buffer data exists
        // and regenerate if the config has changed since last generation
        if (!shapeToPreview.lastGeneratedConfig ||
            shapeToPreview.lastGeneratedConfig.customBufferSize !== currentConfig.customBufferSize ||
            shapeToPreview.lastGeneratedConfig.centerShape !== currentConfig.centerShape ||
            shapeToPreview.lastGeneratedConfig.minWallLength !== currentConfig.minWallLength) {

            // Regenerate shape buffers with current settings
            // Use inputGrid (original user drawing) for live session reprocessing
            // Note: File imports correctly use highResShape since inputGrid doesn't exist in JSON
            const inputData = shapeToPreview.data.inputGrid || shapeToPreview.data.highResShape;
            shapeToPreview.saveUserInput(
                shapeToPreview.data.title,
                inputData,
                currentConfig
            );

            // Store the config used for generation
            shapeToPreview.lastGeneratedConfig = { ...currentConfig };
        }

        // Use the shape preview renderer
        const canvas = { width: canvasWidth, height: canvasHeight };
        const detailMode = appState.display.detailView;
        this.shapeRenderer.renderShapePreview(shapeToPreview, canvas, detailMode, appState);
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
        // Save button in Results panel
        this.html.saveButton = createButton('Save')
            .addClass('primary-button button settings-button')
            .parent(this.html.controlsContainer)
            .attribute('disabled', '') // until annealing is complete
            .mousePressed(() => this.handleSaveSolution());
    }

    // ============= UI Update from AppState =============
    updateUIFromAppState() {
        // Update all form elements to match appState
        // Called after external changes (loading solutions, etc.)
        // This is the ONLY place besides handlers that should touch UI elements

        const config = appState.generationConfig;

        // Aspect ratio buttons - use handler to update both UI and ensure consistency
        this.handleAspectRatioChange(config.aspectRatioPref);

        // Perimeter settings
        if (this.html.usePerimeterCheckbox) {
            this.html.usePerimeterCheckbox.checked(config.useCustomPerimeter);
            // Force update if p5.js didn't update properly
            if (this.html.usePerimeterCheckbox.checked() !== config.useCustomPerimeter) {
                this.html.usePerimeterCheckbox.elt.checked = config.useCustomPerimeter;
            }
        }

        if (this.html.perimeterWidthInput) {
            this.html.perimeterWidthInput.value(config.perimeterWidthInches);
            // Force update if p5.js didn't update properly
            if (this.html.perimeterWidthInput.value() !== config.perimeterWidthInches.toString()) {
                this.html.perimeterWidthInput.elt.value = config.perimeterWidthInches;
            }
        }

        if (this.html.perimeterHeightInput) {
            this.html.perimeterHeightInput.value(config.perimeterHeightInches);
            // Force update if p5.js didn't update properly
            if (this.html.perimeterHeightInput.value() !== config.perimeterHeightInches.toString()) {
                this.html.perimeterHeightInput.elt.value = config.perimeterHeightInches;
            }
        }

        // Buffer settings
        if (this.html.customBufferSizeInput) {
            this.html.customBufferSizeInput.value(config.customBufferSize);
            // Force update if p5.js didn't update properly
            if (this.html.customBufferSizeInput.value() !== config.customBufferSize.toString()) {
                this.html.customBufferSizeInput.elt.value = config.customBufferSize;
            }
        }

        if (this.html.minWallLengthSelect && config.minWallLength !== undefined) {
            const minWallLengthStr = String(config.minWallLength);
            this.html.minWallLengthSelect.selected(minWallLengthStr);
            // Force update if p5.js didn't update properly
            if (this.html.minWallLengthSelect.value() !== minWallLengthStr) {
                this.html.minWallLengthSelect.elt.value = minWallLengthStr;
            }
        }

    }


    viewSavedAnneal(index) {
        if (index === null) {
            // Display an empty solution grid
            this.drawBlankGrid();
            return;
        }

        // Start with clean slate before viewing solution
        this.drawBlankGrid();

        // display selected saved anneal
        appState.currentViewedAnnealIndex = index;
        // Create a deep copy of the saved anneal to prevent modifications
        const savedAnneal = appState.savedAnneals[index];

        // Handle legacy solutions (use historical defaults for shape processing)
        let fabricationContext = savedAnneal.fabricationContext;
        if (!fabricationContext) {
            console.log('[DesignUI] Loading legacy solution - using historical defaults');
            fabricationContext = {
                bufferSettings: {
                    customBufferSize: 1,  // Historical default of 1" buffer added
                    centerShape: false,
                    minWallLength: 1.0
                },
                materialType: 'plywood-laser'
            };
        }

        // Apply solution's buffer settings using setter methods
        appState.setCustomBufferSize(fabricationContext.bufferSettings.customBufferSize, 'solution');
        appState.setCenterShape(fabricationContext.bufferSettings.centerShape, 'solution');
        appState.setMinWallLength(fabricationContext.bufferSettings.minWallLength, 'solution');

        appState.currentAnneal = {
            title: savedAnneal.title,
            finalSolution: Solution.fromDataObject(savedAnneal.finalSolution.toDataObject()),
            enabledShapes: [...savedAnneal.enabledShapes], // shallow copy is fine for boolean array
            fabricationContext: fabricationContext // Store context with loaded solution
        };

        // update UI to match loaded solution
        const solution = appState.currentAnneal.finalSolution;

        // Use centralized method to update appState and trigger events
        appState.loadSolutionConfig(solution);

        // Update appState with all solution settings
        appState.generationConfig.aspectRatioPref = solution.aspectRatioPref;
        appState.generationConfig.useCustomPerimeter = solution.useCustomPerimeter;
        appState.generationConfig.perimeterWidthInches = solution.perimeterWidthInches;
        appState.generationConfig.perimeterHeightInches = solution.perimeterHeightInches;

        // Update all UI elements from appState (single source of truth)
        this.updateUIFromAppState();

        // Update perimeter UI to show the saved values (but keep them disabled)
        if (this.html.usePerimeterCheckbox) {
            this.html.usePerimeterCheckbox.checked(solution.useCustomPerimeter);
        }
        if (this.html.perimeterWidthInput) {
            this.html.perimeterWidthInput.value(solution.perimeterWidthInches.toString());
        }
        if (this.html.perimeterHeightInput) {
            this.html.perimeterHeightInput.value(solution.perimeterHeightInches.toString());
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
        appState.display.shapesDisabled = true;
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

    regenerateShapesWithNewSettings() {
        // Regenerate each shape using its original high-resolution data
        const config = {
            customBufferSize: appState.generationConfig.customBufferSize,
            centerShape: appState.generationConfig.centerShape,
            minWallLength: appState.generationConfig.minWallLength
        };

        appState.shapes.forEach(shape => {
            if (shape.data && shape.data.highResShape && shape.data.title) {
                // Use the existing high-resolution data as input (it represents the processed user input)
                // Pass explicit configuration to avoid UI dependencies
                shape.saveUserInput(shape.data.title, shape.data.highResShape, config);
            }
        });

        // Emit state change to trigger UI updates
        appEvents.emit('stateChanged');

        // Update preview if active
        this.updateShapePreview();
    }

    updateShapePreview() {
        // Update shape preview when preview state changes or shapes are regenerated
        if (appState.display.previewMode && this.displayShapePreview) {
            this.displayShapePreview();
        }
    }
}

// only export the class when in a Node.js environment (e.g., during Jest tests)
// ignored when the app is running in the browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DesignUI;
}