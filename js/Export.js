class Export {
    constructor(cellLines) {
        this.cellLines = cellLines;
        this.boards = [];
        this.materialThickness = 0.11; // default value, can be changed
        this.caseDepth = 5; // default value, can be changed

        // Configuration for laser cutting
        this.materialWidth = 16.5;
        this.materialHeight = 11;
        this.layoutToInch = 2; // layout squares (0.5 inches) to inch conversion
        this.ppi = 40; // pixel per inch
        this.buffer = 0.25 * this.ppi; // gap between boards

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

        // todo: consider material thickness when calculating board length
        let length = (end - start + 1) / this.layoutToInch;
        length += this.materialThickness; // Add material thickness to length

        return new Board(startCoord, endCoord, orientation);
    }

    detectJoints() {
        for (let i = 0; i < this.boards.length; i++) {
            for (let j = 0; j < this.boards.length; j++) {
                if (i !== j && this.boards[i].orientation !== this.boards[j].orientation) {
                    this.checkJoints(this.boards[i], this.boards[j]);
                }
            }
        }
    }

    checkJoints(board1, board2) {
        // Check for T-joints and end joints
        if (board1.orientation === "x") {
            this.checkHorizontalJoints(board1, board2);
        } else {
            this.checkVerticalJoints(board1, board2);
        }

        // Check for X-joints
        this.checkXJoints(board1, board2);
    }

    checkHorizontalJoints(hBoard, vBoard) {
        if (hBoard.coords.start.y === vBoard.coords.start.y || hBoard.coords.start.y === vBoard.coords.end.y) {
            if (vBoard.coords.start.x >= hBoard.coords.start.x && vBoard.coords.start.x <= hBoard.coords.end.x) {
                let jointPos = vBoard.coords.start.x - hBoard.coords.start.x;
                if (vBoard.coords.start.x === hBoard.coords.start.x) {
                    hBoard.poi.startJoint = "pin";
                } else if (vBoard.coords.start.x === hBoard.coords.end.x) {
                    hBoard.poi.endJoint = "pin";
                } else {
                    hBoard.poi.tJoints.push(jointPos);
                }
                vBoard.poi.tJoints.push(hBoard.coords.start.y - vBoard.coords.start.y);
            }
        }
    }

    checkVerticalJoints(vBoard, hBoard) {
        if (vBoard.coords.start.x === hBoard.coords.start.x || vBoard.coords.start.x === hBoard.coords.end.x) {
            if (hBoard.coords.start.y >= vBoard.coords.start.y && hBoard.coords.start.y <= vBoard.coords.end.y) {
                let jointPos = hBoard.coords.start.y - vBoard.coords.start.y;
                if (hBoard.coords.start.y === vBoard.coords.start.y) {
                    vBoard.poi.startJoint = "pin";
                } else if (hBoard.coords.start.y === vBoard.coords.end.y) {
                    vBoard.poi.endJoint = "pin";
                } else {
                    vBoard.poi.tJoints.push(jointPos);
                }
                hBoard.poi.tJoints.push(vBoard.coords.start.x - hBoard.coords.start.x);
            }
        }
    }

    checkXJoints(board1, board2) {
        if (board1.orientation === "x") {
            let xStart = Math.max(board1.coords.start.x, board2.coords.start.x);
            let xEnd = Math.min(board1.coords.end.x, board2.coords.end.x);
            let yStart = Math.max(board1.coords.start.y, board2.coords.start.y);
            let yEnd = Math.min(board1.coords.end.y, board2.coords.end.y);

            if (xStart < xEnd && yStart < yEnd) {
                board1.poi.xJoints.push(xStart - board1.coords.start.x);
                board2.poi.xJoints.push(yStart - board2.coords.start.y);
            }
        }
    }


    findBoardPosition(boardWidth) {
        for (let sheet = 0; sheet < this.sheets.length; sheet++) {
            for (let row = 0; row < this.sheets[sheet].length; row++) {
                let rowOccupiedWidth = this.sheets[sheet][row];
                let rowRemainingWidth = this.materialWidth - rowOccupiedWidth;
                let spaceNeeded = boardWidth + (this.buffer / this.ppi) * 2;

                if (rowRemainingWidth >= spaceNeeded) {
                    this.sheets[sheet][row] += boardWidth + (this.buffer / this.ppi);
                    return [sheet, row];
                }
            }
        }
        console.error("Not enough space on sheets for all boards");
        return null;
    }

    displayPreview() {
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
            let boardY = sheet * this.materialHeight + row * (this.caseDepth + this.buffer / this.ppi);

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
        // - example: if the depth is 1.5, how many pins and slots should be used?
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