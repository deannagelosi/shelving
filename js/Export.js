class Export {
    constructor(_cellData, _spacing, _config) {
        this.cellData = _cellData;
        this.cellLines = this.cellData.cellLines;
        this.squareSize = this.cellData.squareSize;
        this.buffer = _spacing.buffer;
        this.xPadding = _spacing.xPadding;
        this.yPadding = _spacing.yPadding;
        this.boards = [];
        this.boardCounter = 0;

        // User-defined config
        this.caseDepth = _config.caseDepth;
        this.sheetThickness = _config.sheetThickness;
        this.sheetWidth = _config.sheetWidth;
        this.sheetHeight = _config.sheetHeight;
        this.numSheets = _config.numSheets;
        this.kerf = _config.kerf; // for vertical cuts in the joints
        // Joint configuration
        this.numPinSlots = _config.numPinSlots || 2;
        this.jointConfig = {
            numSlotCuts: this.numPinSlots,
            numPinCuts: this.numPinSlots + 1,
            totalCuts: (this.numPinSlots * 2) + 1
        };
        console.log(_config)

        // Configuration for laser cutting
        this.gap = 0.6 // inch gap between boards
        this.fontSize = 0.25; // inch font size for etching
        this.fontOffset = 0.15;
        this.sheets = []; // holds what boards are on each sheet and row
        this.totalHeight; // total height of all sheets

        // state variables
        this.sheetOutline = []; // rectangles for sheets
        this.cutList = []; // rectangles for boards and joints
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

    previewCase() {
        // confirm boards created correctly by displaying them in correct orientation
        clear();
        background(255);
        
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
                    ellipse(startX(board.coords.start.x), startY(board.coords.start.y), 30);
                }
                if (board.poi.endJoint === "slot") {
                    ellipse(endX(board.coords.end.x), endY(board.coords.end.y), 30);
                }
            }
            // pin ends
            for (const board of this.boards) {
                fill("pink");
                if (board.poi.startJoint === "pin") {
                    ellipse(startX(board.coords.start.x), startY(board.coords.start.y), 22);
                }
                if (board.poi.endJoint === "pin") {
                    ellipse(endX(board.coords.end.x), endY(board.coords.end.y), 22);
                }
            }
            // t-joints
            for (const board of this.boards) {
                for (const tJoint of board.poi.tJoints) {
                    fill("teal");
                    if (board.orientation === "x") {
                        // add t-joint on x-axis from start coord
                        ellipse(startX(board.coords.start.x) + (tJoint * this.squareSize), startY(board.coords.start.y), 14);
                    } else {
                        // subtract t-joint on y-axis from start coord
                        ellipse(startX(board.coords.start.x), startY(board.coords.start.y) - (tJoint * this.squareSize), 14);
                    }
                }
            }
            // x-joints
            for (const board of this.boards) {
                fill("white");
                stroke("black");
                strokeWeight(0.25);
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

    prepLayout() {
        // populated the cutList and etchList arrays
        this.sheetOutline = [];
        this.cutList = [];
        this.etchList = [];

        // find the number of rows that can fit on a sheet
        this.setupSheets();

        // Get sheets
        for (let i = 0; i < this.sheets.length; i++) {
            let sheetY = i * this.sheetHeight;
            this.sheetOutline.push({ x: 0, y: sheetY, w: this.sheetWidth, h: this.sheetHeight });
        }

        // Get boards, joints, and labels
        for (let board of this.boards) {
            // calculate the true board length
            let [sheet, row] = this.findBoardPosition(board.len);
            if (sheet === null && row === null) {
                // not enough space, add a sheet
                // todo: remove a sheet if there are more than needed
                let numSheets = parseInt(exportUI.html.numSheetsInput.value());
                exportUI.html.numSheetsInput.value(numSheets + 1);
                exportUI.handleCreate();
                break;
            };

            let boardStartX = this.sheets[sheet][row] - board.len;
            let boardStartY = ((sheet * this.sheetHeight) + this.gap) + (row * (this.caseDepth + this.gap));

            // Draw board
            this.cutList.push({ x: boardStartX, y: boardStartY, w: board.len, h: this.caseDepth });

            // Draw joints
            this.prepJoints(board, boardStartX, boardStartY);

            // Draw board id
            this.etchList.push({ text: board.id, x: boardStartX, y: boardStartY - this.fontOffset });
        }
    }

    prepJoints(board, boardStartX, boardStartY) {
        // add all the joints to the cut list
        // - 1 pin needs 2 cuts, 1 slot needs 1 cut
        // - 2 pins needs 3 cuts, 2 slots needs 2 cuts
        const numJoints = this.jointConfig.totalCuts;
        const cutoutRatio = (1 / numJoints);
        const jointHeight = cutoutRatio * this.caseDepth;

        // Start joint
        if (board.poi.startJoint === "slot") {
            for (let i = 0; i < this.jointConfig.numSlotCuts; i++) {
                let ratio = i === 0 ? 1 : 3;
                let x = boardStartX;
                let y = boardStartY + this.caseDepth * (ratio * cutoutRatio);
                this.cutList.push({ x, y, w: this.sheetThickness, h: jointHeight });
            }
        } else if (board.poi.startJoint === "pin") {
            for (let i = 0; i < this.jointConfig.numPinCuts; i++) {
                let ratio = i === 0 ? 0 : i === 1 ? 2 : 4;
                let x = boardStartX;
                let y = boardStartY + this.caseDepth * (ratio * cutoutRatio);
                this.cutList.push({ x, y, w: this.sheetThickness, h: jointHeight });
            }
        }
        // End joint
        if (board.poi.startJoint === "slot") {
            for (let i = 0; i < this.jointConfig.numSlotCuts; i++) {
                let ratio = i === 0 ? 1 : 3;
                let x = boardStartX + board.len - this.sheetThickness;
                let y = boardStartY + this.caseDepth * (ratio * cutoutRatio);
                this.cutList.push({ x, y, w: this.sheetThickness, h: jointHeight });
            }
        } else if (board.poi.startJoint === "pin") {
            for (let i = 0; i < this.jointConfig.numPinCuts; i++) {
                let ratio = i === 0 ? 0 : i === 1 ? 2 : 4;
                let x = boardStartX + board.len - this.sheetThickness;
                let y = boardStartY + this.caseDepth * (ratio * cutoutRatio);
                this.cutList.push({ x, y, w: this.sheetThickness, h: jointHeight });
            }
        }
        // T-joints
        for (let tJoint of board.poi.tJoints) {
            for (let i = 0; i < this.jointConfig.numSlotCuts; i++) {
                let ratio = i === 0 ? 1 : 3;
                let x = boardStartX + tJoint;
                let y = boardStartY + this.caseDepth * (ratio * cutoutRatio);
                this.cutList.push({ x, y, w: this.sheetThickness, h: jointHeight });
            }
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

    previewLayout() {
        if (this.sheetOutline.length === 0 || this.cutList.length === 0 || this.etchList.length === 0) {
            this.prepLayout();
        }

        // Calculate scaling factor to fit preview in canvas
        const totalSheetHeight = this.sheetHeight * this.sheets.length;
        const scaleX = canvasWidth / this.sheetWidth;
        const scaleY = canvasHeight / totalSheetHeight;
        const scaleValue = min(scaleX, scaleY) * 0.9; // 90% of available space for margins

        // Set up the drawing environment
        push();
        translate(canvasWidth / 2, canvasHeight / 2);
        scale(scaleValue);
        translate(-this.sheetWidth / 2, -totalSheetHeight / 2);

        clear();
        background(255);

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
        // Draw the label etches
        fill(0);
        noStroke();
        textSize(7 / scaleValue);
        for (let etch of this.etchList) {
            text(etch.text, etch.x, etch.y);
        }

        pop();
    }

    generateDXF() {
        // Generates a DXF file for laser cutting
        //  - Three separate layers:
        //    - 'Sheet Outlines' for sheet boundaries(this.sheetOutline)
        //    - 'Cuts' for board and joint cutouts (this.cutList)
        //    - 'Labels' for board labels(this.etchList)
        //  - Kerf adjustment is subtracted from each rectangle cut width
        //  - 1 pixel = 1 inch scale
        //  - Flips y-axis to correct p5.js coordinates to DXF coordinates
        const dxf = new DXFWriter();
        dxf.setUnits('Inches');
        // Create layers
        dxf.addLayer('Sheet Outlines', DXFWriter.ACI.GREEN, 'CONTINUOUS');
        dxf.addLayer('Cuts', DXFWriter.ACI.RED, 'CONTINUOUS');
        dxf.addLayer('Labels', DXFWriter.ACI.BLUE, 'CONTINUOUS');
        // Add elements
        this.populateOutlineLayer(dxf);
        this.populateCutLayer(dxf);
        this.populateEtchLayer(dxf);
        // return dxf string
        return dxf.toDxfString();
    }

    populateOutlineLayer(dxf) {
        dxf.setActiveLayer('Sheet Outlines');
        for (let sheet of this.sheetOutline) {
            const y1 = this.totalHeight - sheet.y;
            const y2 = this.totalHeight - (sheet.y + sheet.h);
            dxf.drawRect(sheet.x, y1, sheet.x + sheet.w, y2); // x, y, width, height
        }
    }

    populateCutLayer(dxf) {
        dxf.setActiveLayer('Cuts');
        for (let cut of this.cutList) {
            const y1 = this.totalHeight - cut.y;
            const y2 = this.totalHeight - (cut.y + cut.h);
            dxf.drawRect(cut.x, y1, cut.x + cut.w - this.kerf, y2); // x, y, width, height
        }
    }

    populateEtchLayer(dxf) {
        dxf.setActiveLayer('Labels');
        for (let label of this.etchList) {
            const text = String(label.text);
            const x = Number(label.x);
            const y = this.totalHeight - Number(label.y);

            dxf.drawText(x, y, this.fontSize, 0, text); // x, y, height, rotation, text
        }
    }

    setupSheets() {
        // find how many rows of boards can fit on a sheet based on depth
        this.sheets = [];
        let numRows = Math.floor(this.sheetHeight / (this.caseDepth + (this.gap * 1.5)));

        this.sheets = Array.from({ length: this.numSheets }, () => Array(numRows).fill(0))
        this.totalHeight = this.sheetHeight * this.numSheets;
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
        return [null, null];
    }
}