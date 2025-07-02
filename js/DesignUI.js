class DesignUI {
    constructor() {
        //== state variables
        this.savedAnnealElements = [];
        // dom elements
        this.html = {};
        this.shapeElements = [];

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

    render() {
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
        let newAnneal = new Anneal(selectedShapes, this);

        await newAnneal.run();
        // check if annealing completed or was aborted
        if (newAnneal.stopAnneal && !newAnneal.finalSolution) {
            // user triggered a stop or restart
            if (newAnneal.restartAnneal) {
                // restart new annealing process
                return this.handleStartAnneal();
            } else {
                // user stopped the annealing process
                console.log("Annealing stopped.");
                this.drawBlankGrid();
                // switch buttons back:
                // - 'regenerate' -> 'generate' mode
                // - 'stop + clear' -> 'clear' mode
                this.html.annealButton.html('Generate');
                this.html.annealButton.mousePressed(() => this.handleStartAnneal());
                this.html.clearButton.mousePressed(() => this.drawBlankGrid());
            }

        } else {
            // annealing completed
            // switch buttons back:
            // - 'regenerate' -> 'generate' mode
            // - 'stop + clear' -> 'clear' mode
            // - 'save' enabled
            this.html.annealButton.html('Generate');
            this.html.annealButton.mousePressed(() => this.handleStartAnneal());
            this.html.clearButton.mousePressed(() => this.drawBlankGrid());
            this.html.saveButton.removeAttribute('disabled');

            // save results
            appState.currentAnneal = newAnneal;
            console.log("Annealing complete: ", appState.currentAnneal.finalSolution.score);

            this.displayResult();
        }
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

        // notify render manager
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
        let emptySolution = new Solution();
        emptySolution.makeBlankLayout(20);
        let colors = {
            lineColor: "rgb(198, 198, 197)",
            bkrdColor: "rgb(229, 229, 229)"
        };
        emptySolution.showGridSquares(colors);

        // notify render manager
        appEvents.emit('stateChanged');
    }

    updateDisplayCallback(_solution) {
        // passed as a callback to the annealing process so it can update the display

        clear();
        background(255);
        // show shapes, grid, and annealing scores
        _solution.showLayout();
        _solution.showScores(); // anneal score when in progress
    }

    displayResult() {
        // show shapes and grid but not annealing scores
        if (appState.currentAnneal && appState.currentAnneal.finalSolution) {
            clear();
            background(255);
            appState.currentAnneal.finalSolution.showLayout();

            // setup case for cellular and boards
            appState.currCellular = new Cellular(appState.currentAnneal.finalSolution);
            appState.currCellular.growCells();
            appState.currCellular.showCellLines();

            // display cells and terrain (cellular scores)
            if (devMode) {
                appState.currCellular.showTerrain();
                appState.currCellular.showCells();
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
                        // notify render manager
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
            // notify render manager
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
        enableShapes.forEach((_enabled, i) => {
            // set the enabled states for this saved solution
            appState.shapes[i].enabled = _enabled;
            if (_enabled) {
                this.shapeElements[i].addClass('highlighted');
            } else {
                this.shapeElements[i].removeClass('highlighted');
            }
        });

        // update display
        this.displayResult();
        this.updateSavedAnnealHighlight();
        // notify render manager
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