class Shape {
    constructor() {
        // 2D array of booleans for the user input grid
        this.inputGrid = [[]];

        // shape grids are stored as 2D arrays of booleans
        // - occupied squares as true, unoccupied as false
        this.shape = [[]]; // a trimmed version of the input grid
        this.lowPolyShape = [[]]; // 1/4th the width and height as shape, scaled to 1/4th the resolution
        this.bufferShape = [[]]; // low poly + one extra square on right and top
        this.bufferHeight;
        this.bufferWidth;
        this.title;
    }

    saveUserInput(_title, _inputGrid) {
        // save the shape and create the rounded up and buffer shape arrays
        this.title = _title;
        this.inputGrid = _inputGrid;

        // save the user shape by trimming empty rows and columns in the input grid
        this.shape = [];
        let leftIndex = this.inputGrid[0].length - 1;
        let rightIndex = 0;
        // find the farthest left and right indices of the shape
        for (let y = 0; y < this.inputGrid.length; y++) {
            if (this.inputGrid[y].includes(true)) {
                // find the left and the right ends of the shape on this row
                let currLeft = this.inputGrid[y].indexOf(true);
                let currRight = this.inputGrid[y].lastIndexOf(true);
                if (currLeft < leftIndex) {
                    leftIndex = currLeft;
                }
                if (currRight > rightIndex) {
                    rightIndex = currRight;
                }
            }
        }
        // use leftIndex and rightIndex to trim the shape
        for (let y = 0; y < this.inputGrid.length; y++) {
            if (this.inputGrid[y].includes(true)) {
                let rowSlice = this.inputGrid[y].slice(leftIndex, rightIndex + 1);
                this.shape.push(rowSlice);
            }
        }

        // create the low poly shape - scale the shape down to 1/4th the resolution
        // - first pad the shape with false squares to make it divisible by 4
        let paddedShape = [];
        const width = this.shape[0].length;
        const height = this.shape.length;
        const paddedWidth = Math.ceil(width / 4) * 4;
        const paddedHeight = Math.ceil(height / 4) * 4;
        const paddingLeft = Math.floor((paddedWidth - width) / 2);
        const paddingRight = paddedWidth - width - paddingLeft;
        const paddingBottom = paddedHeight - height;

        // pad the shape on the left and right
        this.shape.forEach(row => {
            const newRow = new Array(paddingLeft).fill(false)
                .concat(row)
                .concat(new Array(paddingRight).fill(false));
            paddedShape.push(newRow);
        });
        // pad the shape on the top
        for (let i = 0; i < paddingBottom; i++) {
            paddedShape.push(new Array(paddedWidth).fill(false));
        }
        // reduce the resolution by 4x
        this.lowPolyShape = [];
        const lowPolyHeight = Math.floor(paddedShape.length / 4);
        const lowPolyWidth = Math.floor(paddedShape[0].length / 4);
        for (let y = 0; y < lowPolyHeight; y++) {
            const row = [];
            for (let x = 0; x < lowPolyWidth; x++) {
                let filledCells = 0;
                for (let dy = 0; dy < 4; dy++) {
                    for (let dx = 0; dx < 4; dx++) {
                        if (paddedShape[y * 4 + dy][x * 4 + dx]) {
                            filledCells++;
                        }
                    }
                }
                if (filledCells > 0) {
                    row.push(true);
                } else {
                    row.push(false);
                }
            }
            this.lowPolyShape.push(row);
        }

        // create the buffer shape - add 1 square to right and top edges of rounded up shape
        // 1. make buffer shape larger by 1 on x and y to make room
        // 2. set any voids and under hang squares as true and add trues to the right and top edges
        this.bufferShape = [];
        for (let y = 0; y < this.lowPolyShape.length; y++) {
            let newRow = [...this.lowPolyShape[y]];
            newRow.push(false); // add extra space on the right
            let firstTrue = newRow.indexOf(true);
            let lastTrue = newRow.lastIndexOf(true);
            this.setTrueBetween(newRow, firstTrue, lastTrue + 1);
            this.bufferShape.push(newRow);
        }
        // add a row on the top of the trim shape that's the same as the row below it
        this.bufferShape.push([...this.bufferShape[this.bufferShape.length - 1]]);
        // add additional boundary squares for under hangs
        for (let y = 0; y < this.bufferShape.length; y++) {
            for (let x = 0; x < this.bufferShape[y].length; x++) {
                if (this.bufferShape[y][x] == false) {
                    // on rows that are not the top row, check if the square above is true
                    if (y < (this.bufferShape.length - 1) && this.bufferShape[y + 1][x] == true) {
                        this.bufferShape[y][x] = true;
                    }
                }
            }
        }
        // add additional boundary squares for over hangs
        for (let y = this.bufferShape.length - 1; y >= 0; y--) {
            for (let x = 0; x < this.bufferShape[y].length; x++) {
                if (this.bufferShape[y][x] == false) {
                    // on rows that are not the bottom row, check if the square below is true
                    if (y > 0 && this.bufferShape[y - 1][x] == true) {
                        this.bufferShape[y][x] = true;
                    }
                }
            }
        }

        // set height and widths
        this.bufferHeight = this.bufferShape.length;
        this.bufferWidth = this.bufferShape[0].length;
    }

    // Function to set values to true between two indices
    setTrueBetween(array, startIndex, endIndex) {
        for (let i = startIndex; i <= endIndex; i++) {
            array[i] = true;
        }
    }
}
