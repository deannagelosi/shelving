class UI {
    constructor() {
        // User input grid size
        this.inputRows;
        this.inputCols;
        this.inputGrid = [];

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
    }

    setupInputGrid(_rows, _cols) {
        this.inputRows = _rows;
        this.inputCols = _cols;
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
                rect(x * cellSize, y * cellSize, cellSize, cellSize);
            }
        }
    }

    selectInputCell(mouseX, mouseY) {
        let gridX = Math.floor(mouseX / cellSize); // Column
        let gridY = Math.floor(mouseY / cellSize); // Row

        if (gridX >= 0 && gridX < this.inputCols && gridY >= 0 && gridY < this.inputRows) {
            this.inputGrid[gridY][gridX] = !this.inputGrid[gridY][gridX]; // Toggle the state
            this.drawInputGrid(); // Redraw to update clicked state
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
            console.log(shapes);
            // console.log(JSON.stringify(shapes));

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