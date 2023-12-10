class CaseExport {
    // makes labels
    // makes svg
    constructor() {
        // in inches
        this.bedWidth = 600;
        this.bedHeight = 400; // 28
        this.pixelRes = 10; // pixels per inch
        this.graphic = createGraphics(this.bedWidth * this.pixelRes, this.bedHeight * this.pixelRes);
        this.maxDepth = 0;
        this.boardThickness = 0.25;
        this.cutWidth = this.boardThickness;
        this.boardLengthAdjust = this.boardThickness;
        this.lengthMod = 2; // cells are 0.5 inches, so multiply by 2 to get length in inches
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

    layoutRects() {
        this.generateRects(shapeCase.horizontalBoards, 0);
        this.generateRects(shapeCase.verticalBoards, 340);
    }

    generateRects(_boards, _LBuffer) {
        // use graphicsBuffer to draw the rectangles
        let rectHeight = this.maxDepth;
        let rectTopLeftX = 30 + _LBuffer;
        let rectTopLeftY = 10;
        let endJointX = 25 + _LBuffer;

        //== Print Boards ==//
        // sort the boards by length
        _boards.sort((a, b) => b.getLength() - a.getLength());
        for (let i = 0; i < _boards.length; i++) {
            let currBoard = _boards[i];
            let rectWidth = (currBoard.getLength() / this.lengthMod) + (this.boardLengthAdjust * this.pixelRes);
            this.graphic.noFill();
            this.graphic.strokeWeight(1);
            this.graphic.rect(rectTopLeftX, rectTopLeftY, rectWidth * this.pixelRes, rectHeight * this.pixelRes);

            // == Points of Interest == //
            // print end joint type label
            this.graphic.textSize(14);
            this.graphic.textAlign(RIGHT, CENTER);
            this.graphic.fill(0);

            let startType = currBoard.poi.endJoints[0];
            let endType = currBoard.poi.endJoints[1];
            this.graphic.text(startType, endJointX, rectTopLeftY + (rectHeight * this.pixelRes) / 2);
            this.graphic.text(endType, endJointX + (rectWidth * this.pixelRes) + 30, rectTopLeftY + (rectHeight * this.pixelRes) / 2);

            this.buildJoinery(startType, rectTopLeftX, rectTopLeftY);
            this.buildJoinery(endType, rectTopLeftX + (rectWidth * this.pixelRes) - (this.cutWidth * this.pixelRes), rectTopLeftY);

            // t-joint slots
            currBoard.poi.tJoints.forEach((tJoint) => {
                this.graphic.noFill();
                // divide by 2 because cells are 0.5 inches and T-Joints are number of cells
                let tJointX = rectTopLeftX + ((tJoint / this.lengthMod) * this.pixelRes);
                tJointX += (this.cutWidth * this.pixelRes) / 2; // center the slot
                let tJointY = rectTopLeftY + (1 * this.pixelRes);
                let tJoints = [[tJointX, tJointY], [tJointX, tJointY + (2 * this.pixelRes)]];
                let slotHeight = 1;
                for (let i = 0; i < tJoints.length; i++) {
                    this.graphic.rect(tJoints[i][0], tJoints[i][1], this.cutWidth * this.pixelRes, slotHeight * this.pixelRes);
                }
            });

            // updates y position for the next rectangle
            rectTopLeftY += rectHeight * this.pixelRes + 10;
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