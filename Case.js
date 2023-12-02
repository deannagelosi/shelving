class Case {
    constructor() {
        this.caseWidth;
        this.caseHeight;

        this.columnHeights = [];
        this.rowWidths = [];

        this.shortShapes = [];
        this.tallShapes = [];
        this.positions = []; // shape positions in the case
        this.shapeBuffer = 1; // space between shapes on top and sides
    }

    sortShapes() {
        shapes.sort(function (a, b) {
            return a.height - b.height;
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
        // randomize shortShapes and tallShapes to reposition objects
        shuffle(this.shortShapes, true);
        shuffle(this.tallShapes, true);
        // to do: could add sorting by width and height (ex: middle column widest on bottom)

        // create new 2D array with the following format (each row is a column in a case):
        // [[tallShapes[2], tallShapes[1], tallShapes[0],
        // [shortShapes[3], shortShapes[2], shortShapes[1], shortShapes[0]],
        // [tallShapes[5], tallShapes[4], tallShapes[3]]
        this.positions = [
            [this.tallShapes[2], this.tallShapes[1], this.tallShapes[0]],
            [this.shortShapes[3], this.shortShapes[2], this.shortShapes[1], this.shortShapes[0]],
            [this.tallShapes[5], this.tallShapes[4], this.tallShapes[3]]
        ];

        // calculate the height and width of each column and set the height of the case
        this.calcHeights();
        this.calcWidths();

        // calculate the y and x value for each shape
        this.calcShapesY();

        // display the case
        this.displayCase();
        this.displayShapes();
    }

    calcHeights() {
        // loop through each column, adding up their heights
        this.columnHeights = [];
        for (let col = 0; col < this.positions.length; col++) {
            let totalHeight = 0;
            for (let row = 0; row < this.positions[col].length; row++) {
                totalHeight += this.positions[col][row].height + this.shapeBuffer;
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
                totalWidth += this.positions[col][row].width + (2 * this.shapeBuffer);
            }
            this.rowWidths.push(totalWidth);
        }
        // push the top row (middle column has 4 shapes)
        let totalWidth = 0;
        totalWidth += this.positions[0][2].width + (2 * this.shapeBuffer);
        totalWidth += this.positions[1][3].width + (2 * this.shapeBuffer);
        totalWidth += this.positions[2][2].width + (2 * this.shapeBuffer);
        this.rowWidths.push(totalWidth);

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
                    let prevHeight = this.positions[col][row - 1].posY + this.positions[col][row - 1].height;
                    this.positions[col][row].posY = prevHeight + colBuffer[row - 1] + this.shapeBuffer;
                }
            }
        }
    }

    calcShapesX() {
        console.log("row widths", this.rowWidths);

        // left justify items in the first (left) column
        // center items in the second (middle) column
        // right justify items in the third (right) column
        // loop the columns
        for (let col = 0; col < this.positions.length; col++) {
            // loop the rows
            for (let row = 0; row < this.positions[col].length; row++) {
                // calculate the x value
                let shapeWidth = this.positions[col][row].width;
                let colWidth = this.rowWidths[row];
                let x;
                if (col == 0) {
                    x = 0;
                } else if (col == 1) {
                    x = (colWidth - shapeWidth) / 2;
                } else if (col == 2) {
                    x = colWidth - shapeWidth;
                }
                this.positions[col][row].posX = x;
            }
        }
    }

    displayCase() {
        // display the outside edge of the case by drawing lines around the perimeter
        stroke(0);
        strokeWeight(2);
        noFill();

        let smallCell = cellSize / 4;
        
        rect(20, 100, this.caseWidth * smallCell, this.caseHeight * smallCell);
    }

    displayShapes() {
        // to do: here
    }
}