class Case {
    constructor() {
        this.caseWidth;
        this.caseHeight;
        this.caseGrid = [];
        this.caseCellSize = 17;
        this.tbPadding = 25; // left right
        this.lrPadding = 45; // left right

        this.columnHeights = [];
        this.rowWidths = [];

        this.middleShapes = [];
        this.sideShapes = [];
        this.positions = []; // shape positions in the case
        this.shapeTitles = []; // positions of the shape titles

        this.horizontalBoards = [];
        this.verticalBoards = [];

        // Create Regenerate button which calls loop()
        this.regenButton = createButton('REGENERATE');
        this.regenButton.position((width / 2) - 90, height + 25);
        this.regenButton.mousePressed(() => {
            // build a new case
            this.sortShapes("random");
            buildAttempts = 0;
            loop();
        });
    }

    sortShapes(_method) {
        // reset and re-sort the shapes
        this.middleShapes = [];
        this.sideShapes = [];

        if (_method == "height") {
            // sort by height
            shapes.sort(function (a, b) {
                return a.boundaryHeight - b.boundaryHeight;
            });
            // four shortest shapes for middle column
            for (let i = 0; i < shapes.length; i++) {
                if (i < 4) {
                    this.middleShapes.push(shapes[i]);
                } else {
                    this.sideShapes.push(shapes[i]);
                }
            }
        } else if (_method == "random") {
            // sort by random
            shuffle(shapes, true);
            // four shortest shapes for middle column
            for (let i = 0; i < shapes.length; i++) {
                if (i < 4) {
                    this.middleShapes.push(shapes[i]);
                } else {
                    this.sideShapes.push(shapes[i]);
                }
            }
        }
    }

    layoutShapes() {
        // shuffle the shape layout
        this.shuffleCaseLayout();

        // calculate height & width of each column and set height & width of the case
        this.calcHeights();
        this.calcWidths();

        // calculate y and x position for each shape and place them in the case grid
        this.calcShapesY();
        this.calcShapesX();
        this.placeShapes();
    }

    shuffleCaseLayout() {
        this.positions = [];

        // randomize middleShapes and sideShapes to reposition objects
        shuffle(this.middleShapes, true);
        shuffle(this.sideShapes, true);
        // to do: could add sorting by width and height (ex: middle column widest on bottom)
        this.positions = [
            [this.sideShapes[0], this.sideShapes[1], this.sideShapes[2]],
            [this.middleShapes[0], this.middleShapes[1], this.middleShapes[2], this.middleShapes[3]],
            [this.sideShapes[3], this.sideShapes[4], this.sideShapes[5]]
        ];
    }

