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
        this.zeroCounter = 0;

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

        let currScore = this.calcDiff(currY, currX);
        let currScoreRight = this.calcDiff(currY, currX + 1);
        let currScoreLeft = this.calcDiff(currY, currX - 1);

        let nextScore = this.moveRight ? currScoreRight : currScoreLeft;
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
                if (nextScore < currScore) {
                    // next spot lower score, move over to it
                    return this.addDot(currY, currX + offsetX);
                } else if (currScore == 0 && nextScore == 0) {
                    // when find a zero score, locate the middle of the 0 scores
                    // add the dot, but also count it
                    this.zeroCounter += 1;
                    return this.addDot(currY, currX + offsetX);
                }
                else if (nextScore > currScore && this.zeroCounter > 0) {
                    // next spot is higher and just left a zero section
                    // remove half the dots, to return to the middle of the 0 section
                    let pops = Math.floor(this.zeroCounter / 2);
                    if (this.moveRight) {
                        this.dots.splice(-pops, pops);
                    } else {
                        this.dots.splice(0, pops);
                    }

                    // reset and switch to vertical growth
                    this.zeroCounter = 0;
                    this.growMode = 2;
                    return true;
                }
                else {
                    this.growMode = 2; // move vertically
                    return true;
                }
                break;
            case 2: // move vertically along limited path
                // both cells are occupied by a shape
                if (currScore == 1000) {
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
                            console.log("No path forward. currY: ", currY, " currX: ", currX);
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
                if (currScore == 0 || currScore == 1) {
                    // both sides same number, split between them
                    return this.addDot(currY + 1, currX);
                }

                let scores = [
                    { score: currScoreLeft, x: currX - 1, y: currY, dir: "left" },
                    { score: currScore, x: currX, y: currY + 1, dir: "center" },
                    { score: currScoreRight, x: currX + 1, y: currY, dir: "right" }
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
        let newDot = { x: _x, y: _y };

        // end growth cases:
        // 1. dot out of bounds
        if (!this.dotInBounds(_y, _x)) {
            return false;
        }
        // 2. dot collision with existing dots (intersection)
        let collision = this.allDots.some(dot => JSON.stringify(dot) === JSON.stringify({ x: _x, y: _y }));
        let bottom = (_y == 0 && _x <= this.layout[0].length);
        if (!bottom && collision) {
            growing = false;
        }
        // 3. last two new dots are parallel to existing dots
        if (this.dots.length > 0) {
            let lastDot;
            if (this.moveRight == true) {
                lastDot = this.dots[this.dots.length - 1];
            } else {
                lastDot = this.dots[0];
            }

            // determine the direction of growth
            if (newDot.x == lastDot.x) {
                // vertical growth. look for parallels on left and right
                // yOffset = 0, xOffset = 1;
                [newDot, growing] = this.checkParallel(newDot, lastDot, growing, 0, 1);
                [newDot, growing] = this.checkParallel(newDot, lastDot, growing, 0, -1);
            } else if (newDot.y == lastDot.y) {
                // horizontal growth. look for parallels on top and bottom
                // yOffset = 1, xOffset = 0;
                [newDot, growing] = this.checkParallel(newDot, lastDot, growing, 1, 0);
                [newDot, growing] = this.checkParallel(newDot, lastDot, growing, -1, 0);
            }
        }

        // add dot to the end or beginning of the array
        if (this.moveRight == true) {
            this.dots.push(newDot);
        } else {
            this.dots.unshift(newDot);
            // reset to leftward rule
        }
        this.allDots.push(newDot);

        // return continue or end growth
        if (growing == false) {
            return false;
        } else {
            return true;
        }
    }

    checkParallel(newDot, lastDot, growing, yOffset, xOffset) {
        if (growing == true) {
            let parallelDot1 = { x: newDot.x + xOffset, y: newDot.y + yOffset };
            let parallelDot2 = { x: lastDot.x + xOffset, y: lastDot.y + yOffset };
            let parallelDotCollision1 = this.allDots.some(dot => JSON.stringify(dot) === JSON.stringify(parallelDot1));
            let parallelDotCollision2 = this.allDots.some(dot => JSON.stringify(dot) === JSON.stringify(parallelDot2));
            
            if (parallelDotCollision1 && parallelDotCollision2) {
                // use the intersecting dot instead and stop growth
                newDot = parallelDot2;
                growing = false;
            }
        }

        return [newDot, growing];
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

    calcDiff(coordY, coordX) {
        // calculate the difference in score between cells UL and UR
        let cellUL = this.retrieveCell(coordY, coordX - 1);
        let cellUR = this.retrieveCell(coordY, coordX);

        // check for shape collision
        if (cellUL.shape != null && cellUR.shape != null) {
            return 1000; // arbitrary large number
        } else {
            return Math.abs(cellUL.score - cellUR.score);
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