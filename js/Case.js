class Case {
    constructor(_squareSize, _cellLines) {
        this.squareSize = _squareSize;
        this.cellLines = _cellLines;
        this.boards = [];
        this.caseDepth;

        // laser cutting design
        this.materialWidth = 16.5;
        this.materialHeight = 11;
        this.materialThickness = 0.11;
        this.layoutToInch = 2; // layout squares (0.5 inches) to inch conversion
        this.lenMod = this.materialThickness;
        this.ppi = 40; // pixel per inch
        this.buffer = 0.25 * this.ppi; // gap between boards
        this.labelPos = 0.2 * this.ppi;

        // laser cutting fabrication
        this.vertKerf = 0.02; // kerf for vertical cuts
        this.cutWidth = this.materialThickness - this.vertKerf;
        this.pinHeight;
        this.slotHeight;

        this.sheetRows = [0, 0, 0]; // 3 rows
        this.sheets = [[...this.sheetRows], [...this.sheetRows]];

        let svgWidth = this.materialWidth * this.ppi
        let svgHeight = (this.materialHeight * this.sheets.length) * this.ppi + this.buffer;

        this.svgOutput = createGraphics(svgWidth, svgHeight, SVG);
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
        if (this.allowMerge) {
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
    }

    showResult() {
        // show boards
        let counter = 0;
        for (let i = 0; i < this.boards.length; i++) {
            let board = this.boards[i];
            stroke("rgb(175, 141, 117)");
            strokeWeight(5);
            line(
                board.coords.start.x * this.squareSize,
                canvasHeight - (board.coords.start.y * this.squareSize),
                board.coords.end.x * this.squareSize,
                canvasHeight - (board.coords.end.y * this.squareSize)
            );
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
            let startRectX = board.coords.start.x * this.squareSize;
            let startRectY = canvasHeight - (board.coords.start.y * this.squareSize);
            let endRectX;
            let endRectY;
            let boardWidth = this.squareSize / 2;
            if (board.orientation === "x") {
                endRectX = board.coords.end.x * this.squareSize + boardWidth;
                endRectY = startRectY - boardWidth;
            } else if (board.orientation === "y") {
                endRectX = startRectX + boardWidth;
                endRectY = canvasHeight - (board.coords.end.y * this.squareSize) - boardWidth;
            }

            this.graphic.rect(startRectX, startRectY, endRectX, endRectY);
        }
        this.graphic.save("boards.svg")
    }

    //-- Export Methods --//
    buildLaserSVG() {
        console.log(this.boards);

        this.detectJoints(); // add joinery (points of interest) to boards

        // draw all the boards, labels, and POIs (joinery)
        this.drawBoards();
        this.drawSheets();
    }

    //-- Helper Methods --//
    mergeBoards(board1, board2) {
        // if two boards are touching or overlapping and they face the same orientation, merge them
        if (board1.orientation === board2.orientation) {
            let orientation = board1.orientation;
            let axis = orientation == "x" ? "y" : "x";
            let aligned = board1.coords.start[axis] == board2.coords.start[axis];

            // check for touching or overlapping on axis
            if (aligned) {
                let board1Overlapped = board1.coords.end[orientation] >= board2.coords.start[orientation] && board1.coords.start[orientation] <= board2.coords.start[orientation]
                let board2Overlapped = board2.coords.end[orientation] >= board1.coords.start[orientation] && board2.coords.start[orientation] <= board1.coords.start[orientation]

                if (board1Overlapped || board2Overlapped) {
                    // merge the boards
                    // find the smallest start and biggest end, make new board
                    let bothStarts = [board1.coords.start, board2.coords.start];
                    let bothEnds = [board1.coords.end, board2.coords.end];

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
                    console.error("Invalid board orientation")
                }
                if (this.boards[j].orientation != "x" && this.boards[j].orientation != "y") {
                    console.error("Invalid board orientation")
                }

                // compare boards in different orientations
                if (i != j && this.boards[i].orientation != this.boards[j].orientation) {
                    // check all three intersection types: X, T

                    // check T: terminating coord (i) for match within coords (j) and the same orientation, i boards
                    let checkXWithin = this.boards[i].coords.start.x > this.boards[j].coords.start.x && this.boards[i].coords.start.x < this.boards[j].coords.end.x;
                    let checkYWithin = this.boards[i].coords.start.y < this.boards[j].coords.start.y && this.boards[i].coords.end.y > this.boards[j].coords.start.y;

                    if (this.boards[i].orientation == "y") {
                        let startCoordYMatch = this.boards[i].coords.start.y == this.boards[j].coords.start.y;
                        let endCoordYMatch = this.boards[i].coords.end.y == this.boards[j].coords.start.y;

                        if (startCoordYMatch && checkXWithin) {
                            this.boards[i].poi.startJoint = "pin";
                            let tJointPos = this.boards[i].coords.start.x - this.boards[j].coords.start.x;
                            this.boards[j].poi.tJoints.push(tJointPos);
                        } else if (endCoordYMatch && checkXWithin) {
                            this.boards[i].poi.endJoint = "pin";
                            let tJointPos = this.boards[i].coords.start.x - this.boards[j].coords.start.x;
                            this.boards[j].poi.tJoints.push(tJointPos);
                        }
                    } else if (this.boards[i].orientation == "x") {
                        let checkYWithin = this.boards[i].coords.start.y > this.boards[j].coords.start.y && this.boards[i].coords.start.y < this.boards[j].coords.end.y;
                        let startCoordXMatch = this.boards[i].coords.start.x == this.boards[j].coords.start.x;
                        let endCoordXMatch = this.boards[i].coords.end.x == this.boards[j].coords.start.x;

                        if (startCoordXMatch && checkYWithin) {
                            this.boards[i].poi.startJoint = "pin";
                            let tJointPos = this.boards[i].coords.start.y - this.boards[j].coords.start.y;
                            this.boards[j].poi.tJoints.push(tJointPos);
                        } else if (endCoordXMatch && checkYWithin) {
                            this.boards[i].poi.endJoint = "pin";
                            let tJointPos = this.boards[i].coords.start.y - this.boards[j].coords.start.y;
                            this.boards[j].poi.tJoints.push(tJointPos);
                        }
                    }

                    // check X: all interior coords (not start or end) for match
                    if (this.boards[i].orientation == "y") {
                        // check only once since impacts both orientations equally
                        if (checkXWithin && checkYWithin) {
                            let xJointPosI = Math.abs(this.boards[i].coords.start.y - this.boards[j].coords.start.y);
                            let xJointPosJ = Math.abs(this.boards[j].coords.start.x - this.boards[i].coords.start.x);
                            this.boards[i].poi.xJoints.push(xJointPosI);
                            this.boards[j].poi.xJoints.push(xJointPosJ);
                        }
                    }
                }
            }
        }
    }

    displaySVGExport() {
        // display the graphics buffer in browser
        background(255);
        document.getElementById('svgContainer').appendChild(this.svgOutput.elt.svg);
    }

    saveSVGExport() {
        this.svgOutput.save("boardLayout.svg")
    }

    drawBoards() {
        // setup draw settings
        // build SVG file
        this.svgOutput.color("black");
        this.svgOutput.stroke("black");
        this.svgOutput.noFill();
        this.svgOutput.strokeWeight(1);
        this.svgOutput.textSize((1 / 6) * this.ppi);
        this.svgOutput.textAlign(LEFT, CENTER);

        let boardHeight = this.maxDepth;
        this.pinHeight = 0.2 * boardHeight;
        this.slotHeight = 0.2 * boardHeight;

        // board index for applying labels
        let xIndex = 0;
        let yIndex = 1;

        // sort the boards by length
        this.boards.sort((a, b) => b.getLength() - a.getLength());
        for (let i = 0; i < this.boards.length; i++) {
            let currBoard = this.boards[i];

            // label the board. Horizontal starts at A, vertical starts at 1
            if (currBoard.orientation == "x") {
                currBoard.boardLabel = String.fromCharCode(65 + xIndex);
                xIndex++;
            } else if (currBoard.orientation == "y") {
                currBoard.boardLabel = yIndex;
                yIndex++;
            }

            // calculate the true board length
            let boardWidth = (currBoard.getLength() / this.layoutToInch) + this.lenMod;
            // find placement on material
            let boardPos = this.choosePlacement(boardWidth);
            let sheet = boardPos[0]; // sheet number
            let row = boardPos[1]; // row on sheet

            // find the top-left corner location for each board on the sheet
            let topLeftX = (this.sheets[sheet][row] * this.ppi) + this.buffer;
            let sheetPosY = (sheet * this.materialHeight * this.ppi) + (sheet * this.buffer);
            let rowPosY = (row * ((boardHeight * this.ppi) + this.buffer)) + this.buffer;
            let topLeftY = sheetPosY + rowPosY;

            // draw board
            this.svgOutput.rect(topLeftX, topLeftY, boardWidth * this.ppi, boardHeight * this.ppi);
            // mark location as filled
            this.sheets[sheet][row] += boardWidth + (this.buffer / this.ppi);

            // draw board label
            let boardLabelX = topLeftX + (this.labelPos);
            let boardLabelY = topLeftY + (this.labelPos);
            this.svgOutput.fill(0); // text needs fill to render correctly for the laser
            this.svgOutput.text(currBoard.boardLabel, boardLabelX, boardLabelY);
            this.svgOutput.noFill();

            // draw L joints (slots or pins)
            let startType = currBoard.poi.startJoint;
            let endType = currBoard.poi.endJoint;
            this.drawSlotsOrPins(startType, topLeftX, topLeftY, boardHeight);
            this.drawSlotsOrPins(endType, topLeftX + (boardWidth * this.ppi) - (this.cutWidth * this.ppi), topLeftY, boardHeight);

            // draw T joints (slots)
            currBoard.poi.tJoints.forEach((tJoint) => {
                let tJointX = topLeftX + ((tJoint / this.layoutToInch) * this.ppi);
                // tJointX += (this.cutWidth * this.pixelRes) / 2; // center the slot
                let tJointY = topLeftY + (0.2 * boardHeight * this.ppi);
                let tJoints = [[tJointX, tJointY], [tJointX, tJointY + (0.4 * boardHeight * this.ppi)]];
                for (let i = 0; i < tJoints.length; i++) {
                    this.svgOutput.rect(tJoints[i][0], tJoints[i][1], this.cutWidth * this.ppi, this.slotHeight * this.ppi);
                }
            });

            // draw X joints (c-shape)
            currBoard.poi.xJoints.forEach((xJoint) => {
                console.log(currBoard);
                let xJointX = topLeftX + ((xJoint / this.layoutToInch) * this.ppi);
                let xJointY;
                if (currBoard.orientation == "x") {
                    // cut joint on board bottom
                    xJointY = topLeftY + ((boardHeight * this.ppi) / 2);
                } else if (currBoard.orientation == "y") {
                    // cut joint on board top
                    console.log("here");
                    xJointY = topLeftY;
                }
                this.svgOutput.rect(xJointX, xJointY, this.cutWidth * this.ppi, (boardHeight * this.ppi) / 2);
            });

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

    drawSlotsOrPins(_type, _boardX, _boardY, _boardHeight) {
        // print the joinery
        if (_type == "slot") {
            // [startX, startY]
            let firstPin = [_boardX, _boardY + (_boardHeight * 0.2 * this.ppi)];
            let secondPin = [_boardX, _boardY + (_boardHeight * 0.6 * this.ppi)];
            let pins = [firstPin, secondPin];
            for (let i = 0; i < pins.length; i++) {
                this.svgOutput.rect(pins[i][0], pins[i][1], this.cutWidth * this.ppi, this.pinHeight * this.ppi);
            }
        } else if (_type == "pin") {
            // [startX, startY]
            let firstSlot = [_boardX, _boardY];
            let secondSlot = [_boardX, _boardY + (_boardHeight * 0.4 * this.ppi)];
            let thirdSlot = [_boardX, _boardY + (_boardHeight * 0.8 * this.ppi)];
            let slots = [firstSlot, secondSlot, thirdSlot];
            for (let i = 0; i < slots.length; i++) {
                this.svgOutput.rect(slots[i][0], slots[i][1], this.cutWidth * this.ppi, this.slotHeight * this.ppi);
            }
        }
    }

    drawSheets() {
        // draw rectangle for material size to laser cut
        let topY = 0;
        let topX = 0
        for (let i = 0; i < this.sheets.length; i++) {
            topY = i * ((this.materialHeight * this.ppi) + this.buffer);

            this.svgOutput.rect(topX, topY, this.materialWidth * this.ppi, this.materialHeight * this.ppi);
        }
    }
}