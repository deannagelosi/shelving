// A lazy-loaded, cached reference to the Shape class.
// This avoids a top-level declaration that causes redeclaration
// errors in the browser/worker environment.
let _Shape;
function getShape() {
    if (_Shape) {
        return _Shape;
    }
    // In a browser/worker, 'Shape' is loaded via script tag and will be in the global scope.
    // In Node.js (Jest), it needs to be required.
    if (typeof Shape !== 'undefined') {
        _Shape = Shape;
    } else {
        _Shape = require('./Shape');
    }
    return _Shape;
}

// Weights for objective functions in calcScore
const WEIGHTS = {
    // ----- Overlap / collision -----
    overlapShapeExponent: 3,           // shapes^exponent multiplier when any overlap exists

    // ----- Empty-space clustering -----
    clusterPenaltyExponent: 4,         // (clusters above min)^exponent multiplier
    clusterLimit: 5,                   // >= this annealScore is considered clustered

    // ----- Floating shapes (gravity) -----
    bottomLiftExponent: 3,             // shapes^exponent multiplier when any bottom lift exists
    emptyRowDivisor: 1.5,              // divisor applied to shapes.length for empty-row contribution

    // ----- General wasted space -----
    spaceScalar: 0.1,                  // linear scaling factor for total empty space
    areaDifferenceScalar: 100.0,         // scales the penalty for deviating from target area

    // ----- Aspect ratio handling -----
    aspectExponent: 2,                 // (ratio deviation)^exponent
    targetWideRatio: 2,                // w/h target when aspectRatioPref === 1 (wide)
    targetTallRatio: 0.5,              // w/h target when aspectRatioPref === -1 (tall)
    targetSquareRatio: 1               // w/h target when aspectRatioPref === 0 (square)
};

class Solution {
    constructor(_shapes = [], _startID = 0, _layoutConfig = {}, _wallConfig = {}, _bufferConfig = {}) {
        this.shapes = _shapes; // shapes with position data
        this.startID = _startID; // the multi-start index this solution annealed from
        this.layout = [[]]; // 2D array of shapes that occupy the layout

        // Layout configuration
        this.aspectRatioPref = _layoutConfig.aspectRatioPref || 0; // -1 for tall, 0 for square, 1 for wide layouts
        this.useCustomPerimeter = _layoutConfig.useCustomPerimeter || false;

        // Wall generation configuration
        this.wallAlgorithm = _wallConfig.algorithm || 'cellular-organic';
        this.cubbyCurveRadius = _wallConfig.cubbyCurveRadius || 0.5;
        this.bendRadius = _wallConfig.bendRadius || 1.0;
        this.maxBends = _wallConfig.maxBends || 4;

        // Shape buffer configuration (used during generation)
        this.customBufferSize = _bufferConfig.customBufferSize !== undefined ? _bufferConfig.customBufferSize : 0.25;
        this.centerShape = _bufferConfig.centerShape !== undefined ? _bufferConfig.centerShape : false;
        this.minWallLength = _bufferConfig.minWallLength !== undefined ? _bufferConfig.minWallLength : 1.0;

        // === CONVERSION BOUNDARY: Inches -> Grid ===
        // Store perimeter in both inches (for UI/export) and grid units (for layout logic)
        this.perimeterWidthInches = _layoutConfig.perimeterWidthInches || 0;
        this.perimeterHeightInches = _layoutConfig.perimeterHeightInches || 0;
        this.perimeterWidthGrid = MathUtils.inchesToGridUnits(this.perimeterWidthInches, this.minWallLength);
        this.perimeterHeightGrid = MathUtils.inchesToGridUnits(this.perimeterHeightInches, this.minWallLength);
        this.goalPerimeterGrid = null; // {x, y, width, height} in grid units

        this.score;
        this.valid = false;

        this.initialLayoutAreaModifier = 1.5;
    }

