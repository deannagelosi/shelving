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
            gridArea: 0, // the number of grid squares in the shape
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

    // ========================
    // Core Utility Methods
    // ========================

    trimToBoundingBox(array) {
        // Works with both boolean[][] and object[][] arrays
        // Returns trimmed array with no empty rows/columns on edges

        if (!array || array.length === 0) return array;

        const height = array.length;
        const width = array[0].length;

        let minY = height, maxY = -1;
        let minX = width, maxX = -1;

        // Find bounds of all occupied cells
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const cell = array[y][x];
                const isOccupied = typeof cell === 'boolean' ? cell : (cell && cell.occupied);

                if (isOccupied) {
                    minY = Math.min(minY, y);
                    maxY = Math.max(maxY, y);
                    minX = Math.min(minX, x);
                    maxX = Math.max(maxX, x);
                }
            }
        }

        // If no occupied cells found, return empty array
        if (maxY < 0 || maxX < 0) return [[]];

        // Trim to bounding box
        const result = [];
        for (let y = minY; y <= maxY; y++) {
            const row = [];
            for (let x = minX; x <= maxX; x++) {
                row.push(array[y][x]);
            }
            result.push(row);
        }

        return result;
    }

    convertArrayType(array, targetType, originalShape = null) {
        // Converts between boolean[][] and object[][] formats
        // targetType: 'boolean' or 'object'
        // originalShape: optional reference for distinguishing original vs filled cells

        if (!array || array.length === 0) return array;

        const result = [];

        for (let y = 0; y < array.length; y++) {
            const row = [];
            for (let x = 0; x < array[y].length; x++) {
                const cell = array[y][x];

                if (targetType === 'boolean') {
                    // Convert to boolean
                    const value = typeof cell === 'boolean' ? cell : (cell && cell.occupied);
                    row.push(value);
                } else if (targetType === 'object') {
                    // Convert to object
                    if (typeof cell === 'boolean') {
                        const isOriginal = originalShape ? originalShape[y] && originalShape[y][x] : cell;
                        row.push({
                            occupied: cell,
                            isPerimeter: false,
                            isOriginalShape: isOriginal
                        });
                    } else {
                        // Already an object, just pass through
                        row.push(cell);
                    }
                }
            }
            result.push(row);
        }

        return result;
    }

    calculateBounds(array) {
        // Delegate to MathUtils for consistent bounds calculation
        return MathUtils.calculateBounds(array);
    }

    detectEdgeTouching(array, bounds) {
        // Determine if occupied cells touch any array edges
        const height = array.length;
        const width = array[0] ? array[0].length : 0;

        return {
            left: bounds.minX === 0,
            right: bounds.maxX === width - 1,
            bottom: bounds.minY === 0,
            top: bounds.maxY === height - 1
        };
    }

    getScaleAlignedDimensions(width, height, scaleFactor, centerShape) {
        // Calculate dimensions and padding needed for scale factor alignment
        const targetWidth = Math.ceil(width / scaleFactor) * scaleFactor;
        const targetHeight = Math.ceil(height / scaleFactor) * scaleFactor;

        const horizontalPadding = targetWidth - width;
        const verticalPadding = targetHeight - height;

        // Use MathUtils for consistent padding distribution
        const hPad = MathUtils.distributePadding(horizontalPadding, true); // Always center horizontally
        const vPad = MathUtils.distributePadding(verticalPadding, centerShape);

        return {
            width: targetWidth,
            height: targetHeight,
            padding: {
                left: hPad.start,
                right: hPad.end,
                top: vPad.start,
                bottom: vPad.end
            }
        };
    }

    saveUserInput(_title, _inputGrid, config = null) {
        // Clean linear pipeline for shape processing
        this.data.title = _title;
        this.data.inputGrid = _inputGrid;

        // Use provided configuration or get default configuration
        config = config || this.getDefaultProcessingConfig();
        const scaleFactor = RenderConfig.getScaleFactor(config.minWallLength);

        // Step 1: Trim input to bounding box
        const trimmed = this.trimToBoundingBox(_inputGrid);
        this.data.highResShape = trimmed; // Store pure shape content

        // Step 2: Fill void spaces between occupied cells
        const filled = this.fillVoidSpaces(trimmed);

        // Step 3: Convert to object array for processing
        let processed = this.convertArrayType(filled, 'object', trimmed);

        // Step 4: Detect edges with minimal expansion
        processed = this.detectEdges(processed, config.centerShape);

        // Step 5: Initial scale factor alignment (without centering if buffer will be applied)
        processed = this.alignToScaleFactor(processed, scaleFactor, config.customBufferSize > 0 ? false : config.centerShape);

        // Store a copy before buffer for lowResShape generation
        const preBufferProcessed = processed.map(row => row.map(cell => ({ ...cell })));

        // Step 6: Apply custom buffer if specified (pure growth phase)
        if (config.customBufferSize > 0) {
            // convert buffer from inches to highres units (1 highres = 0.25", independent of minWallLength)
            const bufferSteps = MathUtils.inchesToHighres(config.customBufferSize);

            // apply buffer expansion (operates in highres space, no scale factor involved)
            processed = this.applyBuffer(processed, bufferSteps, config.centerShape);

            // Final trim to remove any growth artifacts
            processed = this.trimToBoundingBox(processed);

            // realign to scale factor after buffer (buffer changes dimensions, need to realign with centering)
            processed = this.alignToScaleFactor(processed, scaleFactor, config.centerShape);
        }

        // Store high-res buffer shape (with buffer applied)
        this.data.highResBufferShape = processed;

        // Step 7: Generate low-res versions
        // Use the pre-buffer processed shape (aligned but without buffer) for low-res scaling
        const alignedBoolean = this.convertArrayType(preBufferProcessed, 'boolean');
        this.data.lowResShape = this.downsampleToLowRes(alignedBoolean, scaleFactor);
        this.data.bufferShape = this.generateLowResBufferFromHighRes(config.minWallLength);

        // Step 8: Calculate shape stats
        this.data.gridArea = this.getGridArea();
    }

    // ========================
    // Processing Pipeline Methods
    // ========================

    detectEdges(shape, centerShape) {
        // Detect edges using minimal expansion and flood fill

        // Add minimal expansion for flood fill (1 cell on each side)
        const minimalPadding = {
            left: 1,
            right: 1,
            top: 1,
            bottom: centerShape ? 1 : 0
        };

        const expanded = this.expandShape(shape, minimalPadding);

        // Run flood fill from edges to identify perimeter
        Shape.identifyPerimeterSquares(expanded);

        // Trim back to occupied cells (expansion only added empty cells)
        return this.trimToBoundingBox(expanded);
    }

    alignToScaleFactor(shape, scaleFactor, centerShape) {
        // Ensure shape dimensions are divisible by scale factor
        const height = shape.length;
        const width = shape[0] ? shape[0].length : 0;

        // Check if already divisible - if so, no padding needed
        if (width % scaleFactor === 0 && height % scaleFactor === 0) {
            return shape; // Perfect fit, no changes needed
        }

        // Calculate exact padding needed for scale factor divisibility
        const widthRemainder = width % scaleFactor;
        const heightRemainder = height % scaleFactor;

        // Add minimum padding to reach next scale factor boundary
        const widthPaddingNeeded = widthRemainder === 0 ? 0 : scaleFactor - widthRemainder;
        const heightPaddingNeeded = heightRemainder === 0 ? 0 : scaleFactor - heightRemainder;

        // Use MathUtils for consistent padding distribution
        const hPad = MathUtils.distributePadding(widthPaddingNeeded, true); // Always center horizontally
        const vPad = MathUtils.distributePadding(heightPaddingNeeded, centerShape);

        return this.expandShape(shape, {
            left: hPad.start,
            right: hPad.end,
            top: vPad.start,
            bottom: vPad.end
        });
    }

    applyBuffer(shape, bufferSteps, centerShape) {
        // Apply pure buffer expansion in N steps
        // bufferSteps: number of highres squares to expand (1 step = 0.25")
        // Operates entirely in highres coordinate space
        let current = shape;

        for (let step = 0; step < bufferSteps; step++) {
            // Check if shape touches any edges and needs minimal room for expansion
            const bounds = this.calculateBounds(current);
            const touchesEdges = this.detectEdgeTouching(current, bounds);

            // Add minimal padding only where needed for expansion
            // When centerShape is true, we allow expansion in all directions
            // When centerShape is false, we don't expand bottom
            const padding = {
                left: touchesEdges.left ? 1 : 0,
                right: touchesEdges.right ? 1 : 0,
                top: touchesEdges.top ? 1 : 0,
                bottom: (touchesEdges.bottom && centerShape) ? 1 : 0
            };

            // Add minimal padding if needed
            if (padding.left || padding.right || padding.top || padding.bottom) {
                current = this.expandShape(current, padding);
            }

            // Perform the expansion step
            current = this.expandBufferByOneStep(current, centerShape);
        }

        return current;
    }



    downsampleToLowRes(highResShape, scaleFactor) {
        // Pure downsampling: convert high-res shape to low-res by checking occupied squares
        const highResHeight = highResShape.length;
        const highResWidth = highResShape[0] ? highResShape[0].length : 0;

        const lowResHeight = Math.ceil(highResHeight / scaleFactor);
        const lowResWidth = Math.ceil(highResWidth / scaleFactor);

        const result = [];

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
                        const square = highResShape[highY][highX];
                        const isOccupied = typeof square === 'boolean' ? square : (square && square.occupied);
                        if (isOccupied) {
                            hasOccupiedSquare = true;
                            break;
                        }
                    }
                    if (hasOccupiedSquare) break;
                }

                lowResRow.push(hasOccupiedSquare);
            }
            result.push(lowResRow);
        }

        return result;
    }

    applyVoidFilling(lowResArray) {
        // Fill gaps between occupied cells in each row to prevent under-hangs
        const result = lowResArray.map(row => [...row]); // Deep copy

        for (let y = 0; y < result.length; y++) {
            const row = result[y];
            const firstTrue = row.indexOf(true);
            const lastTrue = row.lastIndexOf(true);

            if (firstTrue !== -1 && lastTrue !== -1 && firstTrue < lastTrue) {
                this.setTrueBetween(row, firstTrue, lastTrue);
            }
        }

        return result;
    }

    generateLowResBufferFromHighRes(minWallLength = 1.0) {
        // Generate low-res buffer shape by downsampling high-res buffer and applying void filling
        if (!this.data.highResBufferShape || this.data.highResBufferShape.length === 0) {
            console.warn('[Shape] No high-res buffer shape available for low-res generation');
            return [[]];
        }

        const scaleFactor = RenderConfig.getScaleFactor(minWallLength);

        // Step 1: Pure downsampling
        const lowResBuffer = this.downsampleToLowRes(this.data.highResBufferShape, scaleFactor);

        // Step 2: Apply void filling to prevent under-hangs
        return this.applyVoidFilling(lowResBuffer);
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

    calculatePerimeter(mask) {
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
        return this.calculatePerimeter(this.data.bufferShape);
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

    getGridArea() {
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


    expandBufferByOneStep(currentShape, centerShape = false) {
        // Expand buffer by expanding perimeter squares outward by one step in all 8 directions
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






    // ========================
    // Static Utility Methods
    // ========================

    static identifyPerimeterSquares(squareObjects) {
        // Use flood fill from edge squares to identify perimeter squares
        // Static utility method for use by renderers
        if (!squareObjects || squareObjects.length === 0) return;

        const height = squareObjects.length;
        const width = squareObjects[0].length;
        const visited = new Set();

        // Get all edge squares as starting points
        const startingPoints = [];

        // Top and bottom edges
        for (let x = 0; x < width; x++) {
            startingPoints.push([x, 0]); // bottom
            startingPoints.push([x, height - 1]); // top
        }

        // Left and right edges
        for (let y = 0; y < height; y++) {
            startingPoints.push([0, y]); // left
            startingPoints.push([width - 1, y]); // right
        }

        // BFS flood fill from outside edges
        const queue = [...startingPoints];

        while (queue.length > 0) {
            const [x, y] = queue.shift();
            const key = `${x},${y}`;

            if (visited.has(key)) continue;
            if (x < 0 || x >= width || y < 0 || y >= height) continue;

            const square = squareObjects[y][x];

            if (!square.occupied) {
                // Empty square - continue flood fill
                visited.add(key);

                // Add 4-connected neighbors
                queue.push([x - 1, y]);
                queue.push([x + 1, y]);
                queue.push([x, y - 1]);
                queue.push([x, y + 1]);
            } else {
                // Occupied square adjacent to flood-filled area = perimeter
                square.isPerimeter = true;
            }
        }
    }

}

// Only export the class when in a Node.js environment (e.g., during Jest tests)
// Ignored when the app is running in the browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Shape;
}