class Shape {
    constructor() {
        //== shape specific data
        // - data that is the same for all solutions
        // - stored in an object to be passed by reference for each solution
        this.data = {
            // shape grids are stored as 2D arrays of booleans
            inputGrid: [[]], // (high res) user input grid
            // - occupied squares as true, unoccupied as false
            highResShape: [[]], // (high res) trimmed input grid
            lowResShape: [[]], // 1/4th the width and height as shape, scaled to 1/4th the resolution
            bufferShape: [[]], // low res + one extra square on right and top
            title: '', // title of the shape
        };

        //== solution specific data
        // - data that is unique to each solution
        // - stored as primitives to be passed by copy for each solution
        this.posX = 0;
        this.posY = 0;
        this.enabled = true;
    }

    saveUserInput(_title, _inputGrid) {
        // save the shape and create the rounded up and buffer shape arrays
        this.data.title = _title;
        this.data.inputGrid = _inputGrid;

        //== create shape
        // trimming empty rows and columns in the input grid
        let shapeTemp = [];
        let leftIndex = this.data.inputGrid[0].length - 1;
        let rightIndex = 0;
        // find the farthest left and right indices of the shape
        for (let y = 0; y < this.data.inputGrid.length; y++) {
            if (this.data.inputGrid[y].includes(true)) {
                // find the left and the right ends of the shape on this row
                let currLeft = this.data.inputGrid[y].indexOf(true);
                let currRight = this.data.inputGrid[y].lastIndexOf(true);
                if (currLeft < leftIndex) {
                    leftIndex = currLeft;
                }
                if (currRight > rightIndex) {
                    rightIndex = currRight;
                }
            }
        }
        // use leftIndex and rightIndex to trim the shape
        for (let y = 0; y < this.data.inputGrid.length; y++) {
            if (this.data.inputGrid[y].includes(true)) {
                let rowSlice = this.data.inputGrid[y].slice(leftIndex, rightIndex + 1);
                shapeTemp.push(rowSlice);
            }
        }
        // pad the shape with extra columns to make evenly distribute across a divisible by 4 width
        this.data.highResShape = [];
        const width = shapeTemp[0].length;
        const paddedWidth = Math.ceil(width / 4) * 4;
        const paddingLeft = Math.floor((paddedWidth - width) / 2);
        const paddingRight = paddedWidth - width - paddingLeft;
        // add the shape, trimmed + padded left/right for 4 dividable
        shapeTemp.forEach(row => {
            const newRow = new Array(paddingLeft).fill(false)
                .concat(row)
                .concat(new Array(paddingRight).fill(false));
            this.data.highResShape.push(newRow);
        });

        //== create the low res shape 
        // - scale the shape down to 1/4th the resolution
        // - first pad the shape on the top to make it divisible by 4
        let paddedShape = this.data.highResShape.map(row => [...row]);
        const height = this.data.highResShape.length;
        const paddedHeight = Math.ceil(height / 4) * 4;
        const paddingBottom = paddedHeight - height;
        // pad the shape on the top
        for (let i = 0; i < paddingBottom; i++) {
            paddedShape.push(new Array(paddedWidth).fill(false));
        }
        // reduce the resolution by 4x
        this.data.lowResShape = [];
        const lowResHeight = Math.floor(paddedShape.length / 4);
        const lowResWidth = Math.floor(paddedShape[0].length / 4);
        for (let y = 0; y < lowResHeight; y++) {
            const row = [];
            for (let x = 0; x < lowResWidth; x++) {
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
            this.data.lowResShape.push(row);
        }

        //== create the buffer shape 
        // - add 1 square to right and top edges of rounded up shape
        // 1. make buffer shape larger by 1 on x and y to make room
        // 2. set any voids and under hang squares as true and add trues to the right and top edges
        this.data.bufferShape = [];
        for (let y = 0; y < this.data.lowResShape.length; y++) {
            let newRow = [...this.data.lowResShape[y]];
            newRow.push(false); // add extra space on the right
            let firstTrue = newRow.indexOf(true);
            let lastTrue = newRow.lastIndexOf(true);
            this.setTrueBetween(newRow, firstTrue, lastTrue + 1);
            this.data.bufferShape.push(newRow);
        }
        // add a row on the top of the trim shape that's the same as the row below it
        this.data.bufferShape.push([...this.data.bufferShape[this.data.bufferShape.length - 1]]);
        // add additional buffer squares for under hangs
        for (let y = 0; y < this.data.bufferShape.length; y++) {
            for (let x = 0; x < this.data.bufferShape[y].length; x++) {
                if (this.data.bufferShape[y][x] == false) {
                    // on rows that are not the top row, check if the square above is true
                    if (y < (this.data.bufferShape.length - 1) && this.data.bufferShape[y + 1][x] == true) {
                        this.data.bufferShape[y][x] = true;
                    }
                }
            }
        }
        // add additional buffer squares for over hangs
        for (let y = this.data.bufferShape.length - 1; y >= 0; y--) {
            for (let x = 0; x < this.data.bufferShape[y].length; x++) {
                if (this.data.bufferShape[y][x] == false) {
                    // on rows that are not the bottom row, check if the square below is true
                    if (y > 0 && this.data.bufferShape[y - 1][x] == true) {
                        this.data.bufferShape[y][x] = true;
                    }
                }
            }
        }
    }

    toDataObject() {
        // convert Shape instance to text object (JSON) (export/worker communication)
        return {
            data: {
                highResShape: this.data.highResShape,
                title: this.data.title
            },
            posX: this.posX,
            posY: this.posY,
            enabled: this.enabled
        };
    }

    static fromDataObject(shapeData) {
        // convert Shape text object (JSON) to Shape instance (import/worker communication)
        const newShape = new Shape();
        newShape.saveUserInput(shapeData.data.title, shapeData.data.highResShape);

        // Set position and state properties if provided
        if (shapeData.posX !== undefined) newShape.posX = shapeData.posX;
        if (shapeData.posY !== undefined) newShape.posY = shapeData.posY;
        if (shapeData.enabled !== undefined) newShape.enabled = shapeData.enabled;

        return newShape;
    }

    // Function to set values to true between two indices
    setTrueBetween(array, startIndex, endIndex) {
        for (let i = startIndex; i <= endIndex; i++) {
            array[i] = true;
        }
    }
}

// Only export the class when in a Node.js environment (e.g., during Jest tests)
// Ignored when the app is running in the browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Shape;
}