    buildHorizontalBoards() {
        // === Build initial short boards under each shape ===

        // working from bottom of case to top, build a board under each shape
        for (let col = 0; col < this.positions.length; col++) {
            for (let row = 0; row < this.positions[col].length; row++) {
                // draw a horizontal line for this shape's floor, using its y-value
                let shape = this.positions[col][row];
                let startX = shape.posX;
                let startY = this.positions[col][row].posY;
                let endX = shape.posX + shape.boundaryWidth;
                let endY = this.positions[col][row].posY;

                // create and save board
                let board = new Board();
                board.startCoords = [startY, startX];
                board.endCoords = [endY, endX];
                board.col = col;
                this.horizontalBoards.push(board);
            }
        }

        // === Grow the boards left and right ===

        // loop the middle column boards
        let centerBoards = this.getBoardsByCol(1);
        for (let i = 0; i < centerBoards.length; i++) {
            let centerBoard = centerBoards[i];
            // find the closest board to the left of this board (closest y value)
            let neighborBoards = this.getClosestBoardsLR(centerBoard); // [left, right]
            let leftBoard = neighborBoards[0];
            let rightBoard = neighborBoards[1];
            // Note: position data is stored as [y, x]

            // == Left Side ==
            let xDistLeft = centerBoard.startCoords[1] - leftBoard.endCoords[1];
            // abort case if a distance is negative
            if (xDistLeft < 0) {
                // x position overlap, try again
                buildIssue = true;
                return;
            }

            let attempts = 10;
            while (xDistLeft > 0 && attempts > 0) {
                let leftGrow = this.allowGrowth(leftBoard, "end");
                let centerGrow = this.allowGrowth(centerBoard, "start");

                if (xDistLeft >= 2) {
                    // can grow both sides if allowed
                    if (leftGrow) {
                        leftBoard.endCoords[1] += 1;
                    }
                    if (centerGrow) {
                        centerBoard.startCoords[1] -= 1;
                    }
                } else if (xDistLeft == 1) {
                    // can only grow one side, trying left first
                    if (leftGrow) {
                        leftBoard.endCoords[1] += 1;
                    }
                    else if (centerGrow) {
                        centerBoard.startCoords[1] -= 1;
                    }
                }
                // update xDistLeft, aborting if it goes negative
                xDistLeft = centerBoard.startCoords[1] - leftBoard.endCoords[1];
                if (xDistLeft < 0) {
                    // x position overlap, try again
                    buildIssue = true;
                    return;
                }
                attempts--;
            }

            // == Right Side ==
            let xDistRight = rightBoard.startCoords[1] - centerBoard.endCoords[1];
            // abort case if a distance is negative
            if (xDistRight < 0) {
                // x position overlap, try again
                buildIssue = true;
                return;
            }

            attempts = 10;
            while (xDistRight > 0 && attempts > 0) {
                let rightGrow = this.allowGrowth(rightBoard, "start");
                let centerGrow = this.allowGrowth(centerBoard, "end");

                if (xDistRight >= 2) {
                    // can grow both sides if allowed
                    if (rightGrow) {
                        rightBoard.startCoords[1] -= 1;
                    }
                    if (centerGrow) {
                        centerBoard.endCoords[1] += 1;
                    }
                } else if (xDistRight == 1) {
                    // can only grow one side, trying left first
                    if (rightGrow) {
                        rightBoard.startCoords[1] -= 1;
                    }
                    else if (centerGrow) {
                        centerBoard.endCoords[1] += 1;
                    }
                }
                // update xDistRight, aborting if it goes negative
                xDistRight = rightBoard.startCoords[1] - centerBoard.endCoords[1];
                if (xDistRight < 0) {
                    // x position overlap, try again
                    buildIssue = true;
                    return;
                }
                attempts--;
            }
        }

    }

    allowGrowth(_board, _side) {
        // check if the board is allowed to grow on the side requested
        let boardGrowX;
        let boardGrowY;
        if (_side == "end") {
            // grow from the end side
            boardGrowX = _board.endCoords[1]; // look one cell to the right
            boardGrowY = _board.endCoords[0];
        } else if (_side == "start") {
            // grow from the start side
            boardGrowX = _board.startCoords[1] - 1; // look one cell to the left
            boardGrowY = _board.startCoords[0];
        }

        if (boardGrowY - 1 >= 0) { // not the bottom
            // check if the top/bottom grid the next column over is occupied
            let nextTopCell = this.caseGrid[boardGrowY][boardGrowX];
            let nextBottomCell = this.caseGrid[boardGrowY - 1][boardGrowX];

            if (nextTopCell == 0 || nextBottomCell == 0) {
                return true;
                // "allowed to grow left board (end side)"
            }
        } else { // at the bottom
            // check if the top/bottom grid the next column over is occupied
            let nextTopCell1 = this.caseGrid[boardGrowY + 1][boardGrowX];
            let nextTopCell2 = this.caseGrid[boardGrowY][boardGrowX];

            if (nextTopCell1 == 0 && nextTopCell2 == 0) {
                return true;
                // "allowed to grow left board (end side)"
            }
        }

        return false;
    }

    getClosestBoardsLR(searchBoard) {
        // find the boards that are the closest neighbor (by y value) on the left and right

        // find closest board on the left
        let leftBoards = this.getBoardsByCol(0);
        let closestBoardLeft = leftBoards[0];
        for (let i = 0; i < leftBoards.length; i++) {
            let currDistY = Math.abs(searchBoard.startCoords[0] - closestBoardLeft.endCoords[0]);
            let newDistY = Math.abs(searchBoard.startCoords[0] - leftBoards[i].endCoords[0]);

            if (newDistY < currDistY) {
                closestBoardLeft = leftBoards[i];
            }
        }
        // find closest board on the right
        let rightBoards = this.getBoardsByCol(2);
        let closestBoardRight = rightBoards[0];
        for (let i = 0; i < rightBoards.length; i++) {
            let currDistY = Math.abs(searchBoard.endCoords[0] - closestBoardRight.startCoords[0]);
            let newDistY = Math.abs(searchBoard.endCoords[0] - rightBoards[i].startCoords[0]);

            if (newDistY < currDistY) {
                closestBoardRight = rightBoards[i];
            }
        }

        return [closestBoardLeft, closestBoardRight];
    }