    randomLayout() {
        // randomly place shapes in the layout as an initial solution
        // annealing will optimize the layout from here

        // find the total area (in terms of number of grid squares) of all shapes
        // - find the area of each shape + buffer
        // - sum up all the areas
        let totalArea = 0;
        for (let i = 0; i < this.shapes.length; i++) {
            let shapeHeight = this.shapes[i].data.bufferShape.length;
            let shapeWidth = this.shapes[i].data.bufferShape[0].length;
            totalArea += (shapeHeight * shapeWidth);
        }
        // give extra space and find the closest rectangle that can hold that area
        let layoutArea = totalArea * this.initialLayoutAreaModifier;
        let width = Math.ceil(Math.sqrt(layoutArea));
        let height = Math.ceil(layoutArea / width);

        // pick random locations for each shape within the potential layout bounds
        for (let i = 0; i < this.shapes.length; i++) {
            let currShape = this.shapes[i];
            currShape.posX = Math.floor(Math.random() * width);
            currShape.posY = Math.floor(Math.random() * height);
        }

        // make the layout using the random positions and calculate the score
        this.makeLayout();

        // Initialize goal perimeter once at the beginning of annealing (not during neighbor creation)
        if (this.useCustomPerimeter) {
            this.centerGoalPerimeterGrid();
        }

        this.calcScore();
    }

    makeBlankLayout(_gridSize) {
        // set default blank values needed to display just the grid
        this.layout = new Array(_gridSize).fill(null).map(() => new Array(_gridSize).fill([]));
    }

    makeLayout() {
        // create a 2D array to represent the layout design space

        this.layout = [[]]; // clear the layout

        // place data about shapes into the layout grid
        for (let i = 0; i < this.shapes.length; i++) {
            let shape = this.shapes[i];

            // posData is stored in each layout grid square
            let posData = {
                shapes: [],
                isShape: [], // a lowRes shape square 
                isBuffer: [], // a buffer square for the shape
                annealScore: 0,
                terrainValue: 0
            };

            // loop shape's buffer height & width to place the full footprint in the layout
            for (let y = 0; y < shape.data.bufferShape.length; y++) {
                for (let x = 0; x < shape.data.bufferShape[y].length; x++) {

                    // place shapes, growing layout if shapes placed out-of-bounds
                    if (shape.data.bufferShape[y][x]) {

                        // grow the layout to fit the shape
                        let xInBounds = shape.posX + x + 1 < this.layout[0].length;
                        let yInBounds = shape.posY + y < this.layout.length;

                        while (!xInBounds) {
                            // grow the x+ direction by two
                            for (let i = 0; i < this.layout.length; i++) {
                                // grow every row with a new posData object
                                this.layout[i].push(JSON.parse(JSON.stringify(posData)));
                                this.layout[i].push(JSON.parse(JSON.stringify(posData)));
                            }
                            xInBounds = shape.posX + x + 1 < this.layout[0].length;
                        }
                        while (!yInBounds) {
                            // grow the y+ direction
                            // add a new row filled with unique objects
                            let newRow = new Array(this.layout[0].length).fill(null).map(() => (JSON.parse(JSON.stringify(posData))));
                            this.layout.push(newRow);

                            yInBounds = shape.posY + y < this.layout.length;
                        }

                        // save the shape to the layout posData
                        this.layout[shape.posY + y][shape.posX + x].shapes.push(shape);

                        // determine if square is occupied by the shape, or by it's buffer
                        let lowResShapeInBounds = y < shape.data.lowResShape.length && x < shape.data.lowResShape[0].length;
                        if (lowResShapeInBounds) {
                            this.layout[shape.posY + y][shape.posX + x].isShape.push(shape.data.lowResShape[y][x]);
                        }

                        let bufferInBounds = y < shape.data.bufferShape.length && x < shape.data.bufferShape[0].length;
                        if (bufferInBounds) {
                            this.layout[shape.posY + y][shape.posX + x].isBuffer.push(shape.data.bufferShape[y][x]);
                        }
                    }
                }
            }
        }

        // Calculate the natural bounding box of shapes
        const naturalBounds = this.calculateNaturalBounds();
        const naturalWidth = naturalBounds.right - naturalBounds.left + 1;
        const naturalHeight = naturalBounds.bottom - naturalBounds.top + 1;

        // Determine target dimensions: use larger of natural bounds or user preference
        let targetWidth, targetHeight;
        if (this.useCustomPerimeter) {
            targetWidth = Math.max(naturalWidth, this.perimeterWidthGrid);
            targetHeight = Math.max(naturalHeight, this.perimeterHeightGrid);
        } else {
            targetWidth = naturalWidth;
            targetHeight = naturalHeight;
        }

        // Resize layout to bounding box of shapes or target dimensions
        this.resizeLayoutToExactDimensions(targetWidth, targetHeight, naturalBounds);

        // assign IDs to shapes based on position
        for (let i = 0; i < this.shapes.length; i++) {
            let shapeID = this.shapes[i].posY.toString() + this.shapes[i].posX.toString();
            this.shapes[i].shapeID = shapeID;
        }
    }

