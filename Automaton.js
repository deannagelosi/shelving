// Builds shelves using cellular automata rules to grow from a seed
class Automaton {
    constructor(_layout, _shape, _startX, _startY) {
        this.layout = _layout;
        this.shape = _shape;
        this.dots = []; // an array of objects with x and y coordinates
        this.growMode = 0;
        this.moveUp = true;
        this.moveRight = true;
        this.startX = _startX ? _startX : this.overhangShift(this.shape.posX);
        this.startY = _startY ? _startY : this.shape.posY;
    }

    plantSeed() {
        // drop seed in the bottom left corner of a shape within a solution
        this.dots.push({ x: this.startX, y: this.startY });
    }

    grow(check) {
        // rules for growing the automaton path

        let currX = this.dots[this.dots.length - 1].x;
        let currY = this.dots[this.dots.length - 1].y;
        switch (this.growMode) {
            case 0:
                // draw along bottom of shape
                // if we go out of bounds to the right, then stop growing
                if (currX < this.layout[currY].length) {
                    // in bounds
                    if (this.layout[currY][currX].cellScore == 0 && this.shape === this.layout[currY][currX].shapes[0]) {
                        this.dots.push({ x: currX + 1, y: currY });
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
                let diffScore1A = this.calcDiff(currY, currX, "up");
                let diffScore1B = this.calcDiff(currY, currX + 1, "up");

                // check for completely out of bounds
                if (diffScore1A == -2 || diffScore1B == -2) {
                    return false;
                }

                if (diffScore1B < diffScore1A) {
                    this.dots.push({ x: currX + 1, y: currY });
                } else {
                    this.growMode = 2;
                }
                break;
            case 2:
                // move vertically straight up
                let diffScore2A = this.calcDiff(currY + 1, currX, "up");

                if (diffScore2A == 0) {
                    this.dots.push({ x: currX, y: currY + 1 });
                } else if (diffScore2A == -1) {
                    // one of the two cells is out of bounds (null)
                    return false;
                } else if (diffScore2A == -2) {
                    // both cells are out of bounds (null)
                    this.dots.push({ x: currX, y: currY + 1 });
                    return false;
                } else if (diffScore2A == 1000) {
                    // both cells are occupied (0)
                    // check if there's a collision with another shape
                    let upLeftShape = this.layout[currY][currX - 1].shapes[0];
                    let upRightShape = this.layout[currY][currX].shapes[0];

                    if (upLeftShape !== upRightShape) {
                        this.dots.push({ x: currX, y: currY + 1 });
                    } else {
                        // both cells are occupied by the same shape
                        // turn left or right
                        let diffScoreLeft = this.calcDiff(currY, currX, "left");
                        let diffScoreRight = this.calcDiff(currY, currX, "right");
                        if (diffScoreLeft == -2 && diffScoreRight != -2) {
                            // turn right 
                            this.dots.push({ x: currX + 1, y: currY });
                        } else if (diffScoreLeft != -2 && diffScoreRight == -2) {
                            // turn left
                            this.dots.push({ x: currX - 1, y: currY });
                        } else {
                            return false;
                        }
                    };
                } else {
                    this.growMode = 3;
                }
                break;
            case 3:
                // move vertically choosing between left, center, or right

                // end if 2 up is occupied. grow to it and stop
                let diffScore3 = this.calcDiff(currY + 2, currX, "up");
                if (diffScore3 == 1000) {
                    this.dots.push({ x: currX, y: currY + 1 });
                    this.dots.push({ x: currX, y: currY + 2 });
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
                        this.dots.push({ x: currX, y: currY + 1 });
                    } else {
                        // left-up wins
                        this.dots.push({ x: currX - 1, y: currY });
                    }
                } else if (winner.dir == "right") {
                    // push the right turn dot. go up-right or right-up
                    let right = this.calcDiff(currY, currX + 1, "up");
                    let up = this.calcDiff(currY + 1, currX, "up");
                    if (up < right) {
                        this.dots.push({ x: currX, y: currY + 1 });
                    } else {
                        this.dots.push({ x: currX + 1, y: currY });
                    }
                }
                // push the winner dot
                this.dots.push({ x: winner.x, y: winner.y });

                // resume simple vertical movement
                this.growMode = 2;

                break;
        }

        return true;
    }

    //-- Helper methods --//
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
        if (this.inBounds(coordY, coordX - 1)) {
            cellUL.score = this.layout[coordY][coordX - 1].cellScore;
            cellUL.shape = this.layout[coordY][coordX - 1].shapes[0];
        }
        if (this.inBounds(coordY, coordX)) {
            cellUR.score = this.layout[coordY][coordX].cellScore;
            cellUR.shape = this.layout[coordY][coordX].shapes[0];
        }
        if (this.inBounds(coordY - 1, coordX - 1)) {
            cellDL.score = this.layout[coordY - 1][coordX - 1].cellScore;
            cellDL.shape = this.layout[coordY - 1][coordX - 1].shapes[0];
        }
        if (this.inBounds(coordY - 1, coordX)) {
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

    inBounds(coordY, coordX) {
        let gridHeight = this.layout.length;
        if (coordY < gridHeight && coordY >= 0 && coordX >= 0 && coordX < this.layout[coordY].length) {
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