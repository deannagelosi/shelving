class Cellular {
    constructor(_solution) {
        this.cellSpace = [[]]; // 2D array of intersections on the layout grid where cells live
        this.pathValues = [[]]; // 2D array of each path's (lines on the layout) height value
        this.cellLines = new Set(); // holds the unique lines to draw

        if (_solution.layout.length <= 1) _solution.makeLayout();
        this.layout = _solution.layout; // array of shapes in their annealed position
        this.layoutHeight = this.layout.length;
        this.layoutWidth = this.layout[0].length;
        this.shapes = _solution.shapes; // array of shapes and their positions
        this.squareSize = _solution.squareSize; // size of each square in the layout
        this.buffer = _solution.buffer; // left & bottom buffer when displaying
        this.yPadding = _solution.yPadding;
        this.xPadding = _solution.xPadding;
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
                }
                let DLSquare = {
                    shape: this.getShapeID(y - 1, x - 1),
                    value: this.getTerrain(y - 1, x - 1)
                }
                let URSquare = {
                    shape: this.getShapeID(y, x),
                    value: this.getTerrain(y, x)
                }
                let DRSquare = {
                    shape: this.getShapeID(y - 1, x),
                    value: this.getTerrain(y - 1, x)
                }

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
            this.addCell(y, 0, { strain: 0 }, false);
            // right wall
            this.addCell(y, this.layoutWidth, { strain: 0 }, false);
        }
        // top wall
        for (let x = 0; x < this.layoutWidth + 1; x++) {
            this.addCell(this.layoutHeight, x, { strain: 0 }, false);
        }

        // populate cell space with cells at the bottom of each shape
        for (let i = 0; i < this.shapes.length; i++) {
            let shape = this.shapes[i];
            let shapeEnds = this.overhangShift(shape);
            let bottomLength = shapeEnds[1] - shapeEnds[0] + 2;

            for (let j = 0; j < bottomLength; j++) {
                // add a cell 
                let y = shape.posY;
                let x = shapeEnds[0] + j;
                let isAlive = j == 0 || j == bottomLength - 1 ? true : false;
                this.addCell(y, x, { strain: i + 1 }, isAlive);
                // mark just added cell as a 'bottom of shape' cell
                // - since parent may not be the cell next to it, we note this to stop backtrack
                this.cellSpace[y][x][this.cellSpace[y][x].length - 1].bottom = true;
            }
        }
    }

    growCells() {
        // setup the terrain and path values for the cell growth
        this.createTerrain();
        this.calcPathValues();
        this.makeInitialCells();

        // grow alive cells until no more cells are alive
        if (devMode) {
            // grow one at a time on keypress
            for (let i = 0; i < numGrow; i++) {
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
                        // remove all but one of the alive cells
                        this.cellSpace[y][x] = [this.cellSpace[y][x][0]];
                        // cell marked to protect from crowded death
                        this.cellSpace[y][x][0].merged = true;

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
                                if (this.cellSpace[option.y][option.x].some(cell => cell.id === parentCell.parent.id)) {
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
                            console.error("No valid options at x: ", x, " y: ", y, " for parentCell: ", parentCell);
                            parentCell.alive = false;
                            continue;
                        } else if (validOptions.length == 1) {
                            // == Selection Rule 1: if only one option remains, take it
                            newCells.push({ y: validOptions[0].y, x: validOptions[0].x, parentCell: parentCell });
                            continue;
                        } else if (validOptions.length > 1) {
                            // == Selection Rule 2: Attraction - cells are attracted to cells of a different strain
                            let cellAdded = false;
                            for (let option of validOptions) {
                                // this.cellSpace[y][x + 1].some(cell => cell.strain == parentCell.strain)
                                // if (this.cellSpace[option.y][option.x].some(cell => !cell.alive && cell.strain != parentCell.strain)) {
                                if (this.cellSpace[option.y][option.x].some(cell => cell.strain != parentCell.strain)) {
                                    newCells.push({ y: option.y, x: option.x, parentCell: parentCell });
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
                                newCells.push({ y: validOptions[0].y, x: validOptions[0].x, parentCell: parentCell });
                                continue;
                            } else {
                                // Tie in the remaining options
                                // Determine remaining options
                                let leftValid = validOptions.some(option => option.dir == "left");
                                let upValid = validOptions.some(option => option.dir == "up");
                                let rightValid = validOptions.some(option => option.dir == "right");

                                // Selection Rule 5: Change is Bad - grow in the same direction if possible
                                if (growingLeft && leftValid) {
                                    newCells.push({ y: y, x: x - 1, parentCell: parentCell }); // left
                                    continue;
                                } else if (growingUp && upValid) {
                                    newCells.push({ y: y + 1, x: x, parentCell: parentCell }); // up
                                    continue;
                                } else if (growingRight && rightValid) {
                                    newCells.push({ y: y, x: x + 1, parentCell: parentCell }); // right
                                    continue;
                                } else {
                                    console.error("Unable to break tie in growth at x: ", x, " y: ", y);
                                    // pick the first option
                                    newCells.push({ y: validOptions[0].y, x: validOptions[0].x, parentCell: parentCell });
                                    continue;
                                }

                            }
                        }
                        console.error("Error growing at x: ", x, " y: ", y, " with parentCell: ", parentCell, " and options: ", options);
                    }
                }
            } // end of x loop
            // Found all new cells for the row. Add them and move to the next row
            for (let newCell of newCells) {
                this.addCell(newCell.y, newCell.x, newCell.parentCell);
            }
        } // end of y loop

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

    addCell(_y, _x, _parentCell, _alive = true) {
        // kill parent cell when replicating
        _parentCell.alive = false;
        // add a new child cell to the cell space
        this.cellSpace[_y][_x].push({
            id: this.cellID++,
            strain: _parentCell.strain,
            alive: _alive,
            parent: _parentCell
        });
    }

    //-- Display Functions --//
    showCells() {
        // loop cell space and display cells on the canvas
        for (let y = 0; y < this.cellSpace.length; y++) {
            for (let x = 0; x < this.cellSpace[y].length; x++) {
                for (let cell of this.cellSpace[y][x]) {
                    // if (!cell.alive) {
                    //     cellColor = lerpColor(cellColor, color(0, 0, 0), 0.4)
                    // }
                    if (cell.alive) {
                        let cellColor = this.strainColor(cell.strain);
                        fill(cellColor);
                        noStroke();
                        let dotX = (x * this.squareSize) + this.buffer + this.xPadding;
                        let dotY = ((canvasHeight - this.yPadding) - this.buffer) - (y * this.squareSize);
                        circle(dotX, dotY, 12);
                    }
                }
            }
        }
    }

    showCellLines() {
        // loop through the cellSpace grid and add any neighboring cells of the same strain as pairs
        // use these pairs to draw all of the lines. store pairs in a Set to de-duplicate pairs.
        // set for deduplicating lines as they are found
        this.cellLine = new Set();

        // loop through all positions in cellSpace
        for (let y = 0; y < this.cellSpace.length; y++) {
            for (let x = 0; x < this.cellSpace[y].length; x++) {
                // check if there are cells at this position
                if (this.cellSpace[y][x].length > 0) {
                    // loop through all cells at this position
                    for (let cell of this.cellSpace[y][x]) {
                        // directions to check: right, up, left, down
                        const sides = [
                            { dir: "left", y: 0, x: -1 },
                            { dir: "up", y: 1, x: 0 },
                            { dir: "right", y: 0, x: 1 },
                            { dir: "left", y: -1, x: 0 }
                        ]
                        for (let side of sides) {
                            let newY = y + side.y;
                            let newX = x + side.x;

                            // check if the new position is within bounds
                            if (this.cellSpaceInBounds(newY, newX)) {
                                // check if there's a cell with the same strain in the new position
                                let matchingCell = this.cellSpace[newY][newX].find(c => c.strain === cell.strain);

                                if (matchingCell) {
                                    // to avoid duplicates create a string with the information
                                    // use min and max to always put the smaller coordinate first
                                    let lineKey = [
                                        Math.min(y, newY),
                                        Math.min(x, newX),
                                        Math.max(y, newY),
                                        Math.max(x, newX),
                                        cell.strain,
                                        0, // 0: not user made, 1: user made
                                        1  // 1: enabled, 0: disabled (by user)
                                    ].join(',');

                                    // when added to a Set, strings are skipped if they already exist
                                    this.cellLines.add(lineKey);
                                }
                            }
                        }
                    }
                }
            }
        }

        // draw all unique lines
        for (let lineKey of this.cellLines) {
            let [y1, x1, y2, x2, strain, userMade, status] = lineKey.split(',').map(Number);

            if (status === 0) {
                continue; // skip disabled lines
            }

            // calculate canvas coordinates
            let startX = (x1 * this.squareSize) + this.buffer + this.xPadding;
            let startY = ((canvasHeight - this.yPadding) - this.buffer) - (y1 * this.squareSize);
            let endX = (x2 * this.squareSize) + this.buffer + this.xPadding;
            let endY = ((canvasHeight - this.yPadding) - this.buffer) - (y2 * this.squareSize);

            // set line color based on strain
            let lineColor;
            if (devMode) {
                lineColor = this.strainColor(strain);
            } else if (userMade === 1) {
                lineColor = "rgb(255, 0, 0)";
            } else {
                lineColor = "rgb(175, 141, 117)";
            }
            stroke(lineColor);
            strokeWeight(7);  // adjust line thickness as needed

            // draw the line
            line(startX, startY, endX, endY);
        }
    }

    showTerrain() {
        // display the design space
        fill(75); // dark grey
        strokeWeight(0);
        textAlign(CENTER, CENTER);
        let txtXOffset = this.squareSize / 2;
        let txtYOffset = this.squareSize / 2;
        let txtSize = this.squareSize / 2;
        textSize(txtSize);

        for (let x = 0; x < this.layoutWidth; x++) {
            for (let y = 0; y < this.layoutHeight; y++) {
                if (this.layout[y][x].terrainValue != this.maxTerrain) {
                    // calc text position, finding y from bottom up
                    let rectX = (x * this.squareSize) + this.buffer + this.xPadding + txtXOffset;
                    let rectY = ((canvasHeight - this.yPadding) - this.squareSize - this.buffer) - (y * this.squareSize) + txtYOffset;
                    // display the terrain value
                    text(this.layout[y][x].terrainValue, rectX, rectY);
                }
            }
        }

    }

    //-- Helper Functions --//
    overhangShift(shape) {
        // for shapes with overhang, find the bottom corner of the shape
        // posX is the x-coordinate of the leftmost cell of the shape in the full layout
        let posX = shape.posX;
        let bottomRow = shape.data.bufferShape[0];

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