    // Calculate what the natural bounding box would be (without actually trimming)
    calculateNaturalBounds() {
        if (this.layout.length === 0 || this.layout[0].length === 0) {
            return { top: 0, bottom: 0, left: 0, right: 0 };
        }

        let top = 0;
        let bottom = this.layout.length - 1;
        let left = 0;
        let right = this.layout[0].length - 1;

        // Find first non-empty row from top
        while (top < this.layout.length && this.layout[top].every(posData => posData.shapes.length == 0)) {
            top++;
        }

        // Find first non-empty row from bottom
        while (bottom >= 0 && this.layout[bottom].every(posData => posData.shapes.length == 0)) {
            bottom--;
        }

        // Find first non-empty column from left
        while (left < this.layout[0].length && this.layout.every(row => row[left].shapes.length == 0)) {
            left++;
        }

        // Find first non-empty column from right
        while (right >= 0 && this.layout.every(row => row[right].shapes.length == 0)) {
            right--;
        }

        return { top, bottom, left, right };
    }

    // Helper methods for layout manipulation
    isRowEmpty(y) {
        if (y < 0 || y >= this.layout.length) return true;
        return this.layout[y].every(posData => posData.shapes.length === 0);
    }

    isColumnEmpty(x) {
        if (this.layout.length === 0) return true;
        return this.layout.every(row => {
            // Return true if column doesn't exist (treat as empty) or if it exists and is empty
            return x >= row.length || row[x].shapes.length === 0;
        });
    }

    createEmptyCell() {
        return {
            shapes: [],
            isShape: [],
            isBuffer: [],
            annealScore: 0,
            terrainValue: 0
        };
    }

    expandLayoutToSize(targetWidth, targetHeight) {
        // Add columns to the right if needed
        if (this.layout[0].length < targetWidth) {
            for (let y = 0; y < this.layout.length; y++) {
                while (this.layout[y].length < targetWidth) {
                    this.layout[y].push(this.createEmptyCell());
                }
            }
        }

        // Add rows to the bottom if needed
        if (this.layout.length < targetHeight) {
            const currentWidth = this.layout[0].length; // Use actual current width, not target
            while (this.layout.length < targetHeight) {
                const newRow = [];
                for (let x = 0; x < currentWidth; x++) {
                    newRow.push(this.createEmptyCell());
                }
                this.layout.push(newRow);
            }
        }
    }

    trimToTargetSize(targetWidth, targetHeight) {
        // Find the actual bounding box of content in the current layout
        const currentBounds = this.calculateCurrentLayoutBounds();

        if (!currentBounds) {
            // No content found, resize to target dimensions
            this.layout = [];
            for (let y = 0; y < targetHeight; y++) {
                const newRow = [];
                for (let x = 0; x < targetWidth; x++) {
                    newRow.push(this.createEmptyCell());
                }
                this.layout.push(newRow);
            }
            return;
        }

        // Calculate the dimensions we need: larger of content bounds or target
        const contentWidth = currentBounds.right - currentBounds.left + 1;
        const contentHeight = currentBounds.bottom - currentBounds.top + 1;
        const finalWidth = Math.max(contentWidth, targetWidth);
        const finalHeight = Math.max(contentHeight, targetHeight);

        // Trim from left
        while (currentBounds.left > 0 && this.isColumnEmpty(0)) {
            for (let y = 0; y < this.layout.length; y++) {
                this.layout[y].shift();
            }
            // Update shape positions and bounds
            for (let shape of this.shapes) {
                shape.posX--;
            }
            currentBounds.left--;
            currentBounds.right--;
        }

        // Trim from top
        while (currentBounds.top > 0 && this.isRowEmpty(0)) {
            this.layout.shift();
            // Update shape positions and bounds
            for (let shape of this.shapes) {
                shape.posY--;
            }
            currentBounds.top--;
            currentBounds.bottom--;
        }

        // Trim from right
        while (this.layout[0].length > finalWidth && this.isColumnEmpty(this.layout[0].length - 1)) {
            for (let y = 0; y < this.layout.length; y++) {
                this.layout[y].pop();
            }
        }

        // Trim from bottom
        while (this.layout.length > finalHeight && this.isRowEmpty(this.layout.length - 1)) {
            this.layout.pop();
        }
    }

