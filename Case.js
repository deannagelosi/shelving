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
    }

    makeBoards() {
        this.boards = [];

        for (let automaton of this.automata) {
            let dots = automaton.dots;

            let startBoard = dots[0];
            let endBoard = dots[1];
            let orientation = this.determineOrientation(startBoard, endBoard);

            for (let i = 1; i < dots.length; i++) {
                let currentDot = dots[i];

                if (this.determineOrientation(startBoard, currentDot) === orientation) {
                    // grow the board while orientation is the same
                    endBoard = currentDot;
                } else {
                    // save a new board once the orientation changes
                    this.boards.push(new Board(
                        { x: startBoard.x, y: startBoard.y },
                        { x: endBoard.x, y: endBoard.y },
                        orientation,
                        this.solution.cellSize
                    ));

                    startBoard = endBoard;
                    endBoard = currentDot;
                    // set orientation of the next board
                    orientation = this.determineOrientation(startBoard, endBoard);
                }
            }

            // save the last board
            this.boards.push(new Board(
                { x: startBoard.x, y: startBoard.y },
                { x: endBoard.x, y: endBoard.y },
                orientation,
                this.solution.cellSize
            ));
        }

        // merge boards
        for (let i = 0; i < this.boards.length; i++) {
            for (let j = 0; j < this.boards.length; j++) {
                if (i != j) {
                    let board1 = this.boards[i];
                    let board2 = this.boards[j];
                    let mergedBoard = this.mergeBoards(board1, board2);
                    if (mergedBoard) {
                        // remove the two boards and add the merged board
                        this.boards.splice(j, 1);
                        this.boards.splice(i, 1);
                        this.boards.push(mergedBoard);
                    }
                }
            }
        }
        console.log(this.boards);
    }

    showResult() {
        // see dots
        // for (let i = 0; i < this.automata.length; i++) {
        //     let chooseColor = color(random(255), random(255), random(255));
        //     let automaton = this.automata[i];
        //     automaton.showResult(chooseColor);
        // }

        // see boards
        for (let i = 0; i < this.boards.length; i++) {
            let chooseColor = color(random(255), random(255), random(255));
            let board = this.boards[i];
            board.showResult(chooseColor);
        }
    }

    //-- Helper Methods --//
    mergeBoards(board1, board2) {
        // if two boards are touching or overlapping and they face the same orientation, merge them
        if (board1.orientation === board2.orientation) {
            let orientation = board1.orientation;
            let oppositeOrientation = orientation == "x" ? "y" : "x";
            let aligned = board1.startCoords[oppositeOrientation] == board2.startCoords[oppositeOrientation];

            // check for touching or overlapping on axis
            if (aligned) {
                let board1Overlapped = board1.endCoords[orientation] >= board2.startCoords[orientation] && board1.startCoords[orientation] < board2.startCoords[orientation]
                let board2Overlapped = board2.endCoords[orientation] >= board1.startCoords[orientation] && board2.startCoords[orientation] < board1.startCoords[orientation]

                if (board1Overlapped) {
                    // merge the boards
                    return new Board(board1.startCoords, board2.endCoords, board1.orientation, this.solution.cellSize);
                } else if (board2Overlapped) {
                    // merge the boards
                    return new Board(board2.startCoords, board1.endCoords, board1.orientation, this.solution.cellSize);
                }
            }
            return false;
        }
    }

    determineOrientation(startCoords, endCoords) {
        if (startCoords.y === endCoords.y) {
            return "x";
        } else if (startCoords.x === endCoords.x) {
            return "y";
        } else {
            // diagonal board, return false
            return false;
        }
    }
}