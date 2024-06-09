class Cellular {
    constructor(_layout, _shapes) {
        this.grid = [[]]; // 2D array of cell objects
        this.layout = _layout; // array of shapes in their annealed position
        this.gridHeight = this.layout.length;
        console.log(this.gridHeight);
        this.gridWidth = this.layout[0].length;
        this.shapes = _shapes; // array of shapes and their positions
    }

    initGrid() {
        // initialize grid with empty slots for cells in the correct dimensions
        this.grid = [[]]; // clear the grid
        for (let i = 0; i < this.gridHeight; i++) {
            this.grid.push(new Array(this.gridWidth).fill(null));
        }

        // populate grid with perimeter cells
        // top + bottom
        for (let i = 0; i < this.gridWidth; i++) {
            this.grid[0][i] = {
                strain: 0,
                alive: false
            };
            this.grid[this.gridHeight][i] = {
                strain: 0,
                alive: false
            };
        }

        // left + right
        for (let i = 0; i < this.gridHeight; i++) {
            this.grid[i][0] = {
                strain: 0,
                alive: false
            };
            this.grid[i][this.gridWidth] = {
                strain: 0,
                alive: false
            };
        }

        // populate grid with cells at the bottom of each shape
        for (let i = 0; i < this.shapes.length; i++) {
            let shape = this.shapes[i];
            let shapeEnds = this.overhangShift(shape);
            let bottomLength = shapeEnds[1] - shapeEnds[0] + 1;

            for (let j = 0; j < bottomLength; j++) {
                // add a cell 
                this.grid[shape.posY][shapeEnds[0] + j] = {
                    strain: i + 1,
                    dir: "",
                    score: null,
                    alive: false
                };
            }

            // set start and end cells to alive and direction
            this.grid[shape.posY][shapeEnds[0]].alive = true;
            this.grid[shape.posY][shapeEnds[0]].dir = "left";
            this.grid[shape.posY][shapeEnds[1]].alive = true;
            this.grid[shape.posY][shapeEnds[1]].dir = "right";
        }

        console.log(this.grid);
    }

    growCells() {
        // loop grid and grow alive cells

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

    // unitInBounds(coordY, coordX) {
    //     // check if the layout unit square is in bounds
    //     let yInBounds = coordY >= 0 && coordY < this.layout.length;
    //     let xInBounds = coordX >= 0 && coordX < this.layout[0].length;
    //     if (yInBounds && xInBounds) {
    //         return true;
    //     } else {
    //         return false;
    //     }
    // }
}