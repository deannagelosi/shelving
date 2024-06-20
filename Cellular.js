class Cellular {
    constructor(_solution) {
        this.grid = [[]]; // 2D array of cell objects
        this.gridScores = [[]]; // 2D array of scores for each slot
        this.pathScores = [[]]; // 2D array of scores for each path
        this.layout = _solution.layout; // array of shapes in their annealed position
        this.gridHeight = this.layout.length;
        this.gridWidth = this.layout[0].length;
        this.shapes = _solution.shapes; // array of shapes and their positions
        this.unitSize = _solution.unitSize; // size of each square in the grid
        this.maxSlotScore = 0; // maximum slot score for the grid, assigned to shapes
    }

    scoreGrid() {
        // assign scores to all slots to make topography
        // initial state: all slots occupied by shapes start at infinity, all empty slots start at 0
        // loop until no slots are zero, adding a point to any slot touching a slot with a non-zero score
        // repeat until all slots have a score

        // set up initial state
        this.gridScores = []; // clear the scores
        let prevScores = [];

        for (let y = 0; y < this.gridHeight; y++) {
            this.gridScores.push([]);
            prevScores.push([]);
            for (let x = 0; x < this.gridWidth; x++) {
                if (this.layout[y][x].shapes.length > 0) {
                    // shape at (x,y) assigned a score of infinity
                    this.gridScores[y].push(Infinity);
                    prevScores[y].push(Infinity);
                } else {
                    // empty slot at (x,y) assigned a score of 0
                    this.gridScores[y].push(0);
                    prevScores[y].push(0);
                }
            }
        }
        // loop until all slots have a score
        // track all slots with a score of 0
        // add a point to any slot touching a slot with a non-zero score, even diagonally
        // stash the updated values to reference the next loop

        let numZero;
        while (numZero != 0) {
            numZero = 0;
            // loop until no zero slot values
            for (let y = 0; y < this.gridHeight; y++) {
                for (let x = 0; x < this.gridWidth; x++) {
                    let numTouch = 0;
                    if (prevScores[y][x] != Infinity) {
                        // check the 8 possible adjacent slots
                        for (let localY = Math.max(0, y - 1); localY <= Math.min(y + 1, this.gridHeight - 1); localY++) {
                            for (let localX = Math.max(0, x - 1); localX <= Math.min(x + 1, this.gridWidth - 1); localX++) {
                                // don't count the slot itself
                                if (localX !== x || localY !== y) {
                                    // count if the adjacent slot is empty
                                    if (prevScores[localY][localX] > 0) {
                                        numTouch++;
                                    }
                                }
                            }
                        }
                        // assign the score to the slot
                        this.gridScores[y][x] += numTouch;
                        // update the max slot score
                        if (this.gridScores[y][x] > this.maxSlotScore) {
                            this.maxSlotScore = this.gridScores[y][x];
                        }
                        // calculate the number of units with a score of 8
                        if (numTouch == 0) {
                            numZero++;
                        }
                    }
                }
            }
            // current scores become previous scores
            prevScores = this.gridScores.map(xArray => [...xArray]);
        }
        // replace infinity with a score larger than the max slot score
        this.maxSlotScore += 2;
        for (let y = 0; y < this.gridHeight; y++) {
            for (let x = 0; x < this.gridWidth; x++) {
                if (this.gridScores[y][x] == Infinity) {
                    this.gridScores[y][x] = this.maxSlotScore;
                }
            }
        }
    }

    showScores(_devMode) {
        if (_devMode) {
            // display the design space grid
            stroke(0);
            strokeWeight(0.5);
            textSize(10);
            fill(0);

            let slotHeight = canvasHeight / this.gridHeight;
            let slotWidth = canvasWidth / this.gridWidth;
            let slotSize = Math.min(slotHeight, slotWidth);

            for (let x = 0; x < this.gridWidth; x++) {
                for (let y = 0; y < this.gridHeight; y++) {
                    let rectX = x * slotSize;
                    let rectY = (canvasHeight - slotSize) - (y * slotSize);
                    // display the slot score if not infinity
                    if (this.gridScores[y][x] != Infinity) {
                        text(this.gridScores[y][x], rectX + slotSize / 3, rectY + slotSize / 1.5);
                    } else {
                        text("∞", rectX + slotSize / 3, rectY + slotSize / 1.5);
                    }
                }
            }
        }
    }

    scorePaths() {
        // assign scores to all paths (i.e., lines on grid) to make topography
        // determine path values based on the adjacent slots
        // calculate the average score of the two slots and assign to the path
        // special case: if both max value, check if the shapes are the same
        // if the shapes are the same, assign a score of max value
        // if the shapes are different, assign a score of 1 to the path 

        this.pathScores = []; // clear the scores
        // add 1 to grid dimensions to account for the perimeter
        for (let y = 0; y < this.gridHeight + 1; y++) {
            this.pathScores.push([]);
            for (let x = 0; x < this.gridWidth + 1; x++) {
                // calculate the path score
                let ULScore = this.getScore(y, x - 1);
                let DLScore = this.getScore(y - 1, x - 1);
                let URScore = this.getScore(y, x);
                let DRScore = this.getScore(y - 1, x);

                let ULShapeID = this.getShapeID(y, x - 1);
                let DLShapeID = this.getShapeID(y - 1, x - 1);
                let URShapeID = this.getShapeID(y, x);
                let DRShapeID = this.getShapeID(y - 1, x);

                let leftScore;
                let upScore;
                let rightScore;

                // Score left path
                if (ULShapeID != null && DLShapeID != null && (ULShapeID !== DLShapeID)) {
                    // special case: both slots one either side of the left path have a different shape
                    leftScore = 1;
                } else {
                    leftScore = (ULScore + DLScore) / 2
                }

                // Score up path
                if (ULShapeID != null && URShapeID != null && (ULShapeID !== URShapeID)) {
                    // special case: both slots one either side of the left path have a different shape
                    upScore = 1;
                } else {
                    upScore = (ULScore + URScore) / 2
                }

                // Score right path
                if (URShapeID != null && DRShapeID != null && (URShapeID !== DRShapeID)) {
                    // special case: both slots one either side of the left path have a different shape
                    rightScore = 1;
                } else {
                    rightScore = (URScore + DRScore) / 2
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

    initGrid() {
        // initialize grid with empty slots for cells in the correct dimensions
        // prescore each slot in the grid

        this.grid = []; // clear the grid
        for (let y = 0; y < this.gridHeight; y++) {
            this.grid.push([]);

            for (let x = 0; x < this.gridWidth; x++) {
                this.grid[y].push([]);
            }
        }

        // populate grid with perimeter cells
        // left + right walls
        for (let i = 0; i < this.gridHeight; i++) {
            this.grid[i][0].push({
                strain: 0,
                alive: false
            });
            this.grid[i][this.gridWidth - 1].push({
                strain: 0,
                alive: false
            });
        }
        // top wall
        for (let i = 1; i < this.gridWidth - 1; i++) {
            this.grid[this.gridHeight - 1][i].push({
                strain: 0,
                alive: false
            });
        }

        // populate grid with cells at the bottom of each shape
        for (let i = 0; i < this.shapes.length; i++) {
            let shape = this.shapes[i];
            let shapeEnds = this.overhangShift(shape);
            let bottomLength = shapeEnds[1] - shapeEnds[0] + 2;

            for (let j = 0; j < bottomLength; j++) {
                // add a cell 
                this.grid[shape.posY][shapeEnds[0] + j].push({
                    strain: i + 1,
                    dir: j == 0 ? "left" : j == bottomLength - 1 ? "right" : "",
                    alive: j == 0 || j == bottomLength - 1 ? true : false
                });
            }
        }
    }

    growCells() {
        // loop grid and grow alive cells

        // if alive, grow once
        for (let y = 0; y < this.grid.length; y++) {
            for (let x = 0; x < this.grid[y].length; x++) {

                // Rule 1: CROWDED - when cells overlap, they die
                if (this.grid[y][x].length > 1) {
                    for (let cell of this.grid[y][x]) {
                        cell.alive = false;
                    }
                }

                for (let parentCell of this.grid[y][x]) {
                    if (parentCell.alive) { }
                }
            }
        }
        // console.log("this.grid: ", this.grid);
    }

    addCell(_y, _x, _dir, _cell) {
        // kill old cell before replicating
        _cell.alive = false;
        // add a new cell to the grid
        this.grid[_y][_x].push({
            strain: _cell.strain,
            dir: _dir,
            alive: true
        });
    }

    chooseDirection(_cells, _dir) {
        // _cells is an array of cells that also have an x-key, y-key, and loc-key
        // choose a direction to grow towards
        let leftCount = 0;
        let upCount = 0;
        let rightCount = 0;
        let leftCoords;
        let upCoords;
        let rightCoords;
        let leftScore = Infinity;
        let upScore = Infinity;
        let rightScore = Infinity;

        for (let cell of _cells) {
            if (cell.loc == "left") {
                leftCount += 1;
                leftCoords = { x: cell.x, y: cell.y, dir: "left" };
                leftScore = this.gridScores[cell.y][cell.x];
            } else if (cell.loc == "up") {
                upCount += 1;
                upCoords = { x: cell.x, y: cell.y, dir: "up" };
                upScore = this.gridScores[cell.y][cell.x];
            } else if (cell.loc == "right") {
                rightCount += 1;
                rightCoords = { x: cell.x, y: cell.y, dir: "right" };
                rightScore = this.gridScores[cell.y][cell.x];
            }
        }

        // Case 1: only one option, choose that one
        if (leftCount > 0 && upCount === 0 && rightCount === 0) {
            return leftCoords;
        } else if (upCount > 0 && leftCount === 0 && rightCount === 0) {
            return upCoords;
        } else if (rightCount > 0 && leftCount === 0 && upCount === 0) {
            return rightCoords;
        }

        // Case 2: two or three options and choose the one in the direction traveled
        if (_dir === "left" && leftCount > 0) {
            return leftCoords;
        } else if (_dir === "up" && upCount > 0) {
            return upCoords;
        } else if (_dir === "right" && rightCount > 0) {
            return rightCoords;
        }

        // Case 3: two options and neither is in the direction traveled, choose the one with the smaller score
        let options = [];
        if (leftCount > 0) options.push({ coords: leftCoords, score: leftScore });
        if (upCount > 0) options.push({ coords: upCoords, score: upScore });
        if (rightCount > 0) options.push({ coords: rightCoords, score: rightScore });

        if (options.length >= 2) {
            let minOption = options.reduce((min, option) => option.score < min.score ? option : min, options[0]);
            return minOption.coords;
        }

        // Default case if no valid direction is found
        console.log("No valid direction found");
        return null;
    }

    getScore(x, y) {
        // translate from grid coordinates to layout coordinates
        // find the unit scores in the layout to the UL and UR of the grid slot position
        let ULScore;
        let URScore;

        if (y == this.layout.length) {
            ULScore = 8;
            URScore = 8;
        } else if (x == 0) {
            ULScore = 8;
            URScore = this.layout[y][x].unitScore;
        } else if (x == this.layout[y].length) {
            ULScore = this.layout[y][x - 1].unitScore;
            URScore = 8;
        } else {
            ULScore = this.layout[y][x - 1].unitScore;
            URScore = this.layout[y][x].unitScore;
        }

        // calculate the score
        // if both integers above 0, return the absolute difference in an array
        // if both integers are 0, return both shapeIDs in an array
        if (ULScore > 0 || URScore > 0) {
            return [Math.abs(ULScore - URScore)];
        } else {
            // both units have a shape, return the shapeIDs
            let ULId = String(this.layout[y][x - 1].shapes[0].posX) + String(this.layout[y][x - 1].shapes[0].posY);
            let URId = String(this.layout[y][x].shapes[0].posX) + String(this.layout[y][x].shapes[0].posY);

            return [ULId, URId];
        }
    }

    showCells() {
        // loop grid and display cells on the canvas
        for (let y = 0; y < this.grid.length; y++) {
            for (let x = 0; x < this.grid[y].length; x++) {
                for (let cell of this.grid[y][x]) {
                    let cellColor = this.strainColor(cell.strain);
                    if (!cell.alive) {
                        cellColor = lerpColor(cellColor, color(0, 0, 0), 0.4)
                    }
                    fill(cellColor);
                    noStroke();
                    circle(
                        x * this.unitSize,
                        canvasHeight - (y * this.unitSize),
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

    pathInBounds(coordY, coordX) {
        // check if the grid slot is in bounds
        let yInBounds = coordY >= 0 && coordY < this.gridScores.length;
        let xInBounds = coordX >= 0 && coordX < this.gridScores[0].length;
        if (yInBounds && xInBounds) {
            return true;
        } else {
            return false;
        }
    }

    unitInBounds(coordY, coordX) {
        // check if the unit square is in bounds
        let yInBounds = coordY >= 0 && coordY < this.layout.length;
        let xInBounds = coordX >= 0 && coordX < this.layout[0].length;
        if (yInBounds && xInBounds) {
            return true;
        } else {
            return false;
        }
    }

    getScore(_y, _x) {
        // find the score at the grid slot
        return this.pathInBounds(_y, _x) ? this.gridScores[_y][_x] : 1;
    }

    getShapeID(_y, _x) {
        // check in bounds
        // return shape ID by searching the layout
        if (this.unitInBounds(_y, _x) && this.layout[_y][_x].shapes.length > 0) {
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