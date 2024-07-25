class DesignUI {
    constructor() {
        //== state variables
        this.currentAnneal;
        this.currentSolution;
        // dom elements
        this.htmlRef = {};
        this.html = {};

        //== initialize UI elements
        this.getHtmlRef();
        this.initBodyUI();
        this.initRightSideUI();

        // initially hide the input elements
        this.hide();
    }

    //== dom element setup methods
    getHtmlRef() {
        // get references to parent dom elements
        this.htmlRef.header = select('#header');
        this.htmlRef.leftBar = select('#left-side-bar');
        this.htmlRef.rightBar = select('#right-side-bar');
        this.htmlRef.bottomDiv = select('#bottom-div');
        this.htmlRef.rightSideTop = select('#right-side-bar .sidebar-top');
        this.htmlRef.rightSideList = select('#right-side-bar .sidebar-list');
        this.htmlRef.rightSideButtons = select('#right-side-bar .sidebar-buttons');
    }

    initBodyUI() {
        //== setup dom elements
        // setup anneal ui element containers
        this.html.designDiv = createDiv();
        this.html.designDiv.parent(this.htmlRef.bottomDiv);
        this.html.designDiv.id('design-div');

        this.html.buttonRow = createDiv();
        this.html.buttonRow.parent(this.html.designDiv);
        this.html.buttonRow.addClass('button-row');

        this.html.annealButton = createButton('Generate');
        this.html.annealButton.parent(this.html.buttonRow).addClass('green-button button');
        this.html.annealButton.mousePressed(() => this.handleStartAnneal());

        this.html.saveButton = createButton('Save');
        this.html.saveButton.parent(this.html.buttonRow).addClass('green-button button');
        this.html.saveButton.attribute('disabled', ''); // until annealing is complete
        this.html.saveButton.mousePressed(() => this.handleSaveSolution());

        // info text
        this.html.diagnosticText = createP("(toggle 'd' key for diagnostics)");
        this.html.diagnosticText.parent(this.html.designDiv).addClass('info-text');

        this.html.growthText = createP("(press 'g' to grow cells)");
        this.html.growthText.parent(this.html.designDiv).addClass('info-text');
    }

    initRightSideUI() {
        // //== setup ui elements for side bar
        // this.html.addButton = createButton('Add');
        // this.html.addButton.parent(this.htmlRef.rightSideButtons);
        // this.html.addButton.addClass('button green-button');
        // this.html.addButton.attribute('disabled', ''); // until 2 shapes are saved
        // this.html.addButton.mousePressed(() => this.saveAllShapes());

        // // create the LOAD SHAPES button
        // this.html.loadButton = createButton('Load');
        // this.html.loadButton.parent(this.htmlRef.rightSideButtons);
        // this.html.loadButton.addClass('button green-button');
        // this.html.loadButton.mousePressed(() => this.loadSavedShapes());

        // // create the NEXT button
        // this.html.nextButton = createButton('Next');
        // this.html.nextButton.parent(this.htmlRef.rightSideButtons);
        // this.html.nextButton.addClass('button green-button');
        // this.html.nextButton.attribute('disabled', ''); // until 2 shapes are saved
        // this.html.nextButton.mousePressed(() => this.nextScreen());
    }

    //== show/hide methods
    show() {
        // toggle on the input screen divs
        this.htmlRef.leftBar.removeClass('hidden');
        this.htmlRef.rightBar.removeClass('hidden');
        this.htmlRef.bottomDiv.removeClass('hidden');

        // remove hidden class from each element in this.html
        Object.values(this.html).forEach(element => element.removeClass('hidden'));

        this.html.growthText.addClass('hidden');
        if (devMode) {
            // show called in displayResult, not updateDisplayCallback
            // only displayResult is called after annealing complete
            this.html.growthText.removeClass('hidden');
        }
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
    async handleStartAnneal() {
        //== start the annealing process

        // find only selected (enabled) shapes
        // - filter() returns shallow copy of allShapes
        // - shallow copy keeps shape specific data while allowing unique position data
        let selectedShapes = allShapes.filter(shape => shape.enabled);
        let currentAnneal = new Anneal(selectedShapes, this);


        await currentAnneal.run();

        // reset "regenerate" button back to "generate" (.run() changed it)
        this.html.annealButton.html('Generate');
        this.html.annealButton.mousePressed(() => this.handleStartAnneal());

        this.currentSolution = currentAnneal.finalSolution;



        console.log("Annealing complete: ", currentAnneal.finalSolution);


        this.displayResult();

        // // rebind re-anneal to restart annealing
        // designUI.html.annealButton.mousePressed(() => this.startAnnealing());

        // console.log("Annealing complete. Score: ", currentSolution.score);
    }

    handleSaveSolution() {
        // save the current solution to the global array
        allSolutions.push(currentSolution);
    }

    //== display methods
    updateDisplayCallback(_solution) {
        // passed as a callback to the annealing process so it can update the display

        clear();
        background(255);
        // show shapes, grid, and annealing scores
        _solution.showLayout()
        _solution.showScores();
    }

    displayResult() {
        // show shapes and grid but not annealing scores
        if (this.currentSolution) {
            clear();
            background(255);
            this.currentSolution.showLayout();

            // update growth text if dev mode on and annealing complete
            this.show();

            if (!enableCellular) {
                // display annealing scores if not showing cellular scores
                this.currentSolution.showScores();
            }
            else if (enableCellular) {
                // setup case for cellular and boards
                newCase = new Case(this.currentSolution);
                newCase.cellular.createTerrain();
                newCase.cellular.calcPathValues();
                newCase.cellular.makeInitialCells();
                newCase.cellular.growCells(numGrow);

                // display cells and terrain (cellular scores)
                newCase.cellular.showTerrain();
                newCase.cellular.showCellLines();
                newCase.cellular.showCells();
            }
        }
    }
}
