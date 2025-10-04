class RenderConfig {
    static getColors(isDevMode = false) {
        // Centralized color definitions for all rendering methods
        const baseColors = {
            lineColor: "rgb(198, 198, 197)",
            bkrdColor: "rgb(229, 229, 229)",
            darkenedBkrdColor: "rgb(170, 170, 170)", // Made darker for better visibility
            bufferColor: "rgba(200,200,200, 0.5)",
            collisionColor: "rgba(184, 64, 64, 0.55)",
            textColor: "rgb(255,255,255)",
            numColor: "rgb(102,102,102)",
            selectionColor: "rgba(0, 100, 255, 0.4)", // Semi-transparent blue for selection
            inputSelectedColor: "rgba(111, 0, 255, 0.5)", // Purple for selected input squares
            inputSelectedStroke: "rgba(204, 204, 204, 0.25)", // Light stroke for selected squares
            boardColor: "rgb(175, 141, 117)", // Wood brown for board rendering

            // Buffer visualization colors
            highResShapeColor: "rgba(102,102,102, 0.6)", // Transparent to show buffer squares
            highResBufferColor: "rgba(150, 150, 150, 0.5)", // Darker grey, semi-transparent  
            lowResBufferColor: "rgba(0, 174, 255, 0.15)", // Blue buffer zones

            // Bend wall rendering colors
            bendWall: {
                wallPath: "rgb(50, 50, 50)",
                debugGroup: "rgba(255, 0, 0, 0.3)",
                completedGroup: "rgba(0, 255, 0, 0.3)",
                activeGroup: "rgba(0, 0, 255, 0.3)",
                forbiddenEnd: "rgb(255, 0, 0)",
                availableEnd: "rgb(0, 255, 0)",
                connectionLine: "rgb(255, 165, 0)",
                shelfSegment: "orange",
                lineSegment: "red",
                arcSegment: "blue",
                segmentIdText: "black",
                segmentIdStroke: "white"
            },

            // Cellular automata rendering colors
            cellular: {
                lineColor: "rgb(175, 141, 117)", // Wood brown for cellular lines
                terrainText: 75, // Dark grey for terrain values
                floodFillPalette: [
                    [255, 100, 100, 80],  // Red
                    [100, 255, 100, 80],  // Green
                    [100, 100, 255, 80],  // Blue
                    [255, 255, 100, 80],  // Yellow
                    [255, 100, 255, 80],  // Magenta
                    [100, 255, 255, 80],  // Cyan
                    [255, 150, 100, 80],  // Orange
                    [150, 100, 255, 80]   // Purple
                ]
            }
        };

        if (isDevMode) {
            return {
                ...baseColors,
                lineColor: 0,
                bkrdColor: 255,
                bufferColor: "rgb(255, 192, 203)", // Low-res buffer (pink)
                highResBufferColor: "rgba(180, 220, 255, 0.3)", // High-res buffer (light blue)
                lowResShapeColor: "rgba(140,140,140, 0.5)",
                collisionColor: "rgba(255, 0, 0, 0.5)",
                boardColor: "rgba(175, 141, 117, 0.5)" // Semi-transparent wood brown for dev mode
            };
        }

        return baseColors;
    }

    static getScaleFactor(minWallLength = 1.0) {
        // Calculate scale factor based on min wall length
        // Scale factor represents number of quarter-inch (highres) squares per grid square
        //
        // IMPORTANT: This relates GRID units to HIGHRES units, NOT inches to highres
        // For inches -> highres conversion, use MathUtils.inchesToHighres() (always factor of 4)
        //
        // 0.25" = 1:1 ratio (1 quarter-inch per grid square, scale factor 1)
        // 0.5"  = 2:1 ratio (2 quarter-inch squares per grid square, scale factor 2)
        // 1.0"  = 4:1 ratio (4 quarter-inch squares per grid square, scale factor 4)
        // 1.5"  = 6:1 ratio (6 quarter-inch squares per grid square, scale factor 6)
        // 2.0"  = 8:1 ratio (8 quarter-inch squares per grid square, scale factor 8)
        switch (minWallLength) {
            case 0.25: return 1;  // 1:1 ratio
            case 0.5:  return 2;  // 2:1 ratio
            case 1.0:  return 4;  // 4:1 ratio
            case 1.5:  return 6;  // 6:1 ratio
            case 2.0:  return 8;  // 8:1 ratio
            default:   return 4;  // default to 1.0" (4:1 ratio)
        }
    }

    static calculateLayoutProperties(solution, canvasWidth, canvasHeight) {
        // Calculate display properties for Solutions
        if (!solution || !solution.layout || solution.layout.length === 0) {
            // Default values for empty/blank layouts
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

    static getStrokeWeights() {
        return {
            gridLine: 0.75,
            highResGrid: 0.25,
            selection: 3,
            perimeter: 2,
            boundingBox: 2,
            debug: 1
        };
    }

    static getTextSizes(squareSize) {
        return {
            gridNumber: squareSize / 2.5,
            shapeTitle: Math.min(squareSize / 2, 14),
            debug: 10
        };
    }

    static calculatePreviewGridSize(shape, minWallLength = 1.0, canvasWidth, canvasHeight) {
        // Calculate optimal grid size for shape preview that maintains consistent visual scale
        // Returns grid dimensions and positioning info
        
        if (!shape || !shape.data) {
            // Default grid for empty shape
            return {
                gridSize: 12,
                squareSize: Math.min(canvasWidth, canvasHeight) / 14, // Leave padding
                xOffset: 0,
                yOffset: 0
            };
        }

        // Get shape dimensions in high-res units (1/4 inch)
        let shapeWidth = 0;
        let shapeHeight = 0;
        
        if (shape.data.highResBufferShape) {
            shapeHeight = shape.data.highResBufferShape.length;
            shapeWidth = shape.data.highResBufferShape[0] ? shape.data.highResBufferShape[0].length : 0;
        } else if (shape.data.highResShape) {
            shapeHeight = shape.data.highResShape.length;
            shapeWidth = shape.data.highResShape[0] ? shape.data.highResShape[0].length : 0;
        }

        // Convert high-res units to grid units based on min wall length
        const scaleFactor = RenderConfig.getScaleFactor(minWallLength);
        const shapeGridWidth = Math.ceil(shapeWidth / scaleFactor);
        const shapeGridHeight = Math.ceil(shapeHeight / scaleFactor);

        // Add padding around shape (in grid units)
        const gridPadding = 3;
        const gridSize = Math.max(
            shapeGridWidth + (gridPadding * 2),
            shapeGridHeight + (gridPadding * 2),
            8 // Minimum grid size
        );

        // Calculate square size to fit grid in canvas
        const padding = 30;
        const availableWidth = canvasWidth - (padding * 2);
        const availableHeight = canvasHeight - (padding * 2);
        const squareSize = Math.min(availableWidth, availableHeight) / gridSize;

        // Center the grid in canvas
        const gridWidth = gridSize * squareSize;
        const gridHeight = gridSize * squareSize;
        const xOffset = (canvasWidth - gridWidth) / 2;
        const yOffset = (canvasHeight - gridHeight) / 2;

        // Calculate shape position to center it in the grid
        const shapeX = Math.floor((gridSize - shapeGridWidth) / 2);
        const shapeY = Math.floor((gridSize - shapeGridHeight) / 2);

        return {
            gridSize,
            squareSize,
            xOffset,
            yOffset,
            shapeX,
            shapeY,
            shapeGridWidth,
            shapeGridHeight
        };
    }
}

// Only export the class when in a Node.js environment (e.g., during Jest tests)
// Ignored when the app is running in the browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RenderConfig;
}