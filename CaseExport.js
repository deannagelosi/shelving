class CaseExport {
    // makes rectangles
    // makes joinery
    // makes labels
    // makes svg
    // lays out boards
    constructor() {
        // in inches
        this.bedWidth = 400;
        this.bedHeight = 400; // 28
        this.pixelRes = 10; // pixels per inch
        this.graphic = createGraphics(this.bedWidth * this.pixelRes, this.bedHeight * this.pixelRes);
        this.maxDepth = 0;
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

    calcPOI() { }

    layoutRects() {
        // use graphicsBuffer to draw the rectangles
        let rectTopLeftX = 30;
        let rectTopLeftY = 10;
        let rectHeight = this.maxDepth;
        let endJointX = 25;
        //== Horizontal Boards ==//
        // sort the boards by length
        shapeCase.horizontalBoards.sort((a, b) => b.getLength() - a.getLength());
        for (let i = 0; i < shapeCase.horizontalBoards.length; i++) {
            let currBoard = shapeCase.horizontalBoards[i];
            let rectWidth = currBoard.getLength();
            this.graphic.noFill();
            this.graphic.rect(rectTopLeftX, rectTopLeftY, rectWidth * this.pixelRes, rectHeight * this.pixelRes);

            // == Points of Interest == //
            // print end joint type on top of rectangles
            let startType = currBoard.poi.endJoints[0];
            let endType = currBoard.poi.endJoints[1];

            // display the shape titles
            this.graphic.textSize(14);
            this.graphic.textAlign(RIGHT, CENTER);
            this.graphic.fill(0);

            this.graphic.text(startType, endJointX, rectTopLeftY + (rectHeight * this.pixelRes) / 2);
            this.graphic.text(endType, (endJointX * 2.25) + (rectWidth * this.pixelRes), rectTopLeftY + (rectHeight * this.pixelRes) / 2);

            // updates y position for the next rectangle
            rectTopLeftY += rectHeight * this.pixelRes + 10;
        }

        //== Vertical Boards ==//
        rectTopLeftX = 370;
        rectTopLeftY = 10;
        endJointX = 345;
        shapeCase.verticalBoards.sort((a, b) => b.getLength() - a.getLength()); // sort the boards by length
        for (let i = 0; i < shapeCase.verticalBoards.length; i++) {
            let currBoard = shapeCase.verticalBoards[i];
            let rectWidth = currBoard.getLength();
            this.graphic.noFill();
            this.graphic.rect(rectTopLeftX, rectTopLeftY, rectWidth * this.pixelRes, rectHeight * this.pixelRes);

            // == Points of Interest == //
            // print end joint type on top of rectangles
            let startType = currBoard.poi.endJoints[0];
            let endType = currBoard.poi.endJoints[1];

            // display the shape titles
            this.graphic.textSize(14);
            this.graphic.textAlign(LEFT, CENTER);
            this.graphic.fill(0);

            this.graphic.text(startType, endJointX, rectTopLeftY + (rectHeight * this.pixelRes) / 2);
            this.graphic.text(endType, (endJointX * 2) + (rectWidth * this.pixelRes) - 10, rectTopLeftY + (rectHeight * this.pixelRes) / 2);

            // updates y position for the next rectangle
            rectTopLeftY += rectHeight * this.pixelRes + 10;
        }


    }

    layoutPOI() { }
    displayExport() {
        // display the graphics buffer in browser
        background(255);
        image(this.graphic, 0, 0);
    }
}