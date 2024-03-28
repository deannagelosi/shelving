class Solution {
    constructor(_shapes) {
        this.shapes = _shapes; // shapes with position data
        this.layout = [[]]; // 2D array of shapes that occupy cells in the layout
        this.overlapPenalty = 2;
        this.overlappingCells = 0;
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
            totalArea += this.shapes[i].data.rectArea;
        }
        // add multiplier to give extra space to work with
        let designArea = totalArea * 4;
        // find the closest rectangle to the designArea
        let width = Math.floor(Math.sqrt(designArea));
        let height = Math.floor(designArea / width);

        //== Randomly choose initial shape locations in designArea ==//
        // loop shapes and randomly place in the layout
        for (let i = 0; i < this.shapes.length; i++) {
            let currShape = this.shapes[i];
            currShape.posX = Math.floor(Math.random() * width);
            currShape.posY = Math.floor(Math.random() * height);
        }
    }

    makeLayout() {
        // create a 2D array to represent the design space

        this.layout = [[]]; // clear the layout
        for (let i = 0; i < this.shapes.length; i++) {
            this.shapes[i].overlap = false;
        }

        // place shape boundaries in the grid
        for (let i = 0; i < this.shapes.length; i++) {
            let shape = this.shapes[i];
            // place shape boundary
            for (let y = 0; y < shape.data.boundaryHeight; y++) { // loop the boundary shape height and width
                for (let x = 0; x < shape.data.boundaryWidth; x++) {

                    // placing shapes, and growing the layout if shapes are placed outside of initial bounds
                    if (shape.data.boundaryShape[y][x]) {
                        let xInBounds = shape.posX + x < this.layout[0].length;
                        let yInBounds = shape.posY + y < this.layout.length;

                        while (!xInBounds) {
                            // grow the x+ direction
                            for (let i = 0; i < this.layout.length; i++) {
                                // grow every row with a new layoutData object
                                this.layout[i].push({ shapes: [] });
                            }
                            xInBounds = shape.posX + x < this.layout[0].length;
                        }
                        while (!yInBounds) {
                            // grow the y+ direction
                            // add a new row filled with unique objects
                            let newRow = new Array(this.layout[0].length).fill(null).map(() => ({ shapes: [] }));
                            this.layout.push(newRow);

                            yInBounds = shape.posY + y < this.layout.length;
                        }
                        // update occupancy of a cell in the layout
                        this.layout[shape.posY + y][shape.posX + x].shapes.push(shape);
                        // mark overlapping shapes
                        if (this.layout[shape.posY + y][shape.posX + x].shapes.length > 1) {
                            for (let j = 0; j < this.layout[shape.posY + y][shape.posX + x].shapes.length; j++) {
                                // change each shape at position (x,y) to overlap is True
                                this.layout[shape.posY + y][shape.posX + x].shapes[j].overlap = true;
                            }
                        }
                    }
                }
            }
        }

        // trim layout and remove empty rows
        // trim the last row if it's empty
        while (this.layout.length > 0 && this.layout[this.layout.length - 1].every(cell => cell.shapes.length == 0)) {
            this.layout.pop();
        }
        // trim the first row if it's empty
        while (this.layout.length > 0 && this.layout[0].every(cell => cell.shapes.length == 0)) {
            this.layout.shift();
        }
        // Remove all-zero columns from the right
        while (this.layout[0].length > 0 && this.layout.every(row => row[row.length - 1].shapes.length == 0)) {
            for (let i = 0; i < this.layout.length; i++) {
                this.layout[i].pop();
            }
        }
        // Remove all-zero columns from the left
        while (this.layout[0].length > 0 && this.layout.every(row => row[0].shapes.length == 0)) {
            for (let i = 0; i < this.layout.length; i++) {
                this.layout[i].shift();
            }
        }
    }

    showLayout() {
        let cellSizeHeight = canvasHeight / this.layout.length;
        let cellSizeWidth = canvasWidth / this.layout[0].length;
        let cellSize = Math.min(cellSizeHeight, cellSizeWidth);

        // display the design space grid
        stroke(0);
        strokeWeight(0.5);
        let designHeight = this.layout.length;
        let designWidth = this.layout[0].length;
        for (let x = 0; x < designWidth; x++) {
            for (let y = 0; y < designHeight; y++) {
                // draw cell
                if (this.layout[y][x].shapes.length == 1) {
                    fill(0); // black (shape)
                } else if (this.layout[y][x].shapes.length > 1) {
                    fill("red");  // collision
                }
                else if (this.layout[y][x].shapes.length == 0) {
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

        this.score = 0; // reset the score

        // todo: minimize top-heavy designs

        // count all the empty cells in the layout
        let emptyCells = 0;
        for (let i = 0; i < this.layout.length; i++) {
            for (let j = 0; j < this.layout[i].length; j++) {
                if (this.layout[i][j].shapes.length == 0) {
                    emptyCells++;
                }
            }
        }

        // find cells that contain more than one shape
        // add to a running total of overlapping cells
        this.overlappingCells = 0;
        for (let i = 0; i < this.layout.length; i++) {
            for (let j = 0; j < this.layout[i].length; j++) {
                if (this.layout[i][j].shapes.length > 1) {
                    this.overlappingCells += this.layout[i][j].shapes.length - 1;
                }
            }
        }

        this.score = emptyCells + (this.overlappingCells * this.overlapPenalty);
    }

    makeNeighbor(_tempCurr, _tempMax, _tempMin) {
        // create a new solution that's a neighbor to the current solution

        // make a shallow copy of shapes; ie new posX and posY, but same shape data
        let shapesCopy = this.shapes.map(shape => ({ ...shape }));
        let newSolution = new Solution(shapesCopy);
        // pick random number between 1 and 5
        // pick random shape

        // pick a shape that is overlapping or a random shape
        let overlappingShapes = newSolution.shapes.filter(shape => shape.overlap);
        let selectedShape;
        if (overlappingShapes.length > 0) {
            selectedShape = overlappingShapes[0];
        } else {
            let shapeIndex = Math.floor(Math.random() * this.shapes.length);
            selectedShape = newSolution.shapes[shapeIndex];
        }

        let shiftMax = 10; // maximum shift distance
        let shiftMin = 1; // minimum shift distance
        let shiftCurr = this.mapValueThenRound(_tempCurr, _tempMax, _tempMin, shiftMax, shiftMin);

        let randOption = Math.floor(Math.random() * 2) + 1;
        if (randOption == 1) { // shift x-value
            if (Math.random() < 0.6) { // more likely to decrease x
                selectedShape.posX -= shiftCurr;
            } else {
                selectedShape.posX += shiftCurr;
            }
        } else if (randOption == 2) { // shift y-value
            if (Math.random() < 0.6) { // more likely to decrease y
                selectedShape.posY -= shiftCurr;
            } else {
                selectedShape.posY += shiftCurr;
            }
        }
        // else if (randOption == 3) { // shift a shape by shiftCurr in +y
        //     newSolution.shapes[randShape].posY += shiftCurr;

        // } else if (randOption == 4) { // shift a shape by shiftCurr in -y
        //     newSolution.shapes[randShape].posY -= shiftCurr;

        // } 
        // else if (randOption == 5) { // pick two shapes and swap their positions
        //     let randShape2 = Math.floor(Math.random() * this.shapes.length);
        //     let tempX = newSolution.shapes[randShape].posX;
        //     let tempY = newSolution.shapes[randShape].posY;
        //     newSolution.shapes[randShape].posX = newSolution.shapes[randShape2].posX;
        //     newSolution.shapes[randShape].posY = newSolution.shapes[randShape2].posY;
        //     newSolution.shapes[randShape2].posX = tempX;
        //     newSolution.shapes[randShape2].posY = tempY;
        // }
        // check if the new position is within bounds (not negative)
        if (selectedShape.posX < 0) {
            selectedShape.posX = 0;
        }
        if (selectedShape.posY < 0) {
            selectedShape.posY = 0;
        }

        return newSolution;
    }

    mapValueThenRound(oldCurr, oldMin, oldMax, newMin, newMax) {
        let newCurr = ((oldCurr - oldMin) / (oldMax - oldMin)) * (newMax - newMin) + newMin;
        return Math.round(newCurr);
    }
}