    calculateCurrentLayoutBounds() {
        // Find the actual bounds of non-empty cells in the current layout
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        let hasContent = false;

        for (let y = 0; y < this.layout.length; y++) {
            for (let x = 0; x < this.layout[y].length; x++) {
                if (this.layout[y][x].shapes.length > 0) {
                    minX = Math.min(minX, x);
                    maxX = Math.max(maxX, x);
                    minY = Math.min(minY, y);
                    maxY = Math.max(maxY, y);
                    hasContent = true;
                }
            }
        }

        return hasContent ? { left: minX, right: maxX, top: minY, bottom: maxY } : null;
    }

    // Resize layout to exact target dimensions
    resizeLayoutToExactDimensions(targetWidth, targetHeight, naturalBounds) {
        if (this.layout.length === 0) {
            return;
        }

        // First expand if needed, then trim to proper bounds
        this.expandLayoutToSize(targetWidth, targetHeight);
        this.trimToTargetSize(targetWidth, targetHeight);
    }

    calcScore() {
        // the objective function in simulated annealing

        // calculate annealing scores and find squares with overlapping shapes
        this.score = 0; // reset the score
        let overlappingCount = 0; // number of squares containing overlapping shapes
        let totalSquares = 0;
        for (let y = 0; y < this.layout.length; y++) {
            for (let x = 0; x < this.layout[y].length; x++) {
                totalSquares++;

                // the number squares with overlapping shapes
                if (this.layout[y][x].shapes.length > 1) {
                    overlappingCount += this.layout[y][x].shapes.length - 1;
                }

                // the number with an anneal score of 8 (no adjacent empty spots) and calc ratio
                if (this.layout[y][x].shapes.length == 0) {
                    // grid square is empty, calculate the score
                    let annealScore = 8;
                    // check the 8 possible adjacent squares
                    for (let localY = Math.max(0, y - 1); localY <= Math.min(y + 1, this.layout.length - 1); localY++) {
                        for (let localX = Math.max(0, x - 1); localX <= Math.min(x + 1, this.layout[0].length - 1); localX++) {
                            // don't count the square itself
                            if (localX !== x || localY !== y) {
                                // count if the adjacent square is not empty
                                if (this.layout[localY][localX].shapes.length > 0) {
                                    annealScore--;
                                }
                            }
                        }
                    }
                    // assign the score
                    this.layout[y][x].annealScore = annealScore;
                }
            }
        }

        // find the cluster penalties, ie. squares touching squares of the same value (above a limit)
        // - add up all anneal scores
        // - add up empty squares under an object, from the object to the floor
        let clusterPenalty = 0;
        let totalAnnealScore = 0;
        for (let y = 0; y < this.layout.length; y++) {
            for (let x = 0; x < this.layout[y].length; x++) {
                let annealScore = this.layout[y][x].annealScore;
                totalAnnealScore += annealScore;

                if (annealScore >= WEIGHTS.clusterLimit) {
                    // look at all the squares surrounding this one and count the number's that are the same 
                    let checkCount = 0;
                    // check the 8 possible adjacent squares
                    for (let localY = Math.max(0, y - 1); localY <= Math.min(y + 1, this.layout.length - 1); localY++) {
                        for (let localX = Math.max(0, x - 1); localX <= Math.min(x + 1, this.layout[0].length - 1); localX++) {
                            // don't count the square itself
                            if (localX !== x || localY !== y) {
                                // count if the adjacent square is the same score
                                if (this.layout[localY][localX].annealScore == annealScore) {
                                    // skew larger clustered scores as worse
                                    clusterPenalty += Math.pow((annealScore - WEIGHTS.clusterLimit + 1), WEIGHTS.clusterPenaltyExponent);
                                }
                                checkCount++; // used to see how many out-of-bounds (how many skipped)
                            }
                        }
                    }
                    // Add any out-of-bound (skipped) squares if the score is 8
                    if (annealScore == 8) {
                        clusterPenalty += (8 - checkCount);
                    }
                }
            }
        }

        // loop shapes and check for float values
        // - bottom float: how far up a bottom row shape is from the bottom
        // - middle float: if a other shape has a full empty row under it
        let totalBottomLift = 0; // how many y-values lifted all the bottom shapes are
        let totalBottomEmptyRow = 0; // sum of anneal scores on all full empty rows under shapes
        for (let shape of this.shapes) {
            let bottomY = shape.posY;
            let bottomWidth = shape.data.bufferShape[0].filter(Boolean).length;
            let isBottomShape = true; // stays true if shape has no shapes under it
            let shapeBottomEmptyRowScore = 0;

            for (let x = shape.posX; x < shape.posX + bottomWidth; x++) {
                // loop all of the shapes x-vales
                let rowInBounds = this.layoutInBounds(bottomY - 1, x);
                if (rowInBounds && this.layout[bottomY - 1][x].shapes.length === 0) {
                    shapeBottomEmptyRowScore += this.layout[bottomY - 1][x].annealScore;
                } else {
                    shapeBottomEmptyRowScore = 0;
                    isBottomShape = false;
                    break;
                }

                // loop all y-values till the bottom. stop if hit a shape
                for (let y = bottomY - 1; y >= 0; y--) {
                    if (this.layout[y][x].shapes.length > 0) {
                        isBottomShape = false;
                        break;
                    }
                }
            }
            // save the row under score if it was all empty
            totalBottomEmptyRow += shapeBottomEmptyRowScore;

            // if shape was a bottom shape, add it's y-value to the total
            if (isBottomShape) {
                totalBottomLift += bottomY;
            }
        }

        // adjust penalties
        if (this.useCustomPerimeter) {
            overlappingCount += this.calculateOutOfBoundsPenalty();
        }

        if (totalBottomLift > 0) {
            totalBottomLift *= Math.pow(this.shapes.length, WEIGHTS.bottomLiftExponent);
        }
        if (overlappingCount > 0) {
            overlappingCount *= Math.pow(this.shapes.length, WEIGHTS.overlapShapeExponent);
        }
        let bottomPenalty = totalBottomLift + (totalBottomEmptyRow * (this.shapes.length / WEIGHTS.emptyRowDivisor));

        let spacePenalty;
        if (this.useCustomPerimeter) {
            const currentArea = this.layout.length * this.layout[0].length;
            const targetArea = this.perimeterWidthGrid * this.perimeterHeightGrid;
            // This rewards shrinking toward the target without overshooting
            const areaDifference = Math.abs(currentArea - targetArea);
            spacePenalty = areaDifference * WEIGHTS.areaDifferenceScalar;
        } else {
            spacePenalty = (totalAnnealScore + totalSquares) * WEIGHTS.spaceScalar;
        }

        // check if solution is valid
        // if (totalBottomLift == 0 && overlappingCount == 0) {
        if (overlappingCount == 0) {
            this.valid = true;
        }
        // calc the "aspect ratio penalty" of the result
        let w = this.layout[0].length;
        let h = this.layout.length;

        let diffRatio;
        if (w === 0 || h === 0) {
            diffRatio = 0;
        } else {
            // compare aspect ratio preference to the result
            let targetRatio;
            if (this.aspectRatioPref === 1) { // wide
                targetRatio = WEIGHTS.targetWideRatio;
            } else if (this.aspectRatioPref === -1) { // tall
                targetRatio = WEIGHTS.targetTallRatio;
            } else { // square
                targetRatio = WEIGHTS.targetSquareRatio;
            }
            const currentRatio = Math.max((w / h), (h / w));
            diffRatio = currentRatio / targetRatio;
        }
        let aspectRatioPenalty = Math.pow(diffRatio, WEIGHTS.aspectExponent);

        this.score = Math.floor(overlappingCount + clusterPenalty + bottomPenalty + aspectRatioPenalty + spacePenalty);
    }

