// Builds shelves using cellular automata rules to grow from a seed
class Automaton {
    constructor(_layout, _shape, _allDots, _startX, _startY,) {
        this.layout = _layout;
        this.shape = _shape;
        this.startX = _startX || (_startX == 0) ? _startX : this.overhangShift(this.shape.posX);
        this.startY = _startY || (_startY == 0) ? _startY : this.shape.posY;
        this.dots = []; // arrays have objects with x and y keys
        this.growMode = 0;

        this.moveRight = true;
        this.isGrowing = true;

        this.allDots = _allDots;
    }

    plantSeed() {
        // plant seed in the bottom left corner of the shape
        // seed will grow right (push) and left (unshift)
        this.addDot(this.startY, this.startX);
    }

    grow() {
        // rules for growing the automaton path\
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

        let cellUR = this.retrieveCell(currY, currX);
        let cellUL = this.retrieveCell(currY, currX - 1);
        let cellDL = this.retrieveCell(currY - 1, currX - 1);
        let cellDR = this.retrieveCell(currY - 1, currX);

        let currScoreUp = this.calcDiff(currY, currX, "up");
        let currScoreRightUp = this.calcDiff(currY, currX + 1, "up");
        let currScoreLeftUp = this.calcDiff(currY, currX - 1, "up");

        let currScoreSideUp = this.moveRight ? currScoreRightUp : currScoreLeftUp;
        let offsetX = this.moveRight ? 1 : -1;

        switch (this.growMode) {
            case -1: // grow perimeter
                // step 1. grow right along the bottom
                // check if the next cell to the right exists
                if (cellUR.score != null && cellDR.score == null) {
                    // grow right
                    return this.addDot(currY, currX + 1);
                } else if (cellUL.score != null && cellUR.score == null) {
                    // grow upward
                    return this.addDot(currY + 1, currX);
                } else if (cellDL.score != null && cellUL.score == null) {
                    // grow left
                    return this.addDot(currY, currX - 1);
                } else if (cellDR.score != null && cellDL.score == null) {
                    // grow downward
                    return this.addDot(currY - 1, currX);
                }
                else {
                    return false;
                }
                break;
            case 0: // grow along bottom of the shape
                if (cellUR.shape == this.shape) {
                    return this.addDot(currY, currX + 1);
                } else {
                    return false;
                }
                break;
            case 1: // move horizontally, away from bottom
                if (currScoreSideUp < currScoreUp) {
                    return this.addDot(currY, currX + offsetX);
                } else {
                    this.growMode = 2; // move vertically
                    return true;
                }
                break;
            case 2: // move vertically along limited path
                // both cells are occupied by a shape
                if (currScoreUp == 1000) {
                    // are they the same shape or different shapes
                    if (cellUL.shape === cellUR.shape) {
                        // turn left or right
                        if (cellUL.shape !== cellDL.shape) {
                            // turn left
                            return this.addDot(currY, currX - 1);
                        } else if (cellUR.shape !== cellDR.shape) {
                            // turn right
                            return this.addDot(currY, currX + 1);
                        } else {
                            console.log("No path forward, got stuck. currY: ", currY, " currX: ", currX);
                            return false;
                        }
                    } else {
                        // different shapes, grow upward between them
                        return this.addDot(currY + 1, currX);
                    }
                } else {
                    // at least one of the cells is empty
                    this.growMode = 3;
                    return true;
                }
                break;
            case 3: // move vertically with multiple options
                if (currScoreUp == 0 || currScoreUp == 1) {
                    // both sides same number, split between them
                    return this.addDot(currY + 1, currX);
                }

                let scores = [
                    { score: currScoreLeftUp, x: currX - 1, y: currY, dir: "left" },
                    { score: currScoreUp, x: currX, y: currY + 1, dir: "center" },
                    { score: currScoreRightUp, x: currX + 1, y: currY, dir: "right" }
                ];

                scores.sort((a, b) => a.score - b.score);

                // pick center if it's one of the low scores, otherwise default pick left
                if (scores[0].score != scores[1].score) {
                    // pick lowest score as winner
                    return this.addDot(scores[0].y, scores[0].x);
                } else if (scores[0].score == scores[1].score && scores[0].score != scores[2].score) {
                    // two-way tie breaker
                    if (scores[0].dir == "center" || scores[1].dir == "center") {
                        return this.addDot(currY + 1, currX);
                    } else {
                        // turn left by default
                        return this.addDot(currY, currX - 1);
                    }
                } else {
                    // three-way tie breaker
                    return this.addDot(currY + 1, currX);
                }
                break;
        }

        return true;
    }

