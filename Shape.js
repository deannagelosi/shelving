class Shape {
    constructor(_title) {
        // 2D array of booleans for the user input grid
        this.inputGrid = [[]];

        // shape grids are stored as 2D arrays of booleans
        // - occupied squares as true, unoccupied as false
        this.shape = [[]]; // twice the width and height as the rounded up shape
        this.roundedUpShape = [[]]; // half the width and height as the shape
        this.bufferShape = [[]]; // rounded + one extra square on right and top
        this.bufferHeight;
        this.bufferWidth;

        this.title = _title;
        this.shapeDepth;
        this.weight;
    }

    saveUserInput(_inputGrid, _depthValue) {
        // save the shape and create the rounded up and buffer shape arrays
        this.inputGrid = _inputGrid;
        this.shapeDepth = _depthValue;

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

        // create the rounded up shape - map it to a lower resolution grid
        // - ie. a 2x2 grid to a 1x1 grid. if any square is true, the whole 2x2 grid is true
        this.roundedUpShape = [];
        this.roundedUpShape = this.shape;
        // todo: implement 2x resolution input grids
        // for (let y = 0; y < this.shape.length; y += 2) {
        //     let newRow = [];
        //     for (let x = 0; x < this.shape[y].length; x += 2) {
        //         let isTrue = false;
        //         for (let i = 0; i < 2; i++) {
        //             for (let j = 0; j < 2; j++) {
        //                 if (this.shape[y + i][x + j] == true) {
        //                     isTrue = true;
        //                 }
        //             }
        //         }
        //         newRow.push(isTrue);
        //     }
        //     this.roundedUpShape.push(newRow);
        // }


        // create the buffer shape - add 1 square to right and top edges of rounded up shape
        // 1. make buffer shape larger by 1 on x and y to make room
        // 2. set any voids and under hang squares as true and add trues to the right and top edges
        this.bufferShape = [];
        for (let y = 0; y < this.roundedUpShape.length; y++) {
            let newRow = [...this.roundedUpShape[y]];
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
