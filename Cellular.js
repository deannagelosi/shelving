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
        // repeat until all terrain values are greater than 0

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
                    // shape at (x,y) assigned a value (height) of infinity
                    this.layout[y][x].terrainValue = Infinity;
                    prevValues[y].push(Infinity);
                } else {
                    // no shapes at (x,y), assign an initial value of 0
                    this.layout[y][x].terrainValue = 0;
                    prevValues[y].push(0);
                }
            }
        }

        // loop until all terrain squares have a value greater than 0
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
                        // track how many squares remain with a terrain height of 0
                        if (numTouch == 0) {
                            numZero++;
                        }
                    }
                }
            }
            // current values become previous values
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

    showTerrain(_devMode) {
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

    calcPathValues() {
        // assign values to all paths (i.e., lines on grid) to make topography
        // determine path values based on the adjacent terrain values
        // calculate the average value of the two adjacent terrains and assign to the path
        // special case: if both max value, check if the shapes are the same
        // if the shapes are the same, assign the path the max terrain value
        // if the shapes are different, assign a value of 1 to the path 

        this.pathValues = []; // clear the values for all the path segments
        // add 1 to grid dimensions to account for the perimeter
        for (let y = 0; y < this.layoutHeight + 1; y++) {
            this.pathValues.push([]);
            for (let x = 0; x < this.layoutWidth + 1; x++) {
                // calculate the path value
                let ULValue = this.getTerrain(y, x - 1);
                let DLValue = this.getTerrain(y - 1, x - 1);
                let URValue = this.getTerrain(y, x);
                let DRValue = this.getTerrain(y - 1, x);

                let ULShapeID = this.getShapeID(y, x - 1);
                let DLShapeID = this.getShapeID(y - 1, x - 1);
                let URShapeID = this.getShapeID(y, x);
                let DRShapeID = this.getShapeID(y - 1, x);

                let leftValue;
                let upValue;
                let rightValue;

                // Left path
                if (ULShapeID != null && DLShapeID != null && (ULShapeID !== DLShapeID)) {
                    // special case: both values one either side of the left path have a different shape
                    leftValue = 1;
                } else {
                    leftValue = (ULValue + DLValue) / 2
                }

                // Up path
                if (ULShapeID != null && URShapeID != null && (ULShapeID !== URShapeID)) {
                    // special case: both values one either side of the left path have a different shape
                    upValue = 1;
                } else {
                    upValue = (ULValue + URValue) / 2
                }

                // Right path
                if (URShapeID != null && DRShapeID != null && (URShapeID !== DRShapeID)) {
                    // special case: both values one either side of the left path have a different shape
                    rightValue = 1;
                } else {
                    rightValue = (URValue + DRValue) / 2
                }

                let values = {
                    left: leftValue,
                    up: upValue,
                    right: rightValue
                };

                this.pathValues[y].push(values);
            }
        }
        console.log("this.pathValues: ", this.pathValues);

    }

    makeInitialCells() {
        // initialize the space where cells live (intersections on the layout)
        this.cellSpace = []; // clear the space
        for (let y = 0; y < this.layoutHeight + 1; y++) {
            this.cellSpace.push([]);

            for (let x = 0; x < this.layoutWidth + 1; x++) {
                this.cellSpace[y].push([]);
            }
        }

        // populate cell space with perimeter cells
        for (let y = 0; y < this.layoutHeight + 1; y++) {
            // left wall
            this.cellSpace[y][0].push({
                strain: 0,
                alive: false
            });
            // right wall
            this.cellSpace[y][this.layoutWidth].push({
                strain: 0,
                alive: false
            });
        }
        // top wall
        for (let x = 0; x < this.layoutWidth + 1; x++) {
            this.cellSpace[this.layoutHeight][x].push({
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
                    alive: j == 0 || j == bottomLength - 1 ? true : false
                });
            }
        }
    }

    growCells() {
        // grow alive cells until no more cells are alive

        for (let i = 0; i < 8; i++) {
            this.growOnce();
        }
        console.log("this.cellSpace: ", this.cellSpace);
    }

    growOnce() {
        // loop cell space and grow any alive cells once

        // save cells that will be added to grow at the end of the loop
        let newCells = [];
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
                        // setup options for cell growth directions
                        let options = [
                            { dir: "left", x: x - 1, y: y, valid: true, score: null },
                            { dir: "up", x: x, y: y + 1, valid: true, score: null },
                            { dir: "right", x: x + 1, y: y, valid: true, score: null }
                        ]

                        // find the score for each option
                        for (let option of options) {
                            let pathValue = this.pathValues[y][x][option.dir];
                            option.score = pathValue + this.calcOppScore(option.y, option.x, parentCell.strain);
                        }

                        for (let option of options) {
                            if (this.cellSpaceInBounds(option.y, option.x)) {
                                // Checking all cells in potential position
                                for (let cell of this.cellSpace[option.y][option.x]) {
                                    // Elimination Rule 1: Can't Backtrack 
                                    if (cell.strain == parentCell.strain) { option.valid = false };
                                }

                                if (this.pathValues[y][x][option.dir] == this.maxTerrain) {
                                    // Elimination Rule 2: Can't grow through a shape
                                    option.valid = false;
                                }
                            } else {
                                // Elimination Rule 3: Can't go out bounds
                                option.valid = false;
                            }
                        }

                        // Selection Rule 1: if only one option remains, take it
                        let validOptions = options.filter(option => option.valid === true);

                        if (validOptions.length === 1) {
                            newCells.push({ y: validOptions[0].y, x: validOptions[0].x, parentCell: parentCell });
                            break;
                        }

                        validOptions.sort((a, b) => a.score - b.score);

                        for (let option of validOptions) {
                            for (let cell of this.cellSpace[option.y][option.x]) {
                                if (cell.alive == false && cell.strain != parentCell.strain) {
                                    // Selection Rule 2: Attraction - a cell is attracted to a dead cell of a different strain
                                    newCells.push({ y: option.y, x: option.x, parentCell: parentCell });
                                    break;
                                }
                            }
                        }


                        // // testing: choose the lowest score as the winner
                        // // Find the option with the lowest score
                        // let bestOption = options[0];
                        // for (let i = 1; i < options.length; i++) {
                        //     if (options[i].score < bestOption.score) {
                        //         bestOption = options[i];
                        //     }
                        // }
                        // newCells.push({ y: bestOption.y, x: bestOption.x, parentCell: parentCell })
                    }
                }
            }
        }

        // add the new cells to the cell space
        for (let newCell of newCells) {
            this.addCell(newCell.y, newCell.x, newCell.parentCell);
        }
    }

    calcOppScore(_y, _x, _strain) {
        // opp_score = Math.min(possible_paths_from_here)

        // Calculate the opportunity score for at the given position (_y, _x)
        // The opportunity score is the best next possible path value from this point
        // The best path value is the minimum of the three possible directions 
        //  ... excluding paths with cells of the same strain (to avoid backtracking)

        // Check for cells in left, up, and right directions
        // Eliminate directions with cells of the same strain
        // Find the minimum path value from the remaining options
        let leftPathValue;
        let upPathValue;
        let rightPathValue;

        // check "left" opportunity
        if (this.cellSpaceInBounds(_y, _x - 1)) {
            // eliminate left if there is a cell of the same strain
            for (let cell of this.cellSpace[_y][_x - 1]) {
                if (cell.strain == _strain) { leftPathValue = Infinity };
            }
        }
        // check "up" opportunity
        if (this.cellSpaceInBounds(_y + 1, _x)) {
            // eliminate up if there is a cell of the same strain
            for (let cell of this.cellSpace[_y + 1][_x]) {
                if (cell.strain == _strain) { upPathValue = Infinity };
            }
        }
        // check "right" opportunity
        if (this.cellSpaceInBounds(_y, _x + 1)) {
            // eliminate right if there is a cell of the same strain
            for (let cell of this.cellSpace[_y][_x + 1]) {
                if (cell.strain == _strain) { rightPathValue = Infinity };
            }
        }

        // if not eliminated, get the path values
        if (leftPathValue != Infinity) { leftPathValue = this.pathValues[_y][_x].left };
        if (upPathValue != Infinity) { upPathValue = this.pathValues[_y][_x].up };
        if (rightPathValue != Infinity) { rightPathValue = this.pathValues[_y][_x].right };

        // set any max terrain values to infinity
        if (leftPathValue == this.maxTerrain) { leftPathValue = Infinity };
        if (upPathValue == this.maxTerrain) { upPathValue = Infinity };
        if (rightPathValue == this.maxTerrain) { rightPathValue = Infinity };

        // return the minimum (best) path value
        return Math.min(leftPathValue, upPathValue, rightPathValue);
    }

    addCell(_y, _x, _parentCell) {
        // kill parent cell when replicating
        _parentCell.alive = false;
        // add a new child cell to the cell space
        this.cellSpace[_y][_x].push({
            strain: _parentCell.strain,
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

    cellSpaceInBounds(coordY, coordX) {
        // check if the grid is in bounds
        let yInBounds = coordY >= 0 && coordY < this.cellSpace.length;
        let xInBounds = coordX >= 0 && coordX < this.cellSpace[0].length;
        if (yInBounds && xInBounds) {
            return true;
        } else {
            return false;
        }
    }

    pathInBounds(coordY, coordX) {
        // check if the grid is in bounds
        let yInBounds = coordY >= 0 && coordY < this.pathValues.length;
        let xInBounds = coordX >= 0 && coordX < this.pathValues[0].length;
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