    getBoardsByCol(_col) {
        let boards = [];
        for (let i = 0; i < this.horizontalBoards.length; i++) {
            let board = this.horizontalBoards[i];
            if (board.col == _col) {
                boards.push(board);
            }
        }
        return boards;
    }

    buildPerimeterBoards() {
        // discard if case is to tall or wide
        if (this.caseHeight > 35 || this.caseWidth > 35) {
            buildIssue = true;
            return;
        }
        // build the perimeter boards
        this.horizontalBoards = [];
        this.verticalBoards = [];

        let topBoard = new Board();
        let leftBoard = new Board();
        let rightBoard = new Board();

        topBoard.startCoords = [this.caseHeight, 0];
        topBoard.endCoords = [this.caseHeight, this.caseWidth];
        this.horizontalBoards.push(topBoard);

        leftBoard.startCoords = [0, 0];
        leftBoard.endCoords = [this.caseHeight, 0];
        this.verticalBoards.push(leftBoard);

        rightBoard.startCoords = [0, this.caseWidth];
        rightBoard.endCoords = [this.caseHeight, this.caseWidth];
        this.verticalBoards.push(rightBoard);
    }

    buildVerticalBoards() {
        this.buildVertBoardsPos(0, "end");
        this.buildVertBoardsPos(1, "start");
        this.buildVertBoardsPos(1, "end");
        this.buildVertBoardsPos(2, "start");
    }

    buildVertBoardsPos(col, startPt) {
        let boards = this.getBoardsByCol(col);
        // loop the left boards, building a vertical board at each end point
        for (let i = 0; i < boards.length; i++) {
            let board = boards[i];
            // the start coords for the vertical line
            let startY;
            let startX;
            if (startPt == "start") {
                startY = board.startCoords[0];
                startX = board.startCoords[1];
            } else if (startPt == "end") {
                startY = board.endCoords[0];
                startX = board.endCoords[1];
            }

            let vertStartCoords = [startY, startX];
            let vertEndCoords = [startY + 1, startX]; // prevents matching with a neighbor or itself at the same y value

            // start moving up until intersecting with an existing horizontal board
            let intersectionFound = false;
            for (let j = 0; j < this.caseHeight; j++) {
                for (let k = 0; k < this.horizontalBoards.length; k++) {
                    // [y, x]
                    let startCoordsHorizBoard = this.horizontalBoards[k].startCoords;
                    let endCoordsHorizBoard = this.horizontalBoards[k].endCoords;
                    // check if the vertical board has crossed a horizontal board's y value
                    if (vertEndCoords[0] == startCoordsHorizBoard[0]) {
                        // is the vertical board's end x value between the horizontal board start x value and end x value
                        if (vertEndCoords[1] >= startCoordsHorizBoard[1] && vertEndCoords[1] <= endCoordsHorizBoard[1]) {
                            // vertical board intersects with a horizontal board, stop moving up
                            // set to the same y-value
                            vertEndCoords[0] = startCoordsHorizBoard[0];
                            intersectionFound = true;
                            break;
                        }
                    }
                }
                if (intersectionFound == false) {
                    // if no intersection, move end point up by one cell
                    vertEndCoords[0] += 1;
                } else {
                    break;
                }
            }
            // create and save vertical board
            let vertBoard = new Board();
            vertBoard.startCoords = vertStartCoords;
            vertBoard.endCoords = vertEndCoords;
            this.verticalBoards.push(vertBoard);
        }
    }

