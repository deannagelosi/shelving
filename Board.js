class Board {
    constructor() {
        // [y, x]
        this.startCoords = []; // left or bottom
        this.endCoords = []; // right or top
        this.width; // width of the board
        this.thickness; // thickness of the board
        this.col; // column the board was initially in before merging

        this.poi = { // points of interest
            endJoints: [],
            tJoints: [],
            labels: [],
        }
    }

    getLength() {
        // return the length of the board
        // check if the board is horizontal or vertical
        // [y, x]
        if (this.startCoords[0] == this.endCoords[0]) {
            // same y, horizontal board
            // return x distance as length
            return this.endCoords[1] - this.startCoords[1];
        }
        else if (this.startCoords[1] == this.endCoords[1]) {
            // same x, vertical board
            // return y distance as length
            return this.endCoords[0] - this.startCoords[0];
        }

        return null; // error
    }
}