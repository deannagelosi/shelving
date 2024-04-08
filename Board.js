class Board {
    constructor(_startCoords, _endCoords, _orientation) {
        // Make sure boards start and end are always left-right or bottom-top
        // fix left-right orientation
        this.orientation = _orientation; // horizontal or vertical

        if (this.orientation == "x") {
            if (_startCoords.x < _endCoords.x) {
                this.startCoords = _startCoords;
                this.endCoords = _endCoords;
            } else {
                this.startCoords = _endCoords;
                this.endCoords = _startCoords;
            }

        } else if (this.orientation == "y") {
            // fix bottom-top orientation
            if (_startCoords.y < _endCoords.y) {
                this.startCoords = _startCoords;
                this.endCoords = _endCoords;
            } else {
                this.startCoords = _endCoords;
                this.endCoords = _startCoords;
            }
        }

        this.width; // width of the board
        this.thickness; // thickness of the board

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
}