    mergeHVBoards() {
        // merge all horizontal and vertical boards
        this.horizontalBoards = this.mergeBoards(this.horizontalBoards, 0);
        this.verticalBoards = this.mergeBoards(this.verticalBoards, 1);

        // discard case if any boards are too short (only 1 cell long)
        for (let i = 0; i < this.horizontalBoards.length; i++) {
            let board = this.horizontalBoards[i];
            if (board.getLength() < 2) {
                buildIssue = true;
                return;
            }
        }
        for (let i = 0; i < this.verticalBoards.length; i++) {
            let board = this.verticalBoards[i];
            if (board.getLength() < 2) {
                buildIssue = true;
                return;
            }
        }

        // discard if a single cell gap exists between two vertical boards
        // sort vert boards by x ([y, x]), then check adjacent boards. skip last board.
        this.verticalBoards.sort((a, b) => a.startCoords[1] - b.startCoords[1]);
        for (let i = 0; i < this.verticalBoards.length - 1; i++) {
            let boardCounter = 1;
            let currBoard = this.verticalBoards[i];
            let nextBoard = this.verticalBoards[i + boardCounter];
            let distanceX = Math.abs(nextBoard.startCoords[1] - currBoard.endCoords[1]);

            while (distanceX == 1) {
                // adjacent on x axis. check if the y values overlap for each board
                if (currBoard.startCoords[0] > nextBoard.startCoords[0] && currBoard.startCoords[0] < nextBoard.endCoords[0]) {
                    buildIssue = true;
                    return;
                }
                if (nextBoard.startCoords[0] > currBoard.startCoords[0] && nextBoard.startCoords[0] < currBoard.endCoords[0]) {
                    buildIssue = true;
                    return;
                }
                if (currBoard.endCoords[0] > nextBoard.startCoords[0] && currBoard.endCoords[0] < nextBoard.endCoords[0]) {
                    buildIssue = true;
                    return;
                }
                if (nextBoard.endCoords[0] > currBoard.startCoords[0] && nextBoard.endCoords[0] < currBoard.endCoords[0]) {
                    buildIssue = true;
                    return;
                }
                // same start and ends on both
                if (currBoard.startCoords[0] == nextBoard.startCoords[0] && currBoard.endCoords[0] == nextBoard.endCoords[0]) {
                    buildIssue = true;
                    return;
                }
                // check if next board is also adjacent
                boardCounter++;
                nextBoard = this.verticalBoards[i + boardCounter];
                if (nextBoard != undefined) {
                    distanceX = Math.abs(nextBoard.startCoords[1] - currBoard.endCoords[1]);
                } else {
                    break;
                }
            }
        }

        // discard if any vertical boards are full height and are not the perimeter boards
        let vCounter = 0;
        for (let i = 0; i < this.verticalBoards.length; i++) {
            let currBoard = this.verticalBoards[i];
            if (currBoard.getLength() == this.caseHeight) {
                vCounter++;
            }
        }
        if (vCounter > 2) {
            buildIssue = true;
            return;
        }

        // discard if any horizontal boards are full width and are not the perimeter boards
        let hCounter = 0;
        for (let i = 0; i < this.horizontalBoards.length; i++) {
            let currBoard = this.horizontalBoards[i];
            if (currBoard.getLength() == this.caseWidth) {
                hCounter++;
            }
        }
        if (hCounter > 2) {
            buildIssue = true;
            return;
        }

    }

    mergeBoards(_boards, _axis) {
        // [y, x]
        // == Sort the boards based on shared axis == //
        _boards.sort((a, b) => a.startCoords[_axis] - b.startCoords[_axis]);

        // == Merge touching boards ==
        // start over on each merge and stop when no more merges are happening
        let merged = true;
        while (merged == true) {
            merged = false;

            // loop through each board and check if touching any other boards (excluding itself)
            for (let i = 0; i < _boards.length; i++) {
                let currBoard = _boards[i];

                let otherBoards = _boards.filter(object => object !== currBoard);
                let found = otherBoards.find(board => this.isTouching(currBoard, board, _axis));

                if (found) {
                    // create a new board that is the combination of the two touching boards
                    let mergedBoard = new Board();
                    mergedBoard.startCoords = currBoard.startCoords;
                    mergedBoard.endCoords = found.endCoords;

                    // remove the two original boards and add the new merged board
                    _boards = _boards.filter(object => object !== currBoard);
                    _boards = _boards.filter(object => object !== found);
                    _boards.push(mergedBoard);

                    // a merge was found, start over looking for more merges
                    merged = true;
                    break;
                }
            }
        }

        return _boards;
    }

