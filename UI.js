class UI {
    constructor() {
        // input control variables
        // User input grid size
        let maxInputInches = 10;
        this.inputRows = maxInputInches * 4; // 0.25" squares input fidelity
        this.inputCols = this.inputRows;
        this.inputSquareSize = Math.floor(Math.min(canvasWidth, canvasHeight) / (this.inputRows + 1));
        this.inputGridHeight = (this.inputRows * this.inputSquareSize);
        this.inputGridWidth = (this.inputCols * this.inputSquareSize);
        this.inputGrid = [];
        // Initialize the stack for square selection history
        // this.selectionHistory = [];
        // Track shape titles displaying to hide later

        // manage debounce
        this.lastClickTime = 0;
        this.clickDelay = 200; // milliseconds

        // layout variables
        this.tbPadding = this.inputSquareSize; // top bottom
        this.lrPadding = this.inputSquareSize / 2; // left right

        // stores the labels, inputs, and buttons for the screens
        this.inputUIElements = {};
        this.shapeTitleElements = [];
        this.annealUIElements = {};

        // Create and store reference to the main container
        this.mainContainer = select('#ui-container');
        if (!this.mainContainer) {
            this.mainContainer = createDiv();
            this.mainContainer.id('ui-container');
        }

        // Create sub-containers
        this.inputContainer = createDiv();
        this.inputContainer.parent(this.mainContainer);
        this.inputContainer.id('input-container');

        this.annealContainer = createDiv();
        this.annealContainer.parent(this.mainContainer);
        this.annealContainer.id('anneal-container');

        // move UI elements into main container
        this.initInputUI()
        this.initAnnealUI();
        this.resetInputGrid();
    }

    initInputUI() {
        // Create the title input field
        let titleLabel = createP('Title:');
        titleLabel.parent(this.inputContainer);
        let titleInput = createInput('');
        titleInput.parent(this.inputContainer);
        titleInput.attribute('size', '20');

        // // Create the depth input field
        // let depthLabel = createP('Depth:');
        // depthLabel.position(this.lrPadding, height + 45);
        // let depthInput = createInput('');
        // depthInput.position(this.lrPadding + 50, height + 60);
        // depthInput.attribute('size', '8');

        // Create the SAVE button
        let saveButton = createButton('SAVE');
        saveButton.parent(this.inputContainer);
        saveButton.mousePressed(() => this.saveShape());

        // Create the NEXT button
        let nextButton = createButton('ANNEAL');
        nextButton.parent(this.inputContainer);
        nextButton.attribute('disabled', ''); // until 2 shapes are saved
        nextButton.mousePressed(() => this.nextToAnneal());

        // Create the LOAD EXAMPLE button
        let exampleButton = createButton('LOAD EXAMPLE');
        exampleButton.parent(this.inputContainer);
        exampleButton.mousePressed(() => this.loadExampleShapes());

        // Create a container for shape titles
        let shapeTitleContainer = createDiv('');
        shapeTitleContainer.parent(this.inputContainer);
        shapeTitleContainer.id('shapeTitleContainer');

        // Set dimensions and style
        shapeTitleContainer.style('height', '60px');
        shapeTitleContainer.style('width', `${(this.inputCols * (this.inputSquareSize - 1))}px`);
        shapeTitleContainer.style('overflow-y', 'scroll');
        shapeTitleContainer.style('border', '1px solid #ccc');

        // store elements to manage
        this.inputUIElements = {
            titleLabel,
            titleInput,
            saveButton,
            nextButton,
            exampleButton,
            shapeTitleContainer
        }
    }

    initAnnealUI() {
        let reannealButton = createButton('RE-ANNEAL');
        reannealButton.parent(this.annealContainer);
        // reannealButton.mousePressed(() => this.reAnneal());

        // info text
        let diagnosticText = createP("(toggle 'd' key for diagnostics)");
        diagnosticText.parent(this.annealContainer);
        diagnosticText.style('color', '#A9A9A9'); // text color light grey

        let growthText = createP("(press 'g' to grow cells)");
        growthText.parent(this.annealContainer);
        growthText.style('color', '#A9A9A9'); // text color light grey

        this.annealUIElements = {
            reannealButton,
            diagnosticText,
            growthText
        };

        // initially hide the anneal container
        this.hideAnnealContainer();
    }

    // show and hide screens functions
    showInputContainer() {
        this.inputContainer.show();
    }

    hideInputContainer() {
        this.inputContainer.hide();
    }

    showAnnealContainer() {
        this.annealContainer.show();

        this.annealUIElements.growthText.hide();
        if (annealingComplete && devMode) {
            this.annealUIElements.growthText.show();
        }
    }

    hideAnnealContainer() {
        this.annealContainer.hide();
    }

    // button handlers
    // reAnneal() {
    //     // function is binded to this in anneal.js
    // }

    selectInputSquare(mouseX, mouseY, blockSelect = false) {
        let xValid = mouseX >= this.lrPadding && mouseX <= this.inputGridWidth + this.lrPadding;
        let yValid = mouseY >= this.tbPadding && mouseY <= this.inputGridHeight + this.tbPadding;
        if (xValid && yValid) {
            let gridX = Math.floor((mouseX - this.lrPadding) / this.inputSquareSize); // Column
            let gridY = Math.floor((this.inputGridHeight + this.tbPadding - mouseY) / this.inputSquareSize); // Row

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
        // check if the shape is valid before saving
        // check if the bottom has at least 1 clicked inout square
        if (this.inputGrid[0].includes(true)) {
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
            // newShape.saveUserInput([...this.inputGrid], depthValue); // save a copy of the input grid
            newShape.saveUserInput([...this.inputGrid], 5); // save a copy of the input grid
            shapes.push(newShape);
            // console log the json

            // Reset active shape and UI
            this.resetCanvas();

            // Enable the NEXT button if 2 shapes have been saved
            if (shapes.length > 1) {
                this.inputUIElements.nextButton.removeAttribute('disabled');
            }
        } else {
            alert('Shape must have an input square selected on the bottom row.');
        }
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

        // 2. change to the next user screen (annealing)
        // Switch away from the input screen
        inputScreen = false;
        // Hide all UI elements
        this.hideInputContainer();
        this.showAnnealContainer();

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
        // this.inputUIElements.depthInput.value('');
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

                rect(this.lrPadding + rectX, this.tbPadding + rectY, this.inputSquareSize, this.inputSquareSize);
            }
        }
    }

    displayShapeTitles() {
        // clear any existing shapes
        for (let element of this.shapeTitleElements) {
            element.remove(); // Remove the element from the screen
        }
        this.shapeTitleElements = []; // Clear the array

        let row = createDiv('');
        row.parent(this.inputUIElements.shapeTitleContainer);
        row.style('display', 'flex');
        row.style('flex-wrap', 'wrap');

        for (let i = shapes.length - 1; i >= 0; i--) {
            let shapeTitle = createP(`${shapes[i].title}`);
            shapeTitle.parent(row);
            shapeTitle.style('margin', '5px 10px 5px 0');
            shapeTitle.style('white-space', 'nowrap');
            this.shapeTitleElements.push(shapeTitle);
        }
    }
}