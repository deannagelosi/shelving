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
        // 



        // populate grid with perimeter cells

    }

    growCells() {

    }

    getScore() {

    }

    //-- Helper functions --//
    overhangShift(posX) {
        // for shapes with overhang, find the bottom corner of the shape
        // posX is the x-coordinate of the leftmost cell of the shape in the full layout
        let leftShift = 0;
        while (this.shapes.data.boundaryShape[0][leftShift] != true) {
            leftShift += 1
        }
        let startX = posX + leftShift;

        let rightShift = this.shapes.data.boundaryShape[0].length - 1;
        while (this.shapes.data.boundaryShape[0][rightShift] != true) {
            rightShift -= 1
        }
        let endX = posX + rightShift;

        return [startX, endX];
    }
}