    labelBoards() {
        // sort horizontal boards by y value and then label them
        this.horizontalBoards.sort((a, b) => a.startCoords[0] - b.startCoords[0]);
        this.horizontalBoards.forEach((board, index) => {
            board.boardLabel = String.fromCharCode(65 + index);
        })

        // sort vertical boards by x value and then label them
        this.verticalBoards.sort((a, b) => a.startCoords[1] - b.startCoords[1]);
        this.verticalBoards.forEach((board, index) => {
            board.boardLabel = index + 1;
        })
    }

    addJoints() {
        // add joints to the boards along all vertical and horizontal intersections
        this.axisJoints(0); // y axis
        this.axisJoints(1); // x axis
    }

    axisJoints(_axis) {
        let primaryBoards; // the boards that are being looped one at a time
        let secondaryBoards; // the boards that are checked against the primary board for matches
        if (_axis == 0) {
            primaryBoards = this.horizontalBoards;
            secondaryBoards = this.verticalBoards;
        } else if (_axis == 1) {
            primaryBoards = this.verticalBoards;
            secondaryBoards = this.horizontalBoards;
        }

        // loop all the primary boards
        for (let i = 0; i < primaryBoards.length; i++) {
            // loop each board and search for another board with a matching edge
            let primaryBoard = primaryBoards[i];
            let foundBoards = secondaryBoards.filter(board => this.hasMatchingCoord(primaryBoard, board, 0));

            if (foundBoards.length > 0) {
                for (let j = 0; j < foundBoards.length; j++) {
                    // found a board with a matching end (start or end) coordinate
                    let secondaryBoard = foundBoards[j];
                    let matchResult = this.hasMatchingCoord(primaryBoard, secondaryBoard, 1);
                    let primaryResult = matchResult[0];
                    let secondaryResult = matchResult[1];

                    // is primaryBoard horizontal or vertical?
                    // [y, x]
                    if (primaryBoard.getOrientation() == 0) {
                        // horizontal board gets pins by default and vert slots
                        primaryBoard.poi.endJoints[primaryResult] = "pin";
                        secondaryBoard.poi.endJoints[secondaryResult] = "slot";
                    }
                    else if (primaryBoard.getOrientation() == 1) {
                        // vertical board gets slots by default and horiz pins
                        primaryBoard.poi.endJoints[primaryResult] = "slot";
                        secondaryBoard.poi.endJoints[secondaryResult] = "pin";
                    }
                }
            }
            if (foundBoards.length == 1) {
                // primaryBoard has T-joints on one end
                // determine which end has the T-joint
                let matchResult = this.hasMatchingCoord(primaryBoard, foundBoards[0], 1);
                let primaryResult = matchResult[0]; // either 0 (start) or 1 (end)
                let whichEndIsTJoint = (primaryResult == 0) ? 1 : 0; // if primaryResult is 0, then the T-joint is on the end (1)
                let horizCoords = primaryBoard.getCoords()[whichEndIsTJoint]; // [y, x]

                let secondaryBoard = this.findIntersectingBoard(horizCoords, _axis);
                let tJointLoc = Math.abs(secondaryBoard.startCoords[_axis] - horizCoords[_axis]);
                secondaryBoard.poi.tJoints.push(tJointLoc);
                primaryBoard.poi.endJoints[whichEndIsTJoint] = "pin"; // add pins to the primaryBoard
            }
            if (foundBoards.length == 0) {
                // primaryBoard has T-joints on both ends
                // board touching the start coords on the horizontal board
                let startSecondaryBoard = this.findIntersectingBoard(primaryBoard.startCoords, _axis);
                let startBoardTJoint = Math.abs(startSecondaryBoard.startCoords[_axis] - primaryBoard.startCoords[_axis]);
                startSecondaryBoard.poi.tJoints.push(startBoardTJoint);
                primaryBoard.poi.endJoints[0] = "pin"; // add pins to the primaryBoard

                // board touching the end coords on the horizontal board
                let endSecondaryBoard = this.findIntersectingBoard(primaryBoard.endCoords, _axis);
                let endBoardTJoint = Math.abs(endSecondaryBoard.startCoords[_axis] - primaryBoard.endCoords[_axis]);
                endSecondaryBoard.poi.tJoints.push(endBoardTJoint);
                primaryBoard.poi.endJoints[1] = "pin"; // add pins to the primaryBoard
            }
        }
    }

