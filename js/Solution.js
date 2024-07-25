class Solution {
    constructor(_shapes, _startID) {
        this.shapes = _shapes; // shapes with position data
        this.startID = _startID; // the multi-start index this solution annealed from
        this.layout = [[]]; // 2D array of shapes that occupy the layout
        this.squareSize;
        this.buffer; // buffer makes room for line numbers in dev mode
        this.xPadding; // padding centers the solution in the canvas
        this.yPadding;
        this.clusterLimit = 5; // penalize when anneal scores of this and above are clustered (multiples touching)
        this.score;
        this.valid = false; // a solution valid if no overlapping shapes or bottom shape float
    }

    randomLayout() {
        // randomly place shapes in the layout as an initial solution
        // annealing will optimize the layout from here

        // find the total area (in terms of number of grid squares) of all shapes
        // - find the area of each shape + buffer
        // - sum up all the areas
        let totalArea = 0;
        for (let i = 0; i < this.shapes.length; i++) {
            let shapeHeight = this.shapes[i].data.bufferShape.length;
            let shapeWidth = this.shapes[i].data.bufferShape[0].length;
            totalArea += (shapeHeight * shapeWidth);
        }
        // give extra space and find the closest rectangle that can hold that area
        let layoutArea = totalArea * 2;
        let width = Math.ceil(Math.sqrt(layoutArea));
        let height = Math.ceil(layoutArea / width);

        // pick random locations for each shape within the potential layout bounds
        for (let i = 0; i < this.shapes.length; i++) {
            let currShape = this.shapes[i];
            currShape.posX = Math.floor(Math.random() * width);
            currShape.posY = Math.floor(Math.random() * height);
        }

        // make the layout using the random positions and calculate the score
        this.makeLayout();
        this.calcScore();
    }

    makeBlankLayout(_gridSize) {
        // set default blank values needed to display just the grid

        this.layout = new Array(_gridSize).fill(null).map(() => new Array(_gridSize).fill([]));

        let layoutHeight = this.layout.length;
        let layoutWidth = this.layout[0].length;
        let squareHeight = canvasHeight / layoutHeight - 3; // -3 makes room for top/bottom buffer
        let squareWidth = canvasWidth / layoutWidth - 3; // -3 makes room for left/right buffer
        this.squareSize = Math.min(squareHeight, squareWidth);
        this.buffer = this.squareSize;
        this.yPadding = ((canvasHeight - (layoutHeight * this.squareSize)) / 2) - this.buffer;
        this.xPadding = ((canvasWidth - (layoutWidth * this.squareSize)) / 2) - this.buffer;
    }

    makeLayout() {
        // create a 2D array to represent the layout design space

        this.layout = [[]]; // clear the layout

        // place data about shapes into the layout grid
        for (let i = 0; i < this.shapes.length; i++) {
            let shape = this.shapes[i];

            // posData is stored in each layout grid square
            let posData = {
                shapes: [],
                isShape: [], // a lowRes shape square 
                isBuffer: [], // a buffer square for the shape
                annealScore: 0,
                terrainValue: 0
            };

            // loop shape's buffer height & width to place the full footprint in the layout
            for (let y = 0; y < shape.data.bufferShape.length; y++) {
                for (let x = 0; x < shape.data.bufferShape[y].length; x++) {

                    // place shapes, growing layout if shapes placed out-of-bounds
                    if (shape.data.bufferShape[y][x]) {

                        // grow the layout to fit the shape
                        let xInBounds = shape.posX + x + 1 < this.layout[0].length;
                        let yInBounds = shape.posY + y < this.layout.length;

                        while (!xInBounds) {
                            // grow the x+ direction by two
                            for (let i = 0; i < this.layout.length; i++) {
                                // grow every row with a new posData object
                                this.layout[i].push(JSON.parse(JSON.stringify(posData)));
                                this.layout[i].push(JSON.parse(JSON.stringify(posData)));
                            }
                            xInBounds = shape.posX + x + 1 < this.layout[0].length;
                        }
                        while (!yInBounds) {
                            // grow the y+ direction
                            // add a new row filled with unique objects
                            let newRow = new Array(this.layout[0].length).fill(null).map(() => (JSON.parse(JSON.stringify(posData))));
                            this.layout.push(newRow);

                            yInBounds = shape.posY + y < this.layout.length;
                        }

                        // save the shape to the layout posData
                        this.layout[shape.posY + y][shape.posX + x].shapes.push(shape);

                        // determine if square is occupied by the shape, or by it's buffer
                        let lowResShapeInBounds = y < shape.data.lowResShape.length && x < shape.data.lowResShape[0].length;
                        if (lowResShapeInBounds) {
                            this.layout[shape.posY + y][shape.posX + x].isShape.push(shape.data.lowResShape[y][x]);
                        }

                        let bufferInBounds = y < shape.data.bufferShape.length && x < shape.data.bufferShape[0].length;
                        if (bufferInBounds) {
                            this.layout[shape.posY + y][shape.posX + x].isBuffer.push(shape.data.bufferShape[y][x]);
                        }
                    }
                }
            }
        }

        // trim layout and remove empty rows
        // trim the last row if it's empty
        while (this.layout.length > 0 && this.layout[this.layout.length - 1].every(posData => posData.shapes.length == 0)) {
            this.layout.pop();
        }
        // trim the first row if it's empty
        while (this.layout.length > 0 && this.layout[0].every(posData => posData.shapes.length == 0)) {
            this.layout.shift();
            // update shape.posY with new position for every shape
            for (let i = 0; i < this.shapes.length; i++) {
                this.shapes[i].posY--;
            }
        }
        // Remove all-zero columns from the right
        while (this.layout[0].length > 0 && this.layout.every(row => row[row.length - 1].shapes.length == 0)) {
            for (let i = 0; i < this.layout.length; i++) {
                this.layout[i].pop();
            }
        }
        // Remove all-zero columns from the left
        while (this.layout[0].length > 0 && this.layout.every(row => row[0].shapes.length == 0)) {
            for (let i = 0; i < this.layout.length; i++) {
                this.layout[i].shift();
            }
            // update shape.posX with new position for every shape
            for (let i = 0; i < this.shapes.length; i++) {
                this.shapes[i].posX--;
            }
        }

        // update squareSize for this layout
        let layoutHeight = this.layout.length;
        let layoutWidth = this.layout[0].length;
        let squareHeight = canvasHeight / layoutHeight - 3; // -3 makes room for top/bottom buffer
        let squareWidth = canvasWidth / layoutWidth - 3; // -3 makes room for left/right buffer
        this.squareSize = Math.min(squareHeight, squareWidth);
        // buffer makes room for the line numbers in dev mode
        this.buffer = this.squareSize;
        // padding centers the solution in the canvas
        this.yPadding = ((canvasHeight - (layoutHeight * this.squareSize)) / 2) - this.buffer;
        this.xPadding = ((canvasWidth - (layoutWidth * this.squareSize)) / 2) - this.buffer;

        // assign IDs to shapes based on position
        for (let i = 0; i < this.shapes.length; i++) {
            let shapeID = this.shapes[i].posY.toString() + this.shapes[i].posX.toString();
            this.shapes[i].shapeID = shapeID;
        }
    }

    calcScore() {
        // the objective function in simulated annealing

        // calculate annealing scores and find squares with overlapping shapes
        this.score = 0; // reset the score
        let overlappingCount = 0; // number of squares containing overlapping shapes
        let totalSquares = 0;
        for (let y = 0; y < this.layout.length; y++) {
            for (let x = 0; x < this.layout[y].length; x++) {
                totalSquares++;

                // the number squares with overlapping shapes
                if (this.layout[y][x].shapes.length > 1) {
                    overlappingCount += this.layout[y][x].shapes.length - 1;
                }

                // the number with an anneal score of 8 (no adjacent empty spots) and calc ratio
                if (this.layout[y][x].shapes.length == 0) {
                    // grid square is empty, calculate the score
                    let annealScore = 8;
                    // check the 8 possible adjacent squares
                    for (let localY = Math.max(0, y - 1); localY <= Math.min(y + 1, this.layout.length - 1); localY++) {
                        for (let localX = Math.max(0, x - 1); localX <= Math.min(x + 1, this.layout[0].length - 1); localX++) {
                            // don't count the square itself
                            if (localX !== x || localY !== y) {
                                // count if the adjacent square is empty
                                if (this.layout[localY][localX].shapes.length > 0) {
                                    annealScore--;
                                }
                            }
                        }
                    }
                    // assign the score
                    this.layout[y][x].annealScore = annealScore;
                }
            }
        }

        // find the cluster penalties, ie. squares touching squares of the same value (above a limit)
        // - add up all anneal scores
        // - add up empty squares under an object, from the object to the floor
        let clusterPenalty = 0;
        let totalAnnealScore = 0;
        for (let y = 0; y < this.layout.length; y++) {
            for (let x = 0; x < this.layout[y].length; x++) {
                let annealScore = this.layout[y][x].annealScore;
                totalAnnealScore += annealScore;

                if (annealScore >= this.clusterLimit) {
                    // look at all the squares surrounding this one and count the number's that are the same 
                    let checkCount = 0;
                    // check the 8 possible adjacent squares
                    for (let localY = Math.max(0, y - 1); localY <= Math.min(y + 1, this.layout.length - 1); localY++) {
                        for (let localX = Math.max(0, x - 1); localX <= Math.min(x + 1, this.layout[0].length - 1); localX++) {
                            // don't count the square itself
                            if (localX !== x || localY !== y) {
                                // count if the adjacent square is the same score
                                if (this.layout[localY][localX].annealScore == annealScore) {
                                    // skew larger clustered scores as worse
                                    clusterPenalty += Math.pow(3, (annealScore - this.clusterLimit));
                                }
                                checkCount++; // used to see how many out-of-bounds (how many skipped)
                            }
                        }
                    }
                    // Add any out-of-bound (skipped) squares if the score is 8
                    if (annealScore == 8) {
                        clusterPenalty += (8 - checkCount);
                    }
                }
            }
        }

        // loop shapes and check for float values
        // - bottom float: how far up a bottom row shape is from the bottom
        // - middle float: if a other shape has a full empty row under it
        let totalBottomLift = 0; // how many y-values lifted all the bottom shapes are
        let totalBottomEmptyRow = 0; // sum of anneal scores on all full empty rows under shapes
        for (let shape of this.shapes) {
            let bottomY = shape.posY;
            let bottomWidth = shape.data.bufferShape[0].filter(Boolean).length;
            let isBottomShape = true; // stays true if shape has no shapes under it
            let shapeBottomEmptyRowScore = 0;

            for (let x = shape.posX; x < shape.posX + bottomWidth; x++) {
                // loop all of the shapes x-vales
                let rowInBounds = this.layoutInBounds(bottomY - 1, x);
                if (rowInBounds && this.layout[bottomY - 1][x].shapes.length === 0) {
                    shapeBottomEmptyRowScore += this.layout[bottomY - 1][x].annealScore
                } else {
                    shapeBottomEmptyRowScore = 0;
                    isBottomShape = false;
                    break;
                }

                // loop all y-values till the bottom. stop if hit a shape
                for (let y = bottomY - 1; y >= 0; y--) {
                    if (this.layout[y][x].shapes.length > 0) {
                        isBottomShape = false;
                        break;
                    }
                }
            }
            // save the row under score if it was all empty
            totalBottomEmptyRow += shapeBottomEmptyRowScore;

            // if shape was a bottom shape, add it's y-value to the total
            if (isBottomShape) {
                totalBottomLift += bottomY;
            }
        }

        // adjust penalties
        if (totalBottomLift > 0) {
            totalBottomLift *= Math.pow(this.shapes.length, 3);
        }
        if (overlappingCount > 0) {
            overlappingCount *= Math.pow(this.shapes.length, 3);
        }
        let bottomPenalty = totalBottomLift + (totalBottomEmptyRow * (this.shapes.length / 1.5));
        let spacePenalty = (totalAnnealScore + totalSquares) * 0.05;

        // check if solution is valid
        if (totalBottomLift == 0 && overlappingCount == 0) {
            this.valid = true;
        }
        // calc the "squareness" of the result
        let w = this.layout[0].length
        let h = this.layout.length
        let whRatio = (Math.max(w, h) / Math.min(w, h)) - 1;
        let squareness = Math.pow((whRatio * this.shapes.length), 2) * 1.5;

        this.score = Math.floor(overlappingCount + clusterPenalty + bottomPenalty + squareness + spacePenalty);
        // this.score = Math.floor(clusterPenalty + bottomPenalty + squareness + spacePenalty);
    }

    createNeighbor(_maxShift) {
        // create a new solution that's a neighbor to the current solution
        // - max shift (movement) amount is based on temperature

        // make a shallow copy of shapes (gives new posX and posY, but uses same shape data)
        let shapesCopy = this.shapes.map(shape => ({ ...shape }));
        let newSolution = new Solution(shapesCopy, this.startID);

        // pick a random shape to act on
        let shapeIndex = Math.floor(Math.random() * this.shapes.length);
        let selectedShape = newSolution.shapes[shapeIndex];

        // can move side to side, up or down, and diagonal
        // pick which a randomly movement option to perform
        let randOption = Math.floor(Math.random() * 9) + 1;
        switch (randOption) {
            case 1: // left
                selectedShape.posX -= _maxShift;
                break;
            case 2: // up-left
                selectedShape.posX -= _maxShift;
                selectedShape.posY += _maxShift;
                break;
            case 3: // up
                selectedShape.posY += _maxShift;
                break;
            case 4: // up-right
                selectedShape.posX += _maxShift;
                selectedShape.posY += _maxShift;
                break;
            case 5: // right
                selectedShape.posX += _maxShift;
                break;
            case 6: // down-right
                selectedShape.posX += _maxShift;
                selectedShape.posY -= _maxShift;
                break;
            case 7: // down
                selectedShape.posY -= _maxShift;
                break;
            case 8: // down-left
                selectedShape.posX -= _maxShift;
                selectedShape.posY -= _maxShift;
                break;
            case 9: // swap position with another random shape
                // choose second shape for swap
                let shapeIndex2;
                do { // keep selecting until it's a different shape
                    shapeIndex2 = Math.floor(Math.random() * this.shapes.length);
                } while (shapeIndex2 === shapeIndex);
                let selectedShape2 = newSolution.shapes[shapeIndex2];
                let tempX = selectedShape.posX;
                let tempY = selectedShape.posY;
                selectedShape.posX = selectedShape2.posX;
                selectedShape.posY = selectedShape2.posY;
                selectedShape2.posX = tempX;
                selectedShape2.posY = tempY;
                break;
        }

        // if shape shifted negative x or y, move all shapes over that amount
        // - sets the shape to 0 while moving everyone relative to that change
        if (selectedShape.posX < 0 || selectedShape.posY < 0) {
            let adjustX = selectedShape.posX < 0 ? Math.abs(selectedShape.posX) : 0;
            let adjustY = selectedShape.posY < 0 ? Math.abs(selectedShape.posY) : 0;

            for (let shape of newSolution.shapes) {
                shape.posX += adjustX;
                shape.posY += adjustY;
            }
        }

        // calculate the score of the new solution
        newSolution.makeLayout();
        newSolution.calcScore();

        return newSolution;
    }

    showLayout() {
        let colors = {};
        if (devMode) {
            colors.lineColor = 0;
            colors.bkrdColor = 255;
            colors.bufferColor = "rgb(255, 192, 203)";
            colors.lowResShapeColor = "rgba(140,140,140, 0.5)"; // grey at 50% opacity
            colors.highResShapeColor = "rgba(102,102,102, 0.9)";
            colors.collisionColor = "rgba(255, 0, 0, 0.5)"; // red at 50% opacity
        } else if (!devMode) {
            colors.lineColor = "rgb(198, 198, 197)";
            colors.bkrdColor = "rgb(229, 229, 229)";
            colors.bufferColor = colors.bkrdColor;
            colors.lowResShapeColor = colors.bkrdColor;
            colors.highResShapeColor = "rgb(102,102,102)";
            colors.collisionColor = "rgba(135, 160, 103, 0.5)"
        }

        if (editMode) {
            colors.bufferColor = "rgba(200,200,200, 0.5)";
        }

        // draw the layout from the bottom layer up
        this.showGridSquares(colors);

        // show the side grid numbers
        if (devMode) this.showGridNumbers();
        // display low res grid buffer squares
        if (devMode || editMode) this.showBuffer(colors);
        // display low res shape squares
        if (devMode) this.showLowResShapes(colors);

        // show the high res shapes
        this.showHighResShapes(colors);

        // show the collision squares
        this.showCollision(colors);
    }

    showGridSquares(_colors) {
        // only print the grid squares with background color
        stroke(_colors.lineColor);
        strokeWeight(0.75);
        fill(_colors.bkrdColor);

        for (let y = 0; y < this.layout.length; y++) {
            for (let x = 0; x < this.layout[y].length; x++) {
                // buffer makes room for the line numbers in dev mode
                // padding centers the solution in the canvas
                let rectX = (x * this.squareSize) + this.buffer + this.xPadding;
                let rectY = ((canvasHeight - this.yPadding) - this.squareSize - this.buffer) - (y * this.squareSize); // draw from bottom up
                rect(rectX, rectY, this.squareSize, this.squareSize);
            }
        }
    }

    showGridNumbers() {
        textAlign(CENTER, CENTER);
        let txtXOffset = this.squareSize / 2;
        let txtYOffset = this.squareSize / 2;
        let txtSize = this.squareSize / 2;
        textSize(txtSize);
        noStroke();

        let designHeight = this.layout.length;
        let designWidth = this.layout[0].length;
        for (let x = 0; x < designWidth; x++) {
            // display column number
            fill(x % 5 === 0 ? "pink" : 100);
            let textX = (x * this.squareSize) + this.buffer + this.xPadding + txtXOffset;
            let textY = ((canvasHeight - this.yPadding) - this.buffer) + txtYOffset;
            text(x, textX, textY);

            for (let y = 0; y < designHeight; y++) {
                // display row number
                fill(y % 5 === 0 ? "pink" : 100);
                let textX = this.xPadding + txtXOffset;
                let textY = ((canvasHeight - this.yPadding) - this.squareSize - this.buffer) - (y * this.squareSize) + txtYOffset;
                text(y, textX, textY);
            }
        }
    }

    showBuffer(_colors) {
        stroke(_colors.lineColor);
        strokeWeight(0.75);
        fill(_colors.bufferColor);

        for (let y = 0; y < this.layout.length; y++) {
            for (let x = 0; x < this.layout[y].length; x++) {
                // only draw buffer squares
                if (this.layout[y][x].shapes.length > 0) {
                    // check if its a buffer square
                    if (this.layout[y][x].isBuffer.some(s => s === true)) {
                        // buffer makes room for the line numbers in dev mode
                        // padding centers the solution in the canvas
                        let rectX = (x * this.squareSize) + this.buffer + this.xPadding;
                        let rectY = ((canvasHeight - this.yPadding) - this.squareSize - this.buffer) - (y * this.squareSize); // draw from bottom up
                        rect(rectX, rectY, this.squareSize, this.squareSize);
                    }
                }
            }
        }
    }

    showLowResShapes(_colors) {
        noStroke();
        fill(_colors.lowResShapeColor);

        for (let y = 0; y < this.layout.length; y++) {
            for (let x = 0; x < this.layout[y].length; x++) {
                // only draw low res shape squares
                if (this.layout[y][x].shapes.length > 0) {
                    // check it's a low res shape square
                    if (this.layout[y][x].isShape.some(s => s === true)) {
                        // buffer makes room for the line numbers in dev mode
                        // padding centers the solution in the canvas
                        let rectX = (x * this.squareSize) + this.buffer + this.xPadding;
                        let rectY = ((canvasHeight - this.yPadding) - this.squareSize - this.buffer) - (y * this.squareSize); // draw from bottom up
                        rect(rectX + (this.squareSize / 2), rectY, this.squareSize, this.squareSize);
                    }
                }
            }
        }
    }

    showHighResShapes(_colors) {
        //== show the high res shapes
        noStroke();
        fill(_colors.highResShapeColor);

        // loop through shapes
        for (let i = 0; i < this.shapes.length; i++) {
            let startX = this.shapes[i].posX;
            let startY = this.shapes[i].posY;
            let smallSquare = this.squareSize / 4;

            // draw rectangle for each true square in the shape grid
            for (let y = 0; y < this.shapes[i].data.highResShape.length; y++) {
                for (let x = 0; x < this.shapes[i].data.highResShape[y].length; x++) {
                    // only draw high res shape squares
                    if (this.shapes[i].data.highResShape[y][x]) {

                        // find its position on the canvas and draw the square
                        let rectX = (startX * this.squareSize) + (x * smallSquare) + this.buffer + this.xPadding;
                        let yOffset = ((canvasHeight - this.yPadding) - smallSquare - this.buffer);
                        let yStart = (startY * this.squareSize);
                        let yRect = (y * smallSquare);
                        let rectY = yOffset - yStart - yRect;
                        rect(rectX + (this.squareSize / 2), rectY, smallSquare, smallSquare);
                    }
                }
            }
        }
    }

    showCollision(_colors) {
        noStroke();
        fill(_colors.collisionColor);

        for (let y = 0; y < this.layout.length; y++) {
            for (let x = 0; x < this.layout[y].length; x++) {
                // only draw collision squares
                if (this.layout[y][x].shapes.length > 1) {
                    // collision. rules:
                    // - if devMode, collision for any overlap (buffer/buffer covers all since shape overlays buffer)
                    // - if not devMode, collision only for shape/shape overlap (not shape/buffer, or buffer/buffer)
                    let isCollision = false;
                    if (devMode && this.layout[y][x].isBuffer.filter(s => s === true).length >= 2) {
                        // 2 or more buffers overlapping
                        isCollision = true;
                    } else if (this.layout[y][x].isShape.filter(s => s === true).length >= 2) {
                        // 2 or more shapes overlapping
                        isCollision = true;
                    }

                    if (isCollision) {
                        // buffer makes room for the line numbers in dev mode
                        // padding centers the solution in the canvas
                        let rectX = (x * this.squareSize) + this.buffer + this.xPadding;
                        let rectY = ((canvasHeight - this.yPadding) - this.squareSize - this.buffer) - (y * this.squareSize); // draw from bottom up
                        rect(rectX, rectY, this.squareSize, this.squareSize);
                    }
                }

            }
        }
    }

    showScores() {
        if (devMode) {
            // display the design space grid
            fill(100)
            stroke(50);
            strokeWeight(0.25);
            textAlign(CENTER, CENTER);
            let txtXOffset = this.squareSize / 2;
            let txtYOffset = this.squareSize / 2;
            let txtSize = this.squareSize / 1.5;
            textSize(txtSize);

            let designHeight = this.layout.length;
            let designWidth = this.layout[0].length;
            for (let x = 0; x < designWidth; x++) {
                for (let y = 0; y < designHeight; y++) {
                    // display the anneal score if its empty of shapes
                    if (this.layout[y][x].annealScore > 0) {
                        // find position for score or shape title[0] text, finding y from bottom up
                        let rectX = (x * this.squareSize) + this.buffer + this.xPadding + txtXOffset;
                        let rectY = ((canvasHeight - this.yPadding) - this.squareSize - this.buffer) - (y * this.squareSize) + txtYOffset;
                        text(this.layout[y][x].annealScore, rectX, rectY);
                    }
                }
            }
        }
    }

    // helper functions
    layoutInBounds(coordY, coordX) {
        // check if the grid is in bounds
        let yInBounds = coordY >= 0 && coordY < this.layout.length;
        let xInBounds = coordX >= 0 && coordX < this.layout[0].length;
        if (yInBounds && xInBounds) {
            return true;
        } else {
            return false;
        }
    }
}