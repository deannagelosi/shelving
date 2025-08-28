class Shape {
    constructor() {
        //== shape specific data
        // - data that is the same for all solutions
        // - stored in an object to be passed by reference for each solution
        this.data = {
            // shape grids are stored as 2D arrays of booleans
            inputGrid: [[]], // (high res) user input grid
            // - occupied squares as true, unoccupied as false
            highResShape: [[]], // (high res) trimmed input grid
            lowResShape: [[]], // less rows/cols than high res shape, scaled to the min wall length
            bufferShape: [[]], // low res + buffer (will be renamed to lowResBufferShape)
            highResBufferShape: [[]], // (high res) shape + buffer for detailed visualization
            title: '', // title of the shape
        };

        //== solution specific data
        // - data that is unique to each solution
        // - stored as primitives to be passed by copy for each solution
        this.posX = 0;
        this.posY = 0;
        this.enabled = true;
        this.id = Shape.nextId++;
    }

    static nextId = 0;

    saveUserInput(_title, _inputGrid, config = null) {
        // save the shape and create the rounded up and buffer shape arrays
        this.data.title = _title;
        this.data.inputGrid = _inputGrid;

        // Use provided configuration or get default configuration
        config = config || this.getDefaultProcessingConfig();
        const scaleFactor = RenderConfig.getScaleFactor(config.minWallLength);

        // Calculate buffer values used by both high-res and low-res buffer creation
        const bufferInches = config.customBufferSize;
        const cellSizeInches = config.minWallLength;
        const bufferCellsFloat = bufferInches / cellSizeInches;

        //== create shape
        // trimming empty rows and columns in the input grid
        let shapeTemp = [];
        let leftIndex = this.data.inputGrid[0].length - 1;
        let rightIndex = 0;
        // find the farthest left and right indices of the shape
        for (let y = 0; y < this.data.inputGrid.length; y++) {
            if (this.data.inputGrid[y].includes(true)) {
                // find the left and the right ends of the shape on this row
                let currLeft = this.data.inputGrid[y].indexOf(true);
                let currRight = this.data.inputGrid[y].lastIndexOf(true);
                if (currLeft < leftIndex) {
                    leftIndex = currLeft;
                }
                if (currRight > rightIndex) {
                    rightIndex = currRight;
                }
            }
        }
        // use leftIndex and rightIndex to trim the shape
        for (let y = 0; y < this.data.inputGrid.length; y++) {
            if (this.data.inputGrid[y].includes(true)) {
                let rowSlice = this.data.inputGrid[y].slice(leftIndex, rightIndex + 1);
                shapeTemp.push(rowSlice);
            }
        }

        // Store the trimmed shape as highResShape (pure shape content)
        this.data.highResShape = shapeTemp;

        // Create expanded shape for buffer generation 
        // This expansion is needed for flood fill edge detection and proper buffer dimensions
        const expansionResult = this.expandShapeBounds(shapeTemp, config.centerShape, scaleFactor);
        const expandedShape = expansionResult.expandedShape;

        //== create the high res buffer shape
        // - apply proper perimeter expansion at high resolution for detailed visualization
        this.data.highResBufferShape = this.generateHighResBuffer(bufferInches, config.centerShape, config);

        //== create the low res shape 
        // - scale the expanded shape (not highResShape) down by the scaleFactor
        // - expandedShape is padded and centered for proper low-res conversion
        const paddedShape = expandedShape;
        // reduce the resolution by scaleFactor
        this.data.lowResShape = [];
        const lowResHeight = Math.floor(paddedShape.length / scaleFactor);
        const lowResWidth = Math.floor(paddedShape[0].length / scaleFactor);
        for (let y = 0; y < lowResHeight; y++) {
            const row = [];
            for (let x = 0; x < lowResWidth; x++) {
                let filledCells = 0;
                for (let dy = 0; dy < scaleFactor; dy++) {
                    for (let dx = 0; dx < scaleFactor; dx++) {
                        if (paddedShape[y * scaleFactor + dy][x * scaleFactor + dx]) {
                            filledCells++;
                        }
                    }
                }
                if (filledCells > 0) {
                    row.push(true);
                } else {
                    row.push(false);
                }
            }
            this.data.lowResShape.push(row);
        }

        //== create the buffer shape 
        // - add configurable buffer to edges based on customBufferSize
        // For low-res buffer: use minimum 1 cell if any buffer requested, otherwise use fractional calculation
        const bufferCells = bufferInches > 0 ? Math.max(1, Math.round(bufferCellsFloat)) : 0;

        // Store fractional buffer for high-res calculations
        this.bufferCellsFloat = bufferCellsFloat;
        this.bufferInches = bufferInches;

        // Generate low-res buffer by "rounding up" from high-res buffer
        // If ANY high-res square within a 1-inch low-res square is occupied, mark the entire low-res square as occupied
        this.data.bufferShape = this.generateLowResBufferFromHighRes(config.minWallLength);
    }

    generateLowResBufferFromHighRes(minWallLength = 1.0) {
        // Generate low-res buffer shape by "rounding up" from high-res buffer
        // Each low-res square represents scaleFactor x scaleFactor high-res squares
        // If ANY high-res square within the area is occupied, mark the low-res square as occupied

        if (!this.data.highResBufferShape || this.data.highResBufferShape.length === 0) {
            console.warn('[Shape] No high-res buffer shape available for low-res generation');
            return [[]];
        }

        const scaleFactor = RenderConfig.getScaleFactor(minWallLength);
        const highResHeight = this.data.highResBufferShape.length;
        const highResWidth = this.data.highResBufferShape[0].length;

        // Calculate low-res dimensions by rounding up
        const lowResHeight = Math.ceil(highResHeight / scaleFactor);
        const lowResWidth = Math.ceil(highResWidth / scaleFactor);

        const lowResBuffer = [];

        // For each low-res square, check if ANY high-res square within its area is occupied
        for (let lowY = 0; lowY < lowResHeight; lowY++) {
            const lowResRow = [];
            for (let lowX = 0; lowX < lowResWidth; lowX++) {
                let hasOccupiedSquare = false;

                // Check all high-res squares within this low-res square's area
                const startHighY = lowY * scaleFactor;
                const endHighY = Math.min(startHighY + scaleFactor, highResHeight);
                const startHighX = lowX * scaleFactor;
                const endHighX = Math.min(startHighX + scaleFactor, highResWidth);

                for (let highY = startHighY; highY < endHighY; highY++) {
                    for (let highX = startHighX; highX < endHighX; highX++) {
                        const square = this.data.highResBufferShape[highY][highX];
                        if (square && square.occupied) {
                            hasOccupiedSquare = true;
                            break;
                        }
                    }
                    if (hasOccupiedSquare) break;
                }

                lowResRow.push(hasOccupiedSquare);
            }
            lowResBuffer.push(lowResRow);
        }

        return lowResBuffer;
    }

    toDataObject() {
        // convert Shape instance to text object (JSON) (export/worker communication)
        return {
            data: {
                highResShape: this.data.highResShape,
                title: this.data.title
            },
            id: this.id,
            posX: this.posX,
            posY: this.posY,
            enabled: this.enabled
        };
    }

    static fromDataObject(shapeData, bufferConfig = null) {
        // convert Shape text object (JSON) to Shape instance (import/worker communication)
        const newShape = new Shape();
        newShape.saveUserInput(shapeData.data.title, shapeData.data.highResShape, bufferConfig);

        // Restore ID if provided
        if (shapeData.id !== undefined) {
            newShape.id = shapeData.id;
            // Ensure the static counter is always ahead of any loaded ID
            Shape.nextId = Math.max(Shape.nextId, shapeData.id + 1);
        } else {
            // If no ID is provided, assign a new one.
            newShape.id = Shape.nextId++;
        }

        // Set position and state properties if provided
        newShape.posX = shapeData.posX !== undefined ? shapeData.posX : 0;
        newShape.posY = shapeData.posY !== undefined ? shapeData.posY : 0;
        newShape.enabled = shapeData.enabled !== undefined ? shapeData.enabled : true;

        return newShape;
    }

    perimeterFromMask(mask) {
        let perimeter = 0;
        const height = mask.length;
        if (height === 0) return 0;
        const width = mask[0].length;
        if (width === 0) return 0;

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                if (mask[y][x]) {
                    // canvas is 0,0 at top left, so y is 0 the bottom row
                    // BOTTOM (skip if row 0, no gap under a shape)
                    if (y > 0 && !mask[y - 1][x]) perimeter++;

                    // TOP (count if exposed or out of bounds)
                    if (y === height - 1 || !mask[y + 1][x]) perimeter++;

                    // LEFT (count if exposed or out of bounds)
                    if (x === 0 || !mask[y][x - 1]) perimeter++;

                    // RIGHT (count if exposed or out of bounds)
                    if (x === width - 1 || !mask[y][x + 1]) perimeter++;
                }
            }
        }
        return perimeter;
    }

    getPerimeter() {
        return this.perimeterFromMask(this.data.bufferShape);
    }

    fillVoidSpaces(shape) {
        // Fill empty spaces between occupied spaces in each row
        // Same logic used for low-res buffer creation, adapted for high-res
        const result = shape.map(row => [...row]); // Deep copy

        for (let y = 0; y < result.length; y++) {
            const row = result[y];
            const firstTrue = row.indexOf(true);
            const lastTrue = row.lastIndexOf(true);

            // Only fill if we found occupied spaces in this row
            if (firstTrue !== -1 && lastTrue !== -1 && firstTrue <= lastTrue) {
                this.setTrueBetween(row, firstTrue, lastTrue);
            }
        }

        return result;
    }

    // Function to set values to true between two indices
    setTrueBetween(array, startIndex, endIndex) {
        for (let i = startIndex; i <= endIndex; i++) {
            array[i] = true;
        }
    }

    expandShapeBounds(shape, centerShape = false, scaleFactor = 1) {
        // Expand shape bounds with scale factor awareness
        // Ensures resulting dimensions are divisible by scaleFactor

        const height = shape.length;
        const width = shape[0].length;

        // Calculate minimum expansion (at least 1 on each side)
        const minExpansion = 1;

        // Calculate dimensions after minimum expansion
        const widthAfterMin = width + (2 * minExpansion);
        const heightAfterMin = height + minExpansion + (centerShape ? minExpansion : 0);

        // Calculate actual expansion to maintain divisibility
        const targetWidth = Math.ceil(widthAfterMin / scaleFactor) * scaleFactor;
        const targetHeight = Math.ceil(heightAfterMin / scaleFactor) * scaleFactor;

        const horizontalExpansion = targetWidth - width;
        const verticalExpansion = targetHeight - height;

        const leftExpansion = Math.floor(horizontalExpansion / 2);
        const rightExpansion = horizontalExpansion - leftExpansion;

        let topExpansion, bottomExpansion;
        if (centerShape) {
            // Center the shape - expand both top and bottom
            bottomExpansion = Math.floor(verticalExpansion / 2);
            topExpansion = verticalExpansion - bottomExpansion;
        } else {
            // Drop to bottom - expand only top
            topExpansion = verticalExpansion;
            bottomExpansion = 0;
        }

        const expansion = {
            left: leftExpansion,
            right: rightExpansion,
            top: topExpansion,
            bottom: bottomExpansion
        };
        
        const expandedShape = this.expandShape(shape, expansion);
        
        // Return both the expanded shape and the expansion data
        return {
            expandedShape: expandedShape,
            expansion: expansion
        };
    }

    expandShape(shape, padding) {
        // Flexible method to add specified padding to any 2D array
        // Automatically detects data type (boolean or object) and uses appropriate fill value
        // padding: { left: number, right: number, top: number, bottom: number }

        if (!shape || shape.length === 0) return shape;

        const height = shape.length;
        const width = shape[0].length;

        // Detect data type from first element
        let fillValue;
        const firstElement = shape[0][0];
        if (typeof firstElement === 'boolean') {
            fillValue = false;
        } else if (typeof firstElement === 'object') {
            // Create empty square object with same structure
            fillValue = {
                occupied: false,
                isPerimeter: false,
                isOriginalShape: false
            };
        } else {
            // Default to false for unknown types
            fillValue = false;
        }

        const newWidth = width + padding.left + padding.right;
        const newHeight = height + padding.top + padding.bottom;

        const result = [];

        // Helper function to create a new row filled with the appropriate value
        const createEmptyRow = (width) => {
            const row = [];
            for (let i = 0; i < width; i++) {
                // Clone the fill value if it's an object
                row.push(typeof fillValue === 'object' ? { ...fillValue } : fillValue);
            }
            return row;
        };

        // Add bottom padding rows first (since Y is flipped, bottom padding goes at array start)
        for (let i = 0; i < padding.bottom; i++) {
            result.push(createEmptyRow(newWidth));
        }

        // Copy existing rows with left and right padding
        for (let y = 0; y < height; y++) {
            const newRow = [];

            // Add left padding
            for (let i = 0; i < padding.left; i++) {
                newRow.push(typeof fillValue === 'object' ? { ...fillValue } : fillValue);
            }

            // Add original row content
            newRow.push(...shape[y]);

            // Add right padding
            for (let i = 0; i < padding.right; i++) {
                newRow.push(typeof fillValue === 'object' ? { ...fillValue } : fillValue);
            }

            result.push(newRow);
        }

        // Add top padding rows last (since Y is flipped, top padding goes at array end)
        for (let i = 0; i < padding.top; i++) {
            result.push(createEmptyRow(newWidth));
        }

        return result;
    }

    getDefaultProcessingConfig() {
        // Default configuration for shape processing when no config is provided
        return {
            customBufferSize: 0.25,  // inches
            centerShape: false,
            minWallLength: 1.0      // inches per cell
        };
    }

    getArea() {
        // Calculate the area of the shape by counting true values in bufferShape
        let area = 0;
        for (let y = 0; y < this.data.bufferShape.length; y++) {
            for (let x = 0; x < this.data.bufferShape[y].length; x++) {
                if (this.data.bufferShape[y][x] === true) {
                    area++;
                }
            }
        }
        return area;
    }

    generateHighResBuffer(bufferInches, centerShape = false, config = null) {
        // Main orchestrator - handles iteration and business logic for buffer expansion
        // Now starts with already-expanded highResShape and maintains synchronized dimensions

        // Use provided configuration or get default configuration
        config = config || this.getDefaultProcessingConfig();

        // Calculate scale factor early as we need it for all expansions
        const scaleFactor = RenderConfig.getScaleFactor(config.minWallLength);

        // Start with already-expanded high-res shape and fill void spaces
        let currentShape = this.data.highResShape.map(row => [...row]);

        // Step 1: Fill void spaces between occupied squares in each row
        const originalShape = currentShape.map(row => [...row]); // Keep reference to original before void filling
        currentShape = this.fillVoidSpaces(currentShape);

        // Step 2: Convert to square objects for buffer processing
        // Pass original shape to distinguish true shape squares from void-filled squares
        let shapeBuffer = this.convertBooleanArrayToSquareObjects(currentShape, originalShape);

        // Step 3: Always ensure proper bounds for flood fill and scale factor alignment
        // This is needed even when buffer = 0
        if (this.needsBoundsExpansion(shapeBuffer, centerShape)) {
            shapeBuffer = this.expandBothArrays(shapeBuffer, centerShape, scaleFactor);
        }

        // Calculate steps needed for buffer expansion (each step = 0.25" at high resolution)
        const steps = Math.round(bufferInches * scaleFactor);

        // Step 4: Iteratively expand outward for N steps (only if buffer > 0)
        if (bufferInches > 0 && steps > 0) {
            for (let step = 0; step < steps; step++) {
                // Check if we need to expand array bounds again during buffer expansion
                if (this.needsBoundsExpansion(shapeBuffer, centerShape)) {
                    shapeBuffer = this.expandBothArrays(shapeBuffer, centerShape, scaleFactor);
                }

                // Perform the perimeter expansion step with current step number (1-based)
                shapeBuffer = this.expandPerimeterOneStep(shapeBuffer, centerShape, step + 1);
            }
        }

        return shapeBuffer;
    }

    expandPerimeterOneStep(currentShape, centerShape = false) {
        // Expand perimeter squares outward by one step in all 8 directions
        const height = currentShape.length;
        const width = currentShape[0].length;

        // Step 1: Find all perimeter squares (occupied squares with at least one empty neighbor)
        const perimeterSquares = [];
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                if (currentShape[y][x].occupied) {
                    // Check if this occupied square has any empty neighbors (8-directional)
                    if (this.hasEmptyNeighbor(currentShape, x, y, width, height)) {
                        perimeterSquares.push({ x, y });
                    }
                }
            }
        }

        // Step 2: Collect all expansion targets from perimeter squares
        const expansionTargets = new Set();

        for (const { x, y } of perimeterSquares) {
            // Check all 8 neighbors of this perimeter square
            const neighbors = [
                { x: x - 1, y: y - 1 }, { x: x, y: y - 1 }, { x: x + 1, y: y - 1 }, // top row
                { x: x - 1, y: y }, { x: x + 1, y: y },   // middle row (skip center)
                { x: x - 1, y: y + 1 }, { x: x, y: y + 1 }, { x: x + 1, y: y + 1 }  // bottom row
            ];

            for (const neighbor of neighbors) {
                // Check if neighbor is within bounds
                if (neighbor.x >= 0 && neighbor.x < width &&
                    neighbor.y >= 0 && neighbor.y < height) {
                    // If neighbor is empty, mark it for expansion
                    if (!currentShape[neighbor.y][neighbor.x].occupied) {
                        expansionTargets.add(`${neighbor.x},${neighbor.y}`);
                    }
                }
            }
        }

        // Step 3: Apply all expansions in batch (copy current shape and apply changes)
        const result = currentShape.map(row => [...row]); // Deep copy

        for (const target of expansionTargets) {
            const [x, y] = target.split(',').map(Number);
            result[y][x] = {
                occupied: true,
                isPerimeter: false,
                isOriginalShape: false
            };
        }

        return result;
    }

    hasEmptyNeighbor(shape, x, y, width, height) {
        // Check if the square at (x,y) has any empty neighbors in 8 directions
        const neighbors = [
            { x: x - 1, y: y - 1 }, { x: x, y: y - 1 }, { x: x + 1, y: y - 1 }, // top row
            { x: x - 1, y: y }, { x: x + 1, y: y },   // middle row (skip center)
            { x: x - 1, y: y + 1 }, { x: x, y: y + 1 }, { x: x + 1, y: y + 1 }  // bottom row
        ];

        for (const neighbor of neighbors) {
            // Check bounds
            if (neighbor.x >= 0 && neighbor.x < width &&
                neighbor.y >= 0 && neighbor.y < height) {
                // If neighbor is empty, this is a perimeter square
                if (!shape[neighbor.y][neighbor.x].occupied) {
                    return true;
                }
            }
        }
        return false;
    }

    convertBooleanArrayToSquareObjects(booleanArray, originalShapeArray = null) {
        // Convert boolean[][] to object[][] with shape metadata
        // Each square: { occupied: boolean, isPerimeter: boolean, isOriginalShape: boolean }
        // originalShapeArray: reference to distinguish true shape squares from void-filled squares

        const result = [];

        for (let y = 0; y < booleanArray.length; y++) {
            const row = [];
            for (let x = 0; x < booleanArray[y].length; x++) {
                const wasOccupied = booleanArray[y][x];
                // Check if this square was in the original shape (before void filling)
                const isOriginal = originalShapeArray ? originalShapeArray[y][x] : wasOccupied;
                row.push({
                    occupied: wasOccupied,
                    isPerimeter: false,  // Will be set by perimeter detection
                    isOriginalShape: isOriginal  // True only for original shape squares
                });
            }
            result.push(row);
        }

        return result;
    }

    needsBoundsExpansion(currentShape, centerShape = false) {
        // Check if any occupied squares are touching the array boundaries
        // This indicates we need to expand the array bounds before the next expansion step
        const height = currentShape.length;
        const width = currentShape[0].length;

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                if (currentShape[y][x].occupied) {
                    // Check if occupied square is touching any boundary

                    // Left boundary (x = 0)
                    if (x === 0) {
                        return true;
                    }

                    // Right boundary (x = width - 1)
                    if (x === width - 1) {
                        return true;
                    }

                    // Bottom boundary (y = 0) - only check if we're centering the shape
                    if (y === 0 && centerShape) {
                        return true;
                    }

                    // Top boundary (y = height - 1) - always check
                    if (y === height - 1) {
                        return true;
                    }
                }
            }
        }

        return false;
    }

    expandBothArrays(bufferShape, centerShape = false, scaleFactor = 1) {
        // Expand buffer array bounds to keep occupied squares away from edges
        // and maintain dimensions divisible by scaleFactor
        // Note: keep highResShape as pure shape data, no expansion/padding

        // First calculate the expansion needed
        const currentHeight = bufferShape.length;
        const currentWidth = bufferShape[0].length;

        // Calculate how much to expand to maintain scale factor divisibility
        const minExpansion = 1;

        // Calculate current dimensions after minimum expansion
        const widthAfterMin = currentWidth + (2 * minExpansion);
        const heightAfterMinTop = currentHeight + minExpansion;
        const heightAfterMinBoth = currentHeight + (2 * minExpansion);

        // Calculate actual expansion needed to maintain divisibility
        const leftRightExpansion = Math.ceil(widthAfterMin / scaleFactor) * scaleFactor - currentWidth;
        const leftExpansion = Math.floor(leftRightExpansion / 2);
        const rightExpansion = leftRightExpansion - leftExpansion;

        let topExpansion, bottomExpansion;
        if (centerShape) {
            // Center the shape - expand both top and bottom
            const totalVerticalExpansion = Math.ceil(heightAfterMinBoth / scaleFactor) * scaleFactor - currentHeight;
            bottomExpansion = Math.floor(totalVerticalExpansion / 2);
            topExpansion = totalVerticalExpansion - bottomExpansion;
        } else {
            // Drop to bottom - expand only top
            topExpansion = Math.ceil(heightAfterMinTop / scaleFactor) * scaleFactor - currentHeight;
            bottomExpansion = 0;
        }

        const expansion = {
            left: leftExpansion,
            right: rightExpansion,
            top: topExpansion,
            bottom: bottomExpansion
        };

        // Expand only the buffer shape (highResShape remains pure shape data)
        const expandedBuffer = this.expandShape(bufferShape, expansion);

        return expandedBuffer;
    }

    expandArrayBounds(currentShape, centerShape = false, scaleFactor = 1) {
        // Expand the array bounds to keep occupied squares away from edges
        // and maintain dimensions divisible by scaleFactor

        const height = currentShape.length;
        const width = currentShape[0].length;

        // Calculate how much to expand to maintain scale factor divisibility
        // We want to add at least 1, but enough to keep divisible by scaleFactor
        const minExpansion = 1;

        // Calculate current dimensions after minimum expansion
        const widthAfterMin = width + (2 * minExpansion);
        const heightAfterMinTop = height + minExpansion;
        const heightAfterMinBoth = height + (2 * minExpansion);

        // Calculate actual expansion needed to maintain divisibility
        const leftRightExpansion = Math.ceil(widthAfterMin / scaleFactor) * scaleFactor - width;
        const leftExpansion = Math.floor(leftRightExpansion / 2);
        const rightExpansion = leftRightExpansion - leftExpansion;

        let topExpansion, bottomExpansion;
        if (centerShape) {
            // Center the shape - expand both top and bottom
            const totalVerticalExpansion = Math.ceil(heightAfterMinBoth / scaleFactor) * scaleFactor - height;
            bottomExpansion = Math.floor(totalVerticalExpansion / 2);
            topExpansion = totalVerticalExpansion - bottomExpansion;
        } else {
            // Drop to bottom - expand only top
            topExpansion = Math.ceil(heightAfterMinTop / scaleFactor) * scaleFactor - height;
            bottomExpansion = 0;
        }

        // Use the unified expandShape method
        return this.expandShape(currentShape, {
            left: leftExpansion,
            right: rightExpansion,
            top: topExpansion,
            bottom: bottomExpansion
        });
    }

    // Data processing utility methods for shape buffer analysis
    static identifyPerimeterSquares(squareObjects) {
        // Use flood fill from edge squares to identify perimeter squares
        // Perimeter squares are occupied squares adjacent to flood-filled empty space

        const height = squareObjects.length;
        const width = squareObjects[0].length;
        const visited = new Set();

        // Get all edge squares as starting points (guaranteed empty after bounds expansion)
        const startingPoints = Shape.getAllEdgeSquares(squareObjects);

        // BFS flood fill from outside edges
        const queue = [...startingPoints];

        while (queue.length > 0) {
            const [x, y] = queue.shift();
            const key = `${x},${y}`;

            if (visited.has(key)) continue;

            // Bounds check
            if (x < 0 || x >= width || y < 0 || y >= height) continue;

            const square = squareObjects[y][x];

            if (!square.occupied) {
                // Empty square - continue flood fill to neighbors
                visited.add(key);
                Shape.addUnvisitedNeighbors(queue, x, y, visited, width, height);
            } else {
                // Occupied square adjacent to flood-filled area = perimeter
                if (!square.isPerimeter) {
                    square.isPerimeter = true;
                }
            }
        }
    }

    static getAllEdgeSquares(squareObjects) {
        // Return all squares on the edges of the grid (guaranteed empty after bounds expansion)
        const height = squareObjects.length;
        const width = squareObjects[0].length;
        const edgeSquares = [];

        // Top edge (array end = visual top due to Y-flip)
        for (let x = 0; x < width; x++) {
            edgeSquares.push([x, height - 1]);
        }

        // Bottom edge (array start = visual bottom)
        for (let x = 0; x < width; x++) {
            edgeSquares.push([x, 0]);
        }

        // Left edge
        for (let y = 0; y < height; y++) {
            edgeSquares.push([0, y]);
        }

        // Right edge  
        for (let y = 0; y < height; y++) {
            edgeSquares.push([width - 1, y]);
        }

        return edgeSquares;
    }

    static addUnvisitedNeighbors(queue, x, y, visited, width, height) {
        // Add unvisited 4-connected neighbors to the queue
        const neighbors = [
            [x - 1, y], // left
            [x + 1, y], // right  
            [x, y - 1], // down (visual)
            [x, y + 1]  // up (visual)
        ];

        for (const [nx, ny] of neighbors) {
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                const key = `${nx},${ny}`;
                if (!visited.has(key)) {
                    queue.push([nx, ny]);
                }
            }
        }
    }

}

// Only export the class when in a Node.js environment (e.g., during Jest tests)
// Ignored when the app is running in the browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Shape;
}