class Cellular {
    constructor(_solution, _devMode = false, _numGrow = 1) {
        this.cellSpace = [[]]; // 2D array of intersections on the layout grid where cells live
        this.pathValues = [[]]; // 2D array of each path's (lines on the layout) height value

        if (_solution.layout.length <= 1) _solution.makeLayout();
        this.layout = _solution.layout; // array of shapes in their annealed position
        this.layoutHeight = this.layout.length;
        this.layoutWidth = this.layout[0].length;
        this.shapes = _solution.shapes; // array of shapes and their positions

        // debug config
        this.devMode = _devMode; // show step-by-step growth
        this.numGrow = _numGrow; // number of growth steps to take in debug mode

        this.maxTerrain = 0; // maximum terrain height for the layout, gets assigned to shapes
        this.scoreRecursion = 4; // how many extra steps to look ahead when calculating opportunity score
        this.numAlive;
        this.cellID = 0; // unique id for each cell
    }

    //-- Setup Functions --//
    createTerrain() {
        // assign values to all squares in the layout to make topography
        // initial state: all spots occupied by shapes start at infinity, all empty spots start at 0
        // loop until none are zero, adding a point to any touching a non-zero value
        // repeat until all terrain values are greater than 0
        // then replace infinity with the max terrain value (highest point + 2)

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
                        // if greater, update the max terrain value
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
                // get terrain for the squares surrounding the path. out of bounds returns 1. 
                // (UL = Upper Left, DL = Down Left, UR = Upper Right, DR = Down Right)
                let ULSquare = {
                    shape: this.getShapeID(y, x - 1),
                    value: this.getTerrain(y, x - 1)
                };
                let DLSquare = {
                    shape: this.getShapeID(y - 1, x - 1),
                    value: this.getTerrain(y - 1, x - 1)
                };
                let URSquare = {
                    shape: this.getShapeID(y, x),
                    value: this.getTerrain(y, x)
                };
                let DRSquare = {
                    shape: this.getShapeID(y - 1, x),
                    value: this.getTerrain(y - 1, x)
                };

                this.pathValues[y].push({
                    left: this.getPathValue(ULSquare, DLSquare),
                    up: this.getPathValue(ULSquare, URSquare),
                    right: this.getPathValue(URSquare, DRSquare)
                });
            }
        }
    }

    getPathValue(square1, square2) {
        // Check adjacent squares to find and return the path value
        if (square1.shape != null && square2.shape != null && (square1.shape !== square2.shape)) {
            // special case: both squares one either side of the path have a different shape
            // return a value of 1 to make a desirable path between the shapes
            return 1;
        } else {
            // return the average terrain height of the two adjacent squares
            return (square1.value + square2.value) / 2;
        }
    }

    //-- Growth Functions --//
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
                id: this.cellID++,
                strain: 0,
                alive: false,
                parent: null,
                parentCoords: (y > 0) ? { x: 0, y: y - 1 } : null
            });
            // right wall
            this.cellSpace[y][this.layoutWidth].push({
                id: this.cellID++,
                strain: 0,
                alive: false,
                parent: null,
                parentCoords: (y > 0) ? { x: this.layoutWidth, y: y - 1 } : null
            });
        }
        // top wall
        for (let x = 0; x < this.layoutWidth + 1; x++) {
            // Skip corner to avoid duplicate
            if (x > 0) {
                this.cellSpace[this.layoutHeight][x].push({
                    id: this.cellID++,
                    strain: 0,
                    alive: false,
                    parent: null,
                    parentCoords: { x: x - 1, y: this.layoutHeight }
                });
            }
        }

        // populate cell space with cells at the bottom of each shape
        for (let i = 0; i < this.shapes.length; i++) {
            let shape = this.shapes[i];
            let shapeEnds = this.overhangShift(shape);
            let bottomLength = shapeEnds[1] - shapeEnds[0] + 2;

            for (let j = 0; j < bottomLength; j++) {
                let y = shape.posY;
                let x = shapeEnds[0] + j;
                let isAlive = j === 0 || j === bottomLength - 1;
                let parentCoords = (j > 0) ? { x: x - 1, y: y } : null;

                const newCell = {
                    id: this.cellID++,
                    strain: i + 1,
                    alive: isAlive,
                    parent: null,
                    parentCoords: parentCoords,
                    bottom: true
                };
                this.cellSpace[y][x].push(newCell);
            }
        }
    }

    growCells() {
        // setup the terrain and path values for the cell growth
        this.createTerrain();
        this.calcPathValues();
        this.makeInitialCells();

        // grow alive cells until no more cells are alive
        if (this.devMode) {
            // grow one at a time on keypress
            for (let i = 0; i < this.numGrow; i++) {
                this.growOnce();
            }
        } else {
            // grow till all cells dead
            this.growOnce();
            while (this.numAlive > 0) {
                this.growOnce();
            }
        }
    }

    growOnce() {
        // loop cell space and grow any alive cells once

        // loop top down and add cells one row at a time
        for (let y = this.cellSpace.length - 1; y >= 0; y--) {
            let newCells = []; // store new cells to add after the row is completely checked
            for (let x = 0; x < this.cellSpace[y].length; x++) {
                if (this.cellSpace[y][x].length > 0) {
                    // How many alive cells are at this position?
                    let numAlive = this.cellSpace[y][x].filter(cell => cell.alive == true).length;

                    // == Start of Merge Rules == //
                    if (numAlive > 1) {
                        // == Merge Rule 1: Standard Merge - when alive cells overlap they merge and one dies
                        // merge into the same strain family
                        this.mergeStrains(this.cellSpace[y][x]);
                        // one cell survives and the rest die
                        let foundSurvivor = false;
                        for (const cell of this.cellSpace[y][x]) {
                            if (cell.alive) {
                                if (!foundSurvivor) {
                                    cell.merged = true;
                                    foundSurvivor = true;
                                } else {
                                    cell.alive = false;
                                }
                            }
                        }

                    } else if (numAlive == 1) {
                        // only one alive cell (parentCell) at this position
                        let parentCell = this.cellSpace[y][x].find(cell => cell.alive);

                        // setup options for directions of cell growth (left, up, or right)
                        let options = [
                            { dir: "left", x: x - 1, y: y, valid: true, score: null, cells: [], passing: false },
                            { dir: "up", x: x, y: y + 1, valid: true, score: null, cells: [], passing: false },
                            { dir: "right", x: x + 1, y: y, valid: true, score: null, cells: [], passing: false }
                        ];
                        // find path scores and cell info for each option
                        for (let option of options) {
                            option.score = this.calcOppScore(y, x, parentCell.strain, option);
                        }

                        // == Merge Rule 2: Passing Merge - when alive cells past each other, merge and one dies
                        // check to the left and the right for passing cells
                        let sides = options.filter(o => o.dir == "left" || o.dir == "right");
                        for (let side of sides) {
                            side.cells = this.cellSpaceInBounds(side.y, side.x) ? this.cellSpace[side.y][side.x] : [];
                            if (side.cells.length > 1) {
                                // if an alive cell to the side matches a dead cells at the parent, they just passed each other
                                // find dead cell strains at the parentCell's position
                                let deadStrains = this.cellSpace[y][x].filter(cell => !cell.alive).map(cell => cell.strain);
                                side.passing = side.cells.some(cell => cell.alive && deadStrains.includes(cell.strain));
                            }

                            if (side.passing == true) {
                                // first merge into the same strain family
                                this.mergeStrains(this.cellSpace[y][x]);
                                let strain = this.cellSpace[y][x][0].strain;
                                // find best score to determine which cell to keep alive (current, or passing cell to the side)
                                let currScore = this.calcOppScore(y, x, strain, { dir: "up", x: x, y: y + 1 });
                                let sideScore = this.calcOppScore(side.y, side.x, strain, { dir: "up", x: side.x, y: side.y + 1 });

                                if (sideScore < currScore) {
                                    // side passing has a better score, kill the current cell
                                    parentCell.alive = false;
                                    // passing cell marked to protect from crowded death
                                    side.cells.forEach(cell => cell.merged = true);

                                } else {
                                    // current cell is same or better, kill the passing cell
                                    side.cells.forEach(cell => cell.alive = false);
                                    // cell marked to protect from crowded death
                                    parentCell.merged = true;
                                }
                            }
                        }

                        // == Merge Rule 3: Crowded - alive cell encounters a dead cell and didn't just merge, dies
                        if (parentCell.alive && this.cellSpace[y][x].length > 1) {
                            // find any dead cell strains at the parentCell's position
                            let deadStrains = this.cellSpace[y][x].filter(cell => !cell.alive).map(cell => cell.strain);
                            if (deadStrains.length > 0 && parentCell.merged != true) {
                                parentCell.alive = false;
                            }
                        }

                        // if the parent cell is now dead, skip the rest of the growth rules
                        if (!parentCell.alive) { continue; }

                        // == End of Merge Rules, Begin Option Elimination Rules == //
                        for (let option of options) {
                            if (this.cellSpaceInBounds(option.y, option.x)) {
                                // == Elimination Rule 1: Can't Backtrack
                                // 1. don't backtrack into parent cell:
                                if (parentCell.parent && this.cellSpace[option.y][option.x].some(cell => cell.id === parentCell.parent.id)) {
                                    option.valid = false;
                                }
                                // 2. don't backtrack into parent cell when on bottom of shape:
                                // - bottom of shape cells might not have the correct parent id
                                // - determine by checking if its the same strain, and we are not moving up
                                if (this.cellSpace[option.y][option.x].some(cell => cell.bottom === true && cell.strain === parentCell.strain && option.dir != "up")) {
                                    option.valid = false;
                                }
                                // 3. don't backtrack right after a merge:
                                // - merged cells can't rely on parent matching as that doesn't cover both directions
                                // - instead any options containing the same strain are just invalid
                                if (parentCell.merged) {
                                    if (this.cellSpace[option.y][option.x].some(cell => cell.strain == parentCell.strain)) {
                                        option.valid = false;
                                    }
                                }

                                // == Elimination Rule 2: Can't Grow Through Shapes - a path at max terrain is blocked by a shape
                                if (this.pathValues[y][x][option.dir] == this.maxTerrain) {
                                    option.valid = false;
                                }
                            } else {
                                // == Elimination Rule 3: Can't go out bounds
                                option.valid = false;
                            }
                        }

                        let validOptions = options.filter(option => option.valid == true);
                        validOptions.sort((a, b) => a.score - b.score);

                        // == End of Elimination Rules, Begin Selection Rules == //

                        // if no valid options, log the issue and kill the cell
                        if (validOptions.length == 0) {
                            parentCell.alive = false;
                            throw new Error(`No valid options at (${x},${y}) for parentCell: ${parentCell}`);
                            // console.error("No valid options at x: ", x, " y: ", y, " for parentCell: ", parentCell);
                            // continue;
                        } else if (validOptions.length == 1) {
                            // == Selection Rule 1: if only one option remains, take it
                            newCells.push({ y: validOptions[0].y, x: validOptions[0].x, parentCell: parentCell, parentX: x, parentY: y });
                            continue;
                        } else if (validOptions.length > 1) {
                            // == Selection Rule 2: Attraction - cells are attracted to cells of a different strain
                            let cellAdded = false;
                            for (let option of validOptions) {
                                // this.cellSpace[y][x + 1].some(cell => cell.strain == parentCell.strain)
                                // if (this.cellSpace[option.y][option.x].some(cell => !cell.alive && cell.strain != parentCell.strain)) {
                                if (this.cellSpace[option.y][option.x].some(cell => cell.strain != parentCell.strain)) {
                                    newCells.push({ y: option.y, x: option.x, parentCell: parentCell, parentX: x, parentY: y });
                                    cellAdded = true;
                                    break;
                                }
                            }
                            if (cellAdded) { continue; }

                            // Still multiple valid options. If no tie, pick the best score. If tie, avoid changing direction

                            // Determine current direction of growth by looking at surrounding cells
                            let growingLeft = this.cellSpaceInBounds(y, x + 1) && this.cellSpace[y][x + 1].some(cell => cell.strain == parentCell.strain);
                            let growingUp = this.cellSpaceInBounds(y - 1, x) && this.cellSpace[y - 1][x].some(cell => cell.strain == parentCell.strain);
                            let growingRight = this.cellSpaceInBounds(y, x - 1) && this.cellSpace[y][x - 1].some(cell => cell.strain == parentCell.strain);

                            // todo: round up the scores?

                            if (validOptions[0].score != validOptions[1].score) {
                                // not tied
                                // == Selection Rule 3: Easiest Path - take the path with the lowest score
                                newCells.push({ y: validOptions[0].y, x: validOptions[0].x, parentCell: parentCell, parentX: x, parentY: y });
                                continue;
                            } else {
                                // Tie in the remaining options
                                // Determine remaining options
                                let leftValid = validOptions.some(option => option.dir == "left");
                                let upValid = validOptions.some(option => option.dir == "up");
                                let rightValid = validOptions.some(option => option.dir == "right");

                                // Selection Rule 4: Change is Bad - grow in the same direction if possible
                                if (growingLeft && leftValid) {
                                    newCells.push({ y: y, x: x - 1, parentCell: parentCell, parentX: x, parentY: y }); // left
                                    continue;
                                } else if (growingUp && upValid) {
                                    newCells.push({ y: y + 1, x: x, parentCell: parentCell, parentX: x, parentY: y }); // up
                                    continue;
                                } else if (growingRight && rightValid) {
                                    newCells.push({ y: y, x: x + 1, parentCell: parentCell, parentX: x, parentY: y }); // right
                                    continue;
                                } else {
                                    // Selection Rule 5: Tie breaker - pick the first option
                                    console.log(`Unable to break tie at (${x},${y}), picking first option.`);
                                    // pick the first option
                                    newCells.push({ y: validOptions[0].y, x: validOptions[0].x, parentCell: parentCell, parentX: x, parentY: y });
                                    continue;
                                }

                            }
                        }
                        throw new Error(`Error growing at (${x},${y}) for parentCell: ${parentCell} and options: ${options}`);
                    }
                }
            } // end of x loop
            // Found all new cells for the row. Add them and move to the next row
            for (let newCell of newCells) {
                this.addCell(newCell.y, newCell.x, newCell.parentCell, { x: newCell.parentX, y: newCell.parentY });
            }
        } // end of y loop

        // count number of alive cells

        this._updateAliveCount();
    }

    mergeStrains(_cells) {
        let strains = _cells.map(cell => cell.strain);
        strains.sort((a, b) => a - b);
        // separate out the lowest strain and all the rest
        let newStrain = strains[0];
        let oldStrains = strains.slice(1);

        // Find any cells with strains matching oldStrains list and change them to newStrain
        for (let y = 0; y < this.cellSpace.length; y++) {
            for (let x = 0; x < this.cellSpace[y].length; x++) {
                for (let cell of this.cellSpace[y][x]) {
                    if (oldStrains.includes(cell.strain)) {
                        cell.strain = newStrain;
                    }
                }
            }
        }
    }

    calcOppScore(_originY, _originX, _strain, _option, _recurseSteps = this.scoreRecursion) {
        // recursive function to calculate the opportunity score to move to a given option
        // opportunity score = path value to the option + best (minimum) valid path leading away from the option
        // valid means excluding paths blocked with cells of the same strain or origin (backtracking)
        // call recursively for each valid path leading from the option
        // base cases are: stop on "C" shapes, going out of bounds, or when _recurseSteps is 0

        // Base Case 1: looking out of bounds
        //  return a good score (low is good) since it completes the path
        if (!this.pathInBounds(_option.y, _option.x)) {
            return 1;
        };

        // find the valid paths (ie. no backtracks), and their values, leading away from the option being scored
        let paths = [
            { dir: "left", x: _option.x - 1, y: _option.y, valid: true, value: null },
            { dir: "up", x: _option.x, y: _option.y + 1, valid: true, value: null },
            { dir: "right", x: _option.x + 1, y: _option.y, valid: true, value: null },
            { dir: "down", x: _option.x, y: _option.y - 1, valid: true, value: null }
        ];

        for (let p of paths) {
            // get the value of the path
            p.value = this.pathValues[_option.y][_option.x][p.dir];

            // if the spot the path leads to is in bounds, check for cells
            if (this.cellSpaceInBounds(p.y, p.x)) {
                // not valid if backtracking (looking back at origin or has cells with the same strain)
                if ((p.y == _originY && p.x == _originX) || (this.cellSpace[p.y][p.x].some(cell => cell.strain == _strain))) {
                    p.valid = false;
                }
                // good score if path leads to a dead cell of a different strain
                if (this.cellSpace[p.y][p.x].some(cell => !cell.alive && cell.strain != _strain)) {
                    p.value = 1;
                }
            }
        }

        // if this is the first step, add the value of the path to the option
        if (_recurseSteps == this.scoreRecursion) {
            // find the path value from the first origin point to the option
            paths.forEach(p => p.value += this.pathValues[_originY][_originX][_option.dir]);
        }

        // Base Case 2: end if using this spot would cause a "C" shaped path
        //  (left && down, or right && down, are occupied by same original strain)
        let downSame = !paths.find(p => p.dir == "down").valid;
        let leftSame = !paths.find(p => p.dir == "left").valid;
        let rightSame = !paths.find(p => p.dir == "right").valid;
        if (downSame && (leftSame || rightSame)) {
            // bad path. end early and return max possible score for the rest of the recursion
            return Infinity;
        }

        // find the remaining valid paths
        let validPaths = paths.filter(p => p.valid == true && p.dir != "down");

        // Base Case 3: no more steps
        //  end and return the best (minimum) path value from this spot + the cost to get here
        if (_recurseSteps == 0) {
            // return the best option from this spot + the path value to get here
            let bestPathValue = Math.min(...validPaths.map(p => p.value));
            return bestPathValue; // + pathValueTo;
        }
        // Recursive Case: decrement and call the function again for each valid path
        else if (_recurseSteps > 0) {

            let nextSteps = _recurseSteps - 1;
            for (let p of validPaths) {
                p.value += this.calcOppScore(_option.y, _option.x, _strain, p, nextSteps);

            }
            // return the best (minimum) score from the returned scores
            let bestPathValue = Math.min(...validPaths.map(p => p.value));
            return bestPathValue; // + pathValueTo;
        }
    }

    addCell(_y, _x, _parentCell, _parentCoords, _alive = true) {
        // kill parent cell when replicating
        if (_parentCell && 'alive' in _parentCell) {
            _parentCell.alive = false;
        }
        // add a new child cell to the cell space
        this.cellSpace[_y][_x].push({
            id: this.cellID++,
            strain: _parentCell.strain,
            alive: _alive,
            parent: _parentCell,
            parentCoords: _parentCoords
        });
    }

    //-- Helper Functions --//
    _updateAliveCount() {
        // count number of alive cells
        this.numAlive = 0;
        for (let y = 0; y < this.cellSpace.length; y++) {
            for (let x = 0; x < this.cellSpace[y].length; x++) {
                for (let cell of this.cellSpace[y][x]) {
                    if (cell.alive === true) {
                        this.numAlive++;
                    }
                }
            }
        }
    }

    getCellRenderLines() {
        const cellLines = new Set();

        for (let y = 0; y < this.cellSpace.length; y++) {
            for (let x = 0; x < this.cellSpace[y].length; x++) {
                for (let cell of this.cellSpace[y][x]) {
                    if (cell.parentCoords) {
                        const { x: parentX, y: parentY } = cell.parentCoords;
                        const lineKey = [
                            Math.min(y, parentY),
                            Math.min(x, parentX),
                            Math.max(y, parentY),
                            Math.max(x, parentX),
                            cell.strain,
                        ].join(',');
                        cellLines.add(lineKey);
                    }
                }
            }
        }
        return cellLines;
    }

    isOverhang(y, x) {
        // an overhang exists if the layout square is occupied, but the one below it is empty.
        const shapeAbove = this.getShapeID(y, x);
        const shapeBelow = this.getShapeID(y - 1, x);
        return shapeAbove !== null && shapeBelow === null;
    }

    overhangShift(shape) {
        // for shapes with overhang, find the bottom corner of the shape
        // posX is the x-coordinate of the leftmost cell of the shape in the full layout
        let posX = shape.posX;
        let bottomRow = shape.data.bufferShape[0];

        let leftShift = 0;
        while (bottomRow[leftShift] != true) {
            leftShift += 1;
        }
        let startX = posX + leftShift;

        let rightShift = bottomRow.length - 1;
        while (bottomRow[rightShift] != true) {
            rightShift -= 1;
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

    static fromDataObject(cellularData, solution) {
        // "Rehydrates" a Cellular instance from raw JSON data and a Solution instance
        const newCellular = new Cellular(solution);

        // Overwrite the default properties with the loaded data
        if (cellularData.cellSpace) newCellular.cellSpace = cellularData.cellSpace;
        if (cellularData.maxTerrain) newCellular.maxTerrain = cellularData.maxTerrain;
        if (cellularData.numAlive) newCellular.numAlive = cellularData.numAlive;

        return newCellular;
    }

    //-- Baseline Growth Functions --//
    growBaseline(numGrowSteps = -1) {
        // --- Setup ---
        this.makeInitialCellsBaseline();

        // --- Growth Loop ---
        // In each step, process one tick of horizontal movement and one tick of vertical movement.
        // The loop continues until no cells are left alive.
        let aliveCellsExist = true;
        let step = 0;
        const maxSteps = 1000; // Safety break for infinite loops
        const loopLimit = (numGrowSteps === -1) ? maxSteps : numGrowSteps;

        while (aliveCellsExist && step < loopLimit) {
            step++;
            this.growHorizontalOnceBaseline();
            this.growVerticalOnceBaseline();

            const currentStats = this.getGrowthStats();
            // Check if any cells are still alive to continue the loop.
            aliveCellsExist = currentStats.alive > 0;
        }

        if (step >= maxSteps) {
            console.error(`Safety triggered at ${maxSteps} steps. Likely infinite baseline build loop.`);
        }
    }

    makeInitialCellsBaseline() {
        // set up the initial state for the baseline algorithm
        this.cellSpace = []; // clear the space
        this.cellID = 0; // reset cell IDs
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
                id: this.cellID++, strain: 0, alive: false, parent: null,
                parentCoords: (y > 0) ? { x: 0, y: y - 1 } : null
            });
            // right wall
            this.cellSpace[y][this.layoutWidth].push({
                id: this.cellID++, strain: 0, alive: false, parent: null,
                parentCoords: (y > 0) ? { x: this.layoutWidth, y: y - 1 } : null
            });
        }
        // top wall
        for (let x = 0; x < this.layoutWidth + 1; x++) {
            if (x > 0) { // Skip corner
                this.cellSpace[this.layoutHeight][x].push({
                    id: this.cellID++, strain: 0, alive: false, parent: null,
                    parentCoords: { x: x - 1, y: this.layoutHeight }
                });
            }
        }

        // populate cell space with cells at the bottom of each shape
        for (let i = 0; i < this.shapes.length; i++) {
            let shape = this.shapes[i];
            let shapeEnds = this.overhangShift(shape);
            let bottomLength = shapeEnds[1] - shapeEnds[0] + 2;

            for (let j = 0; j < bottomLength; j++) {
                let y = shape.posY;
                let x = shapeEnds[0] + j;
                let isAlive = j === 0 || j === bottomLength - 1;
                let parentCoords = (j > 0) ? { x: x - 1, y: y } : null;

                const newCell = {
                    id: this.cellID++,
                    strain: i + 1,
                    alive: isAlive,
                    parent: null,
                    parentCoords: parentCoords,
                    bottom: true,
                    direction: null,
                    allowance: undefined,
                    destinationType: null,
                    underOverhangOfShapeID: null
                };

                if (isAlive) {
                    if (j === 0) { // left side, should travel left (away from shape)
                        newCell.direction = 'left';
                    } else { // right side, should travel right (away from shape)
                        newCell.direction = 'right';
                    }
                }

                this.cellSpace[y][x].push(newCell);
            }
        }
    }

    growHorizontalOnceBaseline() {
        // --- Self-Setup Phase ---
        // Calculate allowance for any new horizontal cells that need it.
        for (let y = 0; y < this.cellSpace.length; y++) {
            for (let x = 0; x < this.cellSpace[y].length; x++) {
                const cellToSetup = this.cellSpace[y][x].find(c => c.alive && (c.direction === 'left' || c.direction === 'right') && c.allowance === undefined);
                if (cellToSetup) {
                    const { allowance, reason } = this.calculateAllowance(cellToSetup, y, x);
                    cellToSetup.destinationType = reason;
                    cellToSetup.allowance = allowance;
                }
            }
        }

        // --- Movement Phase ---
        const cellsToProcess = [];
        // Collect all alive, horizontal cells to process in this tick
        for (let y = 0; y < this.cellSpace.length; y++) {
            for (let x = 0; x < this.cellSpace[y].length; x++) {
                const aliveHorizontalCell = this.cellSpace[y][x].find(c => c.alive && (c.direction === 'left' || c.direction === 'right'));
                if (aliveHorizontalCell) {
                    cellsToProcess.push({ cell: aliveHorizontalCell, x, y });
                }
            }
        }

        for (const item of cellsToProcess) {
            const { cell, x, y } = item;

            // Cell may have been killed by a previous collision in this same tick
            if (!cell.alive) {
                continue;
            }


            const moveDir = cell.direction === 'left' ? -1 : 1;
            const neighborX = x + moveDir;

            // 1. Check for a head-on collision
            if (this.cellSpaceInBounds(y, neighborX)) {
                // Two types of head-on collisions:
                // 1. Two live cells moving in the opposite direction meet
                // 2. Two live cells moving perpendicular meet (one sideways, one up)
                const neighborCellList = this.cellSpace[y][neighborX];
                const opposingCell = neighborCellList.find(c => c.alive && (c.direction === (cell.direction === 'left' ? 'right' : 'left')));
                const perpendicularCell = neighborCellList.find(c => c.alive && (c.direction === 'up'));

                if (opposingCell) {
                    // Create a dead cell at the collision point to complete the wall
                    this.addCellBaseline(y, neighborX, cell, { x, y }, false);
                    // Stop the opposing cell and turn it upwards
                    opposingCell.direction = 'up';
                    opposingCell.allowance = 0;
                    continue; // This cell's turn is over.
                }

                if (perpendicularCell) {
                    // Create a dead cell at the collision point to complete the wall
                    this.addCellBaseline(y, neighborX, cell, { x, y }, false);
                    // Leave the perpendicular cell alone to continue moving up
                    continue; // This cell's turn is over.
                }
            }

            // 2. If no collision, check allowance and move
            if (cell.allowance > 0) {
                // Check if next space is a wall
                const neighborCellList = this.cellSpace[y][neighborX];
                const deadCell = neighborCellList.find(c => !c.alive);
                if (deadCell) {
                    // cell has reached a wall. move to it and die.
                    this.addCellBaseline(y, neighborX, cell, { x, y }, false);
                    continue;
                }

                // Move forward if space is available
                if (this.cellSpaceInBounds(y, neighborX)) {
                    this.addCellBaseline(y, neighborX, cell, { x, y });
                } else {
                    // Reached the edge, die
                    cell.alive = false;
                }
            } else {
                // Allowance is zero, stop and turn up, or die at perimeter
                if (cell.destinationType === 'edge') {
                    cell.alive = false;
                } else {
                    // Cell has 0 allowance, change direction to up
                    cell.direction = 'up';
                }
            }
        }
    }

    addCellBaseline(_y, _x, _parentCell, _parentCoords, _alive = true) {
        // kill parent cell when replicating
        if (_parentCell && 'alive' in _parentCell) {
            _parentCell.alive = false;
        }
        // add a new child cell to the cell space
        this.cellSpace[_y][_x].push({
            id: this.cellID++,
            strain: _parentCell.strain,
            alive: _alive,
            parent: _parentCell,
            parentCoords: _parentCoords,
            direction: _parentCell.direction,
            destinationType: _parentCell.destinationType,
            allowance: _parentCell.allowance > 0 ? _parentCell.allowance - 1 : 0,
            underOverhangOfShapeID: _parentCell.underOverhangOfShapeID
        });
    }

    growVerticalOnceBaseline() {
        const cellsToProcess = [];
        // Collect all alive, upward-moving cells to process in this tick
        for (let y = 0; y < this.cellSpace.length; y++) {
            for (let x = 0; x < this.cellSpace[y].length; x++) {
                const aliveUpCell = this.cellSpace[y][x].find(c => c.alive && c.direction === 'up');
                if (aliveUpCell) {
                    cellsToProcess.push({ cell: aliveUpCell, x, y });
                }
            }
        }

        for (const item of cellsToProcess) {
            const { cell, x, y } = item;

            // Cell may have been killed or diverted by a previous operation in this same tick
            if (!cell.alive || cell.direction !== 'up') {
                continue;
            }

            const targetY = y + 1;
            const targetX = x;

            // --- Rule 1: Shape Collision Check ---
            // An upward path from (y,x) passes between layout squares (y, x-1) and (y, x).
            // A collision only occurs if the path is fully blocked by the *same* shape.
            if (this.layoutInBounds(y, x - 1) && this.layoutInBounds(y, x)) {
                const leftShape = this.getShapeID(y, x - 1);
                const rightShape = this.getShapeID(y, x);

                // If both sides of the path are the same shape, it's a collision.
                if (leftShape !== null && leftShape === rightShape) {
                    const blockingShapeID = leftShape;
                    const newDirection = this.getHorizontalEscapeDirection(y, x, blockingShapeID);
                    cell.direction = newDirection;
                    // Flag the cell for allowance recalculation and grant it a "permission slip"
                    // to travel under the shape it just collided with.
                    cell.allowance = undefined;
                    cell.underOverhangOfShapeID = blockingShapeID;
                    continue; // Cell is now horizontal, skip further processing.
                }
            }

            // --- Rule 2: Cell Collision & Movement ---
            if (this.cellSpaceInBounds(targetY, targetX)) {
                // Check for collision at the target *before* moving.
                const isCollision = this.cellSpace[targetY][targetX].length > 0;
                // Move the cell, and set its alive status based on the collision check.
                this.addCellBaseline(targetY, targetX, cell, { x, y }, !isCollision);
            } else {
                // Hit the top boundary of the cell space.
                cell.alive = false;
            }
        }
    }

    calculateAllowance(_cell, _y, _x) {
        // Get the cell's "permission slip" to be under an overhang, if it has one.
        let overhangPermissionID = _cell.underOverhangOfShapeID;

        let currentX = _x;
        let distance = 0;
        let reason = 'edge';

        let firstStep = true;
        while (true) {
            // increment currentX looking ahead
            if (firstStep) {
                if (_cell.direction === 'left') currentX--;
                // on first step rightward is already looking right
                firstStep = false;
            } else {
                if (_cell.direction === 'left') currentX--;
                if (_cell.direction === 'right') currentX++;
            }

            // Stop if we go out of bounds
            if (!this.cellSpaceInBounds(_y, currentX)) {
                reason = 'edge';
                if (_cell.direction === 'right') distance--;
                break;
            }

            const shape_above = this.getShapeID(_y, currentX);

            if (shape_above !== null) {
                // --- We have encountered a shape. Now we must decide if it's an obstacle. ---

                if (overhangPermissionID === null || overhangPermissionID === undefined) {
                    // This is a normal cell with no permission. Any shape is an obstacle.
                    reason = 'shape';
                    break;
                }

                // This cell has a permission slip. Let's see if it's valid here.
                if (shape_above === overhangPermissionID) {
                    // We are under the correct overhang. Check for a solid wall.
                    const shape_below = this.getShapeID(_y - 1, currentX);
                    if (shape_below !== null && shape_below === overhangPermissionID) {
                        // OBSTACLE: We have hit a solid wall of the permitted shape.
                        reason = 'shape';
                        break;
                    } else {
                        // SAFE: This is just an overhang. Continue scanning.
                        distance++;
                    }
                } else {
                    // OBSTACLE: This is a different, unauthorized shape.
                    // We must stop. Since we're no longer under the correct overhang,
                    // we revoke the permission slip for any future calculations.
                    reason = 'shape';
                    _cell.underOverhangOfShapeID = null;
                    break;
                }
            } else {
                // --- There is no shape above. This is open space. ---

                // If we were just under an overhang, our permission is now used up.
                // Revoke the slip so we don't try to enter another overhang later.
                if (overhangPermissionID !== null && overhangPermissionID !== undefined) {
                    overhangPermissionID = null;
                    _cell.underOverhangOfShapeID = null;
                }
                distance++;
            }
        }
        // if shape collision, only move halfway towards the shape
        const allowance = (reason === 'shape' && distance > 0) ? Math.ceil(distance / 2) : distance;
        return { allowance, reason };
    }

    getHorizontalEscapeDirection(collisionY, collisionX, blockingShapeID) {
        // Search outwards from the collision which side the shape is blocking on.
        // Then return the *opposite* direction of the found wall.
        for (let distance = 1; distance <= this.layoutWidth + 1; distance++) {
            // Check Left for a wall
            const leftX = collisionX - distance;
            if (leftX < 0 || (this.getShapeID(collisionY, leftX) === blockingShapeID && this.getShapeID(collisionY - 1, leftX) === blockingShapeID)) {
                return 'right'; // Wall on left (or edge hit), so go right.
            }

            // Check Right for a wall
            const rightX = collisionX + distance;
            if (rightX >= this.layoutWidth || (this.getShapeID(collisionY, rightX) === blockingShapeID && this.getShapeID(collisionY - 1, rightX) === blockingShapeID)) {
                return 'left'; // Wall on right (or edge hit), so go left.
            }
        }

        // If the loop completes, the cell is trapped.
        throw new Error(`Could not find horizontal escape route for a trapped cell at (${collisionX}, ${collisionY}).`);
    }

    getGrowthStats() {
        const stats = {
            alive: 0,
            up: 0,
            left: 0,
            right: 0,
        };

        for (let y = 0; y < this.cellSpace.length; y++) {
            for (let x = 0; x < this.cellSpace[y].length; x++) {
                for (const cell of this.cellSpace[y][x]) {
                    if (cell.alive) {
                        stats.alive++;
                        if (cell.direction === 'up') stats.up++;
                        else if (cell.direction === 'left') stats.left++;
                        else if (cell.direction === 'right') stats.right++;
                    }
                }
            }
        }
        return stats;
    }

    getWallSet() {
        // Create a strain-agnostic set of wall segments
        const wallSet = new Set();

        for (let y = 0; y < this.cellSpace.length; y++) {
            for (let x = 0; x < this.cellSpace[y].length; x++) {
                for (let cell of this.cellSpace[y][x]) {
                    if (cell.parentCoords) {
                        const { x: parentX, y: parentY } = cell.parentCoords;

                        if (y === parentY) {
                            // A horizontal path creates a HORIZONTAL wall.
                            const wallX = Math.min(x, parentX);
                            wallSet.add(`h-${wallX}-${y}`);
                        } else if (x === parentX) {
                            // A vertical path creates a VERTICAL wall.
                            const wallY = Math.min(y, parentY);
                            wallSet.add(`v-${x}-${wallY}`);
                        }
                    }
                }
            }
        }

        return wallSet;
    }

    calculateAllCubbyAreas() {
        // Perform a flood-fill process for every shape in the layout
        const results = [];

        // Pre-compute wall set for fast lookups
        const wallSet = this.getWallSet();

        // Process each shape
        for (let i = 0; i < this.shapes.length; i++) {
            const shape = this.shapes[i];

            // Find the seed point using existing overhangShift logic
            const shapeEnds = this.overhangShift(shape);
            const seedX = shapeEnds[0];
            const seedY = shape.posY;

            // Execute flood fill from the seed point
            const floodResult = this.floodFill(seedX, seedY, wallSet);

            // Calculate shape area
            const shapeArea = shape.getArea();

            // Store results
            results.push({
                shape_id: i,
                cubbyArea: floodResult.area,
                shapeArea: shapeArea,
                labelCoords: { x: seedX, y: seedY },
                visitedCells: floodResult.visitedCells
            });
        }

        return results;
    }

    floodFill(startX, startY, wallSet) {
        // Flood-fill algorithm to calculate enclosed area
        const visited = new Set();
        const visitedCells = [];
        const queue = [{ x: startX, y: startY }];
        let area = 0;

        while (queue.length > 0) {
            const { x, y } = queue.shift();

            // Create unique key for this position
            const posKey = `${x}-${y}`;

            // Skip if already visited
            if (visited.has(posKey)) {
                continue;
            }

            // Check if position is within layout bounds
            if (!this.layoutInBounds(y, x)) {
                continue;
            }

            // Check if this position is blocked by walls
            const topWall = wallSet.has(`h-${x}-${y + 1}`);
            const bottomWall = wallSet.has(`h-${x}-${y}`);
            const leftWall = wallSet.has(`v-${x}-${y}`);
            const rightWall = wallSet.has(`v-${x + 1}-${y}`);

            // If completely surrounded by walls, this is not part of the cubby space
            if (topWall && bottomWall && leftWall && rightWall) {
                continue;
            }

            // Mark as visited and count this square
            visited.add(posKey);
            visitedCells.push({ x: x, y: y });
            area++;

            // Add neighboring positions to queue
            const neighbors = [
                { x: x + 1, y: y },     // right
                { x: x - 1, y: y },     // left
                { x: x, y: y + 1 },     // up
                { x: x, y: y - 1 }      // down
            ];

            for (const neighbor of neighbors) {
                const neighborKey = `${neighbor.x}-${neighbor.y}`;
                if (!visited.has(neighborKey)) {
                    // Check if there's a wall blocking the path to this neighbor
                    let blocked = false;

                    if (neighbor.x > x) { // moving right
                        blocked = wallSet.has(`v-${neighbor.x}-${y}`);
                    } else if (neighbor.x < x) { // moving left
                        blocked = wallSet.has(`v-${x}-${y}`);
                    } else if (neighbor.y > y) { // moving up
                        blocked = wallSet.has(`h-${x}-${neighbor.y}`);
                    } else if (neighbor.y < y) { // moving down
                        blocked = wallSet.has(`h-${x}-${y}`);
                    }

                    if (!blocked) {
                        queue.push(neighbor);
                    }
                }
            }
        }

        return { area: area, visitedCells: visitedCells };
    }
}

// Only export the class when in a Node.js environment (e.g., during Jest tests)
// Ignored when the app is running in the browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Cellular;
}