    findIntersectingBoard(_coords, _axis) {
        // loop the boards and check if any intersect with the coords
        // _axis is where to search for intersections (y (0) to find vertical boards, x (1) for horizontal boards)
        let searchBoards;
        let sharedAxis;
        if (_axis == 0) {
            searchBoards = this.verticalBoards;
            sharedAxis = 1; // coords is at the same x value as the found board
        } else if (_axis == 1) {
            searchBoards = this.horizontalBoards;
            sharedAxis = 0; // coords is at the same y value as the found board
        }

        for (let i = 0; i < searchBoards.length; i++) {
            let currBoard = searchBoards[i];
            // check if the coords are between the start and end coords of the currBoard
            if (_coords[_axis] > currBoard.startCoords[_axis] && _coords[_axis] < currBoard.endCoords[_axis]) {
                if (_coords[sharedAxis] == currBoard.startCoords[sharedAxis]) {
                    return currBoard;
                }
            }
        }
        return null;
    }

    hasMatchingCoord(board1, board2, mode) {
        // if mode = 0, return Boolean
        // if mode = 1, return which coord matched (startCoord or endCoord)
        let coords1 = board1.getCoords(); // [[y1, x1], [y2, x2]]
        let coords2 = board2.getCoords(); // [[y1, x1], [y2, x2]]

        for (let i = 0; i < coords1.length; i++) {
            for (let j = 0; j < coords2.length; j++) {
                if (coords1[i][0] === coords2[j][0] && coords1[i][1] === coords2[j][1]) {
                    if (mode == 0) {
                        // a matching coord was found, return true
                        return true;
                    } else if (mode == 1) {
                        // return which coord matched
                        let board1Edge;
                        let board2Edge;
                        if (i == 0) {
                            board1Edge = 0; // 0 is always start
                        } else if (i == 1) {
                            board1Edge = 1; // 1 is always end
                        }

                        if (j == 0) {
                            board2Edge = 0; // 0 is always start
                        } else if (j == 1) {
                            board2Edge = 1; // 1 is always end
                        }

                        return [board1Edge, board2Edge];
                    }
                }
            }
        }
        return false;
    }

    isTouching(_board1, _board2, _axis) {
        let currBoard = _board1;
        let otherBoard = _board2;
        let touching = false;
        if (_axis == 0) { // y axis
            // horizontal boards - y's equal and x's touching or overlapping
            let yTouching = currBoard.endCoords[0] == otherBoard.startCoords[0];
            let xTouching = currBoard.endCoords[1] >= otherBoard.startCoords[1] && currBoard.endCoords[1] <= otherBoard.endCoords[1];

            if (yTouching && xTouching) {
                touching = true;
            }
        } else if (_axis == 1) { // x axis
            // vertical boards - x's equal and y's touching or overlapping
            let xTouching = currBoard.endCoords[1] == otherBoard.startCoords[1];
            let yTouching = currBoard.endCoords[0] >= otherBoard.startCoords[0] && currBoard.endCoords[0] <= otherBoard.endCoords[0];

            if (xTouching && yTouching) {
                touching = true;
            }
        }
        return touching;
    }

    displayBoards() {
        // draw the horizontal boards
        for (let i = 0; i < this.horizontalBoards.length; i++) {
            let board = this.horizontalBoards[i];
            stroke("red");
            strokeWeight(3);

            // translate to the case's position and cell size
            let startX = this.lrPadding + (board.startCoords[1] * this.caseCellSize);
            let startY = this.tbPadding + (this.caseHeight * this.caseCellSize) - (board.startCoords[0] * this.caseCellSize); // draw from bottom up
            let endX = this.lrPadding + (board.endCoords[1] * this.caseCellSize);
            let endY = this.tbPadding + (this.caseHeight * this.caseCellSize) - (board.endCoords[0] * this.caseCellSize); // draw from bottom up

            line(startX, startY, endX, endY);

            // draw dots at the start and end coords
            fill("orange"); // Black color for the dots
            noStroke(); // No border for the dots
            // Draw a dot at the startCoords and endCoords
            circle(startX, startY, 15); // x, y, size
            circle(endX, endY, 15); // x, y, size
        }

        // draw the vertical boards
        for (let i = 0; i < this.verticalBoards.length; i++) {
            let board = this.verticalBoards[i];
            stroke("red");
            strokeWeight(3);

            // translate to the case's position and cell size
            let startX = this.lrPadding + (board.startCoords[1] * this.caseCellSize);
            let startY = this.tbPadding + (this.caseHeight * this.caseCellSize) - (board.startCoords[0] * this.caseCellSize); // draw from bottom up
            let endX = this.lrPadding + (board.endCoords[1] * this.caseCellSize);
            let endY = this.tbPadding + (this.caseHeight * this.caseCellSize) - (board.endCoords[0] * this.caseCellSize); // draw from bottom up

            line(startX, startY, endX, endY);

            // draw dots at the start and end coords
            fill("green"); // Black color for the dots
            noStroke(); // No border for the dots
            // Draw a dot at the startCoords and endCoords
            circle(startX, startY, 8); // x, y, size
            circle(endX, endY, 8); // x, y, size
        }
    }

