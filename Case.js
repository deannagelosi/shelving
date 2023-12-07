class Case {
    constructor() {
        this.caseWidth;
        this.caseHeight;
        this.caseGrid = [];
        this.caseCellSize = 20;
        this.tbPadding = 25; // left right
        this.lrPadding = 25; // left right

        this.columnHeights = [];
        this.rowWidths = [];

        this.shortShapes = [];
        this.tallShapes = [];
        this.positions = []; // shape positions in the case
    }

    sortShapes() {
        shapes.sort(function (a, b) {
            return a.boundaryHeight - b.boundaryHeight;
        });
        // four shortest shapes for middle column
        for (let i = 0; i < shapes.length; i++) {
            if (i < 4) {
                this.shortShapes.push(shapes[i]);
            } else {
                this.tallShapes.push(shapes[i]);
            }
        }
    }

    buildCase() {
        this.shuffleCaseLayout();

        // calculate height & width of each column and set height & width of the case
        this.calcHeights();
        this.calcWidths();

        // calculate the y and x value for each shape and place them in the case grid
        this.calcShapesY();
        this.calcShapesX();
        this.placeShapes();

        // display the case and shapes
        this.displayShapes();
        this.displayCase();

        // this.printCoords();
    }

    shuffleCaseLayout() {
        // randomize shortShapes and tallShapes to reposition objects
        shuffle(this.shortShapes, true);
        shuffle(this.tallShapes, true);
        // to do: could add sorting by width and height (ex: middle column widest on bottom)
        this.positions = [
            [this.tallShapes[5], this.tallShapes[4], this.tallShapes[3]],
            [this.shortShapes[3], this.shortShapes[2], this.shortShapes[1], this.shortShapes[0]],
            [this.tallShapes[2], this.tallShapes[1], this.tallShapes[0]]
        ];
    }

    calcHeights() {
        // loop through each column, adding up their heights
        this.columnHeights = [];
        for (let col = 0; col < this.positions.length; col++) {
            let totalHeight = 0;
            for (let row = 0; row < this.positions[col].length; row++) {
                totalHeight += this.positions[col][row].boundaryHeight;
            }
            this.columnHeights.push(totalHeight);
        }

        // find the column with the tallest height, set as case height
        this.caseHeight = Math.max(...this.columnHeights);
    }

    calcWidths() {
        // loop through each row, adding up their widths
        this.rowWidths = [];

        // find the width of each row
        for (let row = 0; row < this.positions.length; row++) {
            let totalWidth = 0;
            for (let col = 0; col < this.positions.length; col++) {
                totalWidth += this.positions[col][row].boundaryWidth;
            }
            this.rowWidths.push(totalWidth);
        }

        // find the row with the widest width, set as case width
        this.caseWidth = Math.max(...this.rowWidths);
    }

    calcShapesY() {
        // find the y value for every shape
        // loop each column, calculate the y value and set it to the shape
        for (let col = 0; col < this.positions.length; col++) {
            // extra height on shorter columns
            let colBuffer = [0, 0, 0];
            let numColShapes = this.positions[col].length;
            if (this.columnHeights[col] < this.caseHeight) {
                let heightDiff = (this.caseHeight - this.columnHeights[0]);
                if (heightDiff % numColShapes == 0) {
                    colBuffer[0] = heightDiff / numColShapes;
                    colBuffer[1] = heightDiff / numColShapes;
                    colBuffer[2] = heightDiff / numColShapes;
                } else {
                    colBuffer[0] = Math.floor(heightDiff / numColShapes) + 1; // remainder goes to first shape
                    colBuffer[1] = Math.floor(heightDiff / numColShapes);
                    colBuffer[2] = Math.floor(heightDiff / numColShapes);
                }
            }
            for (let row = 0; row < this.positions[col].length; row++) {
                if (row == 0) {
                    this.positions[col][row].posY = 0;
                }
                else {
                    let prevHeight = this.positions[col][row - 1].posY + this.positions[col][row - 1].boundaryHeight;
                    this.positions[col][row].posY = prevHeight + colBuffer[row - 1];
                }
            }
        }
    }

    calcShapesX() {
        // left justify items in the first (left) column
        // center items in the second (middle) column
        // right justify items in the third (right) column

        // loop the columns
        for (let col = 0; col < this.positions.length; col++) {
            // loop the rows
            for (let row = 0; row < this.positions[col].length; row++) {
                // calculate the x value
                let shapeWidth = this.positions[col][row].boundaryWidth;
                let x;
                if (col == 0) {
                    x = 0;
                } else if (col == 1) {
                    x = Math.floor((this.caseWidth - shapeWidth) / 2);
                } else if (col == 2) {
                    x = this.caseWidth - shapeWidth;
                }
                this.positions[col][row].posX = x;
            }
        }
    }

    printCoords() {
        for (let col = 0; col < this.positions.length; col++) {
            for (let row = 0; row < this.positions[col].length; row++) {
                let shape = this.positions[col][row];
                console.log(`${shape.title}: ${shape.posX}, ${shape.posY}, col: ${col}, row: ${row}`);
            }
        }
    }

    placeShapes() {
        // initialize grid case as all false
        for (let i = 0; i < this.caseHeight; i++) {
            this.caseGrid[i] = [];
            for (let j = 0; j < this.caseWidth; j++) {
                this.caseGrid[i][j] = 0; // 0 is empty
            }
        }

        // place boundaries and shapes in the grid, looping if there's a collision
        for (let i = 0; i < shapes.length; i++) {
            let shape = shapes[i];
            // place boundary shape
            for (let y = 0; y < shape.boundaryHeight; y++) { // loop the boundary shape height and width
                for (let x = 0; x < shape.boundaryWidth; x++) {
                    if (shape.boundaryShape[y][x]) {
                        // check for collision (cell already occupied)
                        if (this.caseGrid[shape.posY + y][shape.posX + x] != 0) {
                            console.log("collision");
                            // shape boundary collision, try again
                            buildIssue = true;
                            return;
                        }
                        this.caseGrid[shape.posY + y][shape.posX + x] = 2; // 2 is filled with a boundary for a shape
                    }
                }
            }

            // place shape
            for (let y = 0; y < shape.shapeHeight; y++) {
                for (let x = 0; x < shape.shapeWidth; x++) {
                    if (shape.shape[y][x]) {
                        this.caseGrid[shape.posY + y][shape.posX + x + 1] = 1; // 1 is filled with a shape
                    }
                }
            }
        }
    }

    displayShapes() {
        // display the case grid
        strokeWeight(0.5);
        for (let x = 0; x < this.caseWidth; x++) {
            for (let y = 0; y < this.caseHeight; y++) {
                // draw cell
                if (this.caseGrid[y][x] == 1) {
                    fill(0); // black (shape)
                } else if (this.caseGrid[y][x] == 2) {
                    fill("pink"); // pink (boundary shape)
                }
                else if (this.caseGrid[y][x] == 0) {
                    fill(255); // white (empty)
                }
                let caseGridHeight = this.caseHeight * this.caseCellSize;

                let rectX = x * this.caseCellSize;
                let rectY = (caseGridHeight - this.caseCellSize) - (y * this.caseCellSize); // draw from bottom up
                rect(this.lrPadding + rectX, this.tbPadding + rectY, this.caseCellSize, this.caseCellSize);
            }
        }
    }

    displayCase() {
        // display the outside edge of the case by drawing lines around the perimeter
        stroke(0);
        strokeWeight(3);
        noFill();
        rect(this.lrPadding, this.tbPadding, this.caseWidth * this.caseCellSize, this.caseHeight * this.caseCellSize);
    }
}