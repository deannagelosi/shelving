class Solution {
    constructor(_shapes) {
        this.shapes = _shapes;
        this.designSpace = [];
        this.numOutBounds = 0;
        this.overlappingModifier = 10;
    }

    setInitialSolution() {
        //== Create a Design Space ==//

        // this.shapes is an array of all shapes
        // the Shapes class has an attribute called rectArea
        // sum up all of the rectAreas for every shape
        // return the sum
        let totalArea = 0;
        for (let i = 0; i < this.shapes.length; i++) {
            totalArea += this.shapes[i].rectArea;
        }
        // add multiplier to give extra space to work with
        let designArea = totalArea * 4;
        // make a rectangular grid with equivalent area to designArea
        // find the closest rectangle to the designArea
        let width = Math.floor(Math.sqrt(designArea));
        let height = Math.floor(designArea / width);
        // create a 2D array of the same width and height
        this.designSpace = new Array(height);
        for (let i = 0; i < height; i++) {
            this.designSpace[i] = new Array(width);
        }
        // console.log(this.designSpace);

        //== Place the shapes ==//
        // loop shapes and randomly place in the designSpace
        for (let i = 0; i < this.shapes.length; i++) {
            let currShape = this.shapes[i];
            currShape.posX = Math.floor(Math.random() * width);
            currShape.posY = Math.floor(Math.random() * height);
        }
    }

    placeShapes() {
        this.numOutBounds = 0;

        // initialize grid cell values as all empty (0 is empty)
        let designHeight = this.designSpace.length;
        let designWidth = this.designSpace[0].length;
        for (let i = 0; i < designHeight; i++) {
            this.designSpace[i] = [];
            for (let j = 0; j < designWidth; j++) {
                this.designSpace[i][j] = 0;
            }
        }

        // place shape boundaries in the grid
        for (let i = 0; i < this.shapes.length; i++) {
            let shape = this.shapes[i];
            // place shape boundary
            for (let y = 0; y < shape.boundaryHeight; y++) { // loop the boundary shape height and width
                for (let x = 0; x < shape.boundaryWidth; x++) {
                    // update designHeight and designWidth in case dimensions have changed
                    designHeight = this.designSpace.length;
                    designWidth = this.designSpace[0].length;

                    // placing shapes, and growing the designSpace if shapes are placed outside of initial bounds
                    if (shape.boundaryShape[y][x]) {
                        let yInBounds = shape.posY + y >= 0 && shape.posY + y < designHeight;
                        let xInBounds = shape.posX + x >= 0 && shape.posX + x < designWidth;

                        // grow if out of bounds for x or y
                        if (!yInBounds) {
                            this.designSpace.push(new Array(designWidth).fill(0));
                        } else if (!xInBounds) {
                            for (let i = 0; i < this.designSpace.length; i++) {
                                this.designSpace[i].push(0);
                            }
                        }
                        // update occupancy of a cell in the designSpace
                        this.designSpace[shape.posY + y][shape.posX + x] += 1;
                    }
                }
            }
        }

        // trim designSpace and remove empty rows
        // trim the last row if it's empty
        while (this.designSpace.length > 0 && this.designSpace[this.designSpace.length - 1].every(cell => cell === 0)) {
            this.designSpace.pop();
        }
        // trim the first row if it's empty
        while (this.designSpace.length > 0 && this.designSpace[0].every(cell => cell === 0)) {
            this.designSpace.shift();
        }
        // Remove all-zero columns from the right
        while (this.designSpace[0].length > 0 && this.designSpace.every(row => row[row.length - 1] === 0)) {
            for (let i = 0; i < this.designSpace.length; i++) {
                this.designSpace[i].pop();
            }
        }

        // Remove all-zero columns from the left
        while (this.designSpace[0].length > 0 && this.designSpace.every(row => row[0] === 0)) {
            for (let i = 0; i < this.designSpace.length; i++) {
                this.designSpace[i].shift();
            }
        }
    }

    showLayout() {
        let cellSizeHeight = canvasHeight / this.designSpace.length;
        let cellSizeWidth = canvasWidth / this.designSpace[0].length;
        let cellSize = Math.min(cellSizeHeight, cellSizeWidth);

        // display the design space grid
        stroke(0);
        strokeWeight(0.5);
        let designHeight = this.designSpace.length;
        let designWidth = this.designSpace[0].length;
        for (let x = 0; x < designWidth; x++) {
            for (let y = 0; y < designHeight; y++) {
                // draw cell
                if (this.designSpace[y][x] == 1) {
                    fill(0); // black (shape)
                } else if (this.designSpace[y][x] >= 2) {
                    fill("red");  // collision
                }
                else if (this.designSpace[y][x] == 0) {
                    fill(255); // white (empty)
                }

                let rectX = x * cellSize;
                let rectY = (canvasHeight - cellSize) - (y * cellSize); // draw from bottom up
                rect(rectX, rectY, cellSize, cellSize);
            }
        }
    }

    calcScore() {
        // the objective function in simulated annealing
        // objectives:
        // - minimize the number of empty cells
        // - minimize the number of overlapping cells
        // - TODO: minimize top-heavy designs
        
        // count all the zeros in the designSpace
        let emptyCells = 0;
        for (let i = 0; i < this.designSpace.length; i++) {
            for (let j = 0; j < this.designSpace[i].length; j++) {
                if (this.designSpace[i][j] == 0) {
                    emptyCells++;
                }
            }
        }

        // find cells where the value is greater than 1
        // add to a running total the value of the cell minus 1
        let overlappingCells = 0;
        for (let i = 0; i < this.designSpace.length; i++) {
            for (let j = 0; j < this.designSpace[i].length; j++) {
                if (this.designSpace[i][j] > 1) {
                    overlappingCells += this.designSpace[i][j] - 1;
                }
            }
        }

        let totalScore = emptyCells + (overlappingCells * this.overlappingModifier);
        console.log("totalScore: ", totalScore);
    }
}