    clearOutOfBoundsMarkers() {
        // Clear all out-of-bounds flags from the layout
        // This ensures a clean state before recalculating
        for (let y = 0; y < this.layout.length; y++) {
            for (let x = 0; x < this.layout[y].length; x++) {
                this.layout[y][x].isOutOfBounds = false;
            }
        }
    }

    calculateOutOfBoundsPenalty() {
        // This method serves two purposes:
        // 1. Calculate penalty for scoring (return value)
        // 2. Mark out-of-bounds cells for debug visualization (layout mutation)
        // The marking ensures debug visualization exactly matches scoring logic

        if (!this.useCustomPerimeter || !this.goalPerimeterGrid) {
            return 0;
        }

        // Clear any existing out-of-bounds flags first
        this.clearOutOfBoundsMarkers();

        let outOfBoundsCount = 0;
        const { x: goalX, y: goalY, width: goalWidth, height: goalHeight } = this.goalPerimeterGrid;

        for (let shape of this.shapes) {
            for (let y = 0; y < shape.data.bufferShape.length; y++) {
                for (let x = 0; x < shape.data.bufferShape[y].length; x++) {
                    if (shape.data.bufferShape[y][x]) {
                        const cellX = shape.posX + x;
                        const cellY = shape.posY + y;

                        // Check if the cell is outside the goal perimeter
                        if (cellX < goalX || cellX >= goalX + goalWidth || cellY < goalY || cellY >= goalY + goalHeight) {
                            outOfBoundsCount++;

                            // Mark the cell in layout for debug visualization
                            // This ensures debug highlighting exactly matches what scoring considers out-of-bounds
                            if (this.layout[cellY] && this.layout[cellY][cellX]) {
                                this.layout[cellY][cellX].isOutOfBounds = true;
                            }
                        }
                    }
                }
            }
        }
        return outOfBoundsCount;
    }

