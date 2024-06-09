class Cellular {
    constructor(_layout, _shapes) {
        this.grid = [[]]; // 2D array of cell objects
        this.layout = _layout; // array of shapes in their annealed position
        this.gridHeight = this.layout.length;
        this.gridWidth = this.layout[0].length;
        this.shapes = _shapes; // array of shapes and their positions
    }

    initGrid() {
        // initialize grid with empty slots for cells in the correct dimensions
        this.grid = []; // clear the grid
        for (let i = 0; i < this.gridHeight; i++) {
            this.grid.push([]);
            for (let j = 0; j < this.gridWidth; j++) {
                this.grid[i].push([]);
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
            let bottomLength = shapeEnds[1] - shapeEnds[0] + 1;

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

        console.log(this.grid);
    }

    growCells() {
        // loop grid and grow alive cells

        // if alive, grow once
        for (let y = 0; y < this.grid.length; y++) {
            for (let x = 0; x < this.grid[y].length; x++) {
                // is there a cell here? and is it alive?
                if (this.grid[y][x] && this.grid[y][x].alive) {
                    // grow the cell
                    let leftSlot;
                    let upSlot;
                    let rightSlot;
                    if (this.slotInBounds(y, x - 1)) {
                        leftSlot = this.grid[y][x - 1];
                    }
                    if (this.slotInBounds(y + 1, x)) {
                        upSlot = this.grid[y + 1][x];
                    }
                    if (this.slotInBounds(y, x + 1)) {
                        rightSlot = this.grid[y][x + 1];
                    }
                }
            }
        }
    }

    getScore() {

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
}