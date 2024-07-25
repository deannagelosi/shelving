class DesignUI {
    constructor() {
        //== state variables
        this.currentAnneal;
        this.savedAnneals = [];
        this.totalSavedAnneals = 0;
        this.currentViewedAnnealIndex = null;
        // dom elements
        this.htmlRef = {};
        this.html = {};
        this.savedAnnealElements = [];
        // flags
        this.isExporting = false;

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

        // Generate button
        this.html.annealButton = createButton('Generate');
        this.html.annealButton.parent(this.html.buttonRow).addClass('green-button button');
        this.html.annealButton.mousePressed(() => this.handleStartAnneal());

        // Save button
        this.html.saveButton = createButton('Save');
        this.html.saveButton.parent(this.html.buttonRow).addClass('green-button button');
        this.html.saveButton.attribute('disabled', ''); // until annealing is complete
        this.html.saveButton.mousePressed(() => this.handleSaveSolution());

        // Clear + Stop button
        this.html.clearButton = createButton('Clear');
        this.html.clearButton.parent(this.html.buttonRow).addClass('red-button button');
        this.html.clearButton.mousePressed(() => this.drawBlankGrid());

        // info text
        this.html.diagnosticText = createP("(toggle 'd' key for diagnostics)");
        this.html.diagnosticText.parent(this.html.designDiv).addClass('info-text');

        this.html.growthText = createP("(press 'g' to grow cells)");
        this.html.growthText.parent(this.html.designDiv).addClass('info-text');
    }

    initRightSideUI() {
        //== setup ui elements for side bar
        // Export button
        this.html.exportButton = createButton('Export');
        this.html.exportButton.parent(this.htmlRef.rightSideButtons);
        this.html.exportButton.addClass('button green-button');
        this.html.exportButton.attribute('disabled', ''); // until one saved anneal
        this.html.exportButton.mousePressed(() => this.handleExport());

        // Import button
        this.html.loadButton = createButton('Import');
        this.html.loadButton.parent(this.htmlRef.rightSideButtons);
        this.html.loadButton.addClass('button green-button');
        this.html.loadButton.mousePressed(() => this.handleImport());
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
        this.currentAnneal = null;
        this.html.saveButton.attribute('disabled', '');
        this.currentViewedAnnealIndex = null;
        this.displaySavedAnneals();

        // find only selected (enabled) shapes
        // - filter() returns shallow copy of allShapes
        // - shallow copy keeps shape specific data while allowing unique position data
        let selectedShapes = allShapes.filter(shape => shape.enabled);
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
        // save the current solution to the global array
        this.totalSavedAnneals++;
        // save only the necessary data for each anneal
        let savedData = {
            title: `solution-${this.totalSavedAnneals}`,
            solutionHistory: this.currentAnneal.solutionHistory,
            finalSolution: this.currentAnneal.finalSolution,
        }
        this.savedAnneals.push(savedData);

        this.currentViewedAnnealIndex = this.savedAnneals.length - 1;
        this.displaySavedAnneals();

        // update buttons
        // disable save until a new anneal or change is made
        this.html.saveButton.attribute('disabled', '');
        // enable export button if disabled
        this.html.exportButton.removeAttribute('disabled');
    }

    handleExport() {
        if (this.isExporting) return; // block multiple clicks during export

        this.isExporting = true;
        this.html.exportButton.html('Saving...');
        this.html.exportButton.attribute('disabled', '');

        // add full shapes array to saved anneals
        let exportData = {
            savedAnneals: this.savedAnneals,
            allShapes: allShapes
        }

        try {
            const jsonData = JSON.stringify(exportData, null);
            const blob = new Blob([jsonData], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            // create temporary link element
            const link = document.createElement('a');
            link.href = url;
            link.download = 'shelving_data.json';

            // append to body, click, and remove
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            // clean up the URL
            URL.revokeObjectURL(url);

        } catch (error) {
            console.error('Export failed:', error);
        } finally {
            this.isExporting = false;
            this.html.exportButton.html('Export');
        }
    }

    handleImport() {
        // user selects a json file
        const input = createFileInput((file) => {
            if (file.type === 'application' && file.subtype === 'json') {
                const importedData = file.data;
                // read the shapes in
                this.loadAnnealJson(importedData);
            } else {
                alert('Select a .json file to upload');
            }
        });
        input.hide(); // hide default file input
        input.elt.click(); // open file dialog on click
    }

    loadAnnealJson(_importedData) {
        // handle loading saved anneals from json file
        let annealData = _importedData.savedAnneals;
        let shapesData = _importedData.allShapes;
        
        let loadedAnneals = [];
        for (let anneal of annealData) {
            // create new shape from saved data
            let enableSolution = new Solution(anneal.finalSolution.shapes);
            anneal.finalSolution = enableSolution; // add solution methods back
            loadedAnneals.push(anneal);
        }
        this.savedAnneals.push(...loadedAnneals);

        // reset list of loaded anneals
        if (this.savedAnneals.length >= 1) {
            // each needs to be clicked twice to show up
            for (let i = 0; i < this.savedAnneals.length; i++) {
                this.viewSavedAnneal(i);
            }
            this.viewSavedAnneal(0);
        }

        // enable export button if all shapes are from the load files
        if (this.savedAnneals.length == _annealData.length) {
            // user loaded all current shapes, no export needed
            this.html.exportButton.attribute('disabled', '');
        } else {
            // user loaded on top of existing anneals, export needed
            this.html.exportButton.removeAttribute('disabled');
        }
    }

    //== display methods
    drawBlankGrid() {
        clear();
        background(255);

        // reset ui to cleared initial state
        this.currentAnneal = null;
        this.currentViewedAnnealIndex = null;
        this.displaySavedAnneals();
        this.html.saveButton.attribute('disabled', '');

        // create empty solution and display grid only
        let emptySolution = new Solution();
        emptySolution.makeBlankLayout(20);
        let colors = {
            lineColor: "rgb(198, 198, 197)",
            bkrdColor: "rgb(229, 229, 229)"
        }
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

            // update growth text if dev mode on and annealing complete
            this.show();

            if (enableCellular) {
                // setup case for cellular and boards
                newCase = new Case(this.currentAnneal.finalSolution);
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

    displaySavedAnneals() {
        this.clearSavedAnneals();

        for (let i = 0; i < this.savedAnneals.length; i++) {
            let savedAnnealItem = createDiv().addClass('saved-anneal-item');
            if (i === this.currentViewedAnnealIndex) {
                savedAnnealItem.addClass('highlighted');
            }
            savedAnnealItem.parent(this.htmlRef.rightSideList);

            let viewIcon = createImg('/img/view.svg', 'View')
                .addClass('icon-button')
                .size(24, 24)
                .parent(savedAnnealItem);
            viewIcon.mousePressed(() => this.viewSavedAnneal(i));

            let titleSpan = createSpan(this.savedAnneals[i].title)
                .addClass('anneal-title')
                .parent(savedAnnealItem);

            let trashIcon = createImg('/img/trash.svg', 'Delete')
                .addClass('icon-button')
                .size(24, 24)
                .parent(savedAnnealItem);
            trashIcon.mousePressed(() => {
                if (confirm(`Are you sure you want to delete "${this.savedAnneals[i].title}"?`)) {
                    this.savedAnneals.splice(i, 1);
                    if (i === this.currentViewedAnnealIndex) {
                        this.currentViewedAnnealIndex = null;
                        // currently viewed anneal was deleted
                        this.drawBlankGrid();
                    } else if (i < this.currentViewedAnnealIndex) {
                        // deleted one before currently viewed, move the index down
                        this.currentViewedAnnealIndex--;
                    }
                    // disable export button if no more saved anneals
                    if (this.savedAnneals.length === 0) {
                        this.html.exportButton.attribute('disabled', ''); // until one saved anneal
                    }
                    // enable export if there are saved anneals
                    if (this.savedAnneals.length > 0) {
                        this.html.exportButton.removeAttribute('disabled');
                    }
                    this.displaySavedAnneals();
                }
            });

            this.savedAnnealElements.push(savedAnnealItem);
        }
    }

    viewSavedAnneal(index) {
        // switch to viewing the selected saved anneal
        this.currentViewedAnnealIndex = index;
        this.currentAnneal = this.savedAnneals[index];
        this.displayResult();
        this.displaySavedAnneals();
    }

    clearSavedAnneals() {
        for (let element of this.savedAnnealElements) {
            element.remove();
        }
        this.savedAnnealElements = [];
    }
}
