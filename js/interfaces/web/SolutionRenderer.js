class SolutionRenderer {
    constructor() {
        // renderer class for Solution visualization
        // all render methods use only parameters, no global state
    }

    renderLayout(solution, canvas, config) {
        // main rendering method that calls all others
        // renders the layout, shapes, and scores on the canvas
        // solution: Solution instance with layout, shapes, etc.
        // canvas: object with height, width, and drawing context
        // config: object with devMode, detailView, squareSize, buffer, padding values

        let colors = {
            lineColor: "rgb(198, 198, 197)",
            bkrdColor: "rgb(229, 229, 229)",
            bufferColor: "rgba(200,200,200, 0.5)",
            lowResShapeColor: "rgb(229, 229, 229)",
            highResShapeColor: "rgba(102,102,102, 0.9)",
            collisionColor: "rgba(135, 160, 103, 0.5)",
            textColor: "rgb(255,255,255)",
            numColor: "rgb(102,102,102)"
        };

        if (config.devMode) {
            colors.lineColor = 0;
            colors.bkrdColor = 255;
            colors.bufferColor = "rgb(255, 192, 203)";
            colors.lowResShapeColor = "rgba(140,140,140, 0.5)";
            colors.collisionColor = "rgba(255, 0, 0, 0.5)";
        }

        // draw layout from bottom layer up
        this.renderGridSquares(solution.layout, canvas, config, colors);

        // show grid numbers
        if (config.detailView || config.devMode) {
            this.renderGridNumbers(solution.layout, canvas, config, colors);
        }

        // display buffer squares
        if (config.detailView || config.devMode) {
            this.renderBuffer(solution.layout, canvas, config, colors);
        }

        // display low res shape squares
        if (config.devMode) {
            this.renderLowResShapes(solution.layout, canvas, config, colors);
        }

        // display high res shapes
        this.renderHighResShapes(solution.shapes, canvas, config, colors);

        // display shape titles
        if (config.detailView || config.devMode) {
            this.renderTitles(solution.shapes, canvas, config, colors);
        }

        // display collision squares
        this.renderCollision(solution.layout, canvas, config, colors);

        // display selection highlight (on top of everything else)
        this.renderShapeSelection(solution.shapes, canvas, config);
    }

    renderGridSquares(layout, canvas, config, colors) {
        // draw grid squares with background color
        stroke(colors.lineColor);
        strokeWeight(0.75);
        fill(colors.bkrdColor);

        for (let y = 0; y < layout.length; y++) {
            for (let x = 0; x < layout[y].length; x++) {
                let rectX = (x * config.squareSize) + config.buffer + config.xPadding;
                let rectY = ((canvas.height - config.yPadding) - config.squareSize - config.buffer) - (y * config.squareSize);
                rect(rectX, rectY, config.squareSize, config.squareSize);
            }
        }
    }

    renderGridNumbers(layout, canvas, config, colors) {
        textAlign(CENTER, CENTER);
        let txtXOffset = config.squareSize / 2.5;
        let txtYOffset = config.squareSize / 2.5;
        let txtSize = config.squareSize / 2.5;
        textSize(txtSize);
        noStroke();

        let designHeight = layout.length;
        let designWidth = layout[0].length;

        for (let x = 0; x < designWidth; x++) {
            // display column number
            fill(config.devMode && x % 5 === 0 ? "pink" : colors.numColor);
            let textX = (x * config.squareSize) + config.buffer + config.xPadding + txtXOffset;
            let textY = ((canvas.height - config.yPadding) - config.buffer) + txtYOffset;
            text(x + 1, textX, textY);

            for (let y = 0; y < designHeight; y++) {
                // display row number
                fill(config.devMode && y % 5 === 0 ? "pink" : colors.numColor);
                let textX = config.xPadding + txtXOffset;
                let textY = ((canvas.height - config.yPadding) - config.squareSize - config.buffer) - (y * config.squareSize) + txtYOffset;
                text(y + 1, textX, textY);
            }
        }
    }

    renderBuffer(layout, canvas, config, colors) {
        stroke(colors.lineColor);
        strokeWeight(0.75);
        fill(colors.bufferColor);

        for (let y = 0; y < layout.length; y++) {
            for (let x = 0; x < layout[y].length; x++) {
                // Only draw buffer squares
                if (layout[y][x].shapes.length > 0) {
                    if (layout[y][x].isBuffer.some(s => s === true)) {
                        // buffer makes room for line numbers in dev mode
                        // padding centers the solution in the canvas
                        let rectX = (x * config.squareSize) + config.buffer + config.xPadding;
                        let rectY = ((canvas.height - config.yPadding) - config.squareSize - config.buffer) - (y * config.squareSize); // draw from bottom up
                        rect(rectX, rectY, config.squareSize, config.squareSize);
                    }
                }
            }
        }
    }

    renderLowResShapes(layout, canvas, config, colors) {
        noStroke();
        fill(colors.lowResShapeColor);

        for (let y = 0; y < layout.length; y++) {
            for (let x = 0; x < layout[y].length; x++) {
                // Only draw low res shape squares
                if (layout[y][x].shapes.length > 0) {
                    if (layout[y][x].isShape.some(s => s === true)) {
                        // buffer makes room for line numbers in dev mode
                        // padding centers the solution in the canvas
                        let rectX = (x * config.squareSize) + config.buffer + config.xPadding;
                        let rectY = ((canvas.height - config.yPadding) - config.squareSize - config.buffer) - (y * config.squareSize); // draw from bottom up
                        rect(rectX + (config.squareSize / 2), rectY, config.squareSize, config.squareSize);
                    }
                }
            }
        }
    }

    renderTitles(shapes, canvas, config, colors) {
        // show shape titles
        noStroke();
        for (let i = 0; i < shapes.length; i++) {
            let shape = shapes[i];
            let startX = shape.posX;
            let startY = shape.posY;
            let smallSquare = config.squareSize / 4;

            let shapeWidth = shape.data.highResShape[0].length * smallSquare;
            let shapeHeight = shape.data.highResShape.length * smallSquare;
            let titleX = (startX * config.squareSize) + (config.squareSize / 2) + config.buffer + config.xPadding + (shapeWidth / 2);
            let titleY = ((canvas.height - config.yPadding) - config.buffer) - (startY * config.squareSize) - (shapeHeight / 2);

            fill(colors.textColor);
            textAlign(CENTER, CENTER);
            textSize(min(config.squareSize / 2, 14));
            text(shape.data.title, titleX, titleY);
        }
    }

    renderHighResShapes(shapes, canvas, config, colors) {
        // show high resolution shapes
        noStroke();
        fill(colors.highResShapeColor);

        for (let i = 0; i < shapes.length; i++) {
            let startX = shapes[i].posX;
            let startY = shapes[i].posY;
            let smallSquare = config.squareSize / 4;

            // draw rectangle for each true square in the shape grid
            for (let y = 0; y < shapes[i].data.highResShape.length; y++) {
                for (let x = 0; x < shapes[i].data.highResShape[y].length; x++) {
                    // only draw high res shape squares
                    if (shapes[i].data.highResShape[y][x]) {
                        // find its position on the canvas
                        let rectX = (startX * config.squareSize) + (x * smallSquare) + config.buffer + config.xPadding;
                        let yOffset = ((canvas.height - config.yPadding) - smallSquare - config.buffer);
                        let yStart = (startY * config.squareSize);
                        let yRect = (y * smallSquare);
                        let rectY = yOffset - yStart - yRect;
                        rect(rectX + (config.squareSize / 2), rectY, smallSquare, smallSquare);
                    }
                }
            }
        }
    }

    renderShapeSelection(shapes, canvas, config) {
        // render blue tint overlay for selected shape
        if (appState.selectedShapeId === null) {
            return;
        }

        // find the selected shape
        const selectedShape = shapes.find(shape => shape.id === appState.selectedShapeId);
        if (!selectedShape) {
            return;
        }

        noStroke();
        fill(0, 100, 255, 100); // semi-transparent blue

        let startX = selectedShape.posX;
        let startY = selectedShape.posY;
        let smallSquare = config.squareSize / 4;

        // draw blue overlay for each true square in the selected shape
        for (let y = 0; y < selectedShape.data.highResShape.length; y++) {
            for (let x = 0; x < selectedShape.data.highResShape[y].length; x++) {
                // only draw overlay on high res shape squares
                if (selectedShape.data.highResShape[y][x]) {
                    // find its position on the canvas (same calculation as renderHighResShapes)
                    let rectX = (startX * config.squareSize) + (x * smallSquare) + config.buffer + config.xPadding;
                    let yOffset = ((canvas.height - config.yPadding) - smallSquare - config.buffer);
                    let yStart = (startY * config.squareSize);
                    let yRect = (y * smallSquare);
                    let rectY = yOffset - yStart - yRect;
                    rect(rectX + (config.squareSize / 2), rectY, smallSquare, smallSquare);
                }
            }
        }
    }

    renderCollision(layout, canvas, config, colors) {
        noStroke();
        fill(colors.collisionColor);

        for (let y = 0; y < layout.length; y++) {
            for (let x = 0; x < layout[y].length; x++) {
                // only draw collision squares
                if (layout[y][x].shapes.length > 1) {
                    // collision. rules:
                    // - if dev mode, any overlapping buffer squares is a collision
                    // - if not dev mode, any overlapping shape squares is a collision
                    let isCollision = false;
                    if (config.devMode && layout[y][x].isBuffer.filter(s => s === true).length >= 2) {
                        // 2 or more buffers overlapping
                        isCollision = true;
                    } else if (layout[y][x].isShape.filter(s => s === true).length >= 2) {
                        // 2 or more shapes overlapping
                        isCollision = true;
                    }

                    if (isCollision) {
                        // buffer makes room for line numbers in dev mode
                        // padding centers the solution in the canvas
                        let rectX = (x * config.squareSize) + config.buffer + config.xPadding;
                        let rectY = ((canvas.height - config.yPadding) - config.squareSize - config.buffer) - (y * config.squareSize); // draw from bottom up
                        rect(rectX, rectY, config.squareSize, config.squareSize);
                    }
                }
            }
        }
    }

    renderScores(layout, canvas, config) {
        if (config.devMode) {
            // display anneal scores on grid
            fill(100);
            stroke(50);
            strokeWeight(0.25);
            textAlign(CENTER, CENTER);
            let txtXOffset = config.squareSize / 2;
            let txtYOffset = config.squareSize / 2;
            let txtSize = config.squareSize / 1.5;
            textSize(txtSize);

            let designHeight = layout.length;
            let designWidth = layout[0].length;
            for (let x = 0; x < designWidth; x++) {
                for (let y = 0; y < designHeight; y++) {
                    // display anneal score if square is empty of shapes
                    if (layout[y][x].annealScore > 0) {
                        // find position for score or shape title, finding y from bottom up
                        let rectX = (x * config.squareSize) + config.buffer + config.xPadding + txtXOffset;
                        let rectY = ((canvas.height - config.yPadding) - config.squareSize - config.buffer) - (y * config.squareSize) + txtYOffset;
                        text(layout[y][x].annealScore, rectX, rectY);
                    }
                }
            }
        }
    }
} 