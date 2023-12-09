class CaseExport {
    // makes rectangles
    // makes joinery
    // makes labels
    // makes svg
    // lays out boards
    constructor() {
        // in inches
        this.bedWidth = 40;
        this.bedHeight = 400; // 28
        this.pixelRes = 20; // pixels per inch
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

    calcPOI() {}

    layoutRects() {
        // use graphicsBuffer to draw the rectangles
        let topLeftX = 10;
        let topLeftY = 10;
        let rectHeight = this.maxDepth;
        
        // sort the boards by length
        shapeCase.horizontalBoards.sort((a, b) => b.getLength() - a.getLength());

        for (let i = 0; i < shapeCase.horizontalBoards.length; i++) {
            let rectWidth = shapeCase.horizontalBoards[i].getLength();
            this.graphic.noFill();
            this.graphic.rect(topLeftX, topLeftY, rectWidth * this.pixelRes, rectHeight * this.pixelRes);

            topLeftY += rectHeight * this.pixelRes + 10;
        }
    }

    layoutPOI() {}
    displayExport() {
        // display the graphics buffer in browser
        background(255);
        image(this.graphic, 0, 0);
    }
}