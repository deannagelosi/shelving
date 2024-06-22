class Cellular {
    constructor(_solution) {
        this.cellSpace = [[]]; // 2D array of intersections on the layout grid where cells live
        this.pathValues = [[]]; // 2D array of each path's (lines on the layout) height value
        this.layout = _solution.layout; // array of shapes in their annealed position
        this.layoutHeight = this.layout.length;
        this.layoutWidth = this.layout[0].length;
        this.shapes = _solution.shapes; // array of shapes and their positions
        this.squareSize = _solution.squareSize; // size of each square in the layout
        this.maxTerrain = 0; // maximum terrain height for the layout, gets assigned to shapes
    }

    createTerrain() {
        // assign values to all squares in the layout to make topography
        // initial state: all spots occupied by shapes start at infinity, all empty spots start at 0
        // loop until none are zero, adding a point to any touching a non-zero value
        // repeat until all train values are greater than 0

        // set up initial state
        // clear the existing terrain values
        for (let y = 0; y < this.layoutHeight; y++) {
            for (let x = 0; x < this.layoutWidth; x++) {
                this.layout[y][x].terrainValue = 0;
            }
        }
        let prevValues = [];

        for (let y = 0; y < this.layoutHeight; y++) {
            prevValues.push([]);
            for (let x = 0; x < this.layoutWidth; x++) {
                if (this.layout[y][x].shapes.length > 0) {
                    // shape at (x,y) assigned a score of infinity
                    this.layout[y][x].terrainValue = Infinity;
                    prevValues[y].push(Infinity);
                } else {
                    // no shapes at (x,y) assigned a initial score of 0
                    this.layout[y][x].terrainValue = 0;
                    prevValues[y].push(0);
                }
            }
        }
        // loop until all squares have a score greater than 0
        // increment the terrain when touching a square with a non-zero terrain, even diagonally
        // stash the updated values to reference the next loop in prevValues

        let numZero;
        while (numZero != 0) {
            numZero = 0;
            // loop until no zero terrain values
            for (let y = 0; y < this.layoutHeight; y++) {
                for (let x = 0; x < this.layoutWidth; x++) {
                    let numTouch = 0;
                    if (prevValues[y][x] != Infinity) {
                        // check the 8 possible adjacent squares
                        for (let localY = Math.max(0, y - 1); localY <= Math.min(y + 1, this.layoutHeight - 1); localY++) {
                            for (let localX = Math.max(0, x - 1); localX <= Math.min(x + 1, this.layoutWidth - 1); localX++) {
                                // don't count the square itself
                                if (localX !== x || localY !== y) {
                                    // count if the adjacent square has a value
                                    if (prevValues[localY][localX] > 0) {
                                        numTouch++;
                                    }
                                }
                            }
                        }
                        // add to the terrain value 
                        this.layout[y][x].terrainValue += numTouch;
                        // update the max terrain value
                        if (this.layout[y][x].terrainValue > this.maxTerrain) {
                            this.maxTerrain = this.layout[y][x].terrainValue;
                        }
                        // calculate the number remaining with a score of 0
                        if (numTouch == 0) {
                            numZero++;
                        }
                    }
                }
            }
            // current scores become previous scores
            prevValues = this.layout.map(row => row.map(posData => posData.terrainValue));
        }
        // replace infinity with a the max terrain value
        this.maxTerrain += 2;
        for (let y = 0; y < this.layoutHeight; y++) {
            for (let x = 0; x < this.layoutWidth; x++) {
                if (this.layout[y][x].terrainValue == Infinity) {
                    this.layout[y][x].terrainValue = this.maxTerrain;
                }
            }
        }
    }

    showScores(_devMode) {
        if (_devMode) {
            // display the design space
            stroke(0);
            strokeWeight(0.5);
            textSize(10);
            fill(0);

            let rectHeight = canvasHeight / this.layoutHeight;
            let rectWidth = canvasWidth / this.layoutWidth;
            let rectSize = Math.min(rectHeight, rectWidth);

            for (let x = 0; x < this.layoutWidth; x++) {
                for (let y = 0; y < this.layoutHeight; y++) {
                    let rectX = x * rectSize;
                    let rectY = (canvasHeight - rectSize) - (y * rectSize);
                    // display the terrain value
                    text(this.layout[y][x].terrainValue, rectX + rectSize / 3, rectY + rectSize / 1.5);
                }
            }
        }
    }

    scorePaths() {
        // assign scores to all paths (i.e., lines on grid) to make topography
        // determine path values based on the adjacent terrain values
        // calculate the average score of the two values and assign to the path
        // special case: if both max value, check if the shapes are the same
        // if the shapes are the same, assign a score of max value
        // if the shapes are different, assign a score of 1 to the path 

        this.pathScores = []; // clear the scores
        // add 1 to grid dimensions to account for the perimeter
        for (let y = 0; y < this.layoutHeight + 1; y++) {
            this.pathScores.push([]);
            for (let x = 0; x < this.layoutWidth + 1; x++) {
                // calculate the path score
                let ULValue = this.getTerrain(y, x - 1);
                let DLValue = this.getTerrain(y - 1, x - 1);
                let URValue = this.getTerrain(y, x);
                let DRValue = this.getTerrain(y - 1, x);

                let ULShapeID = this.getShapeID(y, x - 1);
                let DLShapeID = this.getShapeID(y - 1, x - 1);
                let URShapeID = this.getShapeID(y, x);
                let DRShapeID = this.getShapeID(y - 1, x);

                let leftScore;
                let upScore;
                let rightScore;

                // Score left path
                if (ULShapeID != null && DLShapeID != null && (ULShapeID !== DLShapeID)) {
                    // special case: both values one either side of the left path have a different shape
                    leftScore = 1;
                } else {
                    leftScore = (ULValue + DLValue) / 2
                }

                // Score up path
                if (ULShapeID != null && URShapeID != null && (ULShapeID !== URShapeID)) {
                    // special case: both values one either side of the left path have a different shape
                    upScore = 1;
                } else {
                    upScore = (ULValue + URValue) / 2
                }

                // Score right path
                if (URShapeID != null && DRShapeID != null && (URShapeID !== DRShapeID)) {
                    // special case: both values one either side of the left path have a different shape
                    rightScore = 1;
                } else {
                    rightScore = (URValue + DRValue) / 2
                }

                let scores = {
                    left: leftScore,
                    up: upScore,
                    right: rightScore
                };

                this.pathScores[y].push(scores);
            }
        }
        console.log("this.pathScores: ", this.pathScores);

    }

    initCellSpace() {
        // initialize the space where cells live (intersections on the layout)

        this.cellSpace = []; // clear the space
        for (let y = 0; y < this.layoutHeight + 1; y++) {
            this.cellSpace.push([]);

            for (let x = 0; x < this.layoutWidth + 1; x++) {
                this.cellSpace[y].push([]);
            }
        }

        // populate cell space with perimeter cells
        // left + right walls
        for (let i = 0; i < this.layoutHeight; i++) {
            this.cellSpace[i][0].push({
                strain: 0,
                alive: false
            });
            this.cellSpace[i][this.layoutWidth - 1].push({
                strain: 0,
                alive: false
            });
        }
        // top wall
        for (let i = 1; i < this.layoutWidth - 1; i++) {
            this.cellSpace[this.layoutHeight - 1][i].push({
                strain: 0,
                alive: false
            });
        }

        // populate cell space with cells at the bottom of each shape
        for (let i = 0; i < this.shapes.length; i++) {
            let shape = this.shapes[i];
            let shapeEnds = this.overhangShift(shape);
            let bottomLength = shapeEnds[1] - shapeEnds[0] + 2;

            for (let j = 0; j < bottomLength; j++) {
                // add a cell 
                this.cellSpace[shape.posY][shapeEnds[0] + j].push({
                    strain: i + 1,
                    dir: j == 0 ? "left" : j == bottomLength - 1 ? "right" : "",
                    alive: j == 0 || j == bottomLength - 1 ? true : false
                });
            }
        }
    }

    growCells() {
        // loop cell space and grow any alive cells once
        for (let y = 0; y < this.cellSpace.length; y++) {
            for (let x = 0; x < this.cellSpace[y].length; x++) {

                // Rule 1: CROWDED - when cells overlap, they die
                if (this.cellSpace[y][x].length > 1) {
                    for (let cell of this.cellSpace[y][x]) {
                        cell.alive = false;
                    }
                }

                for (let parentCell of this.cellSpace[y][x]) {
                    if (parentCell.alive) {
                        let options = [
                            { dir: "left", x: x - 1, y: y, valid: true, score: null },
                            { dir: "up", x: x, y: y + 1, valid: true },
                            { dir: "right", x: x + 1, y: y, valid: true }
                        ]



                    }
                }
            }
        }
        // console.log("this.cellSpace: ", this.cellSpace);
    }

    calcOptionScore(_y, _x, _dir, _strain) {
        // return the sum of the path score plus the best opportunity (minimum) score
        // first calculate the path score
        let pathScore = this.pathScores[_y][_x]._dir;
        // check if there are cells in left, up, and right directions
        // if there are, check if any cell is the same strain
        let oppScore = null;
        if (this.cellSpace[_y][_x].length > 0) {
            for (let cell of this.cellSpace[_y][_x]) {
                if (cell.strain == _strain) {
                    // very large number to avoid this option
                    oppScore = Infinity;
                }
            }

        }
    }

    addCell(_y, _x, _dir, _cell) {
        // kill old cell before replicating
        _cell.alive = false;
        // add a new cell to the cell space
        this.cellSpace[_y][_x].push({
            strain: _cell.strain,
            dir: _dir,
            alive: true
        });
    }

    showCells() {
        // loop cell space and display cells on the canvas
        for (let y = 0; y < this.cellSpace.length; y++) {
            for (let x = 0; x < this.cellSpace[y].length; x++) {
                for (let cell of this.cellSpace[y][x]) {
                    let cellColor = this.strainColor(cell.strain);
                    if (!cell.alive) {
                        cellColor = lerpColor(cellColor, color(0, 0, 0), 0.4)
                    }
                    fill(cellColor);
                    noStroke();
                    circle(
                        x * this.squareSize,
                        canvasHeight - (y * this.squareSize),
                        10
                    );
                }
            }
        }
    }

    //-- Helper functions --//
    overhangShift(shape) {
        // for shapes with overhang, find the bottom corner of the shape
        // posX is the x-coordinate of the leftmost cell of the shape in the full layout
        let posX = shape.posX;
        let bottomRow = shape.data.boundaryShape[0];

        let leftShift = 0;
        while (bottomRow[leftShift] != true) {
            leftShift += 1
        }
        let startX = posX + leftShift;

        let rightShift = bottomRow.length - 1;
        while (bottomRow[rightShift] != true) {
            rightShift -= 1
        }
        let endX = posX + rightShift;

        return [startX, endX];
    }

    layoutInBounds(coordY, coordX) {
        // check if the grid is in bounds
        let yInBounds = coordY >= 0 && coordY < this.layout.length;
        let xInBounds = coordX >= 0 && coordX < this.layout[0].length;
        if (yInBounds && xInBounds) {
            return true;
        } else {
            return false;
        }
    }

    getTerrain(_y, _x) {
        // find the terrain value at the layout position
        return this.layoutInBounds(_y, _x) ? this.layout[_y][_x].terrainValue : 1;
    }

    getShapeID(_y, _x) {
        // check in bounds
        // return shape ID by searching the layout
        if (this.layoutInBounds(_y, _x) && this.layout[_y][_x].shapes.length > 0) {
            return this.layout[_y][_x].shapes[0].shapeID;
        } else {
            return null;
        }
    }

    strainColor(strain) {
        let value = ((strain + 1) * 255) % 256;
        return color(this.range(value), this.range(value * 70), this.range(value * 56));
    }

    range(num) {
        return num % 256;
    }
}