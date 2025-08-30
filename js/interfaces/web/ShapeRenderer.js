class ShapeRenderer {
    constructor() {
        // Stateless renderer utility class for Shape objects
    }

    renderShapePreview(shape, canvas, detailMode = false, appState = null) {
        // Simple shape preview rendering without complex solution logic
        // Shows single shape on basic grid with optional detail mode features

        const colors = RenderConfig.getColors();

        // Get shape processing configuration
        let config = null;
        if (appState && appState.generationConfig) {
            config = {
                customBufferSize: appState.generationConfig.customBufferSize || 0.25,
                centerShape: appState.generationConfig.centerShape || false,
                minWallLength: appState.generationConfig.minWallLength || 1.0
            };
        } else {
            config = shape.getDefaultProcessingConfig();
        }

        // Calculate dynamic grid configuration based on shape size and min wall length
        const gridConfig = RenderConfig.calculatePreviewGridSize(
            shape, 
            config.minWallLength, 
            canvas.width, 
            canvas.height
        );

        const gridSize = gridConfig.gridSize;
        const squareSize = gridConfig.squareSize;
        const xOffset = gridConfig.xOffset;
        const yOffset = gridConfig.yOffset;
        const shapeX = gridConfig.shapeX;
        const shapeY = gridConfig.shapeY;

        // Clear canvas and set background
        clear();
        background(255);

        // Draw basic grid
        this.renderPreviewGrid(gridSize, xOffset, yOffset, squareSize, colors);

        // Render layered buffer visualization in detail mode
        if (detailMode) {
            // Layer 1: Low-res buffer
            if (shape.data.bufferShape) {
                this.renderShapeLowResBuffer(shape, shapeX, shapeY, xOffset, yOffset, squareSize, colors, config);
            }

            // Layer 2: High-res buffer
            if (shape.data.highResBufferShape) {
                this.renderShapeHighResBuffer(shape, shapeX, shapeY, xOffset, yOffset, squareSize, colors, config);
            }
        }

        // Layer 3: High-res shape
        this.renderSingleHighResShape(shape, shapeX, shapeY, xOffset, yOffset, squareSize, colors, config);

        // Render high-res grid lines if in detail mode
        if (detailMode) {
            this.renderPreviewHighResGrid(gridSize, xOffset, yOffset, squareSize, colors, config.minWallLength);
        }

        // Debug: render bounding box outline if in detail mode
        if (detailMode) {
            this.renderBoundingBoxDebug(shape, shapeX, shapeY, xOffset, yOffset, squareSize, colors, config);
        }

        // Render shape title
        if (detailMode) {
            fill(colors.textColor);
            stroke(colors.numColor);
            strokeWeight(RenderConfig.getStrokeWeights().selection);
            textAlign(CENTER, CENTER);
            textSize(RenderConfig.getTextSizes(squareSize).shapeTitle);
            const titleX = xOffset + ((shapeX + 0.5) * squareSize);
            const titleY = yOffset + ((shapeY - 0.7) * squareSize);
            text(shape.data.title, titleX, titleY);
        }
    }

    renderPreviewGrid(gridSize, xOffset, yOffset, squareSize, colors) {
        // Draw basic grid for shape preview
        stroke(colors.lineColor);
        strokeWeight(RenderConfig.getStrokeWeights().gridLine);
        for (let y = 0; y < gridSize; y++) {
            for (let x = 0; x < gridSize; x++) {
                fill(colors.bkrdColor);
                const rectX = xOffset + (x * squareSize);
                const rectY = yOffset + (y * squareSize);
                rect(rectX, rectY, squareSize, squareSize);
            }
        }
    }

    renderSingleHighResShape(shape, gridX, gridY, xOffset, yOffset, squareSize, colors, config) {
        // Render high-resolution shape data for preview using buffer array filtering
        if (!shape.data.highResBufferShape) return;

        const scaleFactor = RenderConfig.getScaleFactor(config.minWallLength);
        const highResSquareSize = squareSize / scaleFactor;

        fill(colors.highResShapeColor);
        stroke(colors.highResShapeColor);
        strokeWeight(0.5);

        // Render original shape squares from buffer array
        for (let y = 0; y < shape.data.highResBufferShape.length; y++) {
            for (let x = 0; x < shape.data.highResBufferShape[y].length; x++) {
                const square = shape.data.highResBufferShape[y][x];
                
                // Only render original shape squares (not buffer expansion)
                if (square.occupied && square.isOriginalShape) {
                    // Use direct buffer coordinates (no alignment needed)
                    const rectX = xOffset + (gridX * squareSize) + (x * highResSquareSize);
                    const rectY = yOffset + (gridY * squareSize) + ((shape.data.highResBufferShape.length - 1 - y) * highResSquareSize);
                    rect(rectX, rectY, highResSquareSize, highResSquareSize);
                }
            }
        }
    }

    renderShapeLowResBuffer(shape, gridX, gridY, xOffset, yOffset, squareSize, colors, config) {
        // Render low-resolution buffer squares for preview
        if (!shape.data.bufferShape) return;

        fill(colors.lowResBufferColor);
        noStroke();

        // With synchronized arrays, both buffers align naturally at grid coordinates
        for (let y = 0; y < shape.data.bufferShape.length; y++) {
            for (let x = 0; x < shape.data.bufferShape[y].length; x++) {
                if (shape.data.bufferShape[y][x]) {
                    const rectX = xOffset + (gridX * squareSize) + (x * squareSize);
                    const rectY = yOffset + (gridY * squareSize) + ((shape.data.bufferShape.length - 1 - y) * squareSize);
                    rect(rectX, rectY, squareSize, squareSize);
                }
            }
        }
    }

    renderShapeHighResBuffer(shape, gridX, gridY, xOffset, yOffset, squareSize, colors, config) {
        // Render high-resolution buffer zones for preview (includes shape + buffer areas)
        // This will be rendered UNDER the shape, so the shape will show on top
        if (!shape.data.highResBufferShape) return;

        // Identify perimeter squares for proper coloring
        Shape.identifyPerimeterSquares(shape.data.highResBufferShape);

        const scaleFactor = RenderConfig.getScaleFactor(config.minWallLength);
        const highResSquareSize = squareSize / scaleFactor;

        fill(colors.highResBufferColor);
        noStroke();

        // With synchronized arrays, high-res buffer aligns naturally at grid coordinates

        // Render buffer squares with different colors based on square properties
        for (let y = 0; y < shape.data.highResBufferShape.length; y++) {
            for (let x = 0; x < shape.data.highResBufferShape[y].length; x++) {
                const square = shape.data.highResBufferShape[y][x];

                // Only render occupied squares in the buffer
                if (!square.occupied) {
                    continue;
                }

                fill(colors.highResBufferColor);
                noStroke();

                const rectX = xOffset + (gridX * squareSize) + (x * highResSquareSize);
                const rectY = yOffset + (gridY * squareSize) + ((shape.data.highResBufferShape.length - 1 - y) * highResSquareSize);
                rect(rectX, rectY, highResSquareSize, highResSquareSize);
            }
        }
    }

    renderPreviewHighResGrid(gridSize, xOffset, yOffset, squareSize, colors, minWallLength = 1.0) {
        // Render high-resolution subdivision grid lines for preview
        const scaleFactor = RenderConfig.getScaleFactor(minWallLength);

        stroke(colors.lineColor);
        strokeWeight(RenderConfig.getStrokeWeights().highResGrid);

        // Draw vertical subdivision lines
        for (let x = 0; x < gridSize; x++) {
            for (let subX = 1; subX < scaleFactor; subX++) {
                const xPos = xOffset + (x * squareSize) + (subX * squareSize / scaleFactor);
                const yStart = yOffset;
                const yEnd = yOffset + (gridSize * squareSize);
                line(xPos, yStart, xPos, yEnd);
            }
        }

        // Draw horizontal subdivision lines  
        for (let y = 0; y < gridSize; y++) {
            for (let subY = 1; subY < scaleFactor; subY++) {
                const yPos = yOffset + (y * squareSize) + (subY * squareSize / scaleFactor);
                const xStart = xOffset;
                const xEnd = xOffset + (gridSize * squareSize);
                line(xStart, yPos, xEnd, yPos);
            }
        }
    }

    renderBoundingBoxDebug(shape, gridX, gridY, xOffset, yOffset, squareSize, colors, config) {
        // Debug visualization of the bounding box used for buffer generation
        if (!shape.data.highResBufferShape || !shape.data.highResShape) return;

        const scaleFactor = RenderConfig.getScaleFactor(config.minWallLength);
        const highResSquareSize = squareSize / scaleFactor;

        // Get buffer dimensions for proper bounding box calculation
        const originalHeight = shape.data.highResBufferShape ? shape.data.highResBufferShape.length : shape.data.highResShape.length;
        const originalWidth = shape.data.highResBufferShape ? shape.data.highResBufferShape[0].length : shape.data.highResShape[0].length;

        // Get buffer shape dimensions 
        const bufferArrayHeight = shape.data.highResBufferShape.length;
        const bufferArrayWidth = shape.data.highResBufferShape[0].length;

        // ORANGE BOX: Shape positioned at grid coordinates (grid-aligned)
        const orangeBoxStartX = xOffset + (gridX * squareSize);
        const orangeBoxStartY = yOffset + (gridY * squareSize);
        const orangeBoxWidth = originalWidth * highResSquareSize;
        const orangeBoxHeight = originalHeight * highResSquareSize;

        stroke('orange');
        strokeWeight(RenderConfig.getStrokeWeights().debug);
        noFill();
        rect(orangeBoxStartX, orangeBoxStartY, orangeBoxWidth, orangeBoxHeight);

        // RED BOX: High-res buffer positioned at grid coordinates (naturally aligned)
        const redBoxStartX = xOffset + (gridX * squareSize);
        const redBoxStartY = yOffset + (gridY * squareSize);
        const redBoxWidth = bufferArrayWidth * highResSquareSize;
        const redBoxHeight = bufferArrayHeight * highResSquareSize;

        stroke('red');
        strokeWeight(RenderConfig.getStrokeWeights().boundingBox);
        noFill();
        rect(redBoxStartX, redBoxStartY, redBoxWidth, redBoxHeight);

        // LIGHT BLUE BOX: Low-res buffer positioned at grid coordinates (naturally aligned)
        if (shape.data.bufferShape) {
            const lowResBufferHeight = shape.data.bufferShape.length;
            const lowResBufferWidth = shape.data.bufferShape[0].length;

            const blueBoxStartX = xOffset + (gridX * squareSize);
            const blueBoxStartY = yOffset + (gridY * squareSize);
            const blueBoxWidth = lowResBufferWidth * squareSize;
            const blueBoxHeight = lowResBufferHeight * squareSize;

            stroke('lightblue');
            strokeWeight(RenderConfig.getStrokeWeights().boundingBox);
            noFill();
            rect(blueBoxStartX, blueBoxStartY, blueBoxWidth, blueBoxHeight);
        }

        // Add debug labels  
        const bufferInches = config.customBufferSize;
        const steps = Math.round(bufferInches * scaleFactor);

        fill('red');
        noStroke();
        textAlign(LEFT, TOP);
        textSize(RenderConfig.getTextSizes().debug);
        text(`Hi-Res Buffer: ${bufferArrayWidth}x${bufferArrayHeight}`, redBoxStartX + 5, redBoxStartY + 5);
        text(`Shape: ${originalWidth}x${originalHeight}`, redBoxStartX + 5, redBoxStartY + 20);
        text(`Lo-Res Buffer: ${shape.data.bufferShape ? shape.data.bufferShape[0].length + 'x' + shape.data.bufferShape.length : 'N/A'}`, redBoxStartX + 5, redBoxStartY + 35);
        text(`Buffer: ${bufferInches}" (${steps} steps)`, redBoxStartX + 5, redBoxStartY + 50);
        text(`Bottom Buffer: ${config.centerShape ? 'ON' : 'OFF'}`, redBoxStartX + 5, redBoxStartY + 65);
    }


    renderShapeSelection(shapes, canvas, config, selectedShapeId) {
        // Render blue tint overlay for selected shape
        if (selectedShapeId === null) {
            return;
        }

        // Find the selected shape
        const selectedShape = shapes.find(shape => shape.id === selectedShapeId);
        if (!selectedShape) {
            return;
        }

        const colors = RenderConfig.getColors();

        noStroke();
        fill(colors.selectionColor);

        let startX = selectedShape.posX;
        let startY = selectedShape.posY;
        // Get the correct scale factor based on app state or default
        let minWallLength = (typeof appState !== 'undefined' && appState.generationConfig) ? appState.generationConfig.minWallLength || 1.0 : 1.0;
        let scaleFactor = RenderConfig.getScaleFactor(minWallLength);
        let smallSquare = config.squareSize / scaleFactor;

        // Draw blue overlay for each original shape square in the buffer array
        if (!selectedShape.data.highResBufferShape) return;
        
        for (let y = 0; y < selectedShape.data.highResBufferShape.length; y++) {
            for (let x = 0; x < selectedShape.data.highResBufferShape[y].length; x++) {
                const square = selectedShape.data.highResBufferShape[y][x];
                
                // Only draw overlay on original shape squares (not buffer expansion)
                if (square.occupied && square.isOriginalShape) {
                    // Use direct buffer coordinates (same calculation as SolutionRenderer)
                    let rectX = (startX * config.squareSize) + (x * smallSquare) + config.buffer + config.xPadding;
                    let yOffset = ((canvas.height - config.yPadding) - smallSquare - config.buffer);
                    let yStart = (startY * config.squareSize);
                    let yRect = (y * smallSquare);
                    let rectY = yOffset - yStart - yRect;
                    rect(rectX, rectY, smallSquare, smallSquare);
                }
            }
        }
    }
}

// Only export the class when in a Node.js environment (e.g., during Jest tests)
// Ignored when the app is running in the browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ShapeRenderer;
}