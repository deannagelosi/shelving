class Board {
    constructor(_startCoords, _endCoords, _orientation) {
        // Make sure boards start and end are always left-right or bottom-top
        // fix left-right orientation
        this.orientation = _orientation; // horizontal or vertical
        [this.startCoords, this.endCoords] = this.setBoardDirection(_startCoords, _endCoords, this.orientation);

        this.merged = false; // if the board is merged with another board later

        // this.depth; // depth of the board
        // this.thickness; // thickness of the board

        this.poi = { // points of interest
            startJoint: "", // "pin" or "slot"
            endJoint: "", // "pin" or "slot"
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

    setBoardDirection(_startCoords, _endCoords, _orientation){
        // always build boards with the start side as the smaller x or y value

        let startCoords;
        let endCoords;

        if (this.orientation == "x") {
            // fix left-right orientation
            if (_startCoords.x < _endCoords.x) {
                startCoords = _startCoords;
                endCoords = _endCoords;
            } else {
                startCoords = _endCoords;
                endCoords = _startCoords;
            }

        } else if (this.orientation == "y") {
            // fix bottom-top orientation
            if (_startCoords.y < _endCoords.y) {
                startCoords = _startCoords;
                endCoords = _endCoords;
            } else {
                startCoords = _endCoords;
                endCoords = _startCoords;
            }
        } else {
            throw new Error("Board missing orientation. start: ", _startCoords, "end: ", _endCoords, "orientation: ", _orientation);
        }

        return [startCoords, endCoords];
    }
}