    calcHeights() {
        // loop through each column, adding up their heights
        this.columnHeights = [];
        for (let col = 0; col < this.positions.length; col++) {
            let totalHeight = 0;
            for (let row = 0; row < this.positions[col].length; row++) {
                totalHeight += this.positions[col][row].boundaryHeight;
            }
            this.columnHeights.push(totalHeight);
        }

        // find the column with the tallest height, set as case height
        this.caseHeight = Math.max(...this.columnHeights);
    }

    calcWidths() {
        // loop through each row, adding up their widths
        this.rowWidths = [];

        let maxRowLength = 0;
        for (let col = 0; col < this.positions.length; col++) {
            if (this.positions[col].length > maxRowLength) {
                maxRowLength = this.positions[col].length;
            }
        }

        // find the width of each row
        for (let row = 0; row < maxRowLength; row++) {
            let totalWidth = 0;
            for (let col = 0; col < this.positions.length; col++) {
                if (this.positions[col][row] != undefined) {
                    totalWidth += this.positions[col][row].boundaryWidth;
                } else if (this.positions[col][row - 1] != undefined) {
                    totalWidth += this.positions[col][row - 1].boundaryWidth;
                }
            }
            this.rowWidths.push(totalWidth);
        }

        // find the row with the widest width, set as case width
        this.caseWidth = Math.max(...this.rowWidths);
    }

    calcShapesY() {
        // find the y value for every shape
        // loop each column, calculate the y value and set it to the shape
        for (let col = 0; col < this.positions.length; col++) {
            // extra height on shorter columns
            let colBuffer = [0, 0, 0];
            let numColShapes = this.positions[col].length;
            if (this.columnHeights[col] < this.caseHeight) {
                let heightDiff = (this.caseHeight - this.columnHeights[col]);
                if (heightDiff % numColShapes == 0) {
                    colBuffer[0] = heightDiff / numColShapes;
                    colBuffer[1] = heightDiff / numColShapes;
                    colBuffer[2] = heightDiff / numColShapes;
                } else {
                    colBuffer[0] = Math.floor(heightDiff / numColShapes) + 1; // remainder goes to first shape
                    colBuffer[1] = Math.floor(heightDiff / numColShapes);
                    colBuffer[2] = Math.floor(heightDiff / numColShapes);
                }
            }
            for (let row = 0; row < this.positions[col].length; row++) {
                if (row == 0) {
                    this.positions[col][row].posY = 0;
                }
                else {
                    let prevHeight = this.positions[col][row - 1].posY + this.positions[col][row - 1].boundaryHeight;
                    this.positions[col][row].posY = prevHeight + colBuffer[row - 1];
                }
            }
        }
    }

    calcShapesX() {
        // left justify items in the first (left) column
        // center items in the second (middle) column
        // right justify items in the third (right) column

        // loop the columns
        for (let col = 0; col < this.positions.length; col++) {
            // loop the rows
            for (let row = 0; row < this.positions[col].length; row++) {
                // calculate the x value
                let boundaryWidth = this.positions[col][row].boundaryWidth;
                let x;
                if (col == 0) {
                    x = 0;
                } else if (col == 1) {
                    x = Math.floor((this.caseWidth - boundaryWidth) / 2);
                } else if (col == 2) {
                    x = this.caseWidth - boundaryWidth;
                }
                this.positions[col][row].posX = x;
            }
        }
    }

