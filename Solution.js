class Solution {
    constructor(_shapes) {
        this.shapes = _shapes; // shapes with position data
        this.layout = [[]]; // 2D array of shapes that occupy the layout
        this.squareSize;
        this.buffer; // left & bottom buffer when displaying
        this.clusterLimit = 5; // penalize when anneal scores of this and above are clustered (multiples touching)
        this.score;
        this.valid = false; // a solution valid if no overlapping shapes or bottom shape float
    }

    exampleSolution() {
        // use a hardcoded example solution for testing
        // no annealing will be done on this solution

        // // cardboard shapes example solution
        // this.shapes[0].posX = 0;
        // this.shapes[0].posY = 14;

        // this.shapes[1].posX = 0;
        // this.shapes[1].posY = 6;

        // this.shapes[2].posX = 10;
        // this.shapes[2].posY = 14;

        // this.shapes[3].posX = 8;
        // this.shapes[3].posY = 0;

        // this.shapes[4].posX = 11;
        // this.shapes[4].posY = 7;

        // this.shapes[5].posX = 0;
        // this.shapes[5].posY = 0;


        // // sunny's shapes example solution 1
        // this.shapes[0].posX = 18; // Squash
        // this.shapes[0].posY = 13;

        // this.shapes[1].posX = 19; // Mushroom
        // this.shapes[1].posY = 0;

        // this.shapes[2].posX = 0;
        // this.shapes[2].posY = 20;

        // this.shapes[3].posX = 0; // Bottle
        // this.shapes[3].posY = 12;

        // this.shapes[4].posX = 10; // Blueberries
        // this.shapes[4].posY = 10;

        // this.shapes[5].posX = 17; // Milkweed Pod
        // this.shapes[5].posY = 19;

        // this.shapes[6].posX = 9;
        // this.shapes[6].posY = 17;

        // this.shapes[7].posX = 1;
        // this.shapes[7].posY = 0;

        // this.shapes[8].posX = 0;
        // this.shapes[8].posY = 5;

        // this.shapes[9].posX = 10;
        // this.shapes[9].posY = 0;

        // // sunny's shapes example solution 2
        // this.shapes[0].posX = 24;
        // this.shapes[0].posY = 11;

        // this.shapes[1].posX = 8;
        // this.shapes[1].posY = 7;

        // this.shapes[2].posX = 0;
        // this.shapes[2].posY = 15;

        // this.shapes[3].posX = 23;
        // this.shapes[3].posY = 0;

        // this.shapes[4].posX = 16;
        // this.shapes[4].posY = 17;

        // this.shapes[5].posX = 1;
        // this.shapes[5].posY = 0;

        // this.shapes[6].posX = 0;
        // this.shapes[6].posY = 7;

        // this.shapes[7].posX = 17;
        // this.shapes[7].posY = 5;

        // this.shapes[8].posX = 13;
        // this.shapes[8].posY = 0;

        // this.shapes[9].posX = 17;
        // this.shapes[9].posY = 10;

        // sunny's shapes example solution 3
        this.shapes[0].posX = 0;
        this.shapes[0].posY = 0;

        this.shapes[1].posX = 17;
        this.shapes[1].posY = 8;

        this.shapes[2].posX = 8;
        this.shapes[2].posY = 6;

        this.shapes[3].posX = 16;
        this.shapes[3].posY = 0;

        this.shapes[4].posX = 25;
        this.shapes[4].posY = 0;

        this.shapes[5].posX = 0;
        this.shapes[5].posY = 13;

        this.shapes[6].posX = 24;
        this.shapes[6].posY = 5;

        this.shapes[7].posX = 9;
        this.shapes[7].posY = 0;

        this.shapes[8].posX = 0;
        this.shapes[8].posY = 7;

        this.shapes[9].posX = 10;
        this.shapes[9].posY = 12;

        // make the layout and calculate the score using the example positions
        this.makeLayout();
        this.calcScore();
    }

    randomLayout() {
        // randomly place shapes in the layout as an initial solution
        // annealing will optimize the layout from here

        // find the total area (in terms of number of grid squares) of all shapes
        // - find the area of each shape (including their boundary buffer)
        // - sum up all the areas

        let totalArea = 0;
        for (let i = 0; i < this.shapes.length; i++) {
            let shapeHeight = this.shapes[i].data.boundaryHeight
            let shapeWidth = this.shapes[i].data.boundaryWidth;
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

    makeLayout() {
        // create a 2D array to represent the layout design space

        this.layout = [[]]; // clear the layout

        // place data about shapes into the layout grid
        for (let i = 0; i < this.shapes.length; i++) {
            let shape = this.shapes[i];
            // place shape boundary

            let posData = {
                shapes: [],
                isShape: [],
                annealScore: 0,
                terrainValue: 0
            };

            for (let y = 0; y < shape.data.boundaryHeight; y++) { // loop the boundary shape height and width
                for (let x = 0; x < shape.data.boundaryWidth; x++) {

                    // placing shapes, and growing the layout if shapes are placed outside of initial bounds
                    if (shape.data.boundaryShape[y][x]) {

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

                        // update occupancy in the layout
                        this.layout[shape.posY + y][shape.posX + x].shapes.push(shape);

                        // mark if occupied by a shape or the shape's boundary
                        let shapeInBounds = y < shape.data.shape.length && x < shape.data.shape[0].length;
                        this.layout[shape.posY + y][shape.posX + x + 1].isShape.push(shapeInBounds && shape.data.shape[y][x]);
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
        let squareHeight = canvasHeight / this.layout.length - 1; // -1 makes room for buffer
        let squareWidth = canvasWidth / this.layout[0].length - 1; // -1 makes room for buffer
        this.squareSize = Math.min(squareHeight, squareWidth);
        this.buffer = this.squareSize;

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
            let bottomWidth = shape.data.boundaryShape[0].filter(Boolean).length;
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
    }

    createNeighbor(_maxShift) {
        // create a new solution that's a neighbor to the current solution
        // - max shift (movement) amount is based on temperature

        // make a shallow copy of shapes (gives new posX and posY, but uses same shape data)
        let shapesCopy = this.shapes.map(shape => ({ ...shape }));
        let newSolution = new Solution(shapesCopy);

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
        let lineColor;
        let bkrdColor;
        let boundaryColor;
        let shapeColor;
        let collisionColor;

        if (devMode) {
            lineColor = 0;
            bkrdColor = 255;
            boundaryColor = "rgb(255, 192, 203)";
            shapeColor = "grey";
            collisionColor = "red";
        } else if (!devMode) {
            lineColor = "rgb(198, 198, 197)";
            bkrdColor = "rgb(229, 229, 229)";
            boundaryColor = bkrdColor; // old: "rgb(209, 209, 209)";
            shapeColor = "grey";
            collisionColor = "rgb(135, 160, 103)"
        }

        textAlign(CENTER, CENTER);
        let txtXOffset = this.squareSize / 2;
        let txtYOffset = this.squareSize / 2;
        let txtSize = this.squareSize / 2;
        textSize(txtSize);

        // display the solution grid
        let designHeight = this.layout.length;
        let designWidth = this.layout[0].length;
        for (let x = 0; x < designWidth; x++) {
            if (devMode) {
                // display column number
                strokeWeight(0);
                fill(x % 5 === 0 ? "pink" : 100);
                let textX = (x * this.squareSize) + this.buffer + txtXOffset;
                let textY = (canvasHeight - this.squareSize) + txtYOffset;
                text(x, textX, textY);
            }

            for (let y = 0; y < designHeight; y++) {
                if (devMode) {
                    // display row number
                    strokeWeight(0);
                    fill(y % 5 === 0 ? "pink" : 100);
                    let textX = txtXOffset;
                    let textY = (canvasHeight - this.squareSize - this.buffer) - (y * this.squareSize) + txtYOffset;
                    text(y, textX, textY);
                }

                // draw each layout square
                if (this.layout[y][x].shapes.length == 0) {
                    fill(bkrdColor); // (empty)
                } else if (this.layout[y][x].shapes.length == 1) {

                    // fill square different color if it's occupied by the boundary shape
                    fill(boundaryColor); // (boundary)

                    if (this.layout[y][x].isShape.some(s => s === true)) {
                        // square is occupied by a shape
                        fill(shapeColor);
                    }
                } else if (this.layout[y][x].shapes.length > 1) {
                    if (y == 0 && x == 14) {
                        console.log(this.layout[y][x])
                    }
                    // color in collision 
                    // if devMode, color shape and boundary collisions
                    // if not devMode, only color collisions with shapes
                    if (!devMode && this.layout[y][x].isShape.filter(s => s === true).length >= 2) {
                        fill(collisionColor);  // collision
                    }
                    else if (!devMode && this.layout[y][x].isShape.some(s => s === true)) {
                        fill(shapeColor);
                    }
                    else if (devMode) {
                        fill(collisionColor);  // collision
                    } else {

                        fill(bkrdColor); // (empty)
                    }
                }

                let rectX = (x * this.squareSize) + this.buffer;
                let rectY = (canvasHeight - this.squareSize - this.buffer) - (y * this.squareSize); // draw from bottom up

                stroke(lineColor);
                strokeWeight(0.75);
                rect(rectX, rectY, this.squareSize, this.squareSize);
            }
        }
    }

    showScores() {
        if (devMode) {
            // display the design space grid
            fill(50)
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
                    // find position for score or shape title[0] text, finding y from bottom up
                    let rectX = (x * this.squareSize) + this.buffer + txtXOffset;
                    let rectY = (canvasHeight - this.squareSize - this.buffer) - (y * this.squareSize) + txtYOffset;

                    if (devMode) {

                        if (this.layout[y][x].annealScore > 0) {
                            // display the anneal score if its empty of shapes
                            text(this.layout[y][x].annealScore, rectX, rectY);

                        }
                        // else if (this.layout[y][x].annealScore == 0 && this.layout[y][x].shapes.length > 0) {
                        //     // display the first char of the shape title if there is a shape
                        //     let shapeID = this.layout[y][x].shapes[0].data.title[0]
                        //     text(shapeID, rectX, rectY);
                        // }
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