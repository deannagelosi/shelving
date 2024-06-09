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
        this.grid = [[]]; // clear the grid
        for (let i = 0; i < this.gridHeight; i++) {
            this.grid.push(new Array(this.gridWidth).fill(null)); 
        }

        // populate grid with cells at the bottom of each shape
        let shape = this.shapes[0];
        let shapeEnds = this.overhangShift(shape);

        this.grid[shape.posY][shapeEnds[0]] = "yo-start";
        this.grid[shape.posY][shapeEnds[1]] = "yo-end";

        console.log(this.grid);




        // populate grid with perimeter cells

    }

    growCells() {

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
}