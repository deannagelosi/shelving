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

        // check for display state (with worker context fallback)
        let isDevMode = (typeof appState !== 'undefined' && appState.display) ? appState.display.devMode : false;
        let detailView = (typeof appState !== 'undefined' && appState.display) ? appState.display.detailView : false;

        const colors = RenderConfig.getColors(isDevMode);

        // draw layout from bottom layer up
        this.renderGridSquares(solution.layout, config, colors, solution);

        // show grid numbers
        if (detailView || isDevMode) {
            this.renderGridNumbers(solution.layout, config, colors);
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
        const selectedShapeId = (typeof appState !== 'undefined' && appState.selectedShapeId) ? appState.selectedShapeId : null;
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

    renderGridNumbers(layout, config, colors) {
        textAlign(CENTER, CENTER);
        const textSizes = RenderConfig.getTextSizes(config.squareSize);
        let txtXOffset = config.squareSize / 2.5;
        let txtYOffset = config.squareSize / 2.5;
        textSize(textSizes.gridNumber);
        noStroke();

        let designHeight = layout.length;
        let designWidth = layout[0].length;

        // check for display state (with worker context fallback)
        let isDevMode = (typeof appState !== 'undefined' && appState.display) ? appState.display.devMode : false;

        for (let x = 0; x < designWidth; x++) {
            // display column number
            fill(isDevMode && x % 5 === 0 ? "pink" : colors.numColor);
            let textX = (x * config.squareSize) + config.buffer + config.xPadding + txtXOffset;
            let textY = ((config.canvasHeight - config.yPadding) - config.buffer) + txtYOffset;
            text(x + 1, textX, textY);

            for (let y = 0; y < designHeight; y++) {
                // display row number
                fill(isDevMode && y % 5 === 0 ? "pink" : colors.numColor);
                let textX = config.xPadding + txtXOffset;
                let textY = ((config.canvasHeight - config.yPadding) - config.squareSize - config.buffer) - (y * config.squareSize) + txtYOffset;
                text(y + 1, textX, textY);
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
            let minWallLength = (typeof appState !== 'undefined' && appState.generationConfig) ? appState.generationConfig.minWallLength || 1.0 : 1.0;
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
            let minWallLength = (typeof appState !== 'undefined' && appState.generationConfig) ? appState.generationConfig.minWallLength || 1.0 : 1.0;
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
            let minWallLength = (typeof appState !== 'undefined' && appState.generationConfig) ? appState.generationConfig.minWallLength || 1.0 : 1.0;
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

        // check for display state (with worker context fallback)
        let isDevMode = (typeof appState !== 'undefined' && appState.display) ? appState.display.devMode : false;
        let detailView = (typeof appState !== 'undefined' && appState.display) ? appState.display.detailView : false;

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
        // check for display state (with worker context fallback)
        let isDevMode = (typeof appState !== 'undefined' && appState.display) ? appState.display.devMode : false;

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
        // handles wall generation and rendering logic

        const wallAlgorithm = solution.wallAlgorithm || 'cellular-organic';

        // Validate wall algorithm and renderers
        if (!wallRenderers) {
            console.error('[SolutionRenderer] No wall renderers provided');
            return null;
        }

        switch (wallAlgorithm) {
            case 'bend':
                if (!wallRenderers.bendWallRenderer) {
                    console.error('[SolutionRenderer] BendWallRenderer not available for bend algorithm');
                    return null;
                }
                this.renderBentWalls(solution, config, wallRenderers, wallRenderData);
                return null; // Bent walls don't generate cellular data

            case 'cellular-organic':
            case 'cellular-rectilinear':
                if (!wallRenderers.cellularRenderer) {
                    console.error('[SolutionRenderer] CellularRenderer not available for cellular algorithm');
                    return null;
                }
                return this.renderCellularWalls(solution, config, wallRenderers, wallRenderData);

            default:
                console.error(`[SolutionRenderer] Unknown wall algorithm: ${wallAlgorithm}. Using cellular-organic as fallback.`);
                if (wallRenderers.cellularRenderer) {
                    solution.wallAlgorithm = 'cellular-organic'; // Set fallback algorithm
                    return this.renderCellularWalls(solution, config, wallRenderers, wallRenderData);
                } else {
                    console.error('[SolutionRenderer] No fallback renderer available');
                    return null;
                }
        }
    }

    renderBentWalls(solution, config, wallRenderers, wallRenderData) {
        // handles bent wall rendering

        let wallPath;
        // check for display state (with worker context fallback)
        let isDevMode = (typeof appState !== 'undefined' && appState.display) ? appState.display.devMode : false;

        if (wallRenderData.useGoldenPathDebugData && wallRenderData.goldenPathData) {
            // Use test data for visual validation
            wallPath = wallRenderData.goldenPathData;
            console.log('[SolutionRenderer] Using golden path test data for visual validation');
        } else {
            // Use actual algorithm output
            const bendGenerator = new BendWall(solution);
            const stepLimit = isDevMode ? (typeof appState !== 'undefined' && appState.display ? appState.display.curveStep : 0) : -1;
            if (isDevMode) {
                bendGenerator.setDebugMode(true);
            }
            wallPath = bendGenerator.generate(solution.maxBends, solution.bendRadius, stepLimit);
            console.log('[SolutionRenderer] Using actual BendWall algorithm output');
        }

        // Render debug state or final path
        if (isDevMode) {
            // Create a generator instance just to get the group data for debugging
            const bendGenerator = new BendWall(solution);
            bendGenerator._groupShapesByY(solution.shapes); // Run grouping
            const canvasObj = { height: config.canvasHeight, width: config.canvasWidth };
            wallRenderers.bendWallRenderer.renderDebugState(
                null, // No specific debug state object anymore
                bendGenerator.groups,
                canvasObj,
                config
            );
            wallRenderers.bendWallRenderer.renderWallPath(wallPath, canvasObj, config);
        } else {
            if (wallPath && wallPath.length > 0) {
                const canvasObj = { height: config.canvasHeight, width: config.canvasWidth };
                wallRenderers.bendWallRenderer.renderWallPath(wallPath, canvasObj, config);
            } else {
                console.warn('[SolutionRenderer] No bent wall path to render');
            }
        }
    }

    renderCellularWalls(solution, config, wallRenderers, wallRenderData) {
        // handles cellular wall rendering

        const wallAlgorithm = solution.wallAlgorithm || 'cellular-organic';
        let currCellular = wallRenderData.currCellular;

        // check for display state (with worker context fallback)
        let isDevMode = (typeof appState !== 'undefined' && appState.display) ? appState.display.devMode : false;

        if (isDevMode) {
            // create temporary cellular instance for step-by-step growth preview
            currCellular = new Cellular(solution);

            // Use the appropriate cellular algorithm
            if (wallAlgorithm === 'cellular-rectilinear') {
                currCellular.growRectilinear();
            } else {
                currCellular.growCells();
            }
        } else {
            // create fresh cellular instance to show complete growth
            currCellular = new Cellular(solution);

            // Use the appropriate cellular algorithm to grow to completion
            if (wallAlgorithm === 'cellular-rectilinear') {
                currCellular.growRectilinear();
            } else {
                currCellular.growCells();
            }
        }

        // Check if this is a cubbies fabrication type
        const fabricationType = solution.fabricationType || 'boards';

        if (fabricationType === 'cubbies') {
            // Render cubbies instead of regular cellular walls
            const cubbyAreas = currCellular.calculateAllCubbyAreas();

            if (cubbyAreas && cubbyAreas.length > 0) {
                // Get wall thickness and curve radius from appState or defaults
                const wallThickness = (typeof appState !== 'undefined' && appState.generationConfig.wallThickness) ?
                    appState.generationConfig.wallThickness : 0.25;
                const cubbyCurveRadius = (typeof appState !== 'undefined' ? appState.generationConfig.cubbyCurveRadius : 0.5);

                // Create Cubby instances
                const cubbies = cubbyAreas.map(cubbyData => {
                    if (cubbyData.visitedCells && cubbyData.visitedCells.length > 0) {
                        const cubby = new Cubby(
                            cubbyData.shape_id,
                            cubbyData.visitedCells,
                            wallThickness,
                            cubbyCurveRadius
                        );

                        return cubby;
                    }
                    return null;
                }).filter(Boolean);

                // Generate all polygon data with perimeter detection
                const caseBounds = Cubby.calculateCaseBounds(cubbies);
                for (const cubby of cubbies) {
                    cubby.generateAllLines(caseBounds);
                }

                // Render all four line types with distinct colors
                const renderOptions = {
                    exteriorColor: '#FF8C00',  // Bright Orange
                    exteriorWeight: 1,
                    centerColor: '#333333',    // Dark Gray
                    centerWeight: 1,
                    interiorColor: '#00CC66',  // Bright Green
                    interiorWeight: 2,         // 2px for interior lines
                    edgeColor: 'magenta',      // Magenta for edgelines
                    edgeWeight: 2
                };

                const canvasObj = { height: config.canvasHeight, width: config.canvasWidth };
                wallRenderers.cubbyRenderer.renderAllLineTypes(cubbies, canvasObj, config, renderOptions);
                wallRenderers.cubbyRenderer.renderCubbyLabels(cubbies, canvasObj, config, {
                    textSize: 14,
                    labelColor: 'white'
                });
            }
        } else {
            // Render normal cellular walls for boards/bent fabrication types
            const cellLines = currCellular.getCellRenderLines();
            const canvasObj = { height: config.canvasHeight, width: config.canvasWidth };
            wallRenderers.cellularRenderer.renderCellLines(cellLines, canvasObj, config);
        }

        // Display cells and terrain in dev mode
        if (isDevMode) {
            const canvasObj = { height: config.canvasHeight, width: config.canvasWidth };
            wallRenderers.cellularRenderer.renderTerrain(solution.layout, canvasObj, { ...config, maxTerrain: currCellular.maxTerrain });
            wallRenderers.cellularRenderer.renderCells(currCellular.cellSpace, canvasObj, config);
        }

        // Return the cellular instance for potential state storage
        return currCellular;
    }

    calculateLayoutProperties(solution, canvasWidth, canvasHeight) {
        // Delegate to centralized configuration
        return RenderConfig.calculateLayoutProperties(solution, canvasWidth, canvasHeight);
    }

    renderHighResGrid(layout, config, colors) {
        // draw high-resolution grid lines within each low-res square
        // this shows the subdivision that shapes use for precise positioning

        // Get the scale factor for high-res subdivision (use appState minWallLength if available)
        let scaleFactor;
        if (typeof appState !== 'undefined' && appState.generationConfig) {
            const minWallLength = appState.generationConfig.minWallLength || 1.0;
            scaleFactor = RenderConfig.getScaleFactor(minWallLength);
        } else {
            scaleFactor = RenderConfig.getScaleFactor(); // Default when appState not available
        }

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