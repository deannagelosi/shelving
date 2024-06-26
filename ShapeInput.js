class ShapeInput {
    constructor() {
        // User input grid size
        this.inputRows = 15;
        this.inputCols = 15;
        this.inputSquareSize = 35;
        this.inputGridHeight = (this.inputRows * this.inputSquareSize);
        this.inputGridWidth = (this.inputCols * this.inputSquareSize);
        this.inputGrid = [];

        this.tbPadding = 50; // top bottom
        this.lrPadding = 25; // left right

        // Initialize the stack for square selection history
        this.selectionHistory = [];
        // Track shape titles displaying to hide later
        this.shapeTitleElements = [];

        // Create the title input field
        this.titleLabel = createP('Title:');
        this.titleLabel.position(this.lrPadding, height + 5);
        this.titleInput = createInput('');
        this.titleInput.position(this.lrPadding + 40, height + 20);
        this.titleInput.attribute('size', '20');

        // Create the depth input field
        this.depthLabel = createP('Depth:');
        this.depthLabel.position(this.lrPadding, height + 45);
        this.depthInput = createInput('');
        this.depthInput.position(this.lrPadding + 50, height + 60);
        this.depthInput.attribute('size', '8');

        // Create the UNDO button
        this.undoButton = createButton('UNDO');
        this.undoButton.position(
            this.titleInput.x + this.titleInput.width + 10, height + 20
        );
        this.undoButton.mousePressed(() => this.undoLastSelection());

        // Create the SAVE button
        this.saveButton = createButton('SAVE');
        this.saveButton.position(
            this.undoButton.x + this.saveButton.width + 10, height + 20
        );
        this.saveButton.mousePressed(() => this.saveShape());

        // Create the NEXT button
        this.nextButton = createButton('NEXT');
        this.nextButton.attribute('disabled', ''); // until 2 shapes are saved
        this.nextButton.position(
            this.saveButton.x + this.nextButton.width + 10, height + 20
        );
        this.nextButton.mousePressed(() => this.moveToNextView());

        // Create the LOAD EXAMPLE button
        this.exampleButton = createButton('LOAD EXAMPLE');
        this.exampleButton.position(
            this.nextButton.x + this.exampleButton.width + 10, height + 20
        );
        this.exampleButton.mousePressed(() => this.loadExampleShapes());


        this.resetInputGrid();
    }

    resetInputGrid() {
        for (let i = 0; i < this.inputRows; i++) {
            this.inputGrid[i] = [];
            for (let j = 0; j < this.inputCols; j++) {
                this.inputGrid[i][j] = false;
            }
        }
    }

    moveToNextView() {
        // Set inputMode to false
        inputMode = false;

        // Hide all UI elements
        this.titleLabel.hide();
        this.titleInput.hide();
        this.depthLabel.hide();
        this.depthInput.hide();
        this.undoButton.hide();
        this.saveButton.hide();
        this.nextButton.hide();
        this.exampleButton.hide();
        // hide titles of shapes on screen
        this.clearShapeTitles();

        // loop to load the new screen
        loop();
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

    selectInputSquare(mouseX, mouseY) {
        let xValid = mouseX >= this.lrPadding && mouseX <= this.inputGridWidth + this.lrPadding;
        let yValid = mouseY >= this.tbPadding && mouseY <= this.inputGridHeight + this.tbPadding;
        if (xValid && yValid) {

            let gridX = Math.floor((mouseX - this.lrPadding) / this.inputSquareSize); // Column
            let gridY = Math.floor((this.inputGridHeight + this.tbPadding - mouseY) / this.inputSquareSize); // Row

            if (gridX >= 0 && gridX < this.inputCols && gridY >= 0 && gridY < this.inputRows) {
                if (!this.inputGrid[gridY][gridX]) {
                    this.inputGrid[gridY][gridX] = true;
                    this.drawInputGrid();

                    // Save the selection to history stack
                    this.selectionHistory.push({ x: gridX, y: gridY });
                }
            }
        }
    }

    undoLastSelection() {
        if (this.selectionHistory.length > 0) {
            const lastSelection = this.selectionHistory.pop();
            this.inputGrid[lastSelection.y][lastSelection.x] = false;
            this.drawInputGrid();
        }
    }

    saveShape() {
        // check if the shape is valid before saving
        // check if the bottom has at least 1 clicked inout square
        if (this.inputGrid[0].includes(true)) {
            // find the shape title
            let titleValue = this.titleInput.value();
            if (titleValue === '') { // no title entered by user
                titleValue = `shape-${shapes.length + 1}`;
            }

            let depthValue = this.depthInput.value();
            if (depthValue === '') { // no depth entered by user
                console.error('no depth entered');
            }

            // save the shape
            let newShape = new Shape(titleValue);
            newShape.saveUserInput([...this.inputGrid], depthValue); // save a copy of the input grid
            shapes.push(newShape);
            // console log the json
            console.log(JSON.stringify(shapes));

            // Reset active shape and UI
            this.resetCanvas();

            // Enable the NEXT button if 2 shapes have been saved
            if (shapes.length > 1) {
                this.nextButton.removeAttribute('disabled');
            }
        } else {
            alert('Shape must have an input square selected on the bottom row.');
        }
    }

    resetCanvas() {
        background(255);
        this.titleInput.value('');
        this.depthInput.value('');
        this.resetInputGrid();
        this.drawInputGrid();
        this.displayShapeTitles();
    }

    displayShapeTitles() {
        this.clearShapeTitles();

        let startY = this.titleInput.y + 75;
        for (let i = 0; i < shapes.length; i++) {
            let titleIndex = shapes.length - i - 1; // list shapes most recent first
            let shapeTitle = createP(`${shapes[titleIndex].title}`);
            shapeTitle.position(50, startY + (i * 25));
            this.shapeTitleElements.push(shapeTitle); // Store the element
        }
    }

    clearShapeTitles() {
        for (let element of this.shapeTitleElements) {
            element.remove(); // Remove the element from the screen
        }
        this.shapeTitleElements = []; // Clear the array
    }

    loadExampleShapes() {
        // loop preloaded data and populate shapes array
        shapes = [];
        for (let key in shapeData) {
            if (shapeData.hasOwnProperty(key)) {
                let inputShape = shapeData[key];
                // create shape
                let newShape = new Shape(inputShape.title);
                newShape.saveUserInput(inputShape.inputGrid, parseInt(inputShape.shapeDepth));
                shapes.push(newShape);
            }
        }

        this.resetCanvas();
        this.nextButton.removeAttribute('disabled');
    }
}