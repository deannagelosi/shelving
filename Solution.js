class Solution {
    constructor(_shapes) {
        this.shapes = _shapes;
        this.designSpace = [[]];
        this.overlappingModifier = 10;
        this.score;
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
        // find the closest rectangle to the designArea
        let width = Math.floor(Math.sqrt(designArea));
        let height = Math.floor(designArea / width);

        //== Randomly choose initial shape locations in designArea ==//
        // loop shapes and randomly place in the designSpace
        for (let i = 0; i < this.shapes.length; i++) {
            let currShape = this.shapes[i];
            currShape.posX = Math.floor(Math.random() * width);
            currShape.posY = Math.floor(Math.random() * height);
        }
    }



    makeDesignSpace() {
        // place shape boundaries in the grid
        for (let i = 0; i < this.shapes.length; i++) {
            let shape = this.shapes[i];
            // place shape boundary
            for (let y = 0; y < shape.boundaryHeight; y++) { // loop the boundary shape height and width
                for (let x = 0; x < shape.boundaryWidth; x++) {

                    // placing shapes, and growing the designSpace if shapes are placed outside of initial bounds
                    if (shape.boundaryShape[y][x]) {
                        let xInBounds = shape.posX + x < this.designSpace[0].length;
                        let yInBounds = shape.posY + y < this.designSpace.length;

                        while (!xInBounds) {
                            // grow the x+ direction
                            for (let i = 0; i < this.designSpace.length; i++) {
                                this.designSpace[i].push(0);
                            }
                            xInBounds = shape.posX + x < this.designSpace[0].length;
                        }
                        while (!yInBounds) {
                            // grow the y+ direction
                            this.designSpace.push(new Array(this.designSpace[0].length).fill(0));

                            yInBounds = shape.posY + y < this.designSpace.length;
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

        console.log("designSpace: ", this.designSpace);
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

        this.score = emptyCells + (overlappingCells * this.overlappingModifier);
        console.log("score: ", this.score);
    }

    makeNeighbor() {
        // create a new solution that's a neighbor to the current solution
        // option 1: shift a shape by 1 cell in +x
        // option 2: shift a shape by 1 cell in -x
        // option 3: shift a shape by 1 cell in +y
        // option 4: shift a shape by 1 cell in -y
        // option 5: pick two shapes and swap their positions
        let newSolution = new Solution(this.shapes);
        // pick random number between 1 and 5
        let randOption = Math.floor(Math.random() * 5) + 1;
        // pick random shape
        let randShape = Math.floor(Math.random() * this.shapes.length);
        if (randOption == 1) {
            newSolution.shapes[randShape].posX += 1;
        } else if (randOption == 2) {
            newSolution.shapes[randShape].posX -= 1;
        } else if (randOption == 3) {
            newSolution.shapes[randShape].posY += 1;
        } else if (randOption == 4) {
            newSolution.shapes[randShape].posY -= 1;
        } else if (randOption == 5) {
            let randShape2 = Math.floor(Math.random() * this.shapes.length);
            let tempX = newSolution.shapes[randShape].posX;
            let tempY = newSolution.shapes[randShape].posY;
            newSolution.shapes[randShape].posX = newSolution.shapes[randShape2].posX;
            newSolution.shapes[randShape].posY = newSolution.shapes[randShape2].posY;
            newSolution.shapes[randShape2].posX = tempX;
            newSolution.shapes[randShape2].posY = tempY;
        }

        return newSolution;
    }

    // == Helper Functions == //
    
}