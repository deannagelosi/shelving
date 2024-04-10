class Case {
    constructor(_solution) {
        this.solution = _solution;
        this.automata = [];
        this.allDots = [];
        this.boards = [];

        this.showBoard = false;
    }

    createAutomata() {
        for (let i = 0; i < this.solution.shapes.length; i++) {
            let automaton = new Automaton(this.solution.layout, this.solution.shapes[i]);
            automaton.plantSeed();
            this.automata.push(automaton);
        }
    }

    growAutomata() {
        // 1. grow shelves in the right directions
        for (let i = 0; i < this.automata.length; i++) {
            let automaton = this.automata[i];
            while (automaton.grow() != false) { }
        }

        // 2. grow shelves in the left direction
        for (let i = 0; i < this.automata.length; i++) {
            this.allDots.push(...this.automata[i].dots);
        }
        let newAutomata = [];
        // loop through all automaton
        for (let i = 0; i < this.automata.length; i++) {
            let automaton = this.automata[i];

            let growing = true;
            while (growing) {
                let currDot = {
                    x: automaton.dots[0].x,
                    y: automaton.dots[0].y
                };
                let newDot = {
                    x: currDot.x - 1,
                    y: currDot.y
                };

                // check currDot
                let cellData = this.solution.layout[currDot.y][currDot.x - 1];

                // check if the next cell is occupied by a shape
                if (cellData && cellData.shapes.length > 0) {
                    // grow a new automata vertically
                    let automaton = new Automaton(this.solution.layout, cellData.shapes[0], currDot.x, currDot.y);
                    automaton.growMode = 2; // grow vertically
                    automaton.plantSeed();

                    while (automaton.grow(true) != false) { }

                    newAutomata.push(automaton);
                    this.allDots.push(...automaton.dots);

                    growing = false;
                    continue;
                }
                // check out of bounds
                else if (currDot.x <= 0) {
                    growing = false;
                    continue;
                }
                // check if next dot intersects with a board
                else if (this.allDots.some(dot => JSON.stringify(dot) === JSON.stringify(newDot))) {
                    // save the occupied spot to connect the boards together, then stop growing
                    automaton.dots.unshift(newDot); // add to beginning
                    this.allDots.push(newDot);
                    growing = false;
                }
                else {
                    // clear to the left, keep growing
                    automaton.dots.unshift(newDot);
                    this.allDots.push(newDot);
                }
            }
        }
        this.automata.push(...newAutomata); // add any new automate created
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
                        orientation
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
                orientation
            ));
        }

        // make perimeter boards
        let height = this.solution.layout.length;
        let width = this.solution.layout[0].length;
        this.boards.push(new Board({ x: 0, y: 0 }, { x: width, y: 0 }, "x"));
        this.boards.push(new Board({ x: width, y: 0 }, { x: width, y: height }, "y"));
        this.boards.push(new Board({ x: width, y: height }, { x: 0, y: height }, "x"));
        this.boards.push(new Board({ x: 0, y: height }, { x: 0, y: 0 }, "y"));

        // merge boards - keep merging until no more merges can be made
        let merging = true;
        while (merging == true) {
            merging = false;

            for (let i = 0; i < this.boards.length; i++) {
                for (let j = 0; j < this.boards.length; j++) {
                    if (i != j) {
                        let board1 = this.boards[i];
                        let board2 = this.boards[j];
                        let mergedBoard = this.mergeBoards(board1, board2);
                        if (mergedBoard) {
                            merging = true;
                            // remove the two boards and add the merged board
                            this.boards.splice(j, 1);
                            this.boards.splice(i, 1);
                            this.boards.push(mergedBoard);
                        }
                    }
                }
            }
        }

        console.log(this.boards);
    }

    showResult() {
        if (this.showBoard) {
            // show boards
            for (let i = 0; i < this.boards.length; i++) {
                let board = this.boards[i];

                stroke(color(random(255), random(255), random(255)));
                strokeWeight(5);
                line(
                    board.startCoords.x * this.solution.cellSize,
                    canvasHeight - (board.startCoords.y * this.solution.cellSize),
                    board.endCoords.x * this.solution.cellSize,
                    canvasHeight - (board.endCoords.y * this.solution.cellSize)
                );
            }
        } else {
            // show dots
            for (let i = 0; i < this.automata.length; i++) {
                let automaton = this.automata[i];

                fill(color(random(255), random(255), random(255)));
                noStroke(); // No border for the dots
                for (let i = 0; i < automaton.dots.length; i++) {
                    circle(
                        automaton.dots[i].x * this.solution.cellSize,
                        canvasHeight - (automaton.dots[i].y * this.solution.cellSize),
                        10
                    );
                }
            }
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
                let board1Overlapped = board1.endCoords[orientation] >= board2.startCoords[orientation] && board1.startCoords[orientation] <= board2.startCoords[orientation]
                let board2Overlapped = board2.endCoords[orientation] >= board1.startCoords[orientation] && board2.startCoords[orientation] <= board1.startCoords[orientation]

                if (board1Overlapped) {
                    // merge the boards
                    return new Board(board1.startCoords, board2.endCoords, board1.orientation);
                } else if (board2Overlapped) {
                    // merge the boards
                    return new Board(board2.startCoords, board1.endCoords, board1.orientation);
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