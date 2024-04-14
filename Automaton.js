// Builds shelves using cellular automata rules to grow from a seed
class Automaton {
    constructor(_layout, _shape, _startX, _startY) {
        this.layout = _layout;
        this.shape = _shape;
        this.dots = []; // arrays have objects with x and y keys
        this.growMode = 0;
        this.startX = _startX || (_startX == 0) ? _startX : this.overhangShift(this.shape.posX);
        this.startY = _startY || (_startY == 0) ? _startY : this.shape.posY;

        this.moveRight = true;
        this.isGrowing = true;
    }

    plantSeed() {
        // plant seed in the bottom left corner of the shape
        // seed will grow right (push) and left (unshift)
        this.addDot(this.startY, this.startX);
    }

    grow(allDots) {
        // rules for growing the automaton path

        let currX;
        let currY;
        if (this.moveRight) {
            // pushing to the array, start with the last dot in the array
            currX = this.dots[this.dots.length - 1].x;
            currY = this.dots[this.dots.length - 1].y;
        } else {
            // prepending to the array, start with the first dot in the array
            currX = this.dots[0].x;
            currY = this.dots[0].y;
        }

        switch (this.growMode) {
            case -1: // grow perimeter
                if (currY == 0 && this.dotInBounds(currY, currX + 1)) {
                    // grow right along bottom
                    this.addDot(currY, currX + 1);
                } else if (currX == this.layout[0].length && this.dotInBounds(currY + 1, currX)) { 
                    // grow up on right side
                    this.addDot(currY + 1, currX);
                } else if (this.dotInBounds(currY, currX - 1)) {
                    // grow left along the top
                    this.addDot(currY, currX - 1);
                } else if (currX == 0 && this.dotInBounds(currY - 1, currX)) {
                    // grow down the left side
                    this.addDot(currY - 1, currX);
                    if (currY - 1 == 0) {
                        // looking for the bottom left corner, stop growing
                        return false;
                    }
                } else {
                    return false;
                }
                break;
            case 0: // grow along bottom of the shape
                // stop at end of shape or out of bounds
                if (this.cellInBounds(currY, currX)) {
                    // in bounds
                    if (this.layout[currY][currX].shapes[0] === this.shape) {
                        this.addDot(currY, currX + 1);
                    } else {
                        return false;
                    }
                } else {
                    return false;
                }
                break;
            case 1: // move horizontally rightward away from bottom
                // posA is the absolute value of the difference between my current position and the next position
                // pos B is the absolute value of the difference between the next position and the position after that
                // if posA is greater than posB, then move forward one
                // if posA is less than or equal to posB, stay in current position and set case = 2
                let diffScore1A = this.calcDiff(currY, currX, "up");
                let diffScore1B = this.calcDiff(currY, currX + 1, "up");

                // check for completely out of bounds
                if (diffScore1A == -2 || diffScore1B == -2) {
                    return false;
                }

                if (diffScore1B < diffScore1A) {
                    this.addDot(currY, currX + 1);
                } else {
                    this.growMode = 2;
                }
                break;
            case 2: // move vertically straight up
                let diffScore2A = this.calcDiff(currY + 1, currX, "up");

                if (diffScore2A == 0) {
                    this.addDot(currY + 1, currX);
                } else if (diffScore2A == -1) {
                    // one of the two cells is out of bounds (null)
                    return false;
                } else if (diffScore2A == -2) {
                    // both cells are out of bounds (null)
                    this.addDot(currY + 1, currX);
                    return false;
                } else if (diffScore2A == 1000) {
                    // both cells are occupied (0)
                    // check if there's a collision with another shape
                    let upLeftShape = this.layout[currY][currX - 1].shapes[0];
                    let upRightShape = this.layout[currY][currX].shapes[0];

                    if (upLeftShape !== upRightShape) {
                        this.addDot(currY + 1, currX);
                    } else {
                        // both cells are occupied by the same shape
                        // turn left or right
                        let diffScoreLeft = this.calcDiff(currY + 1, currX, "left");
                        let diffScoreRight = this.calcDiff(currY + 1, currX, "right");
                        if (diffScoreLeft == -2 && diffScoreRight != -2) {
                            // turn right 
                            this.addDot(currY, currX + 1);
                        } else if (diffScoreLeft != -2 && diffScoreRight == -2) {
                            // turn left
                            this.addDot(currY, currX - 1);
                        } else if (diffScoreLeft == -2 && diffScoreRight == -2) {
                            return false;
                        } else {
                            this.addDot(currY + 1, currX);
                            return true;
                        }
                    };
                } else {
                    this.growMode = 3;
                }
                break;
            case 3: // move vertically choosing between left, center, or right

                // end if 2 up is occupied. grow to it and stop
                let diffScore3 = this.calcDiff(currY + 2, currX, "up");
                if (diffScore3 == 1000) {
                    this.addDot(currY + 1, currX);
                    this.addDot(currY + 2, currX);
                    return false;
                }

                // else move upwards +1, picking best of the 3 options
                let scores = [
                    { score: this.calcDiff(currY + 1, currX - 1, "up"), x: currX - 1, y: currY + 1, dir: "left" },
                    { score: this.calcDiff(currY + 1, currX, "up"), x: currX, y: currY + 1, dir: "center" },
                    { score: this.calcDiff(currY + 1, currX + 1, "up"), x: currX + 1, y: currY + 1, dir: "right" }
                ];

                scores.sort((a, b) => a.score - b.score);

                let winner;
                // pick the winner
                if (scores[0].score === scores[1].score && scores[1].score === scores[2].score) {
                    // all three intersection scores are equal
                    if (scores[0].score == 1000) {
                        // if all three above are occupied, then stop growing
                        return false;
                    } else {
                        // if all 3 scores are equal, pick the center
                        winner = scores.find(score => score.dir === "center");
                    }
                } else if (scores[0].score === scores[1].score) {
                    // there is a tie, pick the winner
                    let tieScores = [
                        { score: this.calcDiff(scores[0].y + 1, scores[0].x, "up"), x: scores[0].x, y: scores[0].y + 1, dir: scores[0].dir },
                        { score: this.calcDiff(scores[1].y + 1, scores[1].x, "up"), x: scores[1].x, y: scores[1].y + 1, dir: scores[1].dir }
                    ];
                    tieScores.sort((a, b) => a.score - b.score);

                    // tie breaker picks the winner
                    winner = {
                        x: tieScores[0].x,
                        y: tieScores[0].y - 1,
                        dir: tieScores[0].dir
                    };
                } else {
                    // no ties
                    winner = scores[0];
                }

                // push the winner dot, as well as any corner turns
                if (winner.dir == "left") {
                    // push the left turn dot. go up-left or left-up
                    let left = this.calcDiff(currY, currX - 1, "up");
                    let up = this.calcDiff(currY + 1, currX, "up");
                    // avoid "c" notch shapes. if going left loops y+1 above current path, then go up
                    // find dots that share an x value with the winner dot
                    let dots = this.dots.filter(dot => dot.x == winner.x);

                    if (up < left || dots.some(dot => dot.y == winner.y - 2)) {
                        // up-left wins
                        this.addDot(currY + 1, currX);
                    } else {
                        // left-up wins
                        this.addDot(currY, currX - 1);
                    }
                } else if (winner.dir == "right") {
                    // push the right turn dot. go up-right or right-up
                    let right = this.calcDiff(currY, currX + 1, "up");
                    let up = this.calcDiff(currY + 1, currX, "up");
                    if (up < right) {
                        this.addDot(currY + 1, currX);
                    } else {
                        this.addDot(currY, currX + 1);
                    }
                }
                // push the winner dot
                this.addDot(winner.y, winner.x);

                // resume simple vertical movement
                this.growMode = 2;

                break;
            case 4: // move leftward

                // - grow fixes:
                // - (done) 1. automaton know about all dots, not just their own
                // - (done) 2. all automaton grow their full bottom support
                // - (done) 3. then switch to growing one at a time (L and R) together
                // - 4. die on line hits
                // - 5. if about to travel parallel to another automaton for 2 moves, instead intersect with it on that second move


                let currDot = {
                    x: this.dots[0].x,
                    y: this.dots[0].y
                };
                let newDot = {
                    x: currDot.x - 1,
                    y: currDot.y
                };

                // check currDot
                let cellUL = { score: null, shape: null };
                if (this.cellInBounds(currDot.y, currDot.x - 1)) {
                    cellUL.score = this.layout[currDot.y][currDot.x - 1].cellScore;
                    cellUL.shape = this.layout[currDot.y][currDot.x - 1].shapes[0];
                }

                // check if the next cell is occupied by a shape
                if (cellUL.shape) {
                    // grow vertically
                    this.growMode = 2;

                    return true;
                }
                // check out of bounds
                else if (currDot.x <= 0) {
                    return false;
                }
                // check if next dot intersects with a board
                else if (allDots.some(dot => JSON.stringify(dot) === JSON.stringify(newDot))) {
                    // save the occupied spot to connect the boards together, then stop growing
                    this.dots.unshift(newDot); // add to beginning
                    return false;
                }
                else {
                    // clear to the left, keep growing
                    this.dots.unshift(newDot);
                    return true;
                }

                break;
        }

        return true;
    }