    createNeighbor(_maxShift) {
        // create a new solution that's a neighbor to the current solution
        // - max shift (movement) amount is based on temperature

        // make a proper copy of shapes that preserves class instances
        // Create new Shape instances with copied position data but shared shape data
        let shapesCopy = this.shapes.map(shape => {
            const newShape = Object.create(Object.getPrototypeOf(shape));
            Object.assign(newShape, shape);
            return newShape;
        });
        // Preserve configuration
        const layoutConfig = {
            aspectRatioPref: this.aspectRatioPref,
            useCustomPerimeter: this.useCustomPerimeter,
            perimeterWidthInches: this.perimeterWidthInches,
            perimeterHeightInches: this.perimeterHeightInches
        };
        const wallConfig = {
            algorithm: this.wallAlgorithm,
            cubbyCurveRadius: this.cubbyCurveRadius,
            bendRadius: this.bendRadius,
            maxBends: this.maxBends
        };
        const bufferConfig = {
            customBufferSize: this.customBufferSize,
            centerShape: this.centerShape,
            minWallLength: this.minWallLength
        };
        let newSolution = new Solution(shapesCopy, this.startID, layoutConfig, wallConfig, bufferConfig);

        // pick a random shape to act on
        let shapeIndex = Math.floor(Math.random() * this.shapes.length);
        let selectedShape = newSolution.shapes[shapeIndex];

        // can move side to side, up or down, and diagonal
        // pick which a randomly movement option to perform
        let randOption = Math.floor(Math.random() * 9) + 1;
        switch (randOption) {
            case 1: // left
                selectedShape.posX -= _maxShift;
                break;
            case 2: // up-left
                selectedShape.posX -= _maxShift;
                selectedShape.posY += _maxShift;
                break;
            case 3: // up
                selectedShape.posY += _maxShift;
                break;
            case 4: // up-right
                selectedShape.posX += _maxShift;
                selectedShape.posY += _maxShift;
                break;
            case 5: // right
                selectedShape.posX += _maxShift;
                break;
            case 6: // down-right
                selectedShape.posX += _maxShift;
                selectedShape.posY -= _maxShift;
                break;
            case 7: // down
                selectedShape.posY -= _maxShift;
                break;
            case 8: // down-left
                selectedShape.posX -= _maxShift;
                selectedShape.posY -= _maxShift;
                break;
            case 9: // swap position with another random shape
                // choose second shape for swap
                let shapeIndex2;
                do { // keep selecting until it's a different shape
                    shapeIndex2 = Math.floor(Math.random() * this.shapes.length);
                } while (shapeIndex2 === shapeIndex);
                let selectedShape2 = newSolution.shapes[shapeIndex2];
                let tempX = selectedShape.posX;
                let tempY = selectedShape.posY;
                selectedShape.posX = selectedShape2.posX;
                selectedShape.posY = selectedShape2.posY;
                selectedShape2.posX = tempX;
                selectedShape2.posY = tempY;
                break;
        }

        newSolution.normalizeCoordinates();

        // calculate the layout for the new solution
        newSolution.makeLayout();

        // Recalculate goal perimeter to center it on the new layout
        if (newSolution.useCustomPerimeter) {
            newSolution.centerGoalPerimeterGrid();
        }

        // calculate the score of the new solution
        newSolution.calcScore();

        return newSolution;
    }

