class Board {
    constructor(_id, _firstCoord, _secondCoord, _orientation, _thickness) {
        // state variables
        this.id = _id;
        this.orientation = _orientation; // horizontal ('x') or vertical ('y')
        this.thickness = _thickness; // Store thickness for length calculations
        this.coords = this.setBoardDirection(_firstCoord, _secondCoord, this.orientation);
        this.boardLabel;

        this.poi = { // points of interest
            start: "unassigned", // assigned later by material configuration
            end: "unassigned", // assigned later by material configuration
            tJoints: [], // array of positions for T-joint intersections
            xJoints: [], // array of positions for X-joint (half-lap) intersections
        };
    }

    getLength() {
        // Start with geometric distance between structural center lines
        // (wall lines represent the midpoint of board thickness)
        let baseLength = this.getGeometricLength();

        // Add full thickness to extend from centerline to actual board ends
        // This accounts for the board extending half-thickness beyond centerline at each end
        // (geometric distance is as if board went halfway through on each end already)
        let length = baseLength + this.thickness;

        // Material-specific end adjustments based on connection method:
        // - 'pin'/'slot' ends: no adjustment (board goes all the way through, material cut around joints)
        // - 'short' ends: subtract thickness (board stops at surface for welding, doesn't go through)
        // - 'etch-line' ends: no adjustment (board goes all the way through, etch shows alignment)
        if (this.poi.start === 'short') length -= this.thickness;
        if (this.poi.end === 'short') length -= this.thickness;

        // Safety check: ensure board length is always valid
        if (length <= 0) {
            console.error(`Board ${this.id} calculated invalid length: ${length}`);
            return 0;
        }

        return length;
    }

    getGeometricLength() {
        // Return the pure geometric distance between coordinates
        if (this.coords.start.y == this.coords.end.y) {
            // Horizontal board
            return this.coords.end.x - this.coords.start.x;
        }
        else if (this.coords.start.x == this.coords.end.x) {
            // Vertical board
            return this.coords.end.y - this.coords.start.y;
        }

        console.error("Board length error. start: ", this.coords.start, "end: ", this.coords.end);
        return 0;
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

// Only export the class when in a Node.js environment (e.g., during Jest tests)
// Ignored when the app is running in the browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Board;
}