// Builds shelves using cellular automata rules to grow from a seed
class Automaton {
    constructor(_layout, _shape) {
        this.layout = _layout;
        this.shape = _shape;
        this.seedX = [];
        this.seedY = [];
        this.growMode = 0;
        this.moveUp = true;
        this.moveRight = true;
    }

    plantSeed() {
        // drop seed in the bottom left corner of a shape within a solution
        this.seedX.push(this.startX(this.shape.posX));
        this.seedY.push(this.shape.posY);
    }

    grow() {
        let currX = this.seedX[this.seedX.length - 1];
        let currY = this.seedY[this.seedY.length - 1];
        switch (this.growMode) {
            case 0:
                // draw along bottom of shape
                // if we go out of bounds to the right, then stop growing
                if (currX < this.layout[currY].length) {
                    // in bounds
                    if (this.layout[currY][currX].cellScore == 0) {
                        this.seedX.push(currX + 1);
                        this.seedY.push(currY);
                    } else {
                        this.growMode = 1;
                    }
                } else {
                    return false;
                }
                break;
            case 1:
                // move horizontally
                // posA is the absolute value of the difference between my current position and the next position
                // pos B is the absolute value of the difference between the next position and the position after that
                // if posA is greater than posB, then move forward one
                // if posA is less than or equal to posB, stay in current position and set case = 2
                let diffScoreA = this.calcDiff(currX, currY, "up");
                let diffScoreB = this.calcDiff(currX + 1, currY, "up");
                if (diffScoreB < diffScoreA) {
                    this.seedX.push(currX + 1);
                    this.seedY.push(currY);
                } else {
                    console.log("mode 2")
                    this.growMode = 2;
                }
                break;
            case 2:
                // move vertically
                // calc the absolute value of the difference between (my current position y+1) and (my current position x - 1, y + 1)
                // if this value is zero, increase y by 1
                // if this value is not zero, set case = 3
                let diffScoreC = this.calcDiff(currX, currY + 1, "up");
                if (diffScoreC == 0) {
                    this.seedX.push(currX);
                    this.seedY.push(currY + 1);
                } else if (diffScoreC == -1) {
                    return false;
                } else {
                    // still go up, but pick the best of the 3 options
                    // get the score for all 3 options, disqualifying an option if they are both 0 inside
                    // pick the lowest score, "up and over" method to get to it
                    // if two scores are tied for lowest, keep looking at options directly above those two till you find one lower, pick that option
                    // note: make a function that returns a dot/intersections score for u,d,l, or r
                    let scores = [
                        { score: this.calcDiff(currX - 1, currY + 1, "up"), x: currX - 1, y: currY + 1, dir: "left" },
                        { score: this.calcDiff(currX, currY + 1, "up"), x: currX, y: currY + 1, dir: "center" },
                        { score: this.calcDiff(currX + 1, currY + 1, "up"), x: currX + 1, y: currY + 1, dir: "right" }
                    ];

                    scores.sort((a, b) => a.score - b.score);

                    if (scores[0].score === scores[1].score && scores[1].score === scores[2].score) {
                        console.log("All three scores are the same.");

                        if (scores[0].score == 1000) {
                            // if all three above are occupied, then stop growing
                            return false;
                        }
                    } else if (scores[0].score === scores[1].score) {
                        console.log("The first two scores are the same.");
                        // // if we have a tie, look up above the two tied intersections and compare the diffs of these intersections
                        // // choose the intersection with the lowest diff, 
                        // // and move to that intersection, resulting in dropping a dot at the winning tie location
                        // // as well as a dot at the intersection with the lowest diff that broke the tie
                        let tieScores = [
                            { score: this.calcDiff(scores[0].x, scores[0].y + 1, "up"), x: scores[0].x, y: scores[0].y + 1, dir: scores[0].dir },
                            { score: this.calcDiff(scores[1].x, scores[1].y + 1, "up"), x: scores[1].x, y: scores[1].y + 1, dir: scores[1].dir }
                        ];
                        tieScores.sort((a, b) => a.score - b.score);

                        let winner;
                        if (tieScores[0].score < tieScores[1].score) {
                            winner = tieScores[0];
                            console.log("Tie breaker 1.");
                            console.log("Winner: ", winner);
                        } else {
                            winner = tieScores[1];
                            console.log("Tie breaker 2.");
                        }

                        if (winner.dir == "left") {
                            // push the left turn dot
                            this.seedX.push(currX - 1);
                            this.seedY.push(currY);

                        } else if (winner.dir == "right") {
                            // push the right turn dot
                            this.seedX.push(currX + 1);
                            this.seedY.push(currY);
                        }
                        // push the winner of the tied dots
                        this.seedX.push(winner.x);
                        this.seedY.push(winner.y - 1);
                        // push the tie break dot (aka the dot above the tie winner)
                        this.seedX.push(winner.x);
                        this.seedY.push(winner.y);

                    } else {
                        // no ties
                        if (scores[0].dir == "left") {
                            // pus the left turn dot
                            this.seedX.push(currX - 1);
                            this.seedY.push(currY);

                        } else if (scores[0].dir == "right") {
                            // push the right turn dot
                            this.seedX.push(currX + 1);
                            this.seedY.push(currY);
                        }
                        // push the winner dot
                        this.seedX.push(scores[0].x);
                        this.seedY.push(scores[0].y);
                    }

                }
                break;
            // case 3:
            //     // cell with a seed
            //     break;
        }

        return true;
    }

    showResult(color) {
        let cellSizeHeight = canvasHeight / this.layout.length;
        let cellSizeWidth = canvasWidth / this.layout[0].length;
        let cellSize = Math.min(cellSizeHeight, cellSizeWidth);
        // show the seed placement
        fill(color); // Black color for the dots
        noStroke(); // No border for the dots
        for (let i = 0; i < this.seedX.length; i++) {
            circle(this.seedX[i] * cellSize, canvasHeight - (this.seedY[i] * cellSize), 10);
        }
        // circle(this.seedX * cellSize, canvasHeight - (this.seedY * cellSize), 10);
    }

    //-- Helper methods --//
    calcDiff(coordX, coordY, dir) {
        // UR = [currX, currY]
        // UL = [currX - 1, currY]
        // DR = [currX, currY - 1]
        // DL = [currX - 1, currY - 1]
        if (dir == "up") {
            let cellScoreA = null;
            let cellScoreB = null;
            // check if point is in bounds
            if (this.inBounds(coordX - 1, coordY)) {
                cellScoreA = this.layout[coordY][coordX - 1].cellScore;
            }
            if (this.inBounds(coordX, coordY)) {
                cellScoreB = this.layout[coordY][coordX].cellScore;
            }

            if (cellScoreA == null && cellScoreB == null) {
                console.log("Error: Both null");
                return -1;
            } else if (cellScoreA == null || cellScoreB == null) {
                if (cellScoreA == null) {
                    cellScoreA = 0;
                } else {
                    cellScoreB = 0;
                }
            }

            if (cellScoreA == 0 && cellScoreB == 0) {
                return 1000; // arbitrary large number
            } else {
                return Math.abs(cellScoreA - cellScoreB);
            }
        }

    }

    inBounds(coordX, coordY) {
        let gridHeight = this.layout.length;
        if (coordY < gridHeight && coordY >= 0 && coordX >= 0 && coordX < this.layout[coordY].length) {
            return true;
        } else {
            return false;
        }
    }

    startX(posX) {
        // for shapes with overhang, find the bottom corner of the shape
        // is the currX 
        let currX = 0;
        while (this.shape.data.boundaryShape[0][currX] != true) {
            currX += 1
        }
        return posX + currX;
    }
}