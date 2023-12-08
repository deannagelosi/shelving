class Board {
    constructor() {
        // [y, x]
        this.startCoords = []; // left or bottom
        this.endCoords = []; // right or top
        this.len; // length of the board
        this.width; // width of the board
        this.thickness; // thickness of the board
        this.poi = [{}]; // points of interest, ex: joinery, labeling, etc.

        this.col; // which column the board is in
    }
}