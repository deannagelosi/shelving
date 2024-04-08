class Board {
    constructor(_cellSize) {
        this.startCoords = { x: null, y: null };
        this.endCoords = { x: null, y: null };
        this.orientation;
        this.width; // width of the board
        this.thickness; // thickness of the board
        this.cellSize = _cellSize;

        this.poi = { // points of interest
            lJoints: ["", ""], // [start edge, end edge]
            tJoints: [], // array of x-values for T-joint holes 
            xJoints: [],
            shapes: [{}], // array of objs with shape name and x-value position
        }
        this.boardLabel;
    }

    getLength() {
        // return the length of the board
        // check if the board is horizontal or vertical
        if (this.startCoords.y == this.endCoords.y) {
            // same y, horizontal board
            // return x distance as length
            return this.endCoords.x - this.startCoords.x;
        }
        else if (this.startCoords.x == this.endCoords.x) {
            // same x, vertical board
            // return y distance as length
            return this.endCoords.y - this.startCoords.y;
        }

        return null; // error
    }

    getCoords() {
        // return the start and end coordinates
        return [this.startCoords, this.endCoords];
    }

    showResult(color) {
        stroke(color); // Black color for the dots
        strokeWeight(5);
        // circle(this.dots[i].x * cellSize, canvasHeight - (this.dots[i].y * cellSize), 10);
        line(this.startCoords.x * this.cellSize, canvasHeight - (this.startCoords.y * this.cellSize), this.endCoords.x * this.cellSize, canvasHeight - (this.endCoords.y * this.cellSize));
    }
}