    normalizeCoordinates() {
        // Check if any shape has negative coordinates and shift all shapes to bring them back into positive space
        let minX = Math.min(...this.shapes.map(shape => shape.posX));
        let minY = Math.min(...this.shapes.map(shape => shape.posY));

        if (minX < 0 || minY < 0) {
            let adjustX = minX < 0 ? Math.abs(minX) : 0;
            let adjustY = minY < 0 ? Math.abs(minY) : 0;

            for (let shape of this.shapes) {
                shape.posX += adjustX;
                shape.posY += adjustY;
            }
        }
    }

    centerGoalPerimeterGrid() {
        if (!this.useCustomPerimeter || !this.layout || this.layout.length === 0) {
            this.goalPerimeterGrid = null;
            return;
        }

        const layoutWidth = this.layout[0].length;
        const layoutHeight = this.layout.length;

        // Calculate the center of the current layout
        const layoutCenterX = layoutWidth / 2;
        const layoutCenterY = layoutHeight / 2;

        // Calculate the top-left corner of the goal perimeter to center it
        const goalX = Math.floor(layoutCenterX - (this.perimeterWidthGrid / 2));
        const goalY = Math.floor(layoutCenterY - (this.perimeterHeightGrid / 2));

        this.goalPerimeterGrid = {
            x: goalX,
            y: goalY,
            width: this.perimeterWidthGrid,
            height: this.perimeterHeightGrid
        };
    }

    exportShapes() {
        // makes a copy of shapes without extra data
        return this.shapes.map(shape => {
            return {
                data: {
                    highResShape: shape.data.highResShape,
                    title: shape.data.title
                },
                posX: shape.posX,
                posY: shape.posY,
                enabled: shape.enabled
            };
        });
    }

    toDataObject() {
        // convert Solution instance to text object (JSON) (export/worker communication)
        // note: layout excluded to keep data size small (easily recalculated)
        return {
            shapes: this.shapes.map(shape => shape.toDataObject()),
            startID: this.startID,
            score: this.score,
            valid: this.valid,
            aspectRatioPref: this.aspectRatioPref,
            // Perimeter parameters
            useCustomPerimeter: this.useCustomPerimeter,
            perimeterWidthInches: this.perimeterWidthInches,
            perimeterHeightInches: this.perimeterHeightInches,
            // Wall generation parameters
            wallAlgorithm: this.wallAlgorithm,
            fabricationType: this.fabricationType,
            cubbyCurveRadius: this.cubbyCurveRadius,
            bendRadius: this.bendRadius,
            maxBends: this.maxBends,
            // Shape buffer parameters (used during generation)
            customBufferSize: this.customBufferSize,
            centerShape: this.centerShape,
            minWallLength: this.minWallLength
        };
    }

