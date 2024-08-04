class Export {
    constructor(_cellData, _spacing, _config) {
        this.cellData = _cellData;
        this.cellLines = this.cellData.cellLines;
        this.squareSize = this.cellData.squareSize;
        this.buffer = _spacing.buffer;
        this.xPadding = _spacing.xPadding;
        this.yPadding = _spacing.yPadding;

        // User-defined config
        this.caseDepth = _config.caseDepth;
        this.sheetThickness = _config.sheetThickness;
        this.sheetWidth = _config.sheetWidth;
        this.sheetHeight = _config.sheetHeight;
        this.numSheets = _config.numSheets;

        this.boards = [];
        this.boardCounter = 0;

        // Configuration for laser cutting
        this.ppi = 40; // pixel per inch (todo: use in DXF generation)
        this.gap = 0.75 // inch gap between boards
        this.sheets = []; // holds what boards are on each sheet and row

        // state variables
        this.sheetOutline = []; // sheet outline rect
        this.cutList = []; // rectangle cut list
        this.etchList = []; // labels etching list
    }

    makeBoards() {
        let horizontalSegments = new Map();
        let verticalSegments = new Map();

        // Group cellLines into horizontal and vertical segments
        for (let lineKey of this.cellLines) {
            const [y1, x1, y2, x2] = lineKey.split(',').map(Number);

            if (y1 === y2) { // Horizontal segment
                const key = y1;
                if (!horizontalSegments.has(key)) horizontalSegments.set(key, []);
                horizontalSegments.get(key).push({ start: x1, end: x2 });
            } else { // Vertical segment
                const key = x1;
                if (!verticalSegments.has(key)) verticalSegments.set(key, []);
                verticalSegments.get(key).push({ start: y1, end: y2 });
            }
        }

        // Merge segments into boards
        this.boards = [
            ...this.mergeSegmentsIntoBoards(horizontalSegments, "x"),
            ...this.mergeSegmentsIntoBoards(verticalSegments, "y")
        ];

        // Sort boards by length
        this.boards.sort((a, b) => b.len - a.len);

        // Detect joints
        this.detectJoints();
    }

    mergeSegmentsIntoBoards(segments, orientation) {
        let boards = [];

        for (let [key, lineSegments] of segments) {
            lineSegments.sort((a, b) => a.start - b.start);

            let currentStart = lineSegments[0].start;
            let currentEnd = lineSegments[0].end;

            for (let i = 1; i < lineSegments.length; i++) {
                if (lineSegments[i].start <= currentEnd + 1) {
                    currentEnd = Math.max(currentEnd, lineSegments[i].end);
                } else {
                    // Create a new board
                    boards.push(this.createBoard(key, currentStart, currentEnd, orientation));
                    currentStart = lineSegments[i].start;
                    currentEnd = lineSegments[i].end;
                }
            }

            // Create the last board
            boards.push(this.createBoard(key, currentStart, currentEnd, orientation));
        }

        return boards;
    }

    createBoard(key, start, end, orientation) {
        let startCoord, endCoord;
        if (orientation === "x") {
            startCoord = { x: start, y: key };
            endCoord = { x: end, y: key };
        } else {
            startCoord = { x: key, y: start };
            endCoord = { x: key, y: end };
        }

        this.boardCounter++;
        return new Board(this.boardCounter, startCoord, endCoord, orientation, this.sheetThickness);
    }

    detectJoints() {
        for (let i = 0; i < this.boards.length; i++) {
            for (let j = i + 1; j < this.boards.length; j++) {
                if (this.boards[i].orientation !== this.boards[j].orientation) {
                    this.checkIntersection(this.boards[i], this.boards[j]);
                }
            }
        }
    }

    checkIntersection(board1, board2) {
        if (board1.orientation === "x") {
            this.checkHorizontalVerticalIntersection(board1, board2);
        } else {
            this.checkHorizontalVerticalIntersection(board2, board1);
        }
    }

    checkHorizontalVerticalIntersection(hBoard, vBoard) {
        // Check for T-joint: horizontal board end intersecting vertical board
        if (hBoard.coords.start.x === vBoard.coords.start.x &&
            hBoard.coords.start.y > vBoard.coords.start.y &&
            hBoard.coords.start.y < vBoard.coords.end.y) {
            this.markTJoint(hBoard, vBoard, 'start');
        }
        if (hBoard.coords.end.x === vBoard.coords.start.x &&
            hBoard.coords.start.y > vBoard.coords.start.y &&
            hBoard.coords.start.y < vBoard.coords.end.y) {
            this.markTJoint(hBoard, vBoard, 'end');
        }

        // Check for T-joint: vertical board end intersecting horizontal board
        if (vBoard.coords.start.y === hBoard.coords.start.y &&
            vBoard.coords.start.x > hBoard.coords.start.x &&
            vBoard.coords.start.x < hBoard.coords.end.x) {
            this.markTJoint(vBoard, hBoard, 'start');
        }
        if (vBoard.coords.end.y === hBoard.coords.start.y &&
            vBoard.coords.start.x > hBoard.coords.start.x &&
            vBoard.coords.start.x < hBoard.coords.end.x) {
            this.markTJoint(vBoard, hBoard, 'end');
        }

        // Check for X-joint
        if (vBoard.coords.start.x > hBoard.coords.start.x &&
            vBoard.coords.start.x < hBoard.coords.end.x &&
            hBoard.coords.start.y > vBoard.coords.start.y &&
            hBoard.coords.start.y < vBoard.coords.end.y) {
            this.markXJoint(hBoard, vBoard);
        }
    }

    markTJoint(intersectingBoard, intersectedBoard, endType) {
        // Change the end of the intersecting board to a pin
        intersectingBoard.poi[endType + 'Joint'] = 'pin';

        // Mark the T-joint on the intersected board
        let jointPos;
        if (intersectedBoard.orientation === 'x') {
            jointPos = intersectingBoard.coords[endType].x - intersectedBoard.coords.start.x;
        } else {
            jointPos = intersectingBoard.coords[endType].y - intersectedBoard.coords.start.y;
        }
        intersectedBoard.poi.tJoints.push(jointPos);
    }

    markXJoint(hBoard, vBoard) {
        let hJointPos = vBoard.coords.start.x - hBoard.coords.start.x;
        let vJointPos = hBoard.coords.start.y - vBoard.coords.start.y;

        hBoard.poi.xJoints.push(hJointPos);
        vBoard.poi.xJoints.push(vJointPos);
    }

    previewCaseLayout() {
        // confirm boards created correctly by displaying them in correct orientation
        const startX = (x1) => ((x1 * this.squareSize) + this.buffer + this.xPadding);
        const startY = (y1) => (((canvasHeight - this.yPadding) - this.buffer) - (y1 * this.squareSize));
        const endX = (x2) => ((x2 * this.squareSize) + this.buffer + this.xPadding);
        const endY = (y2) => (((canvasHeight - this.yPadding) - this.buffer) - (y2 * this.squareSize));

        // draw the cell line segments
        if (devMode) this.cellData.showCellLines("red");

        // draw the boards
        strokeWeight(7);
        for (const board of this.boards) {
            if (devMode) stroke("rgba(175, 141, 117, 0.5)");
            if (!devMode) stroke("rgb(175, 141, 117)");
            line(
                startX(board.coords.start.x),
                startY(board.coords.start.y),
                endX(board.coords.end.x),
                endY(board.coords.end.y)
            );

            // put text with the board id at the board start coords
            fill("black");
            stroke("white");
            textSize(20);
            // if board is x oriented, draw text to the right of the start coords
            if (board.orientation === "x") {
                text(board.id, startX(board.coords.start.x) + 20, startY(board.coords.start.y) + 7);
            } else {
                // if board is y oriented, draw text above the start coords
                text(board.id, startX(board.coords.start.x) - 7, startY(board.coords.start.y) - 20);
            }
        }

        if (devMode) {
            // draw the end joints by type
            noStroke();
            // slot ends
            for (const board of this.boards) {
                fill("salmon");
                if (board.poi.startJoint === "slot") {
                    ellipse(startX(board.coords.start.x), startY(board.coords.start.y), 35);
                }
                if (board.poi.endJoint === "slot") {
                    ellipse(endX(board.coords.end.x), endY(board.coords.end.y), 35);
                }
            }
            // pin ends
            for (const board of this.boards) {
                fill("pink");
                if (board.poi.startJoint === "pin") {
                    ellipse(startX(board.coords.start.x), startY(board.coords.start.y), 25);
                }
                if (board.poi.endJoint === "pin") {
                    ellipse(endX(board.coords.end.x), endY(board.coords.end.y), 25);
                }
            }
            // t-joints
            for (const board of this.boards) {
                for (const tJoint of board.poi.tJoints) {
                    fill("teal");
                    if (board.orientation === "x") {
                        // add t-joint on x-axis from start coord
                        ellipse(startX(board.coords.start.x) + (tJoint * this.squareSize), startY(board.coords.start.y), 15);
                    } else {
                        // subtract t-joint on y-axis from start coord
                        ellipse(startX(board.coords.start.x), startY(board.coords.start.y) - (tJoint * this.squareSize), 15);
                    }
                }
            }
            // x-joints
            for (const board of this.boards) {
                fill("white");
                stroke("black");
                strokeWeight(0.5);
                for (const xJoint of board.poi.xJoints) {
                    if (board.orientation === "x") {
                        // add x-joint on x-axis from start coord
                        ellipse(startX(board.coords.start.x) + (xJoint * this.squareSize), startY(board.coords.start.y), 10);
                    } else {
                        // add x-joint on y-axis from start coord
                        ellipse(startX(board.coords.start.x), startY(board.coords.start.y) - (xJoint * this.squareSize), 10);
                    }
                }
            }

        }
    }

    
    }

    previewCutLayout() {
        clear();
        background(255);

        // find the number of rows that can fit on a sheet
        this.setupSheets();

        // Calculate scaling factor to fit preview in canvas
        const totalSheetHeight = this.sheetHeight * this.sheets.length;
        const scaleX = canvasWidth / this.sheetWidth;
        const scaleY = canvasHeight / totalSheetHeight;
        const scaleValue = min(scaleX, scaleY) * 0.9; // 90% of available space for margins

        // Find the cuts and etches
        // Draw sheets
        for (let i = 0; i < this.sheets.length; i++) {
            let sheetY = i * this.sheetHeight;
            this.sheetOutline.push({ x: 0, y: sheetY, w: this.sheetWidth, h: this.sheetHeight });
        }

        // Draw boards and joints
        for (let board of this.boards) {
            // calculate the true board length
            let [sheet, row] = this.findBoardPosition(board.len);
            if (sheet === null) continue;

            let boardStartX = this.sheets[sheet][row] - board.len;
            let boardStartY = ((sheet * this.sheetHeight) + this.gap) + (row * (this.caseDepth + this.gap));

            // Draw board
            this.cutList.push({ x: boardStartX, y: boardStartY, w: board.len, h: this.caseDepth });

            // Draw joints
            this.drawJoints(board, boardStartX, boardStartY, scaleValue);

            // Draw board id

            this.etchList.push({ text: board.id, x: boardStartX, y: boardStartY - 0.2 });
        }

        // Set up the drawing environment
        push();
        translate(canvasWidth / 2, canvasHeight / 2);
        scale(scaleValue);
        translate(-this.sheetWidth / 2, -totalSheetHeight / 2);

        noFill();
        stroke(0);
        strokeWeight(1 / scaleValue);
        // Draw the sheets
        for (let sheet of this.sheetOutline) {
            rect(sheet.x, sheet.y, sheet.w, sheet.h);
        }
        // Draw the cuts
        for (let cut of this.cutList) {
            rect(cut.x, cut.y, cut.w, cut.h);
        }
        // Draw the etches
        fill(0);
        noStroke();
        textSize(7 / scaleValue);
        for (let etch of this.etchList) {
            text(etch.text, etch.x, etch.y);
        }

        pop();
    }

    setupSheets() {
        // find how many rows of boards can fit on a sheet based on depth
        this.sheets = [];
        let numRows = Math.floor(this.sheetHeight / (this.caseDepth + (this.gap * 2)));

        this.sheets = Array.from({ length: this.numSheets }, () => Array(numRows).fill(0))
    }

    findBoardPosition(_boardLength) {
        // fit boards efficiently on sheets in each row
        for (let sheet = 0; sheet < this.sheets.length; sheet++) {
            for (let row = 0; row < this.sheets[sheet].length; row++) {
                let rowOccupiedWidth = this.sheets[sheet][row];
                let rowRemainingWidth = this.sheetWidth - rowOccupiedWidth;
                let spaceNeeded = _boardLength + (this.gap * 2);

                if (rowRemainingWidth >= spaceNeeded) {
                    // mark the space as occupied
                    this.sheets[sheet][row] += _boardLength + this.gap;
                    return [sheet, row];
                }
            }
        }
        console.error("Not enough space on sheets for all boards");
        return [null, null];
    }

    drawJoints(board, boardStartX, boardStartY, scaleValue) {
        // todo: dynamically use different pin/slot count based on depth

        // todo: find how many pins and slots. 
        // 1 pin means 2 cuts, 1 slot means 1 cut
        // each cut should be at most 1 inch long
        // look at the this.caseDepth and do math to solve this
        // example: if the depth is 1.5, how many pins and slots should be used?

        const numJoints = 5; // 2 slots, 3 pins
        const cutoutRatio = (1 / numJoints);
        const jointHeight = cutoutRatio * this.caseDepth;
        noFill();
        stroke("black");
        strokeWeight(1 / scaleValue);

        // Start joint
        if (board.poi.startJoint === "slot") {
            this.cutList.push({ x: boardStartX, y: boardStartY + this.caseDepth * (1 * cutoutRatio), w: this.sheetThickness, h: jointHeight });
            this.cutList.push({ x: boardStartX, y: boardStartY + this.caseDepth * (3 * cutoutRatio), w: this.sheetThickness, h: jointHeight });
        } else if (board.poi.startJoint === "pin") {
            this.cutList.push({ x: boardStartX, y: boardStartY + this.caseDepth * (0 * cutoutRatio), w: this.sheetThickness, h: jointHeight });
            this.cutList.push({ x: boardStartX, y: boardStartY + this.caseDepth * (2 * cutoutRatio), w: this.sheetThickness, h: jointHeight });
            this.cutList.push({ x: boardStartX, y: boardStartY + this.caseDepth * (4 * cutoutRatio), w: this.sheetThickness, h: jointHeight });
        }

        // End joint
        const endX = boardStartX + board.len - this.sheetThickness;
        if (board.poi.endJoint === "slot") {
            this.cutList.push({ x: endX, y: boardStartY + this.caseDepth * (1 * cutoutRatio), w: this.sheetThickness, h: jointHeight });
            this.cutList.push({ x: endX, y: boardStartY + this.caseDepth * (3 * cutoutRatio), w: this.sheetThickness, h: jointHeight });

        } else if (board.poi.endJoint === "pin") {
            this.cutList.push({ x: endX, y: boardStartY + this.caseDepth * (0 * cutoutRatio), w: this.sheetThickness, h: jointHeight });
            this.cutList.push({ x: endX, y: boardStartY + this.caseDepth * (2 * cutoutRatio), w: this.sheetThickness, h: jointHeight });
            this.cutList.push({ x: endX, y: boardStartY + this.caseDepth * (4 * cutoutRatio), w: this.sheetThickness, h: jointHeight });
        }

        // T-joints
        for (let tJoint of board.poi.tJoints) {
            let tJointX = boardStartX + tJoint;
            this.cutList.push({ x: tJointX, y: boardStartY + this.caseDepth * (1 * cutoutRatio), w: this.sheetThickness, h: jointHeight });
            this.cutList.push({ x: tJointX, y: boardStartY + this.caseDepth * (3 * cutoutRatio), w: this.sheetThickness, h: jointHeight });
        }

        // X-joints
        for (let xJoint of board.poi.xJoints) {
            let xJointX = boardStartX + xJoint;
            if (board.orientation == "y") {
                // cut from top of board
                this.cutList.push({ x: xJointX, y: boardStartY, w: this.sheetThickness, h: this.caseDepth / 2 });
            } else {
                // cut from bottom of board
                this.cutList.push({ x: xJointX, y: (boardStartY + (this.caseDepth / 2)), w: this.sheetThickness, h: this.caseDepth / 2 });
            }
        }
    }
}