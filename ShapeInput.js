class ShapeInput {
    constructor() {
        // User input grid size
        this.inputRows;
        this.inputCols;
        this.inputGrid = [];
        this.inputCellSize = 50;
        this.padding = 100;

        // Create the title input field
        this.titleLabel = createP('Title:');
        this.titleLabel.position(10, height + 5);
        this.titleInput = createInput('');
        this.titleInput.position(50, height + 20);
        this.titleInput.attribute('maxlength', '25');

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

        this.inputRows = (canvasWidth - (this.padding * 2)) / this.inputCellSize;
        this.inputCols = (canvasHeight - (this.padding * 2)) / this.inputCellSize;
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
        let gridHeight = this.inputRows * this.inputCellSize;

        for (let x = 0; x < this.inputRows; x++) {
            for (let y = 0; y < this.inputCols; y++) {
                // draw cell
                if (this.inputGrid[y][x]) {
                    fill(0); // Fill black if the rect is clicked
                } else {
                    fill(255); // Fill white
                }
                let rectX = this.padding + (x * this.inputCellSize);
                let rectY = (gridHeight + this.padding/2) - (y * this.inputCellSize); // draw from bottom up
                rect(rectX, rectY, this.inputCellSize, this.inputCellSize);
            }
        }
    }

    selectInputCell(mouseX, mouseY) {
        let xValid = mouseX >= this.padding && mouseX <= canvasWidth - this.padding;
        let yValid = mouseY >= this.padding && mouseY <= canvasHeight - this.padding;
        if (xValid && yValid) {

            let gridX = Math.floor((mouseX - this.padding) / this.inputCellSize); // Column
            let gridY = Math.floor((canvasHeight - this.padding - mouseY) / this.inputCellSize); // Row

            if (gridX >= 0 && gridX < this.inputCols && gridY >= 0 && gridY < this.inputRows) {
                this.inputGrid[gridY][gridX] = !this.inputGrid[gridY][gridX]; // Toggle the state
                console.log("inputGrid: ", this.inputGrid);
                this.drawInputGrid(); // Redraw to update clicked state
            }
        }

    }

    saveShape() {
        // check if the shape is valid before saving
        let bottomRow = this.inputGrid[this.inputGrid.length - 1];

        // check if the bottom has at least 1 clicked cell
        if (bottomRow.includes(true)) {
            // find the shape title
            let titleValue = this.titleInput.value();
            if (titleValue === '') { // no title entered by user
                titleValue = `shape-${shapes.length + 1}`;
            }

            // save the shape
            let newShape = new Shape(titleValue);
            newShape.saveUserInput([...this.inputGrid]); // save a copy of the input grid
            shapes.push(newShape);
            // console.log(shapes);
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
        this.resetInputGrid();
        this.drawInputGrid();
        this.displayShapeTitles();
    }

    displayShapeTitles() {
        // Start below the title input box
        let startY = this.titleInput.y + 25;
        // Display each shape's title
        for (let i = 0; i < shapes.length; i++) {
            let shapeTitle = createP(`${shapes[i].title}`);
            shapeTitle.position(10, startY + (i * 25));
        }
    }
}