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
                let diffScoreA = this.calcDiff(currX, currY, "up");
                let diffScoreB = this.calcDiff(currX + 1, currY, "up");

                // check for completely out of bounds
                if (diffScoreA == -2 || diffScoreB == -2) {
                    return false;
                }

                if (diffScoreB < diffScoreA) {
                    this.dots.push({ x: currX + 1, y: currY });
                } else {
                    this.growMode = 2;
                }
                break;
            case 2:
                // move vertically straight up
                let diffScoreC = this.calcDiff(currX, currY + 1, "up");

                if (diffScoreC == 0) {
                    this.dots.push({ x: currX, y: currY + 1 });
                } else if (diffScoreC == -1) {
                    // one of the two cells is out of bounds (null)
                    return false;
                } else if (diffScoreC == -2) {
                    // both cells are out of bounds (null)
                    this.dots.push({ x: currX, y: currY + 1 });
                    return false;
                } else if (diffScoreC == 1000) {
                    // both cells are occupied (0)
                    this.dots.push({ x: currX, y: currY + 1 });
                    // check if there's a collision with another shape
                    let upLeftShape = this.layout[currY][currX - 1].shapes[0];
                    if (this.shape != null && this.shape !== upLeftShape) {
                        return false;
                    }
                } else {
                    this.growMode = 3;
                }
                break;
            case 3:
                // move vertically choosing between left, center, or right

                // end if 2 up is occupied. grow to it and stop
                let diffScoreD = this.calcDiff(currX, currY + 2, "up");
                if (diffScoreD == 1000) {
                    this.dots.push({ x: currX, y: currY + 1 });
                    this.dots.push({ x: currX, y: currY + 2 });
                    return false;
                }

                // else move upwards +1, picking best of the 3 options
                let scores = [
                    { score: this.calcDiff(currX - 1, currY + 1, "up"), x: currX - 1, y: currY + 1, dir: "left" },
                    { score: this.calcDiff(currX, currY + 1, "up"), x: currX, y: currY + 1, dir: "center" },
                    { score: this.calcDiff(currX + 1, currY + 1, "up"), x: currX + 1, y: currY + 1, dir: "right" }
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
                        { score: this.calcDiff(scores[0].x, scores[0].y + 1, "up"), x: scores[0].x, y: scores[0].y + 1, dir: scores[0].dir },
                        { score: this.calcDiff(scores[1].x, scores[1].y + 1, "up"), x: scores[1].x, y: scores[1].y + 1, dir: scores[1].dir }
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
                    let left = this.calcDiff(currX - 1, currY, "up");
                    let up = this.calcDiff(currX, currY + 1, "up");
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
                    let right = this.calcDiff(currX + 1, currY, "up");
                    let up = this.calcDiff(currX, currY + 1, "up");
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
    calcDiff(coordX, coordY, dir) {
        // UR = [currX, currY]
        // UL = [currX - 1, currY]
        // DR = [currX, currY - 1]
        // DL = [currX - 1, currY - 1]
        if (dir == "up") {
            let cellScoreA = null;
            let cellScoreB = null;
            // check if point is in bounds
            if (this.inBounds(coordY, coordX - 1)) {
                cellScoreA = this.layout[coordY][coordX - 1].cellScore;
            }
            if (this.inBounds(coordY, coordX)) {
                cellScoreB = this.layout[coordY][coordX].cellScore;
            }

            if (cellScoreA == null && cellScoreB == null) {
                return -2;
            }

            if (cellScoreA == null || cellScoreB == null) {
                return -1;
            }

            if (cellScoreA == 0 && cellScoreB == 0) {
                return 1000; // arbitrary large number
            } else {
                return Math.abs(cellScoreA - cellScoreB);
            }
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