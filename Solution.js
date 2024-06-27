class Solution {
    constructor(_shapes) {
        this.shapes = _shapes; // shapes with position data
        this.layout = [[]]; // 2D array of shapes that occupy the layout
        this.eightThreshold = 0.07; // ratio limit for anneal scores of 8
        this.score;
        this.squareSize;
        this.buffer; // left & bottom buffer when displaying
    }

    exampleSolution() {
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

        // sunny's shapes example solution 2
        this.shapes[0].posX = 24;
        this.shapes[0].posY = 11;

        this.shapes[1].posX = 8;
        this.shapes[1].posY = 7;

        this.shapes[2].posX = 0;
        this.shapes[2].posY = 15;

        this.shapes[3].posX = 23;
        this.shapes[3].posY = 0;

        this.shapes[4].posX = 16;
        this.shapes[4].posY = 17;

        this.shapes[5].posX = 1;
        this.shapes[5].posY = 0;

        this.shapes[6].posX = 0;
        this.shapes[6].posY = 7;

        this.shapes[7].posX = 17;
        this.shapes[7].posY = 5;

        this.shapes[8].posX = 13;
        this.shapes[8].posY = 0;

        this.shapes[9].posX = 17;
        this.shapes[9].posY = 10;

        // // sunny's shapes example solution 3
        // this.shapes[0].posX = 0;
        // this.shapes[0].posY = 0;

        // this.shapes[1].posX = 17;
        // this.shapes[1].posY = 8;

        // this.shapes[2].posX = 8;
        // this.shapes[2].posY = 6;

        // this.shapes[3].posX = 16;
        // this.shapes[3].posY = 0;

        // this.shapes[4].posX = 25;
        // this.shapes[4].posY = 0;

        // this.shapes[5].posX = 0;
        // this.shapes[5].posY = 13;

        // this.shapes[6].posX = 24;
        // this.shapes[6].posY = 5;

        // this.shapes[7].posX = 9;
        // this.shapes[7].posY = 0;

        // this.shapes[8].posX = 0;
        // this.shapes[8].posY = 7;

        // this.shapes[9].posX = 10;
        // this.shapes[9].posY = 12;
    }

    setInitialSolution() {
        //== Create a Design Space ==//

        // this.shapes is an array of all shapes
        // the Shapes class has an attribute called rectArea
        // sum up all of the rectAreas for every shape
        // return the sum
        let totalArea = 0;
        for (let i = 0; i < this.shapes.length; i++) {
            totalArea += this.shapes[i].data.rectArea;
        }
        // add multiplier to give extra space to work with
        let designArea = totalArea * 1.5;
        // find the closest rectangle to the designArea
        let width = Math.floor(Math.sqrt(designArea));
        let height = Math.floor(designArea / width);

        //== Randomly choose initial shape locations in designArea ==//
        // loop shapes and randomly place in the layout
        for (let i = 0; i < this.shapes.length; i++) {
            let currShape = this.shapes[i];
            currShape.posX = Math.floor(Math.random() * width);
            currShape.posY = Math.floor(Math.random() * height);
        }
    }

    makeLayout() {
        // create a 2D array to represent the design space

        this.layout = [[]]; // clear the layout

        // place data about shapes into the layout grid
        for (let i = 0; i < this.shapes.length; i++) {
            let shape = this.shapes[i];
            // place shape boundary

            let posData = {
                shapes: [],
                isShape: false,
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
                        this.layout[shape.posY + y][shape.posX + x + 1].isShape = shapeInBounds && shape.data.shape[y][x];
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
            boundaryColor = "rgb(209, 209, 209)";
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
                    fill(bkrdColor); // white (empty)
                } else if (this.layout[y][x].shapes.length == 1) {
                    // fill square pink if it's occupied by the boundary shape
                    fill(boundaryColor); // pink (boundary)
                    if (this.layout[y][x].isShape) {
                        // square is occupied by the shape
                        fill(shapeColor);
                    }
                } else if (this.layout[y][x].shapes.length > 1) {
                    fill(collisionColor);  // collision
                }

                let rectX = (x * this.squareSize) + this.buffer;
                let rectY = (canvasHeight - this.squareSize - this.buffer) - (y * this.squareSize); // draw from bottom up

                stroke(lineColor);
                strokeWeight(0.75);
                rect(rectX, rectY, this.squareSize, this.squareSize);
            }
        }
    }

    showScores(_devMode) {
        if (_devMode) {
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

                        } else if (this.layout[y][x].annealScore == 0 && this.layout[y][x].shapes.length > 0) {
                            // display the first char of the shape title if there is a shape
                            let shapeID = this.layout[y][x].shapes[0].data.title[0]
                            text(shapeID, rectX, rectY);
                        }
                    }
                }
            }
        }
    }

    calcScore() {
        // the objective function in simulated annealing

        this.score = 0; // reset the score
        let num8Scores = 0; // reset the number of squares with a anneal score of 8
        let totalSquares = 0; // total number of squares in the layout
        let overlappingSquares = 0; // number of squares containing overlapping shapes

        // count all the empty squares in the layout
        for (let y = 0; y < this.layout.length; y++) {
            for (let x = 0; x < this.layout[y].length; x++) {
                totalSquares++; // the total number of squares

                // the number of overlapping squares
                if (this.layout[y][x].shapes.length > 1) {
                    overlappingSquares += this.layout[y][x].shapes.length - 1;
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
                    // calculate the number of with a score of 8
                    if (annealScore == 8) {
                        num8Scores++;
                    }
                }
            }
        }

        let rawBottomShapes = [];

        // loop through each column to find the first shape from the bottom up
        for (let col = 0; col < this.layout[0].length; col++) {
            for (let row = 0; row < this.layout.length; row++) {
                let posData = this.layout[row][col];
                if (posData.shapes.length > 0) {
                    // there is a shape(s) occupying this square
                    let shape = posData.shapes[0];
                    // check if looking at the bottom row of the shape
                    if (row == shape.posY) {
                        // check if the shape already exists in bottomShapes
                        let existingData = rawBottomShapes.find(data => data.shape === shape);

                        if (existingData) {
                            // increment numSeen if the shape already exists
                            existingData.numSeen++;
                        } else {
                            // create a new data object if the shape doesn't exist
                            let data = {
                                shape: shape,
                                numSeen: 1,
                                bottomWidth: shape.data.boundaryShape[0].filter(Boolean).length
                            };
                            rawBottomShapes.push(data);
                        }
                        break; // move to the next column after finding the first shape
                    }
                }
            }
        }
        let bottomShapes = rawBottomShapes.filter(shape => shape.numSeen === shape.bottomWidth);

        // calculate the height off the ground of each bottom shape
        let totalYValues = 0;
        for (let i = 0; i < bottomShapes.length; i++) {
            let yValue = bottomShapes[i].shape.posY;
            totalYValues += yValue;
        }

        if (overlappingSquares == 0 && num8Scores / totalSquares < this.eightThreshold && totalYValues == 0) {
            this.score = 0;
        } else {
            this.score = (this.layout.length * overlappingSquares) + num8Scores + totalYValues;
        }
    }

    makeNeighbor(_tempCurr, _tempMax, _tempMin) {
        // create a new solution that's a neighbor to the current solution

        // make a shallow copy of shapes; ie new posX and posY, but same shape data
        let shapesCopy = this.shapes.map(shape => ({ ...shape }));
        let newSolution = new Solution(shapesCopy);

        // pick shift amount based on temperature
        let shiftMax = 10; // maximum shift distance
        let shiftMin = 1; // minimum shift distance
        let shiftCurr = this.mapValueThenRound(_tempCurr, _tempMax, _tempMin, shiftMax, shiftMin);

        // pick a random shape to act on
        let shapeIndex = Math.floor(Math.random() * this.shapes.length);
        let selectedShape = newSolution.shapes[shapeIndex];

        // pick a randomly to shift the shape or swap with another shape
        let randOption = Math.floor(Math.random() * 9) + 1;
        if (randOption == 1 || randOption == 2) {
            selectedShape.posX -= shiftCurr; // shift x-value smaller

        } else if (randOption == 3 || randOption == 4) {
            selectedShape.posX += shiftCurr; // shift x-value bigger

        } else if (randOption == 5 || randOption == 6) {
            selectedShape.posY -= shiftCurr; // shift y-value smaller

        } else if (randOption == 7 || randOption == 8) {
            selectedShape.posY += shiftCurr; // shift y-value bigger

        }
        else if (randOption == 9) { // pick two shapes and swap their positions
            // choose second shape for swap
            let shapeIndex2 = Math.floor(Math.random() * this.shapes.length);
            let selectedShape2 = newSolution.shapes[shapeIndex2];

            let tempX = selectedShape.posX;
            let tempY = selectedShape.posY;
            selectedShape.posX = selectedShape2.posX;
            selectedShape.posY = selectedShape2.posY;
            selectedShape2.posX = tempX;
            selectedShape2.posY = tempY;
        }

        // check if the new position is within bounds (not negative)
        if (selectedShape.posX < 0) {
            selectedShape.posX = 0;
        }
        if (selectedShape.posY < 0) {
            selectedShape.posY = 0;
        }

        return newSolution;
    }

    mapValueThenRound(oldCurr, oldMin, oldMax, newMin, newMax) {
        let newCurr = ((oldCurr - oldMin) / (oldMax - oldMin)) * (newMax - newMin) + newMin;
        return Math.round(newCurr);
    }
}