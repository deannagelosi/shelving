class Case {
    constructor(_solution) {
        this.solution = _solution;
        this.automata = [];
        this.allDots = [];
        this.boards = [];
    }

    createAutomata() {
        for (let i = 0; i < this.solution.shapes.length; i++) {
            let automaton = new Automaton(this.solution.layout, this.solution.shapes[i], this.solution.cellSize);
            automaton.plantSeed();
            this.automata.push(automaton);
        }
    }

    growAutomata() {
        // grow shelves in the right and up directions
        for (let i = 0; i < this.automata.length; i++) {
            let automaton = this.automata[i];
            while (automaton.grow() != false) { }
        }

        for (let i = 0; i < this.automata.length; i++) {
            // loop through every automaton, grabbing its dots array
            // combine all dots arrays into one array
            let automaton = this.automata[i];
            let dots = automaton.dots;
            this.allDots.push(...dots);
        }

        // grow shelves in the left direction
        for (let i = 0; i < this.automata.length; i++) {
            // loop through all automaton, check the first dot and grow in the left direction
            // stop when the next dot would be out of bounds
            // also when a dot is already present in the next position
            let automaton = this.automata[i];

            let growing = true;
            while (growing) {
                let currX = automaton.dots[0].x;
                let currY = automaton.dots[0].y;
                let newDot = {
                    x: currX - 1,
                    y: currY
                };

                // don't grow if the dot will be out of bounds
                if (currX <= 0) {
                    growing = false;
                    continue; // stop here
                }

                // check if the dot will be added to an already occupied spot (intersection)
                let isOccupied = this.allDots.some(dot => JSON.stringify(dot) === JSON.stringify(newDot));

                // add dot to automaton and allDots array
                automaton.dots.unshift(newDot);
                this.allDots.push(newDot);

                if (isOccupied) {
                    growing = false;
                    continue; // stop here
                }
            }
        }
        // console.log(this.automata);
    }

    makeBoards() {
        this.boards = [];

        for (let automaton of this.automata) {
            let dots = automaton.dots;

            let startDot = dots[0];
            let endDot = dots[0];
            let orientation = this.determineOrientation(startDot, dots[1]);

            for (let i = 1; i < dots.length; i++) {
                let currentDot = dots[i];
                let nextDot = dots[i + 1];

                if (nextDot && this.determineOrientation(currentDot, nextDot) === orientation) {
                    endDot = nextDot;
                } else {
                    // let board = this.mergeBoard({ x: startDot.x, y: startDot.y }, { x: endDot.x, y: endDot.y }, boards);
                    // if (!board) {
                    let board = new Board(this.solution.cellSize);
                    board.startCoords = { x: startDot.x, y: startDot.y };
                    board.endCoords = { x: endDot.x, y: endDot.y };
                    board.orientation = orientation;
                    this.boards.push(board);
                    // }
                    startDot = currentDot;
                    endDot = currentDot;
                    if (nextDot) {
                        // set orientation of the next board
                        orientation = this.determineOrientation(currentDot, nextDot);
                    }
                }
            }

            // save the last board in automata
            // let board = this.mergeBoard({ x: startDot.x, y: startDot.y }, { x: endDot.x, y: endDot.y }, boards);
            // if (!board) {
            let board = new Board(this.solution.cellSize);
            board.startCoords = { x: startDot.x, y: startDot.y };
            board.endCoords = { x: endDot.x, y: endDot.y };
            board.orientation = orientation;
            this.boards.push(board);
            // }
        }

        console.log(this.boards);
    }

    showResult() {
        // for (let i = 0; i < this.automata.length; i++) {
        //     let chooseColor = color(random(255), random(255), random(255));
        //     let automaton = this.automata[i];
        //     automaton.showResult(chooseColor);
        // }
        for (let i = 0; i < this.boards.length; i++) {
            let chooseColor = color(random(255), random(255), random(255));
            let board = this.boards[i];
            board.showResult(chooseColor);
        }
    }

    //-- Helper Methods --//
    // mergeBoard(startCoords, endCoords, boards) {
    //     for (let board of boards) {
    //         if (board.orientation === this.determineOrientation(startCoords, endCoords)) {
    //             if (board.orientation === 'horizontal') {
    //                 if (board.endCoords.y === startCoords.y) {
    //                     if (board.endCoords.x === startCoords.x || board.endCoords.x + 1 === startCoords.x) {
    //                         board.endCoords.x = endCoords.x;
    //                         return board;
    //                     } else if (board.endCoords.x >= startCoords.x && board.startCoords.x >= board.startCoords.x) {
    //                         board.startCoords.x = Math.min(board.startCoords.x, startCoords.x);
    //                         board.endCoords.x = Math.max(board.endCoords.x, endCoords.x);
    //                         return board;
    //                     }
    //                 }
    //                 if (board.startCoords.y === endCoords.y) {
    //                     if (board.startCoords.x === endCoords.x || board.startCoords.x - 1 === endCoords.x) {
    //                         board.startCoords.x = startCoords.x;
    //                         return board;
    //                     } else if (board.startCoords.x <= endCoords.x && board.endCoords.x >= endCoords.x) {
    //                         board.startCoords.x = Math.min(board.startCoords.x, startCoords.x);
    //                         board.endCoords.x = Math.max(board.endCoords.x, endCoords.x);
    //                         return board;
    //                     }
    //                 }
    //             } else if (board.orientation === 'vertical') {
    //                 if (board.endCoords.x === startCoords.x) {
    //                     if (board.endCoords.y === startCoords.y || board.endCoords.y + 1 === startCoords.y) {
    //                         board.endCoords.y = endCoords.y;
    //                         return board;
    //                     } else if (board.endCoords.y >= startCoords.y && board.startCoords.y >= board.startCoords.y) {
    //                         board.startCoords.y = Math.min(board.startCoords.y, startCoords.y);
    //                         board.endCoords.y = Math.max(board.endCoords.y, endCoords.y);
    //                         return board;
    //                     }
    //                 }
    //                 if (board.startCoords.x === endCoords.x) {
    //                     if (board.startCoords.y === endCoords.y || board.startCoords.y - 1 === endCoords.y) {
    //                         board.startCoords.y = startCoords.y;
    //                         return board;
    //                     } else if (board.startCoords.y <= endCoords.y && board.endCoords.y >= endCoords.y) {
    //                         board.startCoords.y = Math.min(board.startCoords.y, startCoords.y);
    //                         board.endCoords.y = Math.max(board.endCoords.y, endCoords.y);
    //                         return board;
    //                     }
    //                 }
    //             }
    //         }
    //     }
    //     return null;
    // }

    determineOrientation(startCoords, endCoords) {
        if (startCoords.y === endCoords.y) {
            return "horizontal";
        } else if (startCoords.x === endCoords.x) {
            return "vertical";
        } else {
            throw new Error("Invalid board coordinates. Start and end coordinates must share either the same x-value or y-value.");
        }
    }
}