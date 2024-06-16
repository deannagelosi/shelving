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
                    score: null,
                    alive: j == 0 ? true : j == bottomLength - 1 ? true : false
                });
            }
        }
    }

    growCells() {
        // loop grid and grow alive cells

        // if alive, grow once
        for (let y = 0; y < this.grid.length; y++) {
            for (let x = 0; x < this.grid[y].length; x++) {

                // Rule 1: crowd - when cells overlap, they die
                if (this.grid[y][x].length > 1) {
                    for (let cell of this.grid[y][x]) {
                        cell.alive = false;
                    }
                }

                for (let cell of this.grid[y][x]) {
                    if (cell.alive) {
                        // gather information about the cell's neighborhood
                        let leftSlot = this.findCells(y, x - 1, "left");
                        let upSlot = this.findCells(y + 1, x, "up");
                        let rightSlot = this.findCells(y, x + 1, "right");
                        let allSlots = [...leftSlot, ...upSlot, ...rightSlot];

                        // Rule 2: attraction - if another strain nearby, grow towards it
                        let validOptions = allSlots.filter(foundCell => foundCell.strain != cell.strain);
                        if (validOptions.length > 0) {
                            // todo: implement addCell
                            let dir = this.chooseDirection(validOptions, cell.dir);
                            if (dir) {
                                // this.addCell(dir.y, dir.x, cell.strain);
                            }
                        }

                        // Rule 3: ...

                    }
                }
            }
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
                leftCoords = { x: cell.x, y: cell.y };
                leftScore = this.gridScores[cell.y][cell.x];
            } else if (cell.loc == "up") {
                upCount += 1;
                upCoords = { x: cell.x, y: cell.y };
                upScore = this.gridScores[cell.y][cell.x];
            } else if (cell.loc == "right") {
                rightCount += 1;
                rightCoords = { x: cell.x, y: cell.y };
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
                    fill(this.strainColor(cell.strain));
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

    strainColor(strain) {
        let value = ((strain + 1) * 255) % 256;
        return color(this.range(value), this.range(value * 70), this.range(value * 56));
    }

    range(num) {
        return num % 256;
    }
}