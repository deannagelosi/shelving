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

        this.shortShapes = [];
        this.tallShapes = [];
        this.positions = []; // shape positions in the case

        this.horizontalBoards = [];
        this.verticalBoards = [];
    }

    sortShapes() {
        shapes.sort(function (a, b) {
            return a.boundaryHeight - b.boundaryHeight;
        });
        // four shortest shapes for middle column
        for (let i = 0; i < shapes.length; i++) {
            if (i < 4) {
                this.shortShapes.push(shapes[i]);
            } else {
                this.tallShapes.push(shapes[i]);
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

    buildBoards() {
        // working from the bottom of the case to the top
        this.horizontalBoards = [];

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
            // let rightBoard = neighborBoards[1];

            // Note: position data is stored as [y, x]
            let xDistLeft = board.startCoords[1] - leftBoard.endCoords[1];
            // abort case if a distance is negative
            if (xDistLeft < 0) {
                buildIssue = true;
                return;
            }

            // grow the left and right boards till they meet
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

    getClosestBoardsLR(searchBoard) {
        // find the boards that are the closest neighbor (by y value) on the left and right
        let closestBoardLeft = this.horizontalBoards[0];
        let closestBoardRight = this.horizontalBoards[0];

        // find closest board on the left
        let leftBoards = this.getBoardsByCol(0);
        for (let i = 0; i < leftBoards.length; i++) {
            let currDistY = Math.abs(searchBoard.startCoords[0] - closestBoardLeft.endCoords[0]);
            let newDistY = Math.abs(searchBoard.startCoords[0] - leftBoards[i].endCoords[0]);

            if (newDistY < currDistY) {
                closestBoardLeft = leftBoards[i];
            }
        }
        // find closest board on the right
        let rightBoards = this.getBoardsByCol(2);
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

    displayBoards() {
        // draw the boards
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
        }
    }

    shuffleCaseLayout() {
        // randomize shortShapes and tallShapes to reposition objects
        shuffle(this.shortShapes, true);
        shuffle(this.tallShapes, true);
        // to do: could add sorting by width and height (ex: middle column widest on bottom)
        this.positions = [
            [this.tallShapes[0], this.tallShapes[1], this.tallShapes[2]],
            [this.shortShapes[0], this.shortShapes[1], this.shortShapes[2], this.shortShapes[3]],
            [this.tallShapes[3], this.tallShapes[4], this.tallShapes[5]]
        ];
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
                let shapeWidth = this.positions[col][row].boundaryWidth;
                let x;
                if (col == 0) {
                    x = 0;
                } else if (col == 1) {
                    x = Math.floor((this.caseWidth - shapeWidth) / 2);
                } else if (col == 2) {
                    x = this.caseWidth - shapeWidth;
                }
                this.positions[col][row].posX = x;
            }
        }
    }

    printCoords() {
        for (let col = 0; col < this.positions.length; col++) {
            for (let row = 0; row < this.positions[col].length; row++) {
                let shape = this.positions[col][row];
                console.log(`${shape.title}: ${shape.posX}, ${shape.posY}, col: ${col}, row: ${row}`);
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

        // place boundaries and shapes in the grid, looping if there's a collision
        for (let i = 0; i < shapes.length; i++) {
            let shape = shapes[i];
            // place boundary shape
            for (let y = 0; y < shape.boundaryHeight; y++) { // loop the boundary shape height and width
                for (let x = 0; x < shape.boundaryWidth; x++) {
                    if (shape.boundaryShape[y][x]) {
                        // check for collision (cell already occupied)
                        if (this.caseGrid[shape.posY + y][shape.posX + x] != 0) {
                            console.log("collision");
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
    }

    displayCase() {
        // display the outside edge of the case by drawing lines around the perimeter
        stroke(0);
        strokeWeight(3);
        noFill();
        rect(this.lrPadding, this.tbPadding, this.caseWidth * this.caseCellSize, this.caseHeight * this.caseCellSize);
    }
}