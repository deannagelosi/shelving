class Shape {
    constructor(_title) {
        this.shape = [[]];
        this.boundaryShape = [[]];
        this.inputGrid = [[]];
        this.title = _title;

        this.shapeHeight;
        this.shapeWidth;
        this.shapeDepth;
        this.boundaryHeight;
        this.boundaryWidth;
        this.rectArea; // boundaryHeight * boundaryWidth
        this.weight;
    }

    saveUserInput(_inputGrid, _depthValue) {
        // to do: only save the shape, without the empty input space around it
        // - note: _inputGrid[0] is the top row, not bottom. flip it.

        // create trim shape
        let trimShape = [];
        let leftIndex = _inputGrid[0].length - 1;
        let rightIndex = 0;
        // find left and right indices for the shape
        for (let i = 0; i < _inputGrid.length; i++) {
            if (_inputGrid[i].includes(true)) {
                let currLeft = _inputGrid[i].indexOf(true);
                let currRight = _inputGrid[i].lastIndexOf(true);
                if (currLeft < leftIndex) {
                    leftIndex = currLeft;
                }
                if (currRight > rightIndex) {
                    rightIndex = currRight;
                }
            }
        }
        // use leftIndex and rightIndex to trim the shape
        for (let i = 0; i < _inputGrid.length; i++) {
            if (_inputGrid[i].includes(true)) {
                let rowSlice = _inputGrid[i].slice(leftIndex, rightIndex + 1);
                trimShape.push(rowSlice);
            }
        }

        // create and save a shape that represents the boundary
        // 4. structure code to regenerate the case layout

        // grow the trim shape by increasing the width by 2
        // create the boundary shape by expanding the trim shape horizontally
        let boundaryShape = [];
        for (let i = 0; i < trimShape.length; i++) {
            let newRow = [...trimShape[i]];
            newRow.unshift(false);
            newRow.push(false);
            let firstTrue = newRow.indexOf(true);
            let lastTrue = newRow.lastIndexOf(true);
            this.setTrueBetween(newRow, firstTrue - 1, lastTrue + 1)
            boundaryShape.push(newRow);
        }
        // add a row on the top of the trim shape that's the same as the row below it
        boundaryShape.push([...boundaryShape[boundaryShape.length - 1]]);

        // add additional boundary units for under hangs
        for (let i = 0; i < boundaryShape.length; i++) {
            for (let j = 0; j < boundaryShape[i].length; j++) {
                if (boundaryShape[i][j] == false) {
                    // on rows that are not the top row, check if the unit above is true
                    if (i < (boundaryShape.length - 1) && boundaryShape[i + 1][j] == true) {
                        boundaryShape[i][j] = true;
                    }
                }
            }
        }

        // add additional boundary units for over hangs
        for (let i = boundaryShape.length - 1; i >= 0; i--) {
            for (let j = 0; j < boundaryShape[i].length; j++) {
                if (boundaryShape[i][j] == false) {
                    // on rows that are not the bottom row, check if the unit below is true
                    if (i > 0 && boundaryShape[i - 1][j] == true) {
                        boundaryShape[i][j] = true;
                    }
                }
            }
        }

        // save grids
        this.shape = trimShape;
        this.boundaryShape = boundaryShape;
        this.inputGrid = _inputGrid;

        // set height and widths
        this.boundaryHeight = this.boundaryShape.length;
        this.boundaryWidth = this.boundaryShape[0].length;
        this.shapeHeight = this.shape.length;
        this.shapeWidth = this.shape[0].length;
        this.shapeDepth = _depthValue;

        this.rectArea = this.boundaryHeight * this.boundaryWidth;
    }

    // Function to set values to true between two indices
    setTrueBetween(array, startIndex, endIndex) {
        for (let i = startIndex; i <= endIndex; i++) {
            array[i] = true;
        }
    }
}