    placeShapes() {
        // initialize grid case as all false
        for (let i = 0; i < this.caseHeight; i++) {
            this.caseGrid[i] = [];
            for (let j = 0; j < this.caseWidth; j++) {
                this.caseGrid[i][j] = 0; // 0 is empty
            }
        }
        // initialize shape titles array as empty
        this.shapeTitles = [];

        // place boundaries and shapes in the grid, looping if there's a collision
        for (let i = 0; i < shapes.length; i++) {
            let shape = shapes[i];
            // place boundary shape
            for (let y = 0; y < shape.boundaryHeight; y++) { // loop the boundary shape height and width
                for (let x = 0; x < shape.boundaryWidth; x++) {
                    if (shape.boundaryShape[y][x]) {
                        // // check if going out of bounds, report which axis
                        // if (this.caseGrid[shape.posY + y] == undefined) {
                        //     // out of bounds, y axis
                        //     buildIssue = true;
                        //     return;
                        // } else if (this.caseGrid[shape.posY + y][shape.posX + x] == undefined) {
                        //     // out of bounds, x axis
                        //     buildIssue = true;
                        //     return;
                        // }
                        // check for collision (cell already occupied)
                        if (this.caseGrid[shape.posY + y][shape.posX + x] != 0) {
                            // shape boundary collision, try again
                            buildIssue = true;
                            return;
                        }
                        this.caseGrid[shape.posY + y][shape.posX + x] = 2; // 2 is filled with a boundary for a shape
                    }
                }
            }

            // place shape
            for (let y = 0; y < shape.shapeHeight; y++) {
                for (let x = 0; x < shape.shapeWidth; x++) {
                    if (shape.shape[y][x]) {
                        this.caseGrid[shape.posY + y][shape.posX + x + 1] = 1; // 1 is filled with a shape
                    }
                }
            }

            // store shape title placements for display          
            let titleX = shape.posX + Math.ceil(shape.shapeWidth / 2) + 1;
            let titleY = shape.posY + Math.ceil(shape.shapeHeight / 2) - 0.5;
            this.shapeTitles.push([shape.title, titleX, titleY]);
        }
    }

    displayShapes() {
        // display the case grid
        stroke(0);
        strokeWeight(0.5);
        for (let x = 0; x < this.caseWidth; x++) {
            for (let y = 0; y < this.caseHeight; y++) {
                // draw cell
                if (this.caseGrid[y][x] == 1) {
                    fill(0); // black (shape)
                } else if (this.caseGrid[y][x] == 2) {
                    fill("pink"); // pink (boundary shape)
                }
                else if (this.caseGrid[y][x] == 0) {
                    fill(255); // white (empty)
                }
                let caseGridHeight = this.caseHeight * this.caseCellSize;

                let rectX = x * this.caseCellSize;
                let rectY = (caseGridHeight - this.caseCellSize) - (y * this.caseCellSize); // draw from bottom up
                rect(this.lrPadding + rectX, this.tbPadding + rectY, this.caseCellSize, this.caseCellSize);
            }
        }

        // display grid numbers
        textSize(12);
        textAlign(CENTER, CENTER);
        // y axis
        let numX = (this.lrPadding / 1.5);
        let numY = this.tbPadding + (this.caseCellSize / 2);
        for (let i = this.caseHeight; i > 0; i--) {
            fill(i % 5 === 0 ? "black" : "grey");
            text(i, numX, numY);
            numY += this.caseCellSize;
        }
        // x axis
        numX = this.lrPadding + (this.caseCellSize / 2);
        numY = this.tbPadding + (this.caseHeight * this.caseCellSize) + (this.caseCellSize * 0.75);
        for (let i = 1; i <= this.caseWidth; i++) {
            fill(i % 5 === 0 ? "black" : "grey");
            text(i, numX, numY);
            numX += this.caseCellSize;
        }

        // display the shape titles
        textSize(14);
        textAlign(CENTER, CENTER); // center on coordinates
        fill(255);
        for (let i = 0; i < this.shapeTitles.length; i++) {
            let title = this.shapeTitles[i][0];
            let titleX = this.shapeTitles[i][1];
            let titleY = this.shapeTitles[i][2];

            text(title, this.lrPadding + (titleX * this.caseCellSize), this.tbPadding + (this.caseHeight * this.caseCellSize) - (titleY * this.caseCellSize));
        }
    }
}