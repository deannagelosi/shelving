class Case {
    constructor() {
        this.caseWidth;
        this.caseHeight;

        this.shortShapes = [];
        this.tallShapes = [];
        this.columnHeights = [];
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
        // create new 2D array with the following format (each row is a column in a case):
        // [[tallShapes[2], tallShapes[1], tallShapes[0],
        // [shortShapes[3], shortShapes[2], shortShapes[1], shortShapes[0]],
        // [tallShapes[5], tallShapes[4], tallShapes[3]]
        this.positions = [
            [this.tallShapes[2], this.tallShapes[1], this.tallShapes[0]],
            [this.shortShapes[3], this.shortShapes[2], this.shortShapes[1], this.shortShapes[0]],
            [this.tallShapes[5], this.tallShapes[4], this.tallShapes[3]]
        ];

        // calculate the height of each column and set the height of the case
        this.calcHeights();

        // calculate the y value for each shape
        this.calcShapesY();

        // calculate the x value for each shape
        this.calcShapesX();



        // loop through each case row, adding up their widths
        // add up the rows in the case
        // set the widest row to the width of the case
        // find the x value for every shape
        // loop each row, calculate the x value and set it to the shape        
    }

    calcHeights() {
        // loop through each column, adding up their heights
        this.columnHeights = [];
        for (let i = 0; i < this.positions.length; i++) {
            let totalHeight = 0;
            for (let j = 0; j < this.positions[i].length; j++) {
                totalHeight += this.positions[i][j].height;
            }
            this.columnHeights.push(totalHeight);
        }
        // find the column with the tallest height, set as case height
        this.caseHeight = Math.max(...this.columnHeights);
    }

    calcShapesY() {
        // find the y value for every shape
        // loop each column, calculate the y value and set it to the shape
        for (let i = 0; i < this.positions.length; i++) {
            // extra height on shorter columns
            let colBuffer = [0, 0, 0];
            let numColShapes = this.positions[i].length;
            if (this.columnHeights[i] < this.caseHeight) {
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
            for (let j = 0; j < this.positions[i].length; j++) {
                if (j == 0) {
                    this.positions[i][j].posY = 0;
                }
                else {
                    let prevHeight = this.positions[i][j - 1].posY + this.positions[i][j - 1].height + colBuffer[j - 1];
                    this.positions[i][j].posY = prevHeight + this.shapeBuffer;
                }
            }
        }
        console.log("column heights: ", this.columnHeights);
        console.log(this.positions);
    }

    calcShapesX() {
        
    }
}