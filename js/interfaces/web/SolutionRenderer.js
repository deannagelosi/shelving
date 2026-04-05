class SolutionRenderer {
    constructor() {
        // renderer class for Solution visualization
        // all render methods use only parameters, no global state
        this.shapeRenderer = new ShapeRenderer();
    }

    _setupCanvas() {
        // common canvas setup for all rendering methods
        clear();
        background(255);
    }

    renderLayout(solution, config) {
        // main rendering method that calls all others
        // renders the layout, shapes, and scores on the canvas
        // solution: Solution instance with layout, shapes, etc.
        // config: unified config object with canvas dimensions and layout properties

        const isDevMode = config.isDevMode;
        const detailView = config.detailView;

        const colors = RenderConfig.getColors(isDevMode);

        // draw layout from bottom layer up
        this.renderGridSquares(solution.layout, config, colors, solution);

        // show grid numbers
        if (detailView || isDevMode) {
            this.renderGridNumbers(solution.layout, config, colors, solution);
        }

        // display buffer squares
        if (detailView || isDevMode) {
            this.renderBuffer(solution.layout, config, colors);
        }

        // display high res shapes
        this.renderHighResShapes(solution.shapes, config, colors);

        // display high res buffer zones (detail mode only)
        if (detailView || isDevMode) {
            this.renderAllShapeBuffers(solution.shapes, config, colors);
        }

        // display high res grid lines (detail mode only)
        if (detailView || isDevMode) {
            this.renderHighResGrid(solution.layout, config, colors);
        }

        // display shape titles
        if (detailView || isDevMode) {
            this.renderTitles(solution.shapes, config, colors);
        }

        // display collision squares
        this.renderCollision(solution.layout, config, colors);

        // display selection highlight (on top of everything else)
        const selectedShapeId = config.selectedShapeId || null;
        const canvasObj = { height: config.canvasHeight, width: config.canvasWidth };
        this.shapeRenderer.renderShapeSelection(solution.shapes, canvasObj, config, selectedShapeId);

        // display custom perimeter box (on top of everything else)
        if (solution.useCustomPerimeter) {
            this.renderPerimeterBox(solution, config);
        }
    }

    renderGridSquares(layout, config, colors, solution) {
        // draw grid squares with background color
        stroke(colors.lineColor);
        strokeWeight(RenderConfig.getStrokeWeights().gridLine);

        for (let y = 0; y < layout.length; y++) {
            for (let x = 0; x < layout[y].length; x++) {
                // Default to the standard background color
                fill(colors.bkrdColor);

                // If in custom perimeter mode, check if the square is out of bounds
                if (solution && solution.useCustomPerimeter && solution.goalPerimeterGrid) {
                    const { x: goalX, y: goalY, width: goalWidth, height: goalHeight } = solution.goalPerimeterGrid;
                    if (x < goalX || x >= goalX + goalWidth || y < goalY || y >= goalY + goalHeight) {
                        fill(colors.darkenedBkrdColor);
                    }
                }

                let rectX = (x * config.squareSize) + config.buffer + config.xPadding;
                let rectY = ((config.canvasHeight - config.yPadding) - config.squareSize - config.buffer) - (y * config.squareSize);
                rect(rectX, rectY, config.squareSize, config.squareSize);
            }
        }
    }

    renderGridNumbers(layout, config, colors, solution) {
        textAlign(CENTER, CENTER);
        const textSizes = RenderConfig.getTextSizes(config.squareSize);
        textSize(textSizes.gridNumber);
        noStroke();
        fill(colors.numColor);

        let designHeight = layout.length;
        let designWidth = layout[0].length;

        // get minWallLength from solution (defaults to 1.0)
        const minWallLength = solution.minWallLength || 1.0;

        // position text in the buffer zone, offset from the grid edge
        const textOffset = config.buffer * 0.4; // 40% into the buffer zone

        // track the last displayed inch value to avoid duplicates
        let lastDisplayedXInch = -1;

        for (let x = 0; x < designWidth; x++) {
            // calculate inch value at the right edge of this grid cell
            const inchValue = (x + 1) * minWallLength;

            // only display whole inch values
            if (Math.floor(inchValue) === inchValue && inchValue !== lastDisplayedXInch) {
                lastDisplayedXInch = inchValue;

                // position at the right edge of the grid cell (the gridline)
                let textX = ((x + 1) * config.squareSize) + config.buffer + config.xPadding;
                let textY = ((config.canvasHeight - config.yPadding) - config.buffer) + textOffset;
                text(inchValue, textX, textY);
            }
        }

        // track the last displayed inch value for Y axis
        let lastDisplayedYInch = -1;

        for (let y = 0; y < designHeight; y++) {
            // calculate inch value at the top edge of this grid cell
            const inchValue = (y + 1) * minWallLength;

            // only display whole inch values
            if (Math.floor(inchValue) === inchValue && inchValue !== lastDisplayedYInch) {
                lastDisplayedYInch = inchValue;

                // position at the top edge of the grid cell (the gridline)
                let textX = config.xPadding + config.buffer - textOffset;
                let textY = ((config.canvasHeight - config.yPadding) - config.buffer) - ((y + 1) * config.squareSize);
                text(inchValue, textX, textY);
            }
        }
    }

    renderBuffer(layout, config, colors) {
        stroke(colors.lineColor);
        strokeWeight(RenderConfig.getStrokeWeights().gridLine);
        fill(colors.lowResBufferColor);

        for (let y = 0; y < layout.length; y++) {
            for (let x = 0; x < layout[y].length; x++) {
                // Only draw buffer squares
                if (layout[y][x].shapes.length > 0) {
                    if (layout[y][x].isBuffer.some(s => s === true)) {
                        // buffer makes room for line numbers in dev mode
                        // padding centers the solution in the canvas
                        let rectX = (x * config.squareSize) + config.buffer + config.xPadding;
                        let rectY = ((config.canvasHeight - config.yPadding) - config.squareSize - config.buffer) - (y * config.squareSize); // draw from bottom up
                        rect(rectX, rectY, config.squareSize, config.squareSize);
                    }
                }
            }
        }
    }

    renderTitles(shapes, config, colors) {
        // show shape titles
        noStroke();
        for (let i = 0; i < shapes.length; i++) {
            let shape = shapes[i];
            let startX = shape.posX;
            let startY = shape.posY;
            let minWallLength = config.minWallLength || 1.0;
            let smallSquare = config.squareSize / RenderConfig.getScaleFactor(minWallLength);

            let shapeWidth = shape.data.highResShape[0].length * smallSquare;
            let shapeHeight = shape.data.highResShape.length * smallSquare;
            let titleX = (startX * config.squareSize) + (config.squareSize / 2) + config.buffer + config.xPadding + (shapeWidth / 2);
            let titleY = ((config.canvasHeight - config.yPadding) - config.buffer) - (startY * config.squareSize) - (shapeHeight / 2);

            fill(colors.textColor);
            textAlign(CENTER, CENTER);
            const textSizes = RenderConfig.getTextSizes(config.squareSize);
            textSize(textSizes.shapeTitle);
            text(shape.data.title, titleX, titleY);
        }
    }

    renderHighResShapes(shapes, config, colors) {
        // show high resolution shapes using buffer array filtering
        noStroke();
        fill(colors.highResShapeColor);

        for (let i = 0; i < shapes.length; i++) {
            const shape = shapes[i];

            // Skip shapes without buffer data
            if (!shape.data.highResBufferShape || shape.data.highResBufferShape.length === 0) {
                continue;
            }

            let startX = shape.posX;
            let startY = shape.posY;
            let minWallLength = config.minWallLength || 1.0;
            let smallSquare = config.squareSize / RenderConfig.getScaleFactor(minWallLength);

            // Draw rectangle for each original shape square in the buffer array
            for (let y = 0; y < shape.data.highResBufferShape.length; y++) {
                for (let x = 0; x < shape.data.highResBufferShape[y].length; x++) {
                    const square = shape.data.highResBufferShape[y][x];

                    // Only render original shape squares (not buffer expansion)
                    if (square.occupied && square.isOriginalShape) {
                        // Use direct buffer coordinates (no alignment needed)
                        let rectX = (startX * config.squareSize) + (x * smallSquare) + config.buffer + config.xPadding;
                        let yOffset = ((config.canvasHeight - config.yPadding) - smallSquare - config.buffer);
                        let yStart = (startY * config.squareSize);
                        let yRect = (y * smallSquare);
                        let rectY = yOffset - yStart - yRect;
                        rect(rectX, rectY, smallSquare, smallSquare);
                    }
                }
            }
        }
    }

    renderAllShapeBuffers(shapes, config, colors) {
        // Render high-res buffer zones for all shapes in the solution
        // Uses the same coordinate calculation as renderHighResShapes for perfect alignment

        for (let i = 0; i < shapes.length; i++) {
            const shape = shapes[i];

            // Skip shapes without buffer data
            if (!shape.data.highResBufferShape || shape.data.highResBufferShape.length === 0) {
                continue;
            }

            // Get configuration values (same as renderHighResShapes)
            let startX = shape.posX;
            let startY = shape.posY;
            let minWallLength = config.minWallLength || 1.0;
            let smallSquare = config.squareSize / RenderConfig.getScaleFactor(minWallLength);

            // Identify perimeter squares for proper coloring
            Shape.identifyPerimeterSquares(shape.data.highResBufferShape);

            fill(colors.highResBufferColor);
            noStroke();

            // Render buffer squares using the same coordinate pattern as high-res shapes
            for (let y = 0; y < shape.data.highResBufferShape.length; y++) {
                for (let x = 0; x < shape.data.highResBufferShape[y].length; x++) {
                    const square = shape.data.highResBufferShape[y][x];

                    // Only render buffer squares (not original shape squares)
                    if (!square.occupied || square.isOriginalShape) {
                        continue;
                    }

                    // Use the exact same coordinate calculation as renderHighResShapes
                    let rectX = (startX * config.squareSize) + (x * smallSquare) + config.buffer + config.xPadding;
                    let yOffset = ((config.canvasHeight - config.yPadding) - smallSquare - config.buffer);
                    let yStart = (startY * config.squareSize);
                    let yRect = (y * smallSquare);
                    let rectY = yOffset - yStart - yRect;
                    rect(rectX, rectY, smallSquare, smallSquare);
                }
            }
        }
    }

    renderCollision(layout, config, colors) {
        noStroke();
        fill(colors.collisionColor);

        const isDevMode = config.isDevMode;
        const detailView = config.detailView;

        for (let y = 0; y < layout.length; y++) {
            for (let x = 0; x < layout[y].length; x++) {
                let shouldHighlight = false;

                // Check for out-of-bounds cells (always highlight these)
                if (layout[y][x].isOutOfBounds) {
                    shouldHighlight = true;
                }

                // Check for collision cells (overlapping shapes)
                if (layout[y][x].shapes.length > 1) {
                    // collision. rules:
                    // - if dev mode OR detail view, any overlapping buffer squares is a collision
                    // - always show overlapping shape squares as collisions
                    if ((isDevMode || detailView) && layout[y][x].isBuffer.filter(s => s === true).length >= 2) {
                        // 2 or more buffers overlapping
                        shouldHighlight = true;
                    } else if (layout[y][x].isShape.filter(s => s === true).length >= 2) {
                        // 2 or more shapes overlapping
                        shouldHighlight = true;
                    }
                }

                if (shouldHighlight) {
                    // buffer makes room for line numbers in dev mode
                    // padding centers the solution in the canvas
                    let rectX = (x * config.squareSize) + config.buffer + config.xPadding;
                    let rectY = ((config.canvasHeight - config.yPadding) - config.squareSize - config.buffer) - (y * config.squareSize); // draw from bottom up
                    rect(rectX, rectY, config.squareSize, config.squareSize);
                }
            }
        }
    }

    renderScores(layout, config) {
        const isDevMode = config.isDevMode;

        if (isDevMode) {
            // display anneal scores on grid
            fill(100);
            stroke(50);
            strokeWeight(0.25);
            textAlign(CENTER, CENTER);
            let txtXOffset = config.squareSize / 2;
            let txtYOffset = config.squareSize / 2;
            textSize(config.squareSize / 1.5); // Score text size

            let designHeight = layout.length;
            let designWidth = layout[0].length;
            for (let x = 0; x < designWidth; x++) {
                for (let y = 0; y < designHeight; y++) {
                    // display anneal score if square is empty of shapes
                    if (layout[y][x].annealScore > 0) {
                        // find position for score or shape title, finding y from bottom up
                        let rectX = (x * config.squareSize) + config.buffer + config.xPadding + txtXOffset;
                        let rectY = ((config.canvasHeight - config.yPadding) - config.squareSize - config.buffer) - (y * config.squareSize) + txtYOffset;
                        text(layout[y][x].annealScore, rectX, rectY);
                    }
                }
            }
        }
    }

    renderPerimeterBox(solution, config) {
        if (!solution.goalPerimeterGrid) return;

        const { x, y, width, height } = solution.goalPerimeterGrid;
        const { squareSize, buffer, xPadding, yPadding } = config;

        // Calculate the coordinates and dimensions on the canvas
        const rectX = (x * squareSize) + buffer + xPadding;
        const rectY = ((config.canvasHeight - yPadding) - (y + height) * squareSize) - buffer;
        const rectWidth = width * squareSize;
        const rectHeight = height * squareSize;

        // Draw the rectangle with enhanced visibility
        noFill();
        stroke(0, 100, 255); // Bright blue color for the perimeter
        strokeWeight(3); // Thicker stroke for better visibility
        rect(rectX, rectY, rectWidth, rectHeight);
    }

    renderBlankGrid(config, gridSize = 20) {
        // create empty solution and display grid only
        // this method encapsulates the creation and rendering of a blank grid

        this._setupCanvas();

        let emptySolution = new Solution();
        emptySolution.makeBlankLayout(gridSize);

        const colors = RenderConfig.getColors();

        // render the grid using unified config
        this.renderGridSquares(emptySolution.layout, config, colors);

        return emptySolution;
    }

    renderSolution(solution, config, showScores = false) {
        // unified method for rendering solutions with optional score display
        // replaces both renderSolutionProgress and renderCompleteSolution

        this._setupCanvas();

        // Render the basic solution layout
        this.renderLayout(solution, config);

        // Optionally show annealing scores (for progress display)
        if (showScores) {
            this.renderScores(solution.layout, config);
        }
    }


    renderWalls(solution, config, wallRenderers, wallRenderData) {
        // cellular-organic wall generation and rendering

        if (!wallRenderers || !wallRenderers.cellularRenderer) {
            console.error('[SolutionRenderer] CellularRenderer not available');
            return null;
        }

        const currCellular = new Cellular(solution);

        const isDevMode = config.isDevMode;
        const currentNumGrow = config.numGrow || 0;

        if (isDevMode) {
            // Debug mode: manual step-by-step growth
            currCellular.createTerrain();
            currCellular.calcPathValues();
            currCellular.makeInitialCells();

            for (let i = 0; i < currentNumGrow; i++) {
                currCellular.growOnce();
            }
        } else {
            // grow complete cellular structure
            currCellular.growCells();
        }

        // Render cellular wall lines
        const cellLines = currCellular.getCellRenderLines();
        const canvasObj = { height: config.canvasHeight, width: config.canvasWidth };
        wallRenderers.cellularRenderer.renderCellLines(cellLines, canvasObj, config);

        // Display cells and terrain in dev mode
        if (isDevMode) {
            wallRenderers.cellularRenderer.renderTerrain(solution.layout, canvasObj, { ...config, maxTerrain: currCellular.maxTerrain });
            wallRenderers.cellularRenderer.renderCells(currCellular.cellSpace, canvasObj, config);
        }

        // Store the cellular instance for potential state use
        wallRenderData.currCellular = currCellular;

        return currCellular;
    }

    calculateLayoutProperties(solution, canvasWidth, canvasHeight) {
        // Delegate to centralized configuration
        return RenderConfig.calculateLayoutProperties(solution, canvasWidth, canvasHeight);
    }

    renderHighResGrid(layout, config, colors) {
        // draw high-resolution grid lines within each low-res square
        // this shows the subdivision that shapes use for precise positioning

        const minWallLength = config.minWallLength || 1.0;
        const scaleFactor = RenderConfig.getScaleFactor(minWallLength);

        // Set up thin stroke for high-res grid lines
        stroke(colors.lineColor);
        strokeWeight(RenderConfig.getStrokeWeights().highResGrid); // Thinner than main grid lines

        const designHeight = layout.length;
        const designWidth = layout[0].length;

        // Draw vertical high-res grid lines
        for (let x = 0; x < designWidth; x++) {
            for (let subX = 1; subX < scaleFactor; subX++) { // Skip 0 as it's the main grid line
                const xPos = config.xPadding + config.buffer + (x * config.squareSize) + (subX * config.squareSize / scaleFactor);
                const yStart = config.yPadding + config.buffer;
                const yEnd = config.canvasHeight - config.yPadding - config.buffer;
                line(xPos, yStart, xPos, yEnd);
            }
        }

        // Draw horizontal high-res grid lines
        for (let y = 0; y < designHeight; y++) {
            for (let subY = 1; subY < scaleFactor; subY++) { // Skip 0 as it's the main grid line
                const yPos = config.canvasHeight - config.yPadding - config.buffer - (y * config.squareSize) - (subY * config.squareSize / scaleFactor);
                const xStart = config.xPadding + config.buffer;
                const xEnd = config.canvasWidth - config.xPadding - config.buffer;
                line(xStart, yPos, xEnd, yPos);
            }
        }
    }

} 