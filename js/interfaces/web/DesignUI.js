class DesignUI {
    constructor() {
        //== state variables
        this.savedAnnealElements = [];
        // dom elements
        this.html = {};
        this.shapeElements = [];

        //== renderer instances
        this.solutionRenderer = new SolutionRenderer();
        this.cellularRenderer = new CellularRenderer();

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
                            valid: valid
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

            const anneal = {
                finalSolution: solution,
                solutionHistory: [], // empty for now to reduce memory usage
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

        return { squareSize, buffer, xPadding, yPadding };
    }

    //== show/hide methods
    // manage visibility and screen-specific setup
    show() {
        // show all design screen elements
        Object.values(this.html).forEach(element => element.removeClass('hidden'));

        // reset the canvas
        clear();
        background(255);

        // start with all shapes enabled in the select list
        appState.shapes.forEach((shape, index) => {
            appState.shapes[index].enabled = true;
        });

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
        updateButton(this.html.saveButton, state.canSave);

        // update dynamic lists
        this.createShapeList();
        this.createAnnealList();
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

    handleAspectRatioChange(pref) {
        aspectRatioPref = pref;

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

            // send generation request to worker
            this.solutionWorker.postMessage({
                type: 'GENERATE_SOLUTION',
                payload: {
                    shapes: shapesData,
                    jobId: `single-${Date.now()}`,
                    startId: 0,
                    aspectRatioPref: aspectRatioPref,
                    devMode: devMode,
                    annealConfig: {
                        displayInterval: 30
                    }
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
        // save only the necessary data for each anneal
        let savedData = {
            title: `solution-${appState.totalSavedAnneals}`,
            solutionHistory: [], // temporarily set to empty to reduce memory usage
            // solutionHistory: appState.currentAnneal.solutionHistory,
            finalSolution: appState.currentAnneal.finalSolution,
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
                ...layoutProps
            };

            // use renderer to display the layout on the canvas
            this.solutionRenderer.renderLayout(solution, canvas, config);

            // setup case for cellular and boards
            if (devMode) {
                // create temporary cellular instance for step-by-step growth preview
                appState.currCellular = new Cellular(solution, devMode, numGrow);
                appState.currCellular.growCells();
            } else if (appState.currentAnneal.cellular) {
                // worker result, use returned cellular data
                appState.currCellular = {
                    cellSpace: appState.currentAnneal.cellular.cellSpace,
                    maxTerrain: appState.currentAnneal.cellular.maxTerrain,
                    numAlive: appState.currentAnneal.cellular.numAlive
                };
            } else {
                // imported solution, recalculate cellular data
                appState.currCellular = new Cellular(solution, devMode, numGrow);
                appState.currCellular.growCells();

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
            this.cellularRenderer.renderCellLines(appState.currCellular.cellSpace, canvas, config);

            // display cells and terrain (cellular scores)
            if (devMode) {
                this.cellularRenderer.renderTerrain(solution.layout, canvas, { ...config, maxTerrain: appState.currCellular.maxTerrain });
                this.cellularRenderer.renderCells(appState.currCellular.cellSpace, canvas, config);
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

    createAnnealList() {
        // create list of solutions to select from
        if (!htmlRefs.right) return;
        if (appState.currentScreen !== ScreenState.DESIGN) return;

        // clear the list
        htmlRefs.right.list.html('');
        this.savedAnnealElements = [];

        // create the list
        for (let i = 0; i < appState.savedAnneals.length; i++) {
            let savedAnnealItem = createDiv().addClass('saved-anneal-item');
            if (i === appState.currentViewedAnnealIndex) {
                savedAnnealItem.addClass('highlighted');
            }
            savedAnnealItem.parent(htmlRefs.right.list);

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
        appState.currentAnneal = appState.savedAnneals[index];

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