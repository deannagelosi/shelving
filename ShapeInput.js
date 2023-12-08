class ShapeInput {
    constructor() {
        // User input grid size
        this.inputRows;
        this.inputCols;
        this.inputGrid = [];
        this.inputCellSize = 55;
        this.tbPadding = 50; // left right
        this.lrPadding = 50; // left right

        // Create the title input field
        this.titleLabel = createP('Title:');
        this.titleLabel.position(this.lrPadding, height + 5);
        this.titleInput = createInput('');
        this.titleInput.position(this.lrPadding + 40, height + 20);
        this.titleInput.attribute('size', '20');

        // Create the depth input field
        this.depthLabel = createP('Depth:');
        this.depthLabel.position(this.lrPadding, height + 50);
        this.depthInput = createInput('');
        this.depthInput.position(this.lrPadding + 50, height + 65);
        this.depthInput.attribute('size', '8');

        // Create the SAVE button
        this.saveButton = createButton('SAVE');
        this.saveButton.position(
            this.titleInput.x + this.titleInput.width + 10, height + 20
        );
        this.saveButton.mousePressed(() => this.saveShape());

        // Create the NEXT button
        this.nextButton = createButton('NEXT');
        this.nextButton.position(
            this.saveButton.x + this.saveButton.width + 10, height + 20
        );
        this.nextButton.mousePressed(() => this.displayAllShapes());

        this.inputRows = 10;
        this.inputCols = 10;
        this.gridHeight = (this.inputRows * this.inputCellSize);
        this.gridWidth = (this.inputCols * this.inputCellSize);
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

    drawInputGrid() {
        for (let x = 0; x < this.inputRows; x++) {
            for (let y = 0; y < this.inputCols; y++) {
                // draw cell
                if (this.inputGrid[y][x]) {
                    fill(0); // Fill black if the rect is clicked
                } else {
                    fill(255); // Fill white
                }

                let rectX = x * this.inputCellSize
                let rectY = (this.gridHeight - this.inputCellSize) - (y * this.inputCellSize); // draw from bottom up

                rect(this.lrPadding + rectX, this.tbPadding + rectY, this.inputCellSize, this.inputCellSize);
            }
        }
    }

    selectInputCell(mouseX, mouseY) {
        let xValid = mouseX >= this.lrPadding && mouseX <= this.gridWidth + this.lrPadding;
        let yValid = mouseY >= this.tbPadding && mouseY <= this.gridHeight + this.tbPadding;
        if (xValid && yValid) {

            let gridX = Math.floor((mouseX - this.lrPadding) / this.inputCellSize); // Column
            let gridY = Math.floor((this.gridHeight + this.tbPadding - mouseY) / this.inputCellSize); // Row

            if (gridX >= 0 && gridX < this.inputCols && gridY >= 0 && gridY < this.inputRows) {
                this.inputGrid[gridY][gridX] = !this.inputGrid[gridY][gridX]; // Toggle the state
                this.drawInputGrid(); // Redraw to update clicked state
            }
        }

    }

    saveShape() {
        // check if the shape is valid before saving
        // check if the bottom has at least 1 clicked cell
        if (this.inputGrid[0].includes(true)) {
            // find the shape title
            let titleValue = this.titleInput.value();
            if (titleValue === '') { // no title entered by user
                titleValue = `shape-${shapes.length + 1}`;
            }

            let depthValue = this.depthInput.value();
            if (depthValue === '') { // no depth entered by user
                console.log('no depth entered');
            }

            // save the shape
            let newShape = new Shape(titleValue);
            newShape.saveUserInput([...this.inputGrid], depthValue); // save a copy of the input grid
            shapes.push(newShape);
            // console log the json
            console.log(JSON.stringify(shapes));

            // Reset active shape and UI
            this.resetCanvas();
        } else {
            alert('Shape must have a cell selected on the bottom row.');
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
        // Start below the title input box
        let startY = this.titleInput.y + 75;
        // Display each shape's title
        for (let i = 0; i < shapes.length; i++) {
            let shapeTitle = createP(`${shapes[i].title}`);
            shapeTitle.position(50, startY + (i * 25));
        }
    }
}