class Board {
    constructor(_id, _firstCoord, _secondCoord, _orientation, _thickness) {
        // state variables
        this.id = _id;
        this.orientation = _orientation; // horizontal ('x') or vertical ('y')
        this.coords = this.setBoardDirection(_firstCoord, _secondCoord, this.orientation);
        this.len = this.getLength() + _thickness; // length of the board, including thickness offset
        this.boardLabel;

        this.poi = { // points of interest
            start: this.orientation === "x" ? "pin" : "slot",
            end: this.orientation === "x" ? "pin" : "slot",
            tJoints: [], // array of x-values for T-joint holes 
            xJoints: [],
        }
    }

    getLength() {
        // return the length of the board
        // check if the board is horizontal or vertical
        if (this.coords.start.y == this.coords.end.y) {
            // same y, horizontal board
            // return x distance as length
            return this.coords.end.x - this.coords.start.x;
        }
        else if (this.coords.start.x == this.coords.end.x) {
            // same x, vertical board
            // return y distance as length
            return this.coords.end.y - this.coords.start.y;
        }

        console.error("Board length error. start: ", this.coords.start, "end: ", this.coords.end);
        return null;
    }

    setBoardDirection(_firstCoord, _secondCoord, _orientation) {
        // always build boards with the start side as the smaller x or y value
        let startCoord;
        let endCoord;

        if (this.orientation == "x") {
            startCoord = _firstCoord.x < _secondCoord.x ? _firstCoord : _secondCoord;
            endCoord = _firstCoord.x < _secondCoord.x ? _secondCoord : _firstCoord;

        } else if (this.orientation == "y") {
            startCoord = _firstCoord.y < _secondCoord.y ? _firstCoord : _secondCoord;
            endCoord = _firstCoord.y < _secondCoord.y ? _secondCoord : _firstCoord;
        } else {
            console.error("Board missing orientation. start: ", _firstCoord, "end: ", _secondCoord, "orientation: ", _orientation);
        }

        return { start: startCoord, end: endCoord };
    }
}