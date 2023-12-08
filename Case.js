class Case {
    constructor() {
        this.caseWidth;
        this.caseHeight;
        this.caseGrid = [];
        this.caseCellSize = 20;
        this.tbPadding = 25; // left right
        this.lrPadding = 25; // left right
        
        this.columnHeights = [];
        this.rowWidths = [];
        
        this.middleShapes = [];
        this.sideShapes = [];
        this.positions = []; // shape positions in the case
        this.shapeTitles = []; // positions of the shape titles

        this.horizontalBoards = [];
        this.verticalBoards = [];
    }

    sortShapes(_method) {
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

    buildCase() {
        this.shuffleCaseLayout();

        // calculate height & width of each column and set height & width of the case
        this.calcHeights();
        this.calcWidths();

        // calculate the y and x value for each shape and place them in the case grid
        this.calcShapesY();
        this.calcShapesX();
        this.placeShapes();
    }

    shuffleCaseLayout() {
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
        // working from the bottom of the case to the top
        // loop all the shapes, build a board under each shape
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
    }

    adjustBoards() {
        // modify the boards to fit the case

        // loop the middle column boards
        let centerBoards = this.getBoardsByCol(1);
        for (let i = 0; i < centerBoards.length; i++) {
            let board = centerBoards[i];
            // find the closest board to the left of this board (closest y value)
            let neighborBoards = this.getClosestBoardsLR(board); // [left, right]
            let leftBoard = neighborBoards[0];
            let rightBoard = neighborBoards[1];

            // Note: position data is stored as [y, x]

            // == Left Side ==
            let xDistLeft = board.startCoords[1] - leftBoard.endCoords[1];
            // abort case if a distance is negative
            if (xDistLeft < 0) {
                // x position overlap, try again
                buildIssue = true;
                return;
            }

            // grow the left and center boards till they meet
            let attempts = 10;
            while (xDistLeft > 0 && attempts > 0) {
                if (xDistLeft >= 2) {
                    // can grow both sides if possible
                    if (this.allowGrowLeft(leftBoard)) {
                        leftBoard.endCoords[1] += 1;
                    }
                    if (this.allowGrowCenterStart(board)) {
                        board.startCoords[1] -= 1;
                    }
                }
                else if (xDistLeft == 1) {
                    // can only grow one side, trying left first
                    if (this.allowGrowLeft(leftBoard)) {
                        leftBoard.endCoords[1] += 1;
                    }
                    else if (this.allowGrowCenterStart(board)) {
                        board.startCoords[1] -= 1;
                    }
                }
                // update xDistLeft, aborting if it goes negative
                xDistLeft = board.startCoords[1] - leftBoard.endCoords[1];
                if (xDistLeft < 0) {
                    // x position overlap, try again
                    buildIssue = true;
                    return;
                }
                attempts--;
            }

            // == Right Side ==
            let xDistRight = rightBoard.startCoords[1] - board.endCoords[1];
            // abort case if a distance is negative
            if (xDistRight < 0) {
                // x position overlap, try again
                buildIssue = true;
                return;
            }

            // grow the right and center boards till they meet
            attempts = 10;
            while (xDistRight > 0 && attempts > 0) {
                if (xDistRight >= 2) {
                    // can grow both sides if possible
                    if (this.allowGrowRight(rightBoard)) {
                        rightBoard.startCoords[1] -= 1;
                    }
                    if (this.allowGrowCenterEnd(board)) {
                        board.endCoords[1] += 1;
                    }
                }
                else if (xDistRight == 1) {
                    // can only grow one side, trying left first
                    if (this.allowGrowRight(rightBoard)) {
                        rightBoard.startCoords[1] -= 1;
                    }
                    else if (this.allowGrowCenterEnd(board)) {
                        board.endCoords[1] += 1;
                    }
                }
                // update xDistRight, aborting if it goes negative
                xDistRight = rightBoard.startCoords[1] - board.endCoords[1];
                if (xDistRight < 0) {
                    // x position overlap, try again
                    buildIssue = true;
                    return;
                }
                attempts--;
            }
        }

    }

    allowGrowLeft(_leftBoard) {
        // check if the left board is allowed to grow on it's end side
        let leftBoardEndX = _leftBoard.endCoords[1];
        let leftBoardEndY = _leftBoard.endCoords[0];

        if (leftBoardEndY - 1 >= 0) { // not the bottom
            // check if the top/bottom grid the next column over is occupied
            let nextTopCell = this.caseGrid[leftBoardEndY][leftBoardEndX];
            let nextBottomCell = this.caseGrid[leftBoardEndY - 1][leftBoardEndX];

            if (nextTopCell == 0 || nextBottomCell == 0) {
                return true;
                // "allowed to grow left board (end side)"
            }
        } else { // at the bottom
            // check if the top/bottom grid the next column over is occupied
            let nextTopCell1 = this.caseGrid[leftBoardEndY + 1][leftBoardEndX];
            let nextTopCell2 = this.caseGrid[leftBoardEndY][leftBoardEndX];

            if (nextTopCell1 == 0 && nextTopCell2 == 0) {
                return true;
                // "allowed to grow left board (end side)"
            }
        }

        return false;
    }

    allowGrowRight(_rightBoard) {
        // check if the left board is allowed to grow on it's end side
        let rightBoardStartX = _rightBoard.startCoords[1];
        let rightBoardStartY = _rightBoard.startCoords[0];

        if (rightBoardStartY - 1 >= 0) { // not the bottom
            // check if the top/bottom grid the next column over is occupied
            let nextTopCell = this.caseGrid[rightBoardStartY][rightBoardStartX - 1];
            let nextBottomCell = this.caseGrid[rightBoardStartY - 1][rightBoardStartX - 1];

            if (nextTopCell == 0 || nextBottomCell == 0) {
                return true;
                // "allowed to grow right board (start side)"
            }
        } else { // at the bottom
            // check if the top/bottom grid the next column over is occupied
            let nextTopCell1 = this.caseGrid[rightBoardStartY + 1][rightBoardStartX - 1];
            let nextTopCell2 = this.caseGrid[rightBoardStartY][rightBoardStartX - 1];

            if (nextTopCell1 == 0 && nextTopCell2 == 0) {
                return true;
                // "allowed to grow right board (start side)"
            }
        }

        return false;
    }

    allowGrowCenterStart(_centerBoard) {
        // check if a center board is allowed to grow on it's starting side
        let boardStartX = _centerBoard.startCoords[1];
        let boardStartY = _centerBoard.startCoords[0];

        if (boardStartY - 1 >= 0) { // not the bottom
            // check if the top/bottom grid the next column over is occupied
            let nextTopCell = this.caseGrid[boardStartY][boardStartX - 1];
            let nextBottomCell = this.caseGrid[boardStartY - 1][boardStartX - 1];

            if (nextTopCell == 0 || nextBottomCell == 0) {
                return true;
                // "allowed to grow center board (start side"
            }
        } else { // at the bottom
            // check if the top/bottom grid the next column over is occupied
            let nextTopCell = this.caseGrid[boardStartY][boardStartX - 1]

            if (nextTopCell == 0) {
                return true;
                // "allowed to grow left board (end side)"
            }
        }

        return false;
    }

    allowGrowCenterEnd(_centerBoard) {
        // check if a center board is allowed to grow on it's starting side
        let boardEndX = _centerBoard.endCoords[1];
        let boardEndY = _centerBoard.endCoords[0];

        if (boardEndY - 1 >= 0) { // not the bottom
            // check if the top/bottom grid the next column over is occupied
            let nextTopCell = this.caseGrid[boardEndY][boardEndX];
            let nextBottomCell = this.caseGrid[boardEndY - 1][boardEndX];

            if (nextTopCell == 0 || nextBottomCell == 0) {
                return true;
                // "allowed to grow center board (start side"
            }
        } else { // at the bottom
            // check if the top/bottom grid the next column over is occupied
            let nextTopCell = this.caseGrid[boardEndY][boardEndX]

            if (nextTopCell == 0) {
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
            fill(0); // Black color for the dots
            noStroke(); // No border for the dots
            // Draw a dot at the startCoords and endCoords
            circle(startX, startY, 10); // x, y, size
            circle(endX, endY, 10); // x, y, size
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
            fill(0); // Black color for the dots
            noStroke(); // No border for the dots
            // Draw a dot at the startCoords and endCoords
            circle(startX, startY, 10); // x, y, size
            circle(endX, endY, 10); // x, y, size
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

        // find the width of each row
        for (let row = 0; row < this.positions.length; row++) {
            let totalWidth = 0;
            for (let col = 0; col < this.positions.length; col++) {
                totalWidth += this.positions[col][row].boundaryWidth;
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
                let heightDiff = (this.caseHeight - this.columnHeights[0]);
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

        // display the shape titles
        textSize(14);
        textAlign(CENTER, CENTER); // center on coordinates
        fill(255);
        console.log(this.shapeTitles);
        for (let i = 0; i < this.shapeTitles.length; i++) {
            let title = this.shapeTitles[i][0];
            let titleX = this.shapeTitles[i][1];
            let titleY = this.shapeTitles[i][2];

            text(title, this.lrPadding + (titleX * this.caseCellSize), this.tbPadding + (this.caseHeight * this.caseCellSize) - (titleY * this.caseCellSize));
        }
    }
}