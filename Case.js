class Case {
    constructor(_solution) {
        this.solution = _solution;
        this.automata = [];
        this.allDots = [];
        this.boards = [];

        this.showBoards = true;
        this.showAllDots = false;

        this.graphic = createGraphics(canvasWidth + this.solution.cellSize, canvasHeight, SVG);
    }

    createAutomata() {
        this.automata = [];

        // create and grow the perimeter dots around the edge of the layout
        let perimeter = new Automaton(this.solution.layout, this.solution.shapes[0], this.allDots, 0, 0);
        perimeter.plantSeed();
        perimeter.growMode = -1; // grow perimeters
        while (perimeter.grow([]) != false) { }
        perimeter.isGrowing = false;
        this.automata.push(perimeter);

        // create automata for each shape
        for (let i = 0; i < this.solution.shapes.length; i++) {
            let automaton = new Automaton(this.solution.layout, this.solution.shapes[i], this.allDots);
            automaton.plantSeed();
            this.automata.push(automaton);
        }
    }

    growAutomata() {
        // bottom: grow shelves along all the bottoms
        // note: skip the first automaton (perimeter) for all growing steps
        for (let i = 1; i < this.automata.length; i++) {
            let automaton = this.automata[i];
            if (automaton.isGrowing) {
                automaton.growMode = 0; // grow bottoms first
                while (automaton.grow() != false) { }
                automaton.growMode = 1; // prep for growing rightward
            }
        }

        // right: grow rightward (every automaton grows once per loop)
        while (this.automata.some(automaton => automaton.isGrowing)) {
            for (let i = 1; i < this.automata.length; i++) {
                let automaton = this.automata[i];
                if (automaton.isGrowing) {
                    automaton.isGrowing = automaton.grow(this.allDots);
                }
            }
        }

        // left: grow leftward (every automaton grows once per loop)
        // reset for next grow mode
        for (let i = 1; i < this.automata.length; i++) {
            let automaton = this.automata[i];
            automaton.isGrowing = true;
            automaton.moveRight = false;
            automaton.growMode = 1; // grow horizontally, left
        }

        while (this.automata.some(automaton => automaton.isGrowing)) {
            for (let i = 1; i < this.automata.length; i++) {
                let automaton = this.automata[i];
                if (automaton.isGrowing) {
                    automaton.isGrowing = automaton.grow(this.allDots);
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

        // merge boards - keep merging until no more merges can be made
        let merging = true;
        while (merging == true) {
            merging = false;

            // make a new list of boards that are merged and unmerged
            let newBoards = [];

            // find boards that can be merged
            for (let i = 0; i < this.boards.length; i++) {
                let board1 = this.boards[i];

                for (let j = 0; j < this.boards.length; j++) {
                    let board2 = this.boards[j];

                    if (i != j && !board1.merged && !board2.merged) {
                        let mergedBoard = this.mergeBoards(board1, board2);

                        if (mergedBoard) {
                            // add the merged board to the new boards list
                            board1.merged = true;
                            board2.merged = true;
                            newBoards.push(mergedBoard);

                            merging = true;
                        }
                    }
                }
            }

            // add unmerged boards to the new boards list
            for (let i = 0; i < this.boards.length; i++) {
                if (!this.boards[i].merged) {
                    newBoards.push(this.boards[i]);
                }
            }

            // update with merged and unmerged boards
            this.boards = newBoards;

            for (let board of this.boards) {
                board.merged = false;
            }
        }
    }

    showResult() {
        if (this.showBoards) {
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

        if (this.showAllDots) {
            // show allDots
            for (let i = 0; i < this.allDots.length; i++) {
                fill(color(random(255), random(255), random(255)));
                noStroke(); // No border for the dots
                circle(
                    this.allDots[i].x * this.solution.cellSize,
                    canvasHeight - (this.allDots[i].y * this.solution.cellSize),
                    10
                );
            }
        }


    }

    renderBoards() {
        // use board objects and translating them into rectangles
        this.graphic.rectMode(CORNERS);
        this.graphic.noFill();
        this.graphic.stroke(0);
        this.graphic.strokeWeight(1);

        for (let i = 0; i < this.boards.length; i++) {
            let board = this.boards[i];
            let startRectX = board.startCoords.x * this.solution.cellSize;
            let startRectY = canvasHeight - (board.startCoords.y * this.solution.cellSize);
            let endRectX;
            let endRectY;
            let boardWidth = this.solution.cellSize / 2;
            if (board.orientation === "x") {
                endRectX = board.endCoords.x * this.solution.cellSize + boardWidth;
                endRectY = startRectY - boardWidth;
            } else if (board.orientation === "y") {
                endRectX = startRectX + boardWidth;
                endRectY = canvasHeight - (board.endCoords.y * this.solution.cellSize) - boardWidth;
            }

            this.graphic.rect(startRectX, startRectY, endRectX, endRectY);
        }
        this.graphic.save("boards.svg")
    }

    //-- Helper Methods --//
    mergeBoards(board1, board2) {
        // if two boards are touching or overlapping and they face the same orientation, merge them
        if (board1.orientation === board2.orientation) {
            let orientation = board1.orientation;
            let axis = orientation == "x" ? "y" : "x";
            let aligned = board1.startCoords[axis] == board2.startCoords[axis];

            // check for touching or overlapping on axis
            if (aligned) {
                let board1Overlapped = board1.endCoords[orientation] >= board2.startCoords[orientation] && board1.startCoords[orientation] <= board2.startCoords[orientation]
                let board2Overlapped = board2.endCoords[orientation] >= board1.startCoords[orientation] && board2.startCoords[orientation] <= board1.startCoords[orientation]

                if (board1Overlapped || board2Overlapped) {
                    // merge the boards
                    // find the smallest start and biggest end, make new board
                    let bothStarts = [board1.startCoords, board2.startCoords];
                    let bothEnds = [board1.endCoords, board2.endCoords];

                    bothStarts.sort((a, b) => a[orientation] - b[orientation]);
                    bothEnds.sort((a, b) => a[orientation] - b[orientation]);

                    return new Board(bothStarts[0], bothEnds[1], board1.orientation);
                }
            }
        }

        return false;
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