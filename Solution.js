class Solution {
    constructor(_shapes) {
        this.shapes = _shapes; // shapes with position data
        this.layout = [[]]; // 2D array of shapes that occupy cells in the layout
        this.overlappingCells = 0;
        this.overlapPenalty = 50;

        // aggregate for empty cell clusterScores
        this.whitespace = 0;
        this.minWhitespace = 500;
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

        // place cell data about shapes into the layout grid
        for (let i = 0; i < this.shapes.length; i++) {
            let shape = this.shapes[i];
            // place shape boundary

            let cellData = {
                shapes: [],
                isShape: false
            };

            for (let y = 0; y < shape.data.boundaryHeight; y++) { // loop the boundary shape height and width
                for (let x = 0; x < shape.data.boundaryWidth; x++) {

                    // placing shapes, and growing the layout if shapes are placed outside of initial bounds
                    if (shape.data.boundaryShape[y][x]) {

                        // grow the layout to fit the shape
                        let xInBounds = shape.posX + x + 1 < this.layout[0].length;
                        let yInBounds = shape.posY + y < this.layout.length;

                        while (!xInBounds) {
                            // grow the x+ direction by two
                            for (let i = 0; i < this.layout.length; i++) {
                                // grow every row with a new cellData object
                                this.layout[i].push(JSON.parse(JSON.stringify(cellData)));
                                this.layout[i].push(JSON.parse(JSON.stringify(cellData)));
                            }
                            xInBounds = shape.posX + x + 1 < this.layout[0].length;
                        }
                        while (!yInBounds) {
                            // grow the y+ direction
                            // add a new row filled with unique objects
                            let newRow = new Array(this.layout[0].length).fill(null).map(() => (JSON.parse(JSON.stringify(cellData))));
                            this.layout.push(newRow);

                            yInBounds = shape.posY + y < this.layout.length;
                        }

                        // update occupancy of a cell in the layout
                        this.layout[shape.posY + y][shape.posX + x].shapes.push(shape);

                        // mark if the cell is occupied by a shape or the shape's boundary
                        let shapeInBounds = y < shape.data.shape.length && x < shape.data.shape[0].length;
                        this.layout[shape.posY + y][shape.posX + x + 1].isShape = shapeInBounds && shape.data.shape[y][x];
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
        textSize(10);
        let designHeight = this.layout.length;
        let designWidth = this.layout[0].length;
        for (let x = 0; x < designWidth; x++) {
            for (let y = 0; y < designHeight; y++) {
                // draw cell
                if (this.layout[y][x].shapes.length == 0) {
                    fill(255); // white (empty)
                } else if (this.layout[y][x].shapes.length == 1) {
                    // fill the cell pink if it's occupied by the boundary shape
                    fill(255, 192, 203); // pink (boundary)
                    if (this.layout[y][x].isShape) {
                        // fill the cell black if it's occupied by the shape
                        fill(0); // black (shape)
                    }
                } else if (this.layout[y][x].shapes.length > 1) {
                    fill("red");  // collision
                }

                let rectX = x * cellSize;
                let rectY = (canvasHeight - cellSize) - (y * cellSize); // draw from bottom up
                rect(rectX, rectY, cellSize, cellSize);

                // place the minesweeper score in the cell if its empty
                if (this.layout[y][x].clusterScore > 0) {
                    fill(0); // black (shape)
                    text(this.layout[y][x].clusterScore, rectX + cellSize / 4, rectY + cellSize);
                }
            }
        }
    }

    calcScore() {
        // the objective function in simulated annealing

        this.score = 0; // reset the score

        // todo: minimize top-heavy designs

        // count all the empty cells in the layout
        this.whitespace = 0;
        for (let i = 0; i < this.layout.length; i++) {
            for (let j = 0; j < this.layout[i].length; j++) {
                if (this.layout[i][j].shapes.length == 0) {
                    // cell is empty
                    let cScore = 0;
                    // check the 8 possible adjacent cells
                    for (let x = Math.max(0, i - 1); x <= Math.min(i + 1, this.layout.length - 1); x++) {
                        for (let y = Math.max(0, j - 1); y <= Math.min(j + 1, this.layout[0].length - 1); y++) {
                            // don't count the cell itself
                            if (x !== i || y !== j) {
                                // count if the adjacent cell is empty
                                if (this.layout[x][y].shapes.length == 0) {
                                    cScore++;
                                }
                            }
                        }
                    }
                    // assign the score to the cell
                    this.layout[i][j].clusterScore = cScore;
                    this.whitespace += cScore;
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

        this.score = (this.whitespace) + (this.overlappingCells * this.overlapPenalty);
    }

    makeNeighbor(_tempCurr, _tempMax, _tempMin) {
        // create a new solution that's a neighbor to the current solution

        // make a shallow copy of shapes; ie new posX and posY, but same shape data
        let shapesCopy = this.shapes.map(shape => ({ ...shape }));
        let newSolution = new Solution(shapesCopy);

        // pick shift amount based on temperature
        let shiftMax = 10; // maximum shift distance
        let shiftMin = 1; // minimum shift distance
        let shiftCurr = this.mapValueThenRound(_tempCurr, _tempMax, _tempMin, shiftMax, shiftMin);

        // pick a random shape to act on
        let shapeIndex = Math.floor(Math.random() * this.shapes.length);
        let selectedShape = newSolution.shapes[shapeIndex];

        // pick a randomly to shift the shape or swap with another shape
        let randOption = Math.floor(Math.random() * 9) + 1;
        if (randOption == 1 || randOption == 2) {
            selectedShape.posX -= shiftCurr; // shift x-value smaller

        } else if (randOption == 3 || randOption == 4) {
            selectedShape.posX += shiftCurr; // shift x-value bigger

        } else if (randOption == 5 || randOption == 6) {
            selectedShape.posY -= shiftCurr; // shift y-value smaller

        } else if (randOption == 7 || randOption == 8) {
            selectedShape.posY += shiftCurr; // shift y-value bigger

        }
        else if (randOption == 9) { // pick two shapes and swap their positions
            // choose second shape for swap
            let shapeIndex2 = Math.floor(Math.random() * this.shapes.length);
            let selectedShape2 = newSolution.shapes[shapeIndex2];

            let tempX = selectedShape.posX;
            let tempY = selectedShape.posY;
            selectedShape.posX = selectedShape2.posX;
            selectedShape.posY = selectedShape2.posY;
            selectedShape2.posX = tempX;
            selectedShape2.posY = tempY;
        }

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