    static fromDataObject(solutionData) {
        // convert Solution text object (JSON) to Solution instance (import/worker communication)
        // note: recalculates layout and score if missing
        const LocalShape = getShape();

        // Prepare buffer configuration first - handle legacy solutions
        const bufferConfig = {
            customBufferSize: solutionData.customBufferSize !== undefined ? solutionData.customBufferSize : 1.0, // Legacy default: 1" buffer
            centerShape: solutionData.centerShape !== undefined ? solutionData.centerShape : false, // Legacy default: drop to bottom
            minWallLength: solutionData.minWallLength !== undefined ? solutionData.minWallLength : 1.0 // Legacy default: 1" grid square size
        };

        // Create shapes with the correct buffer configuration
        const shapes = solutionData.shapes.map(shapeData => LocalShape.fromDataObject(shapeData, bufferConfig));

        // Prepare layout configuration
        const layoutConfig = {
            aspectRatioPref: solutionData.aspectRatioPref || 0,
            useCustomPerimeter: solutionData.useCustomPerimeter || false,
            perimeterWidthInches: solutionData.perimeterWidthInches || 0,
            perimeterHeightInches: solutionData.perimeterHeightInches || 0
        };

        // Prepare wall generation parameters
        const wallConfig = {
            algorithm: solutionData.wallAlgorithm || 'cellular-organic',
            cubbyCurveRadius: solutionData.cubbyCurveRadius || 0.5,
            bendRadius: solutionData.bendRadius || solutionData.curveRadius || 1.0,
            maxBends: solutionData.maxBends || 4
        };

        const solution = new Solution(shapes, solutionData.startID, layoutConfig, wallConfig, bufferConfig);

        // set missing properties if they exist
        if (solutionData.clusterLimit !== undefined) {
            solution.clusterLimit = solutionData.clusterLimit;
        }

        // set fabrication type and related properties
        solution.fabricationType = solutionData.fabricationType;

        // Check if layout data exists (from worker) or needs to be recalculated (from import)
        if (solutionData.layout && solutionData.score !== undefined && solutionData.valid !== undefined) {
            // Data includes computed layout (worker result)
            solution.layout = solutionData.layout;
            solution.score = solutionData.score;
            solution.valid = solutionData.valid;
        } else {
            // Data lacks computed layout, recalculate (imported file)
            solution.makeLayout();
            solution.calcScore();
        }

        return solution;
    }

    static createGridBaseline(shapeInstances, aspectRatioPref = 0, bufferConfig = {}) {
        // create a deterministic grid-packing baseline solution
        // calculate rows and columns for a near-square layout
        const numShapes = shapeInstances.length;
        const cols = Math.ceil(Math.sqrt(numShapes));
        const rows = Math.ceil(numShapes / cols);

        // create copies of shapes to avoid modifying the originals
        const shapesCopy = shapeInstances.map(shape => {
            const newShape = Object.create(Object.getPrototypeOf(shape));
            Object.assign(newShape, shape);
            return newShape;
        });

        // calculate column widths and row heights
        const colWidths = new Array(cols).fill(0);
        const rowHeights = new Array(rows).fill(0);

        for (let i = 0; i < shapesCopy.length; i++) {
            const shape = shapesCopy[i];
            const col = i % cols;
            const row = Math.floor(i / cols);

            const shapeWidth = shape.data.bufferShape[0].length;
            const shapeHeight = shape.data.bufferShape.length;

            colWidths[col] = Math.max(colWidths[col], shapeWidth);
            rowHeights[row] = Math.max(rowHeights[row], shapeHeight);
        }

        // position shapes in grid
        for (let i = 0; i < shapesCopy.length; i++) {
            const shape = shapesCopy[i];
            const col = i % cols;
            const row = Math.floor(i / cols);

            // calculate position based on cumulative column widths and row heights
            shape.posX = colWidths.slice(0, col).reduce((sum, width) => sum + width, 0);
            shape.posY = rowHeights.slice(0, row).reduce((sum, height) => sum + height, 0);
        }

        // create solution instance and calculate layout/score
        const layoutConfig = { aspectRatioPref: aspectRatioPref };
        const gridSolution = new Solution(shapesCopy, 0, layoutConfig, {}, bufferConfig);
        gridSolution.makeLayout();
        gridSolution.calcScore();

        return gridSolution;
    }

    calculateEmptySpace() {
        // calculate the number of empty squares in the layout
        if (!this.layout || this.layout.length === 0 || this.layout[0].length === 0) {
            return 0;
        }

        const totalSquares = this.layout.length * this.layout[0].length;
        let occupiedSquares = 0;

        for (const row of this.layout) {
            for (const cell of row) {
                if (cell.isShape && cell.isShape.some(s => s === true)) {
                    occupiedSquares++;
                }
            }
        }

        return totalSquares - occupiedSquares;
    }

    // helper functions
    layoutInBounds(coordY, coordX) {
        // check if the grid is in bounds
        let yInBounds = coordY >= 0 && coordY < this.layout.length;
        let xInBounds = coordX >= 0 && coordX < this.layout[0].length;
        if (yInBounds && xInBounds) {
            return true;
        } else {
            return false;
        }
    }
}

// Only export the class when in a Node.js environment (e.g., during Jest tests)
// Ignored when the app is running in the browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Solution;
}