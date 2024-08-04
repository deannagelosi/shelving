class Export {
    constructor(_cellData, _spacing) {
        this.cellData = _cellData;
        this.cellLines = this.cellData.cellLines;
        this.squareSize = this.cellData.squareSize;
        this.buffer = _spacing.buffer;
        this.xPadding = _spacing.xPadding;
        this.yPadding = _spacing.yPadding;
        this.boards = [];
        this.materialThickness = 0.25; // default value
        this.caseDepth = 5; // default value
        this.boardCounter = 0;

        // Configuration for laser cutting
        this.materialWidth = 16.5;
        this.materialHeight = 11;
        this.layoutToInch = 2; // layout squares (0.5 inches) to inch conversion
        this.ppi = 40; // pixel per inch
        this.gap = 0.25 * this.ppi; // gap between boards

        this.sheets = [[0, 0, 0], [0, 0, 0]]; // 3 rows, 2 sheets
    }

    setMaterialThickness(thickness) {
        if (typeof thickness === 'number' && thickness > 0) {
            this.materialThickness = thickness;
        } else {
            console.error("Invalid material thickness. Must be a positive number.");
        }
    }

    setCaseDepth(depth) {
        if (typeof depth === 'number' && depth > 0) {
            this.caseDepth = depth;
        } else {
            console.error("Invalid case depth. Must be a positive number.");
        }
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
        this.boards.sort((a, b) => b.getLength() - a.getLength());

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

        // todo: what is the goal of this code snippet
        // todo: consider material thickness when calculating board length
        let length = (end - start + 1) / this.layoutToInch;
        length += this.materialThickness; // Add material thickness to length

        this.boardCounter++;
        return new Board(startCoord, endCoord, orientation, this.boardCounter);
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
                text(board.id, startX(board.coords.start.x) + 30, startY(board.coords.start.y) + 5);
            } else {
                // if board is y oriented, draw text above the start coords
                text(board.id, startX(board.coords.start.x) - 5, startY(board.coords.start.y) - 30);
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

    findBoardPosition(boardWidth) {
        for (let sheet = 0; sheet < this.sheets.length; sheet++) {
            for (let row = 0; row < this.sheets[sheet].length; row++) {
                let rowOccupiedWidth = this.sheets[sheet][row];
                let rowRemainingWidth = this.materialWidth - rowOccupiedWidth;
                let spaceNeeded = boardWidth + (this.gap / this.ppi) * 2;

                if (rowRemainingWidth >= spaceNeeded) {
                    this.sheets[sheet][row] += boardWidth + (this.gap / this.ppi);
                    return [sheet, row];
                }
            }
        }
        console.error("Not enough space on sheets for all boards");
        return null;
    }

    previewCutLayout() {
        clear();
        background(255);
        // Calculate scaling factor to fit preview in canvas
        const totalSheetHeight = this.materialHeight * this.sheets.length;
        const scaleX = canvasWidth / this.materialWidth;
        const scaleY = canvasHeight / totalSheetHeight;
        const scaleValue = min(scaleX, scaleY) * 0.9; // 90% of available space for margins

        // Set up the drawing environment
        push();
        translate(canvasWidth / 2, canvasHeight / 2);
        scale(scaleValue);
        translate(-this.materialWidth / 2, -totalSheetHeight / 2);

        // Draw sheets
        for (let i = 0; i < this.sheets.length; i++) {
            let sheetY = i * this.materialHeight;
            noFill();
            stroke(0);
            strokeWeight(1 / scaleValue);
            rect(0, sheetY, this.materialWidth, this.materialHeight);
        }

        // Draw boards and joints
        for (let board of this.boards) {
            let [sheet, row] = this.findBoardPosition(board.getLength() / this.layoutToInch);
            if (sheet === null) continue;

            let boardX = this.sheets[sheet][row] - board.getLength() / this.layoutToInch;
            let boardY = sheet * this.materialHeight + row * (this.caseDepth + this.gap / this.ppi);

            // Draw board
            noFill();
            stroke(0);
            strokeWeight(1 / scaleValue);
            rect(boardX, boardY, board.getLength() / this.layoutToInch, this.caseDepth);

            // Draw joints
            this.drawJoints(board, boardX, boardY, scaleValue);
        }

        pop();
    }

    drawJoints(board, boardX, boardY, scaleValue) {
        // todo: dynamically use different pin/slot count based on depth
        
        // todo: find how many pins and slots. 
        // 1 pin means 2 cuts, 1 slot means 1 cut
        // each cut should be at most 1 inch long
        // look at the this.caseDepth and do math to solve this
        // example: if the depth is 1.5, how many pins and slots should be used?

        const numJoints = 5; // 2 slots, 3 pins
        const jointHeight = (1 / numJoints) * this.caseDepth;
        noFill();
        stroke(0);
        strokeWeight(1 / scaleValue);

        // Start joint
        if (board.poi.startJoint === "slot") {
            rect(boardX, boardY + this.caseDepth * 0.2, this.materialThickness, jointHeight);
            rect(boardX, boardY + this.caseDepth * 0.6, this.materialThickness, jointHeight);
        } else if (board.poi.startJoint === "pin") {
            rect(boardX, boardY, this.materialThickness, jointHeight);
            rect(boardX, boardY + this.caseDepth * 0.4, this.materialThickness, jointHeight);
            rect(boardX, boardY + this.caseDepth * 0.8, this.materialThickness, jointHeight);
        }

        // End joint
        const endX = boardX + board.getLength() / this.layoutToInch - this.materialThickness;
        if (board.poi.endJoint === "slot") {
            rect(endX, boardY + this.caseDepth * 0.2, this.materialThickness, jointHeight);
            rect(endX, boardY + this.caseDepth * 0.6, this.materialThickness, jointHeight);
        } else if (board.poi.endJoint === "pin") {
            rect(endX, boardY, this.materialThickness, jointHeight);
            rect(endX, boardY + this.caseDepth * 0.4, this.materialThickness, jointHeight);
            rect(endX, boardY + this.caseDepth * 0.8, this.materialThickness, jointHeight);
        }

        // T-joints
        for (let tJoint of board.poi.tJoints) {
            let tJointX = boardX + tJoint / this.layoutToInch;
            rect(tJointX, boardY + this.caseDepth * 0.2, this.materialThickness, jointHeight);
            rect(tJointX, boardY + this.caseDepth * 0.6, this.materialThickness, jointHeight);
        }

        // X-joints
        for (let xJoint of board.poi.xJoints) {
            let xJointX = boardX + xJoint / this.layoutToInch;
            rect(xJointX, boardY, this.materialThickness, this.caseDepth / 2);
        }
    }
}