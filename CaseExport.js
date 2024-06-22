// todo: reference, delete later

class CaseExport {
    // makes labels
    // makes svg
    constructor() {
        // in inches
        this.bedWidth = 40; // 40
        this.bedHeight = 28; // 28
        this.pixelRes = 100; // pixels per inch
        this.graphic = createGraphics(45 * this.pixelRes, 60 * this.pixelRes, SVG);
        this.maxDepth = 0;
        this.boardThickness = 0.25;
        this.vertKerf = 0.02; // kerf for vertical cuts
        this.cutWidth = this.boardThickness - this.vertKerf;
        this.boardLengthAdjust = this.boardThickness;
        this.lengthMod = 2; // layout squares are 0.5 inches, so multiply by 2 to get length in inches
        this.printGap = 0.25 * this.pixelRes; // gap between printed boards

        this.bedRows = [0, 0, 0, 0, 0]; // 5 rows
        this.beds = [[...this.bedRows], [...this.bedRows]];
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

    printBed() {
        // print the bed
        this.graphic.noFill();
        this.graphic.strokeWeight(1);

        // first bed
        this.graphic.rect(0, 0, this.bedWidth * this.pixelRes, this.bedHeight * this.pixelRes);
        // second bed if used
        if (this.beds[1][0] > 0) {
            this.graphic.rect(0, (this.bedHeight * this.pixelRes), this.bedWidth * this.pixelRes, this.bedHeight * this.pixelRes);
        }
    }

    printAlignment() {
        // == Print Alignment Indicators == //
        let align = this.printGap * (3 / 4);
        this.graphic.strokeWeight(0.5);
        this.graphic.noFill();
        this.graphic.rect(0, 0, align, align);
        this.graphic.rect((this.bedWidth * this.pixelRes) - align, 0, align, align);
    }

    layoutRects() {
        this.printAlignment();
        this.generateRects(shapeCase.horizontalBoards);
        this.generateRects(shapeCase.verticalBoards);
    }

    generateRects(_boards) {
        // use graphicsBuffer to draw the rectangles
        let rectHeight = this.maxDepth;

        //== Print Boards ==//
        // sort the boards by length
        _boards.sort((a, b) => b.getLength() - a.getLength());
        for (let i = 0; i < _boards.length; i++) {
            let currBoard = _boards[i];
            let rectWidth = (currBoard.getLength() / this.lengthMod) + (this.boardLengthAdjust);
            this.graphic.noFill();
            this.graphic.strokeWeight(1);

            // find a space for the rectangle in the print bed rows
            let bedLocation = this.findBedSpace(rectWidth); // [bed, row]
            let bed = bedLocation[0];
            let row = bedLocation[1];

            // calc the top left corner location of the rectangle
            let rectTopLeftX = (this.beds[bed][row] * this.pixelRes) + this.printGap
            let bedY = (bed * (this.bedHeight * this.pixelRes));
            let rowY = this.printGap + (row * ((rectHeight * this.pixelRes) + this.printGap));
            let rectTopLeftY = bedY + rowY;

            // print the rectangle
            this.graphic.rect(rectTopLeftX, rectTopLeftY, rectWidth * this.pixelRes, rectHeight * this.pixelRes);
            // mark the bed row space as used
            this.beds[bed][row] += rectWidth + (this.printGap / this.pixelRes);

            // == Points of Interest == //
            // print end joints and t-joints
            let startType = currBoard.poi.endJoints[0];
            let endType = currBoard.poi.endJoints[1];

            // joinery on the start side of the board
            this.buildJoinery(startType, rectTopLeftX, rectTopLeftY);
            // joinery on the end side of the board
            this.buildJoinery(endType, rectTopLeftX + (rectWidth * this.pixelRes) - (this.cutWidth * this.pixelRes), rectTopLeftY);

            // t-joint slots
            currBoard.poi.tJoints.forEach((tJoint) => {
                this.graphic.noFill();
                let tJointX = rectTopLeftX + ((tJoint / this.lengthMod) * this.pixelRes);
                // tJointX += (this.cutWidth * this.pixelRes) / 2; // center the slot
                let tJointY = rectTopLeftY + (1 * this.pixelRes);
                let tJoints = [[tJointX, tJointY], [tJointX, tJointY + (2 * this.pixelRes)]];
                let slotHeight = 1;
                for (let i = 0; i < tJoints.length; i++) {
                    this.graphic.rect(tJoints[i][0], tJoints[i][1], this.cutWidth * this.pixelRes, slotHeight * this.pixelRes);
                }
            });

            // print board label name
            this.graphic.textSize((1 / 6) * this.pixelRes);
            this.graphic.textAlign(LEFT, CENTER);
            this.graphic.fill(0);
            let boardLabel = currBoard.boardLabel;
            let boardLabelX = rectTopLeftX + (0.5 * this.pixelRes);
            let boardLabelY = rectTopLeftY + (0.5 * this.pixelRes);
            this.graphic.text(boardLabel, boardLabelX, boardLabelY);
        }
    }

    findBedSpace(_rectWidth) {
        // calc space in inches, not at image pixelRes
        for (let bed = 0; bed < this.beds.length; bed++) {
            for (let row = 0; row < this.beds[bed].length; row++) {

                let rowOccupiedWidth = this.beds[bed][row];
                let bedWidth = this.bedWidth;
                let rowRemainingWidth = bedWidth - rowOccupiedWidth;
                let spaceNeeded = _rectWidth + ((this.printGap / this.pixelRes) * 2);

                if (rowRemainingWidth >= spaceNeeded) {
                    return [bed, row];
                }
            }
        }
    }

    buildJoinery(_type, _rectX, _rectY) {
        // print the joinery
        if (_type == "slot") {
            this.graphic.noFill();
            let firstPin = [_rectX, _rectY + (1 * this.pixelRes)];
            let secondPin = [_rectX, _rectY + (3 * this.pixelRes)];
            let pins = [firstPin, secondPin];
            let pinHeight = 1;
            for (let i = 0; i < pins.length; i++) {
                this.graphic.rect(pins[i][0], pins[i][1], this.cutWidth * this.pixelRes, pinHeight * this.pixelRes);
            }
        } else if (_type == "pin") {
            this.graphic.noFill();
            let firstSlot = [_rectX, _rectY];
            let secondSlot = [_rectX, _rectY + (2 * this.pixelRes)];
            let thirdSlot = [_rectX, _rectY + (4 * this.pixelRes)];
            let slots = [firstSlot, secondSlot, thirdSlot];
            let slotHeight = 1;
            for (let i = 0; i < slots.length; i++) {
                this.graphic.rect(slots[i][0], slots[i][1], this.cutWidth * this.pixelRes, slotHeight * this.pixelRes);
            }
        }
    }

    displayExport() {
        // display the graphics buffer in browser
        background(255);
        image(this.graphic, 0, 0);
    }
}

// function keyPressed() {
//   if (key === 's' || key === 'S') {
//     // build the joints
//     shapeCase.addJoints();

//     // export case as svg
//     let caseExport = new CaseExport();
//     caseExport.calcDepth();
//     caseExport.layoutRects();
//     caseExport.printBed();
//     // caseExport.displayExport()
//     caseExport.graphic.save("caseBoards.svg")
//   }
// }