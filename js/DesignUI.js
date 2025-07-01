class DesignUI {
    constructor() {
        //== state variables
        this.currentAnneal;
        this.savedAnneals = [];
        this.currCellular;
        this.totalSavedAnneals = 0;
        this.currentViewedAnnealIndex = null;
        // dom elements
        this.htmlRef = {};
        this.html = {};
        this.savedAnnealElements = [];
        this.shapeElements = [];
        // flags

        //== initialize UI elements
        this.getHtmlRef();
        this.initHeaderUI();
        this.initBodyUI();
        this.initRightSideUI();

        // initially hide the input elements
        this.hide();
    }

    //== dom element setup methods
    getHtmlRef() {
        // get references to parent dom elements
        this.htmlRef.header = select('#header');
        this.htmlRef.subheading = select('#subheading');
        this.htmlRef.headerControls = select('#header-controls');
        this.htmlRef.leftBar = select('#left-side-bar');
        this.htmlRef.rightBar = select('#right-side-bar');
        this.htmlRef.bottomDiv = select('#bottom-div');
        this.htmlRef.leftSideTop = select('#left-side-bar .sidebar-top');
        this.htmlRef.leftSideList = select('#left-side-bar .sidebar-list');
        this.htmlRef.rightSideTop = select('#right-side-bar .sidebar-top');
        this.htmlRef.rightSideList = select('#right-side-bar .sidebar-list');
        this.htmlRef.rightSideButtons = select('#right-side-bar .sidebar-buttons');
    }

    initHeaderUI() {
        //== setup ui elements for header
        // slider toggle
        this.html.sliderDiv = createDiv()
            .id('slider-div')
            .parent(this.htmlRef.headerControls)
            .mousePressed(this.handleSlider.bind(this));

        // Simple label
        this.html.simpleLabel = createSpan('Simple')
            .addClass('toggle-label')
            .parent(this.html.sliderDiv);

        // Create and append the slider
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
            .parent(this.htmlRef.headerControls);

        this.html.orientationButtons = createDiv()
            .addClass('orientation-buttons')
            .parent(this.html.orientationDiv);

        this.html.tallButton = createDiv()
            .addClass('orientation-button tall')
            .parent(this.html.orientationButtons)
            .mousePressed(() => this.handleOrientationChange(-1));

        this.html.squareButton = createDiv()
            .addClass('orientation-button square selected')
            .parent(this.html.orientationButtons)
            .mousePressed(() => this.handleOrientationChange(0));

        this.html.wideButton = createDiv()
            .addClass('orientation-button wide')
            .parent(this.html.orientationButtons)
            .mousePressed(() => this.handleOrientationChange(1));
    }

    initBodyUI() {
        //== setup dom elements
        // setup anneal ui element containers
        this.html.designDiv = createDiv()
            .parent(this.htmlRef.bottomDiv)
            .id('design-div');

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

    initRightSideUI() {
        //== setup ui elements for right side bar
        // Next button
        this.html.nextButton = createButton('Next')
            .parent(this.htmlRef.rightSideButtons)
            .addClass('button primary-button')
            .attribute('disabled', '') // until one saved anneal
            .mousePressed(() => this.handleNext());
    }

    //== show/hide methods
    show() {
        // toggle on the input screen divs
        this.htmlRef.leftBar.removeClass('hidden');
        this.htmlRef.rightBar.removeClass('hidden');
        this.htmlRef.bottomDiv.removeClass('hidden');
        // set titles
        this.htmlRef.leftSideTop.html('Shapes');
        this.htmlRef.rightSideTop.html('Results');
        // Set subheading
        this.htmlRef.subheading.html("Generate Layout");

        // remove hidden class from each element in this.html
        Object.values(this.html).forEach(element => element.removeClass('hidden'));

        this.drawBlankGrid();
        // this.html.growthText.addClass('hidden');
        // if (devMode) {
        //     // show called in displayResult, not updateDisplayCallback
        //     // only displayResult is called after annealing complete
        //     this.html.growthText.removeClass('hidden');
        // }

        // // temp auto-loading for testing
        // this.viewSavedAnneal(0);
        // setTimeout(() => {
        //     this.handleNext();
        //     exportUI.handleCreate();
        // }, 0);
    }

    hide() {
        // toggle off input screen divs
        this.htmlRef.leftBar.addClass('hidden');
        this.htmlRef.rightBar.addClass('hidden');
        this.htmlRef.bottomDiv.addClass('hidden');

        // add hidden class to each element in this.html
        Object.values(this.html).forEach(element => element.addClass('hidden'));
    }

    //== button handlers
    handleOrientationChange(pref) {
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
        for (let shape of inputUI.shapes) {
            if (!shape.data.lowResShape || !shape.data.bufferShape) {
                // if missing, generate it
                shape.saveUserInput(shape.data.title, shape.data.highResShape);
            }
        }

        // find only selected (enabled) shapes
        // - filter() returns shallow copy of all shapes
        // - shallow copy keeps shape specific data while allowing unique position data
        let selectedShapes = inputUI.shapes.filter(shape => shape.enabled);
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
            this.currentAnneal = newAnneal;
            console.log("Annealing complete: ", this.currentAnneal.finalSolution.score);

            this.displayResult();
        }
    }

    handleSaveSolution() {
        // save the current solution to the array
        this.totalSavedAnneals++;
        // save only the necessary data for each anneal
        let savedData = {
            title: `solution-${this.totalSavedAnneals}`,
            solutionHistory: this.currentAnneal.solutionHistory,
            finalSolution: this.currentAnneal.finalSolution,
            enabledShapes: inputUI.shapes.map(shape => shape.enabled)
        }
        this.savedAnneals.push(savedData);
        this.viewSavedAnneal(this.savedAnneals.length - 1);

        // update buttons
        // disable save until a new anneal or change is made
        this.html.saveButton.attribute('disabled', '');
    }

    handleNext() {
        // clean up the design screen
        this.clearShapeList();
        this.clearSavedAnneals();

        // setup for the export screen
        clear();
        background(255);

        // change to export screen
        changeScreen(ScreenState.EXPORT);
    }

    //== display methods
    drawBlankGrid() {
        clear();
        background(255);

        // reset ui to cleared initial state
        // show anneal list
        this.viewSavedAnneal(null);
        // show shapes list
        this.createShapeList();
        this.html.saveButton.attribute('disabled', '');

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
        if (this.currentAnneal && this.currentAnneal.finalSolution) {
            clear();
            background(255);
            this.currentAnneal.finalSolution.showLayout();

            // setup case for cellular and boards
            this.currCellular = new Cellular(this.currentAnneal.finalSolution);
            this.currCellular.growCells();
            this.currCellular.showCellLines();

            // display cells and terrain (cellular scores)
            if (devMode) {
                this.currCellular.showTerrain();
                this.currCellular.showCells();
            }
        }
    }

    createShapeList() {
        // create list of shapes to select from
        this.clearShapeList();
        inputUI.shapes.forEach((shape, index) => {
            let shapeItem = createDiv()
                .parent(this.htmlRef.leftSideList)
                .addClass(shape.enabled ? 'shape-item highlighted' : 'shape-item')
                .mousePressed(() => this.toggleShapeSelection(index));

            createSpan(shape.data.title)
                .addClass('shape-title')
                .parent(shapeItem);

            this.shapeElements.push(shapeItem);
        });
    }

    clearShapeList() {
        for (let element of this.shapeElements) {
            element.remove();
        }
        this.shapeElements = [];
    }

    toggleShapeSelection(index) {
        if (this.shapeElements[index].hasClass('disabled')) return;

        inputUI.shapes[index].enabled = !inputUI.shapes[index].enabled;
        this.shapeElements[index].toggleClass('highlighted');
    }

    displaySavedAnneals() {
        this.clearSavedAnneals();

        for (let i = 0; i < this.savedAnneals.length; i++) {
            let savedAnnealItem = createDiv().addClass('saved-anneal-item');
            if (i === this.currentViewedAnnealIndex) {
                savedAnnealItem.addClass('highlighted');
            }
            savedAnnealItem.parent(this.htmlRef.rightSideList);

            let viewIcon = createImg('img/view.svg', 'View')
                .addClass('icon-button')
                .size(24, 24)
                .parent(savedAnnealItem)
                .mousePressed(() => this.viewSavedAnneal(i));

            let titleSpan = createSpan(this.savedAnneals[i].title)
                .addClass('anneal-title')
                .parent(savedAnnealItem);

            let trashIcon = createImg('img/trash.svg', 'Delete')
                .addClass('icon-button')
                .size(24, 24)
                .parent(savedAnnealItem)
                .mousePressed(() => {
                    if (confirm(`Are you sure you want to delete "${this.savedAnneals[i].title}"?`)) {
                        this.savedAnneals.splice(i, 1);
                        if (i === this.currentViewedAnnealIndex) {
                            this.currentViewedAnnealIndex = null;
                            // currently viewed anneal was deleted
                            this.drawBlankGrid();
                        } else if (i < this.currentViewedAnnealIndex) {
                            // deleted one before currently viewed, move the index down
                            this.currentViewedAnnealIndex--;
                            this.viewSavedAnneal(this.currentViewedAnnealIndex);
                        }
                    }
                });

            this.savedAnnealElements.push(savedAnnealItem);
        }
    }

    viewSavedAnneal(index) {
        if (index === null) {
            // clear the viewed anneal
            this.currentViewedAnnealIndex = null;
            this.currentAnneal = null;
            this.displaySavedAnneals();
            this.html.nextButton.attribute('disabled', '');
            return;
        }

        // display selected saved anneal
        this.currentViewedAnnealIndex = index;
        this.currentAnneal = this.savedAnneals[index];

        // disable shape selection changes while viewing saved anneal
        if (this.shapeElements.length === 0) {
            this.createShapeList();
        }
        this.shapeElements.forEach(element => {
            element.addClass('disabled');
        });
        // set which shapes are enabled for this saved solution
        let enableShapes = this.currentAnneal.enabledShapes;
        enableShapes.forEach((_enabled, i) => {
            // set the enabled states for this saved solution
            inputUI.shapes[i].enabled = _enabled;
            if (_enabled) {
                this.shapeElements[i].addClass('highlighted');
            } else {
                this.shapeElements[i].removeClass('highlighted');
            }
        });

        // update display
        this.displayResult();
        this.updateSavedAnnealHighlight();
        this.html.nextButton.removeAttribute('disabled');
    }

    updateSavedAnnealHighlight() {
        for (let i = 0; i < this.savedAnnealElements.length; i++) {
            if (this.currentAnneal === this.savedAnneals[i]) {
                this.savedAnnealElements[i].addClass('highlighted');
            } else {
                this.savedAnnealElements[i].removeClass('highlighted');
            }
        }
    }

    clearSavedAnneals() {
        for (let element of this.savedAnnealElements) {
            element.remove();
        }
        this.savedAnnealElements = [];
    }
}

// Only export the class when in a Node.js environment (e.g., during Jest tests)
// Ignored when the app is running in the browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DesignUI;
}