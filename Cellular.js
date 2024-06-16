class Cellular {
    constructor(_solution) {
        this.grid = [[]]; // 2D array of cell objects
        this.gridScores = [[]]; // 2D array of scores for each slot
        this.layout = _solution.layout; // array of shapes in their annealed position
        this.gridHeight = this.layout.length + 1; // +1 for the top of the slot
        this.gridWidth = this.layout[0].length + 1; // +1 for the right of the slot
        this.shapes = _solution.shapes; // array of shapes and their positions
        this.unitSize = _solution.unitSize; // size of each square in the grid
    }

    initGrid() {
        // initialize grid with empty slots for cells in the correct dimensions
        // prescore each slot in the grid
        this.grid = []; // clear the grid
        this.gridScores = []; // clear the scores

        for (let y = 0; y < this.gridHeight; y++) {
            this.grid.push([]);
            this.gridScores.push([]);

            for (let x = 0; x < this.gridWidth; x++) {
                this.grid[y].push([]);
                this.gridScores[y].push(this.getScore(x, y));
            }
        }
        console.log("this.gridScores: ", this.gridScores);

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
                    if (parentCell.alive) {
                        // gather information about the parent cell's neighborhood
                        let leftSlot = this.findCells(y, x - 1, "left");
                        let upSlot = this.findCells(y + 1, x, "up");
                        let rightSlot = this.findCells(y, x + 1, "right");
                        let allSlots = [...leftSlot, ...upSlot, ...rightSlot];

                        // Rule 2: ATTRACTION - if another strain nearby, grow towards it
                        let validOptions = allSlots.filter(foundCell => foundCell.strain != parentCell.strain);
                        if (validOptions.length > 0) {
                            let newLoc = this.chooseDirection(validOptions, parentCell.dir);
                            if (newLoc) {
                                return this.addCell(newLoc.y, newLoc.x, newLoc.dir, parentCell);
                            }
                        }

                        // check if there's a shape nearby
                        let leftScore = this.findScore(y, x - 1);
                        let upScore = this.findScore(y + 1, x);
                        let rightScore = this.findScore(y, x + 1);

                        if (leftScore.length == 1 && upScore.length == 1 && rightScore.length == 1) {
                            // no shapes nearby
                            // find the direction(s) with the smallest score not occupied by parent strain
                            let options = this.findOptions(y, x, parentCell.strain);


                            // Rule 3: SMALLEST - choose the direction with the smallest score
                            if (options.length == 1) {
                                return this.addCell(options[0].y, options[0].x, options[0].dir, parentCell);
                            };

                            // Rule 4: MIDDLE - if left and right tie, go up
                            // if options contains an object with dir = "left" and dir = "right", choose "up"
                            let left = options.filter(option => option.dir == "left");
                            let right = options.filter(option => option.dir == "right");
                            if (left.length > 0 && right.length > 0) {
                                let up = options.filter(option => option.dir == "up");
                                return this.addCell(up[0].y, up[0].x, up[0].dir, parentCell);
                            }
                            
                            // Rule 5: TURN - if tied between current direction and new direction, choose new direction
                            // if options.length == 2 and one of the option's dir = parentCell.dir, choose the other options direction
                            if (options.length == 2) {
                                let newDir = options.filter(option => option.dir != parentCell.dir);
                                return this.addCell(newDir[0].y, newDir[0].x, newDir[0].dir, parentCell);
                            };


                        } else {
                            // at least one shape nearby
                        }

                    }
                }
            }
        }
        console.log("this.grid: ", this.grid);
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

    findOptions(_y, _x, _strain) {
        // find the direction(s) with the smallest score not occupied by parent strain
        let leftScore = this.findScore(_y, _x - 1)[0];
        let upScore = this.findScore(_y + 1, _x)[0];
        let rightScore = this.findScore(_y, _x + 1)[0];
        let leftCells = this.findCells(_y, _x - 1, "left");
        let rightCells = this.findCells(_y, _x + 1, "right");
        
        let options = {
            // all valid directions
            left: true,
            up: true,
            right: true
        };
        // filter out directions with the parent strain
        if (leftCells.length > 0) {
            for (let cell of leftCells) {
                if (cell.strain == _strain) {
                    options.left = false;
                }
            }    
        }
        if (rightCells.length > 0) {
            for (let cell of rightCells) {
                if (cell.strain == _strain) {
                    options.right = false;
                }
            }
        }
        
        // if more than one option remains, sort by score and return all directions with the smallest score
        // sort directions by score only if they are true
        let optionScores = [];
        if (options.left == true) optionScores.push({ x: _x - 1, y: _y, dir: "left", score: leftScore });
        if (options.up == true) optionScores.push({ x: _x, y: _y + 1, dir: "up", score: upScore });
        if (options.right == true) optionScores.push({ x: _x + 1, y: _y, dir: "right", score: rightScore });
        
        // if only one option remains (e.g., up), return that direction
        if (optionScores.length == 1) {
            return [optionScores[0]];
        } else {
            // if more than one option remains, sort by score and return all directions with the smallest score
            let minScore = optionScores.reduce((min, option) => option.score < min.score ? option : min, optionScores[0]).score;
            let minOptions = optionScores.filter(option => option.score == minScore);
            return minOptions;
        }
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
                leftCoords = { x: cell.x, y: cell.y, dir: "left"};
                leftScore = this.gridScores[cell.y][cell.x];
            } else if (cell.loc == "up") {
                upCount += 1;
                upCoords = { x: cell.x, y: cell.y, dir: "up"};
                upScore = this.gridScores[cell.y][cell.x];
            } else if (cell.loc == "right") {
                rightCount += 1;
                rightCoords = { x: cell.x, y: cell.y, dir: "right"};
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

    slotInBounds(coordY, coordX) {
        // check if the grid slot is in bounds
        let yInBounds = coordY >= 0 && coordY < this.grid.length;
        let xInBounds = coordX >= 0 && coordX < this.grid[0].length;
        if (yInBounds && xInBounds) {
            return true;
        } else {
            return false;
        }
    }

    findCells(_y, _x, _loc) {
        // find the cells at the grid slot
        let slotContents = this.slotInBounds(_y, _x) ? this.grid[_y][_x] : [];
        let updatedCells = [];
        for (let cell of slotContents) {
            cell.x = _x;
            cell.y = _y;
            cell.loc = _loc; // location relative to the reference cell
            updatedCells.push(cell);
        }
        return updatedCells;
    }

    findScore(_y, _x) {
        // find the score at the grid slot
        return this.slotInBounds(_y, _x) ? this.gridScores[_y][_x] : [];
    }

    strainColor(strain) {
        let value = ((strain + 1) * 255) % 256;
        return color(this.range(value), this.range(value * 70), this.range(value * 56));
    }

    range(num) {
        return num % 256;
    }
}