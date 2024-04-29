class Case {
    constructor(_solution) {
        this.solution = _solution;
        this.automata = [];
        this.allDots = [];
        this.boards = [];
        this.maxDepth = 0;

        this.showBoards = true;
        this.showAllDots = false;

        // laser cutting design
        this.materialWidth = 40;
        this.materialHeight = 20;
        this.materialThickness = 0.079;
        this.cellToInch = 2; // input cells (0.5 inches) to inch conversion
        this.lenMod = this.materialThickness;
        this.ppi = 10; // pixel per inch
        this.buffer = 0.25 * this.ppi; // gap between boards

        // laser cutting fabrication
        this.vertKerf = 0.02; // kerf for vertical cuts
        this.cutWidth = this.materialThickness - this.vertKerf;

        this.sheetRows = [0, 0, 0, 0, 0]; // 5 rows
        this.sheets = [[...this.sheetRows], [...this.sheetRows]];

        this.svgOutput = createGraphics(this.materialWidth * this.ppi, this.materialHeight * this.ppi, SVG);
    }

    createAutomata() {
        this.automata = [];

        // create and grow the perimeter dots around the edge of the layout
        let perimeter = new Automaton(this.solution.layout, this.solution.shapes[0], this.allDots, 0, 0);
        perimeter.plantSeed();
        perimeter.growModeEnd = -1; // grow perimeters
        while (perimeter.grow([]) != false) { }
        perimeter.isGrowingEnd = false; // stop growth on both ends of the automaton
        perimeter.isGrowingStart = false;
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
        for (let i = 1; i < this.automata.length; i++) {
            let automaton = this.automata[i];
            if (automaton.isGrowingEnd) {
                automaton.growModeEnd = 0; // grow bottoms first
                while (automaton.grow() != false) { }

                automaton.growModeStart = 1;
                automaton.growModeEnd = 1;

                // grow from the end once to get it started
                automaton.isGrowingEnd = automaton.grow(this.allDots);
            }
        }

        // grow in both directions, one step at a time
        while (this.automata.some(automaton => automaton.isGrowingEnd || automaton.isGrowingStart)) {
            for (let i = 1; i < this.automata.length; i++) {
                let automaton = this.automata[i];

                // grow rightward (from the end of the automaton) once per loop
                if (automaton.isGrowingEnd) {
                    automaton.growEnd = true;
                    automaton.isGrowingEnd = automaton.grow(this.allDots);
                }

                // automaton.isGrowingStart = false
                if (automaton.isGrowingStart) {
                    automaton.growEnd = false;
                    automaton.isGrowingStart = automaton.grow(this.allDots);
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

    //-- Export Methods --//
    exportToLaserSVG() {
        console.log(this.boards);

        // add board labels (points of interest) [todo]
        this.detectJoints(); // add joinery (points of interest) to boards
        this.calcDepth(); // max shape depth becomes case depth

        // build SVG file
        this.svgOutput.color("black");
        this.svgOutput.stroke("black");
        this.svgOutput.noFill();
        this.svgOutput.strokeWeight(1);
        // draw rectangle for material size to laser cut
        this.svgOutput.rect(0, 0, this.materialWidth * this.ppi, this.materialHeight * this.ppi);
        // draw all the boards and POIs (joinery)
        this.drawBoards();




        this.displayExport(); // save as SVG, view in the browser



        // - populate with all boards
        // save SVG file
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

    detectJoints() {
        // loop all boards against all other boards
        for (let i = 0; i < this.boards.length; i++) {
            for (let j = 0; j < this.boards.length; j++) {
                if (this.boards[i].orientation != "x" && this.boards[i].orientation != "y") {
                    console.log("Invalid board orientation")
                }
                if (this.boards[j].orientation != "x" && this.boards[j].orientation != "y") {
                    console.log("Invalid board orientation")
                }

                // compare boards in different orientations
                if (i != j && this.boards[i].orientation != this.boards[j].orientation) {
                    // check all three intersection types: L, X, T
                    // check L: check all start and end coords for match
                    let startsMatch = JSON.stringify(this.boards[i].startCoords) == JSON.stringify(this.boards[j].startCoords)
                    let endsMatch = JSON.stringify(this.boards[i].endCoords) == JSON.stringify(this.boards[j].endCoords)
                    let startIEndJ = JSON.stringify(this.boards[i].startCoords) == JSON.stringify(this.boards[j].endCoords)
                    let endIStartJ = JSON.stringify(this.boards[i].endCoords) == JSON.stringify(this.boards[j].startCoords)
                    let iJointType = this.boards[i].orientation == "x" ? "pin" : "slot";
                    let jJointType = this.boards[j].orientation == "x" ? "pin" : "slot";

                    if (startsMatch) {
                        this.boards[i].poi.startJoint = iJointType;
                        this.boards[j].poi.startJoint = jJointType;
                    } else if (endsMatch) {
                        this.boards[i].poi.endJoint = iJointType;
                        this.boards[j].poi.endJoint = jJointType;
                    } else if (startIEndJ) {
                        this.boards[i].poi.startJoint = iJointType;
                        this.boards[j].poi.endJoint = jJointType;
                    } else if (endIStartJ) {
                        this.boards[i].poi.endJoint = iJointType;
                        this.boards[j].poi.startJoint = jJointType;
                    }

                    let checkXWithin = this.boards[i].startCoords.x > this.boards[j].startCoords.x && this.boards[i].startCoords.x < this.boards[j].endCoords.x;
                    let checkYWithin = this.boards[i].startCoords.y < this.boards[j].startCoords.y && this.boards[i].endCoords.y > this.boards[j].startCoords.y;

                    // check T: terminating coord (i) for match within coords (j) and the same orientation, i boards
                    if (this.boards[i].orientation == "y") {
                        let startCoordYMatch = this.boards[i].startCoords.y == this.boards[j].startCoords.y;
                        let endCoordYMatch = this.boards[i].endCoords.y == this.boards[j].startCoords.y;

                        if (startCoordYMatch && checkXWithin) {
                            this.boards[i].poi.startJoint = "pin";
                            let tJointPos = this.boards[i].startCoords.x - this.boards[j].startCoords.x;
                            this.boards[j].poi.tJoints.push(tJointPos);
                        } else if (endCoordYMatch && checkXWithin) {
                            this.boards[i].poi.endJoint = "pin";
                            let tJointPos = this.boards[i].startCoords.x - this.boards[j].startCoords.x;
                            this.boards[j].poi.tJoints.push(tJointPos);
                        }
                    } else if (this.boards[i].orientation == "x") {
                        let checkYWithin = this.boards[i].startCoords.y > this.boards[j].startCoords.y && this.boards[i].startCoords.y < this.boards[j].endCoords.y;
                        let startCoordXMatch = this.boards[i].startCoords.x == this.boards[j].startCoords.x;
                        let endCoordXMatch = this.boards[i].endCoords.x == this.boards[j].startCoords.x;

                        if (startCoordXMatch && checkYWithin) {
                            this.boards[i].poi.startJoint = "pin";
                            let tJointPos = this.boards[i].startCoords.y - this.boards[j].startCoords.y;
                            this.boards[j].poi.tJoints.push(tJointPos);
                        } else if (endCoordXMatch && checkYWithin) {
                            this.boards[i].poi.endJoint = "pin";
                            let tJointPos = this.boards[i].startCoords.y - this.boards[j].startCoords.y;
                            this.boards[j].poi.tJoints.push(tJointPos);
                        }
                    }

                    // check X: all interior coords (not start or end) for match
                    if (this.boards[i].orientation == "y") {
                        // check only once since impacts both orientations equally
                        if (checkXWithin && checkYWithin) {
                            let xJointPosI = Math.abs(this.boards[i].startCoords.y - this.boards[j].startCoords.y);
                            let xJointPosJ = Math.abs(this.boards[j].startCoords.x - this.boards[i].startCoords.x);
                            this.boards[i].poi.xJoints.push(xJointPosI);
                            this.boards[j].poi.xJoints.push(xJointPosJ);
                        }
                    }
                }
            }
        }
    }

    calcDepth() {
        // access shapeCase to loop all horizontal and vertical boards
        // shapeCase.horizontalBoards and shapeCase.verticalBoards
        for (let i = 0; i < shapes.length; i++) {
            if (this.maxDepth < shapes[i].shapeDepth) {
                this.maxDepth = shapes[i].shapeDepth;
            }
        }
        this.maxDepth += 1; // add buffer for depth
    }

    buildJoinery(_type, _rectX, _rectY) {
        //     // print the joinery
        //     if (_type == "slot") {
        //         this.graphic.noFill();
        //         let firstPin = [_rectX, _rectY + (1 * this.pixelRes)];
        //         let secondPin = [_rectX, _rectY + (3 * this.pixelRes)];
        //         let pins = [firstPin, secondPin];
        //         let pinHeight = 1;
        //         for (let i = 0; i < pins.length; i++) {
        //             this.graphic.rect(pins[i][0], pins[i][1], this.cutWidth * this.pixelRes, pinHeight * this.pixelRes);
        //         }
        //     } else if (_type == "pin") {
        //         this.graphic.noFill();
        //         let firstSlot = [_rectX, _rectY];
        //         let secondSlot = [_rectX, _rectY + (2 * this.pixelRes)];
        //         let thirdSlot = [_rectX, _rectY + (4 * this.pixelRes)];
        //         let slots = [firstSlot, secondSlot, thirdSlot];
        //         let slotHeight = 1;
        //         for (let i = 0; i < slots.length; i++) {
        //             this.graphic.rect(slots[i][0], slots[i][1], this.cutWidth * this.pixelRes, slotHeight * this.pixelRes);
        //         }
        //     } else if (_type == "c") {
        //         this.graphic.noFill();

        //     }
    }

    displayExport() {
        // display the graphics buffer in browser
        background(255);
        document.getElementById('svgContainer').appendChild(this.svgOutput.elt.svg);
    }

    drawBoards() {
        let boardHeight = this.maxDepth;
        // sort the boards by length
        this.boards.sort((a, b) => b.getLength() - a.getLength());
        for (let i = 0; i < this.boards.length; i++) {
            let currBoard = this.boards[i];
            // calculate the true board length
            let boardWidth = (currBoard.getLength() / this.cellToInch) + this.lenMod;
            // find placement on material
            let boardPos = this.choosePlacement(boardWidth);
            let sheet = boardPos[0]; // sheet number
            let row = boardPos[1]; // row on sheet

            // find the top-left corner location for each board on the sheet
            let topLeftX = (this.sheets[sheet][row] * this.ppi) + this.buffer;
            let sheetPosY = sheet * this.materialHeight * this.ppi;
            let rowPosY = (row * ((boardHeight * this.ppi) + this.buffer)) + this.buffer;
            let topLeftY = sheetPosY + rowPosY;

            // draw rectangle
            this.svgOutput.rect(topLeftX, topLeftY, boardWidth * this.ppi, boardHeight * this.ppi);
            // mark location as filled
            this.sheets[sheet][row] += boardWidth + (this.buffer / this.ppi);

            // draw points of interest (joinery)
            // draw L joints (slots or pins)
            let startType = currBoard.poi.startJoint;
            let endType = currBoard.poi.endJoint;
            this.drawSlotsOrPins(startType, topLeftX, topLeftY);
            this.drawSlotsOrPins(endType, topLeftX + (boardWidth * this.ppi) - (this.cutWidth * this.ppi), topLeftY);
        }
    }

    choosePlacement(_boardWidth) {
        // determine board placement on each material sheet, in inches
        for (let sheet = 0; sheet < this.sheets.length; sheet++) {
            for (let row = 0; row < this.sheets[sheet].length; row++) {

                let rowOccupiedWidth = this.sheets[sheet][row];
                let sheetWidth = this.materialWidth;
                let rowRemainingWidth = sheetWidth - rowOccupiedWidth;
                let spaceNeeded = _boardWidth + ((this.buffer / this.ppi) * 2);

                if (rowRemainingWidth >= spaceNeeded) {
                    return [sheet, row];
                }
            }
        }
    }

    drawSlotsOrPins(_type, _boardX, _boardY) {
        // print the joinery
        if (_type == "slot") {
            // this.svgOutput.noFill();
            // [startX, startY]
            let firstPin = [_boardX, _boardY + (this.maxDepth * 0.2 * this.ppi)];
            let secondPin = [_boardX, _boardY + (this.maxDepth * 0.6 * this.ppi)];
            let pins = [firstPin, secondPin];
            console.log("pins: ", pins);
            let pinHeight = 1;
            for (let i = 0; i < pins.length; i++) {
                this.svgOutput.rect(pins[i][0], pins[i][1], this.cutWidth * this.ppi, pinHeight * this.ppi);
            }
        } else if (_type == "pin") {
            // this.svgOutput.noFill();
            let firstSlot = [_boardX, _boardY];
            let secondSlot = [_boardX, _boardY + (this.maxDepth * 0.4 * this.ppi)];
            let thirdSlot = [_boardX, _boardY + (this.maxDepth * 0.8 * this.ppi)];
            let slots = [firstSlot, secondSlot, thirdSlot];
            let slotHeight = 1;
            for (let i = 0; i < slots.length; i++) {
                this.svgOutput.rect(slots[i][0], slots[i][1], this.cutWidth * this.ppi, slotHeight * this.ppi);
            }
        }
    }
}