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
        // config: object with squareSize, buffer, padding values

        let colors = {
            lineColor: "rgb(198, 198, 197)",
            bkrdColor: "rgb(229, 229, 229)",
            darkenedBkrdColor: "rgb(170, 170, 170)", // Made darker for better visibility
            bufferColor: "rgba(200,200,200, 0.5)",
            lowResShapeColor: "rgb(229, 229, 229)",
            highResShapeColor: "rgba(102,102,102, 0.9)",
            collisionColor: "rgba(184, 64, 64, 0.55)",
            textColor: "rgb(255,255,255)",
            numColor: "rgb(102,102,102)"
        };

        // check for display state (with worker context fallback)
        let isDevMode = (typeof appState !== 'undefined' && appState.display) ? appState.display.devMode : false;
        let detailView = (typeof appState !== 'undefined' && appState.display) ? appState.display.detailView : false;
        if (isDevMode) {
            colors.lineColor = 0;
            colors.bkrdColor = 255;
            colors.bufferColor = "rgb(255, 192, 203)";
            colors.lowResShapeColor = "rgba(140,140,140, 0.5)";
            colors.collisionColor = "rgba(255, 0, 0, 0.5)";
        }

        // draw layout from bottom layer up
        this.renderGridSquares(solution.layout, canvas, config, colors, solution);

        // show grid numbers
        if (detailView || isDevMode) {
            this.renderGridNumbers(solution.layout, canvas, config, colors);
        }

        // display buffer squares
        if (detailView || isDevMode) {
            this.renderBuffer(solution.layout, canvas, config, colors);
        }

        // display low res shape squares
        if (isDevMode) {
            this.renderLowResShapes(solution.layout, canvas, config, colors);
        }

        // display high res shapes
        this.renderHighResShapes(solution.shapes, canvas, config, colors);

        // display shape titles
        if (detailView || isDevMode) {
            this.renderTitles(solution.shapes, canvas, config, colors);
        }

        // display collision squares
        this.renderCollision(solution.layout, canvas, config, colors);

        // display selection highlight (on top of everything else)
        this.renderShapeSelection(solution.shapes, canvas, config);

        // display custom perimeter box (on top of everything else)
        if (solution.useCustomPerimeter) {
            this.renderPerimeterBox(solution, canvas, config);
        }
    }

    renderGridSquares(layout, canvas, config, colors, solution) {
        // draw grid squares with background color
        stroke(colors.lineColor);
        strokeWeight(0.75);

        for (let y = 0; y < layout.length; y++) {
            for (let x = 0; x < layout[y].length; x++) {
                // Default to the standard background color
                fill(colors.bkrdColor);

                // If in custom perimeter mode, check if the square is out of bounds
                if (solution && solution.useCustomPerimeter && solution.goalPerimeter) {
                    const { x: goalX, y: goalY, width: goalWidth, height: goalHeight } = solution.goalPerimeter;
                    if (x < goalX || x >= goalX + goalWidth || y < goalY || y >= goalY + goalHeight) {
                        fill(colors.darkenedBkrdColor);
                    }
                }

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

        // check for display state (with worker context fallback)
        let isDevMode = (typeof appState !== 'undefined' && appState.display) ? appState.display.devMode : false;

        for (let x = 0; x < designWidth; x++) {
            // display column number
            fill(isDevMode && x % 5 === 0 ? "pink" : colors.numColor);
            let textX = (x * config.squareSize) + config.buffer + config.xPadding + txtXOffset;
            let textY = ((canvas.height - config.yPadding) - config.buffer) + txtYOffset;
            text(x + 1, textX, textY);

            for (let y = 0; y < designHeight; y++) {
                // display row number
                fill(isDevMode && y % 5 === 0 ? "pink" : colors.numColor);
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
                    let rectY = ((canvas.height - config.yPadding) - config.squareSize - config.buffer) - (y * config.squareSize); // draw from bottom up
                    rect(rectX, rectY, config.squareSize, config.squareSize);
                }
            }
        }
    }

    renderScores(layout, canvas, config) {
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

    renderPerimeterBox(solution, canvas, config) {
        if (!solution.goalPerimeter) return;

        const { x, y, width, height } = solution.goalPerimeter;
        const { squareSize, buffer, xPadding, yPadding } = config;

        // Calculate the coordinates and dimensions on the canvas
        const rectX = (x * squareSize) + buffer + xPadding;
        const rectY = ((canvas.height - yPadding) - (y + height) * squareSize) - buffer;
        const rectWidth = width * squareSize;
        const rectHeight = height * squareSize;

        // Draw the rectangle with enhanced visibility
        noFill();
        stroke(0, 100, 255); // Bright blue color for the perimeter
        strokeWeight(3); // Thicker stroke for better visibility
        rect(rectX, rectY, rectWidth, rectHeight);
    }

    renderBlankGrid(canvas, layoutProps, gridSize = 20) {
        // create empty solution and display grid only
        // this method encapsulates the creation and rendering of a blank grid

        clear();
        background(255);

        let emptySolution = new Solution();
        emptySolution.makeBlankLayout(gridSize);

        // set up config for renderer
        let config = {
            ...layoutProps
        };
        let colors = {
            lineColor: "rgb(198, 198, 197)",
            bkrdColor: "rgb(229, 229, 229)"
        };

        // render the grid
        this.renderGridSquares(emptySolution.layout, canvas, config, colors);

        return emptySolution;
    }

    renderSolutionProgress(solution, canvas, layoutProps, perimeterConfig, showScores = true) {
        // renders solution during annealing progress with perimeter handling

        clear();
        background(255);

        // Set up config for renderer
        let config = {
            ...layoutProps
        };

        // Render the solution
        this.renderLayout(solution, canvas, config);

        if (showScores) {
            this.renderScores(solution.layout, canvas, config);
        }
    }

    renderCompleteSolution(solution, canvas, layoutProps, perimeterConfig, wallRenderers, wallRenderData) {
        // renders complete solution with walls and perimeter handling
        // wallRenderers: { bendWallRenderer, cellularRenderer }
        // wallRenderData: { currCellular, goldenPathData, useGoldenPathDebugData}

        clear();
        background(255);

        // Note: centerGoalPerimeter() and calcScore() are handled during solution generation,
        // not in the renderer. The renderer only displays the current state.

        // Set up config for renderer
        let config = {
            ...layoutProps,
            canvasHeight: canvas.height
        };

        // Render the basic solution layout
        this.renderLayout(solution, canvas, config);

        // Handle wall generation and rendering
        return this.renderWalls(solution, canvas, config, wallRenderers, wallRenderData);
    }

    renderWalls(solution, canvas, config, wallRenderers, wallRenderData) {
        // handles wall generation and rendering logic

        const wallAlgorithm = solution.wallAlgorithm || 'cellular-organic';

        if (wallAlgorithm === 'bend') {
            this.renderBentWalls(solution, canvas, config, wallRenderers, wallRenderData);
            return null; // Bent walls don't generate cellular data
        } else {
            return this.renderCellularWalls(solution, canvas, config, wallRenderers, wallRenderData);
        }
    }

    renderBentWalls(solution, canvas, config, wallRenderers, wallRenderData) {
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
            wallRenderers.bendWallRenderer.renderDebugState(
                null, // No specific debug state object anymore
                bendGenerator.groups,
                canvas,
                config
            );
            wallRenderers.bendWallRenderer.renderWallPath(wallPath, canvas, config);
        } else {
            if (wallPath && wallPath.length > 0) {
                wallRenderers.bendWallRenderer.renderWallPath(wallPath, canvas, config);
            } else {
                console.warn('[SolutionRenderer] No bent wall path to render');
            }
        }
    }

    renderCellularWalls(solution, canvas, config, wallRenderers, wallRenderData) {
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
                
                // Get layout dimensions for perimeter detection
                const layoutWidth = currCellular.layoutWidth;
                const layoutHeight = currCellular.layoutHeight;
                
                // Create Cubby instances with all line data
                const cubbies = cubbyAreas.map(cubbyData => {
                    if (cubbyData.visitedCells && cubbyData.visitedCells.length > 0) {
                        const cubby = new Cubby(
                            cubbyData.shape_id,
                            cubbyData.visitedCells,
                            wallThickness,
                            cubbyCurveRadius
                        );
                        
                        // Generate all three line types (no perimeter detection needed)
                        cubby.generateCenterLines();
                        cubby.generateInteriorLines();
                        cubby.generateExteriorLines();
                        
                        return cubby;
                    }
                    return null;
                }).filter(Boolean);
                
                // Render all three line types with distinct colors (all 1px)
                const renderOptions = {
                    exteriorColor: '#FF8C00',  // Bright Orange
                    exteriorWeight: 1,
                    centerColor: '#333333',    // Dark Gray
                    centerWeight: 1,
                    interiorColor: '#00CC66',  // Bright Green
                    interiorWeight: 1
                };
                
                wallRenderers.cubbyRenderer.renderAllLineTypes(cubbies, canvas, config, renderOptions);
                wallRenderers.cubbyRenderer.renderCubbyLabels(cubbies, canvas, config, { 
                    textSize: 14,
                    labelColor: 'white'
                });
            }
        } else {
            // Render normal cellular walls for boards/bent fabrication types
            const cellLines = currCellular.getCellRenderLines();
            wallRenderers.cellularRenderer.renderCellLines(cellLines, canvas, config);
        }

        // Display cells and terrain in dev mode
        if (isDevMode) {
            wallRenderers.cellularRenderer.renderTerrain(solution.layout, canvas, { ...config, maxTerrain: currCellular.maxTerrain });
            wallRenderers.cellularRenderer.renderCells(currCellular.cellSpace, canvas, config);
        }

        // Return the cellular instance for potential state storage
        return currCellular;
    }

    calculateLayoutProperties(solution, canvasWidth, canvasHeight) {
        // calculate display properties for Solutions
        if (!solution || !solution.layout || solution.layout.length === 0) {
            // default values for empty/blank layouts
            return {
                squareSize: 25,
                buffer: 25,
                xPadding: (canvasWidth - (20 * 25)) / 2 - 25,
                yPadding: (canvasHeight - (20 * 25)) / 2 - 25
            };
        }

        let layoutHeight = solution.layout.length;
        let layoutWidth = solution.layout[0].length;
        let squareHeight = canvasHeight / (layoutHeight + 2); // + 2 makes room for top/bottom buffer
        let squareWidth = canvasWidth / (layoutWidth + 2); // + 2 makes room for left/right buffer
        let squareSize = Math.min(squareHeight, squareWidth);
        let buffer = squareSize;
        let yPadding = ((canvasHeight - (layoutHeight * squareSize)) / 2) - buffer;
        let xPadding = ((canvasWidth - (layoutWidth * squareSize)) / 2) - buffer;

        return { squareSize, buffer, xPadding, yPadding, layoutHeight, layoutWidth };
    }
} 