    //-- Helper methods --//
    addDot(_y, _x) {
        let growing = true;
        // check if the dot is in bounds
        if (!this.dotInBounds(_y, _x)) {
            return false;
        }

        // add dot
        if (this.moveRight == true) {
            this.dots.push({ x: _x, y: _y });
        } else {
            this.dots.unshift({ x: _x, y: _y });
            // reset to leftward rule
        }

        // END CASES
        // 1. end if this dot is in allDots (collision)
        let collision = this.allDots.some(dot => JSON.stringify(dot) === JSON.stringify({ x: _x, y: _y }));
        let bottom = (_y == 0 && _x <= this.layout[0].length);

        // 2. end if the dot is parallel to another automaton for 2 moves
        // get the last two dots in dots[]
        if (this.dots.length >= 2) {
            let lastDot = this.dots[this.dots.length - 1];
            let secondLastDot = this.dots[this.dots.length - 2];
            // search allDots for a dot that is one dot to the right of lastDot
            let rightDot = { x: lastDot.x + 1, y: lastDot.y };
            let rightDotCollision = this.allDots.some(dot => JSON.stringify(dot) === JSON.stringify(rightDot));
            // search allDots for a dot that is one dot to the right of secondLastDot
            let secondRightDot = { x: secondLastDot.x + 1, y: secondLastDot.y };
            let secondRightDotCollision = this.allDots.some(dot => JSON.stringify(dot) === JSON.stringify(secondRightDot));

            let checkY = lastDot.y != secondLastDot.y;

            if (rightDotCollision && secondRightDotCollision && checkY) {
                // remove lastDot
                this.dots.pop();
                // add the intersecting dot to the right
                this.dots.push(secondRightDot);
                this.allDots.push({ x: _x, y: _y });
                growing = false;
            }
        }

        this.allDots.push({ x: _x, y: _y });

        if (!bottom && collision) {
            growing = false;
        }

        if (growing == false) {
            return false;
        } else {
            return true;
        }
    }

    retrieveCell(_y, _x) {
        // retrieve the cell score and shape at the given coordinates
        // if the cell is out-of-bounds, return {score: null, shape: null}
        let cell = { score: null, shape: null };
        if (this.cellInBounds(_y, _x)) {
            cell.score = this.layout[_y][_x].cellScore;
            cell.shape = this.layout[_y][_x].shapes[0];
        }
        return cell;
    }

    calcDiff(coordY, coordX, dir) {
        let cellUL = this.retrieveCell(coordY, coordX - 1);
        let cellUR = this.retrieveCell(coordY, coordX);
        let cellDL = this.retrieveCell(coordY - 1, coordX - 1);
        let cellDR = this.retrieveCell(coordY - 1, coordX);

        if (dir == "up") {
            // check for shape collision
            if (cellUL.shape != null && cellUR.shape != null) {
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
        if (yInBounds && xInBounds) {
            return true;
        } else {
            return false;
        }
    }

    cellInBounds(coordY, coordX) {
        // check in bounds for layout cells (up to < length)
        let yInBounds = coordY >= 0 && coordY < this.layout.length;
        let xInBounds = coordX >= 0 && coordX < this.layout[0].length;
        if (yInBounds && xInBounds) {
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