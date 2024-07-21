class UI {
    constructor() {
        //== state variables
        // input grid values
        this.inputGrid = [];
        // dom elements and shape titles
        this.inputUIElements = {};
        this.annealUIElements = {};
        this.shapeTitleElements = [];

        //== input grid variables
        this.maxInputInches = 8;
        this.gridInchSize = 0.25; // each square is 0.25 inches
        this.inputRows = Math.floor(this.maxInputInches / this.gridInchSize);
        this.inputCols = this.inputRows;

        // calc input grid size
        this.inputSquareSize = Math.min(canvasWidth, canvasHeight) / this.inputRows;
        this.sidePadding = this.inputSquareSize / 2;
        // shrink input squares to fit padding on all sides
        this.inputSquareSize = (canvasWidth - this.sidePadding * 2) / this.inputRows;
        this.inputGridHeight = (this.inputRows * this.inputSquareSize);
        this.inputGridWidth = (this.inputCols * this.inputSquareSize);

        //== mouse click delay (debounce)
        this.lastClickTime = 0;
        this.clickDelay = 200; // milliseconds


        //== setup dom elements
        // retrieve reference to ui container div
        this.uiContainer = select('#ui-container');
        // setup input and anneal ui element containers
        this.inputContainer = createDiv().parent(this.uiContainer).id('input-container');
        this.annealContainer = createDiv().parent(this.uiContainer).id('anneal-container');

        // initialize UI elements
        this.initInputUI();
        this.initAnnealUI();
        this.resetInputGrid();
    }

    initInputUI() {
        // setup ui elements for input screen

        // create input fields and buttons row div
        let inputButtonRow = createDiv();
        inputButtonRow.parent(this.inputContainer);
        inputButtonRow.addClass('input-button-row');

        // create the title input field
        let titleLabel = createP('Title:');
        titleLabel.parent(inputButtonRow).addClass('input-label');
        let titleInput = createInput('');
        titleInput.parent(inputButtonRow).addClass('input-field');
        titleInput.attribute('size', '20');

        // create the SAVE button
        let saveButton = createButton('SAVE');
        saveButton.parent(inputButtonRow).addClass('button');
        saveButton.mousePressed(() => this.saveShape());

        // create the NEXT button
        let nextButton = createButton('ANNEAL');
        nextButton.parent(inputButtonRow).addClass('button');
        nextButton.attribute('disabled', ''); // until 2 shapes are saved
        nextButton.mousePressed(() => this.nextToAnneal());

        // create the LOAD EXAMPLE button
        let exampleButton = createButton('LOAD EXAMPLE');
        exampleButton.parent(inputButtonRow).addClass('button');
        exampleButton.mousePressed(() => this.loadExampleShapes());

        // create a container for shape titles
        let shapeTitleContainer = createDiv('');
        shapeTitleContainer.parent(this.inputContainer).id('shape-title-container');

        // store elements to manage
        this.inputUIElements = {
            titleLabel,
            titleInput,
            saveButton,
            nextButton,
            exampleButton,
            shapeTitleContainer
        }

        // to do: re-enable depth input
        // // Create the depth input field
        // let depthLabel = createP('Depth:');
        // depthLabel.position(this.lrPadding, height + 45);
        // let depthInput = createInput('');
        // depthInput.position(this.lrPadding + 50, height + 60);
        // depthInput.attribute('size', '8');
    }

    initAnnealUI() {
        let reannealButton = createButton('RE-ANNEAL');
        reannealButton.parent(this.annealContainer).addClass('button');
        // re-anneal button gets it's handler function in Anneal.js

        // info text
        let diagnosticText = createP("(toggle 'd' key for diagnostics)");
        diagnosticText.parent(this.annealContainer).addClass('info-text');

        let growthText = createP("(press 'g' to grow cells)");
        growthText.parent(this.annealContainer).addClass('info-text');

        this.annealUIElements = {
            reannealButton,
            diagnosticText,
            growthText
        };

        // Initially hide the anneal container
        this.hideAnnealUI();
    }

    showInputUI() {
        this.inputContainer.removeClass('hidden');
    }

    hideInputUI() {
        this.inputContainer.addClass('hidden');
    }

    showAnnealUI() {
        this.annealContainer.removeClass('hidden');

        this.annealUIElements.growthText.addClass('hidden');
        if (annealingComplete && devMode) {
            this.annealUIElements.growthText.removeClass('hidden');
        }
    }

    hideAnnealUI() {
        this.annealContainer.addClass('hidden');
    }

    selectInputSquare(mouseX, mouseY, blockSelect = false) {
        // check if mouse click is within input grid
        // factor in padding on all sides
        let xValid = mouseX >= this.sidePadding && mouseX <= this.inputGridWidth + this.sidePadding;
        let yValid = mouseY >= this.sidePadding && mouseY <= this.inputGridHeight + this.sidePadding;
        if (xValid && yValid) {
            let gridX = Math.floor((mouseX - this.sidePadding) / this.inputSquareSize); // column
            let gridY = Math.floor((this.inputGridHeight + this.sidePadding - mouseY) / this.inputSquareSize); // row

            if (gridX >= 0 && gridX < this.inputCols && gridY >= 0 && gridY < this.inputRows) {
                let currentTime = millis();
                if (blockSelect || (currentTime - this.lastClickTime > this.clickDelay)) {
                    if (blockSelect) {
                        // used when dragging mouse
                        this.inputGrid[gridY][gridX] = true;
                    } else {
                        // used when clicking mouse
                        this.inputGrid[gridY][gridX] = !this.inputGrid[gridY][gridX];
                        this.lastClickTime = currentTime;
                    }
                    this.drawInputGrid();
                }
            }
        }
    }

    saveShape() {
        // // check if the shape is valid before saving
        // // check if the bottom has at least 1 clicked input square
        // if (this.inputGrid[0].includes(true)) {

        // find the shape title
        let titleValue = this.inputUIElements.titleInput.value();
        if (titleValue === '') { // no title entered by user
            titleValue = `shape-${shapes.length + 1}`;
        }

        // let depthValue = this.inputUIElements.depthInput.value();
        // if (depthValue === '') { // no depth entered by user
        //     console.error('no depth entered');
        // }

        // save the shape
        let newShape = new Shape(titleValue);
        // todo: replace hardcoded depth value (5) with user inputted depth
        // newShape.saveUserInput([...this.inputGrid], depthValue); // save a copy of the input grid
        newShape.saveUserInput([...this.inputGrid], 5); // save a copy of the input grid
        shapes.push(newShape);

        // Reset active shape and UI
        this.resetCanvas();

        // Enable the NEXT button if 2 shapes have been saved
        if (shapes.length > 1) {
            this.inputUIElements.nextButton.removeAttribute('disabled');
        }
        // } else {
        //     alert('Shape must have an input square selected on the bottom row.');
        // }
        isMousePressed = false;
    }

    nextToAnneal() {
        // 1. prep the inputted shapes for annealing the first solution
        // - wrap user inputted shapes with extra position
        // - gives each solution unique position data, while sharing the same shape data
        shapesPos = [];
        for (let i = 0; i < shapes.length; i++) {
            let shapeData = {
                data: shapes[i],
                // pos is bottom left corner of the shape, including overhangs
                posX: 0,
                posY: 0,
            };
            shapesPos.push(shapeData);
        }
        this.clearShapeTitles();

        // 2. change to the next user screen (annealing)
        // Switch away from the input screen
        inputScreen = false;
        // swap visible UI elements
        this.hideInputUI();
        this.showAnnealUI();

        isMousePressed = false;
        loop();
    }

    loadExampleShapes() {
        // loop preloaded data and populate shapes array
        shapes = [];
        for (let shape of shapeData) {
            // create new shape from saved data
            let newShape = new Shape(shape.title);
            newShape.saveUserInput(shape.inputGrid, parseInt(shape.shapeDepth));
            shapes.push(newShape);
        }

        // disable button press to prevent drag selection being left on
        setTimeout(() => {
            isMousePressed = false;
        }, this.clickDelay / 2); // Delay in milliseconds

        this.resetCanvas();
        this.inputUIElements.nextButton.removeAttribute('disabled');
        this.inputUIElements.exampleButton.attribute('disabled', ''); // until 2 shapes are saved
    }

    // input grid control functions
    resetCanvas() {
        background(255);
        this.inputUIElements.titleInput.value('');
        // todo: this.inputUIElements.depthInput.value('');
        this.resetInputGrid();
        this.drawInputGrid();
        this.displayShapeTitles();
    }

    resetInputGrid() {
        for (let i = 0; i < this.inputRows; i++) {
            this.inputGrid[i] = [];
            for (let j = 0; j < this.inputCols; j++) {
                this.inputGrid[i][j] = false;
            }
        }
    }

    drawInputGrid() {
        for (let x = 0; x < this.inputRows; x++) {
            for (let y = 0; y < this.inputCols; y++) {
                // draw input square
                if (this.inputGrid[y][x]) {
                    fill(0); // Fill black if the rect is clicked
                } else {
                    fill(255); // Fill white
                }

                let rectX = x * this.inputSquareSize
                let rectY = (this.inputGridHeight - this.inputSquareSize) - (y * this.inputSquareSize); // draw from bottom up

                rect(this.sidePadding + rectX, this.sidePadding + rectY, this.inputSquareSize, this.inputSquareSize);
            }
        }
    }

    displayShapeTitles() {
        this.clearShapeTitles();

        let titleContainer = this.inputUIElements.shapeTitleContainer

        for (let i = shapes.length - 1; i >= 0; i--) {
            let shapeTitle = createP(`${shapes[i].title}`).addClass('shape-title');
            shapeTitle.parent(titleContainer);
            this.shapeTitleElements.push(shapeTitle);
        }
    }

    clearShapeTitles() {
        for (let element of this.shapeTitleElements) {
            element.remove();
        }
        this.shapeTitleElements = [];
    }
}