    //-- Helper methods --//
    addDot(_y, _x) {
        if (this.moveRight == true) {
            this.dots.push({ x: _x, y: _y });
        } else {
            this.dots.unshift({ x: _x, y: _y });

            // reset to leftward rule
            this.growMode = 4;
        }
    }

    calcDiff(coordY, coordX, dir) {
        // UR = [currY, currX]
        // UL = [currY, currX - 1]
        // DR = [currY - 1, currX]
        // DL = [currY - 1, currX - 1]
        let cellUL = { score: null, shape: null };
        let cellUR = { score: null, shape: null };
        let cellDL = { score: null, shape: null };
        let cellDR = { score: null, shape: null };

        // check if point is in bounds
        if (this.cellInBounds(coordY, coordX - 1)) {
            cellUL.score = this.layout[coordY][coordX - 1].cellScore;
            cellUL.shape = this.layout[coordY][coordX - 1].shapes[0];
        }
        if (this.cellInBounds(coordY, coordX)) {
            cellUR.score = this.layout[coordY][coordX].cellScore;
            cellUR.shape = this.layout[coordY][coordX].shapes[0];
        }
        if (this.cellInBounds(coordY - 1, coordX - 1)) {
            cellDL.score = this.layout[coordY - 1][coordX - 1].cellScore;
            cellDL.shape = this.layout[coordY - 1][coordX - 1].shapes[0];
        }
        if (this.cellInBounds(coordY - 1, coordX)) {
            cellDR.score = this.layout[coordY - 1][coordX].cellScore;
            cellDR.shape = this.layout[coordY - 1][coordX].shapes[0];
        }

        if (dir == "up") {
            if (cellUL.score == null && cellUR.score == null) {
                return -2;
            }
            if (cellUL.score == null || cellUR.score == null) {
                return -1;
            }
            if (cellUL.score == 0 && cellUR.score == 0) {
                return 1000; // arbitrary large number
            } else {
                return Math.abs(cellUL.score - cellUR.score);
            }
        } else if (dir == "left") {
            // if UL and DL are different shapes, the return the score
            // if UL and DL are the same shape, return -2
            if (cellUL.shape !== cellDL.shape) {
                return Math.abs(cellUL.score - cellDL.score);
            } else {
                return -2;
            }
        } else if (dir == "right") {
            // if UR and DR are different shapes, the return the score
            // if UR and DR are the same shape, return -2

        }
    }

    dotInBounds(coordY, coordX) {
        // check in bounds for dots (can == length)
        let yInBounds = coordY >= 0 && coordY <= this.layout.length;
        let xInBounds = coordX >= 0 && coordX <= this.layout[0].length;
        if (yInBounds && xInBounds ) {
            return true;
        } else {
            return false;
        }
    }
    
    cellInBounds(coordY, coordX) {
        // check in bounds for layout cells (up to < length)
        let yInBounds = coordY >= 0 && coordY < this.layout.length;
        let xInBounds = coordX >= 0 && coordX < this.layout[0].length;
        if (yInBounds && xInBounds ) {
            return true;
        } else {
            return false;
        }
    }

    overhangShift(posX) {
        // for shapes with overhang, find the bottom corner of the shape
        // is the currX 
        let currX = 0;
        while (this.shape.data.boundaryShape[0][currX] != true) {
            currX += 1
        }
        return posX + currX;
    }
}