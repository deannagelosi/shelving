class CurveWall {
    constructor(solution) {
        this.solution = solution;
        this.shapes = solution.shapes;
        this.layout = solution.layout;

        // Debug mode properties
        this.debugMode = false;
        this.debugSteps = [];
        this.currentStep = 0;

        // Safety counter to prevent infinite loops
        this.maxIterations = 10;

        // Generated wall path data
        this.wallPath = [];
        this.groups = [];
    }

    /**
     * Main public method to generate curved walls
     * @param {number} maxBends - Maximum number of sequential 90-degree bends (default: 4)
     * @param {number} turnRadius - Radius for 90-degree turns in inches (default: 1.0)
     * @returns {Array} Array of wall segments (lines and arcs)
     */
    generate(maxBends = 4, turnRadius = 1.0, stepLimit = -1) {
        // This method orchestrates the step-by-step generation for the debugger.
        this.wallPath = [];
        this.groups = [];
        this.debugSteps = [];
        let currentStep = 0;

        // Step 0: Grouping (always performed)
        this.groups = this._groupShapesByY(this.shapes);
        if (stepLimit === currentStep) return []; // On 'd' press (step 0), show nothing.

        // Step 1: Generate all shelves.
        currentStep++;
        this.wallPath = this._generateShelves(this.groups);
        if (stepLimit === currentStep) return this.wallPath; // On first 'g' (step 1), show only shelves.

        // --- From here, we generate connections one by one for each subsequent step ---
        if (this.groups.length < 2) {
            return this.wallPath;
        }

        // Build the connection queue based on the user's specification.
        const connectionQueue = this._buildConnectionQueue();

        // Process the connection queue step-by-step for the debugger.
        for (let i = 0; i < connectionQueue.length; i++) {
            currentStep++;
            if (stepLimit !== -1 && currentStep > stepLimit) {
                break; // Stop if we've reached the debugger's step limit.
            }

            const { from, to, side } = connectionQueue[i];
            this.wallPath.push(...this._connectGroups(from, to, side, turnRadius));
        }

        // If stepLimit is -1 (i.e., not debugging), this loop will complete,
        // and the full wall path will be returned.
        return this.wallPath;
    }

    /**
     * Enable debug mode for step-by-step visualization
     * @param {boolean} enabled - Whether to enable debug mode
     */
    setDebugMode(enabled) {
        this.debugMode = enabled;
        if (enabled) {
            this.debugSteps = [];
            this.currentStep = 0;
        }
    }

    /**
     * Get debug information for current step
     * @returns {Object} Debug state information
     */
    getDebugState() {
        if (!this.debugMode || this.currentStep >= this.debugSteps.length) {
            return null;
        }

        return this.debugSteps[this.currentStep];
    }

    /**
     * Advance to next debug step
     * @returns {boolean} True if there are more steps
     */
    nextDebugStep() {
        if (!this.debugMode) return false;

        this.currentStep++;
        return this.currentStep < this.debugSteps.length;
    }

    // Private methods will be implemented in subsequent checklist items
    _groupShapesByY(shapes) {
        // Cluster shapes into groups that share a common floor (same posY value)
        // Calculate the min/max extents for each group

        if (!shapes || shapes.length === 0) {
            return [];
        }

        // Create a map to group shapes by their Y coordinate
        const groupMap = new Map();

        shapes.forEach((shape, shapeIndex) => {
            const y = shape.posY;

            if (!groupMap.has(y)) {
                groupMap.set(y, {
                    id: groupMap.size,
                    y: y,
                    shapes: [],
                    leftX: Infinity,
                    rightX: -Infinity,
                    connectedSides: {
                        left: false,
                        right: false
                    },
                    completed: false
                });
            }

            const group = groupMap.get(y);
            group.shapes.push({
                shape: shape,
                index: shapeIndex
            });

            // Get the bottom extents for this shape
            const extents = this._getBottomExtents(shape);

            // Update group extents
            group.leftX = Math.min(group.leftX, extents.leftX);
            group.rightX = Math.max(group.rightX, extents.rightX);
        });

        // Convert map to array and sort by Y coordinate (bottom to top)
        const groups = Array.from(groupMap.values());
        groups.sort((a, b) => a.y - b.y);

        // Add debug information if in debug mode
        if (this.debugMode) {
            this.debugSteps.push({
                step: 'grouping',
                message: `Grouped ${shapes.length} shapes into ${groups.length} groups`,
                groups: groups.map(g => ({
                    id: g.id,
                    y: g.y,
                    leftX: g.leftX,
                    rightX: g.rightX,
                    shapeCount: g.shapes.length,
                    shapeNames: g.shapes.map(s => s.shape.data.title)
                }))
            });
        }

        return groups;
    }

    _getBottomExtents(shape) {
        // Find the min/max x-coordinates of a shape's bottom-most row from its bufferShape
        // The bottom row is at index 0 of the bufferShape array

        if (!shape.data.bufferShape || shape.data.bufferShape.length === 0) {
            console.warn('Shape has no bufferShape data:', shape.data.title);
            return { leftX: shape.posX, rightX: shape.posX };
        }

        const bottomRow = shape.data.bufferShape[0];
        if (!bottomRow || bottomRow.length === 0) {
            console.warn('Shape has empty bottom row:', shape.data.title);
            return { leftX: shape.posX, rightX: shape.posX };
        }

        // Find the leftmost and rightmost true values in the bottom row
        let leftIndex = -1;
        let rightIndex = -1;

        // Find leftmost true value
        for (let x = 0; x < bottomRow.length; x++) {
            if (bottomRow[x] === true) {
                leftIndex = x;
                break;
            }
        }

        // Find rightmost true value
        for (let x = bottomRow.length - 1; x >= 0; x--) {
            if (bottomRow[x] === true) {
                rightIndex = x;
                break;
            }
        }

        // If no true values found, return the shape position
        if (leftIndex === -1 || rightIndex === -1) {
            console.warn('No occupied cells found in bottom row of shape:', shape.data.title);
            return { leftX: shape.posX, rightX: shape.posX };
        }

        // Convert buffer shape indices to layout coordinates
        const leftX = shape.posX + leftIndex;
        const rightX = shape.posX + rightIndex;

        return { leftX, rightX };
    }

    _generateWallPath(maxBends, turnRadius, stepLimit, stepCounter) {
        // DEPRECATED - Logic moved to generate()
        return [];
    }

    _generateShelves(groups) {
        const shelves = [];
        groups.forEach(group => {
            // A shelf is a full-width line at the visual bottom of the shapes.
            // This is the top of the green debug bar, which is one row below the group's y-pos.
            const shelfY = group.y - 1; // CORRECTED Y-POSITION
            const startX = group.leftX;
            const endX = group.rightX + 1;

            shelves.push({
                type: 'line',
                startX: startX,
                startY: shelfY,
                endX: endX,
                endY: shelfY,
                isShelf: true
            });
        });
        return shelves;
    }

    _findBestConnection(low, high) {
        let bestConnection = { startSide: null, endSide: null, distance: Infinity };

        const lowSides = ['left', 'right'].filter(s => !low.connectedSides[s]);
        const highSides = ['left', 'right'].filter(s => !high.connectedSides[s]);

        lowSides.forEach(lowSide => {
            const lowX = (lowSide === 'left') ? low.leftX : low.rightX;
            highSides.forEach(highSide => {
                const highX = (highSide === 'left') ? high.leftX : high.rightX;
                const distance = Math.abs(lowX - highX);

                if (distance < bestConnection.distance) {
                    bestConnection = { startSide: lowSide, endSide: highSide, distance };
                }
            });
        });

        return { startSide: bestConnection.startSide, endSide: bestConnection.endSide };
    }

    _chooseSideCloserToWall(group, minX, maxX) {
        // Determine which side of the group is closer to a wall
        const distLeft = group.leftX - minX;
        const distRight = maxX - group.rightX;

        // If tie, always pick right side as specified
        if (distLeft === distRight) {
            return 'right';
        }

        return (distLeft < distRight) ? 'left' : 'right';
    }

    _existsIncompleteGroup(groups) {
        return groups.some(group => !group.completed);
    }

    _findLowestIncomplete(groups) {
        // Find the group with the lowest Y value that is not completed
        return groups.find(group => !group.completed);
    }

    _findNextHigherIncomplete(lowGroup, groups) {
        // Find the next higher incomplete group after lowGroup
        const candidates = groups.filter(group =>
            !group.completed && group.y > lowGroup.y
        );

        if (candidates.length === 0) {
            return null;
        }

        // Return the one with the lowest Y value among candidates
        return candidates.reduce((lowest, current) =>
            current.y < lowest.y ? current : lowest
        );
    }

    _chooseAvailableSide(group, minX, maxX) {
        // Choose the side closer to a wall, similar to _chooseSideCloserToWall
        return this._chooseSideCloserToWall(group, minX, maxX);
    }

    _sideAvailable(group, side) {
        // Check if the specified side of the group is available for connection
        return !group.connectedSides[side];
    }

    _bendPossible(lowGroup, highGroup, side, turnRadius) {
        // Check if a bend is geometrically possible
        // A 180-degree U-turn requires at least 2 * turnRadius horizontal distance
        const lowX = (side === 'left') ? lowGroup.leftX : lowGroup.rightX;
        const highLeftX = highGroup.leftX;
        const highRightX = highGroup.rightX;

        // Find the closest point on the high group to connect to
        const closestHighX = Math.abs(lowX - highLeftX) < Math.abs(lowX - highRightX)
            ? highLeftX : highRightX;

        const horizontalDistance = Math.abs(lowX - closestHighX);

        // Need at least 2 * turnRadius for a proper U-turn
        return horizontalDistance >= (2 * turnRadius);
    }

    _connectToNearestWall(group, minX, maxX, turnRadius) {
        // Connect an orphan group to the nearest wall
        const distToLeft = group.leftX - minX;
        const distToRight = maxX - group.rightX;

        const side = (distToLeft < distToRight) ? 'left' : 'right';
        const startX = (side === 'left') ? group.leftX : group.rightX;
        const endX = (side === 'left') ? minX : maxX;

        // Mark this side as connected
        group.connectedSides[side] = true;

        // Return a simple horizontal line segment, offset by 0.5 for cell centering
        const y = group.y + 0.5;
        return [{
            type: 'line',
            startX: startX + 0.5,
            startY: y,
            endX: endX + 0.5,
            endY: y
        }];
    }

    _capChainAt(group, side) {
        // Create a small stub to cap off a chain
        const startX = (side === 'left') ? group.leftX : group.rightX;
        const stubLength = 0.5; // Small stub length
        const endX = (side === 'left') ? startX - stubLength : startX + stubLength;

        // Mark this side as connected
        group.connectedSides[side] = true;

        const y = group.y + 0.5;
        return [{
            type: 'line',
            startX: startX + 0.5,
            startY: y,
            endX: endX + 0.5,
            endY: y
        }];
    }

    _computeQuarterArc(startX, startY, inDir, turnDir, r) {
        // Convert direction string to unit vector and base angle (clockwise degrees)
        const dirMap = {
            'E': { dx: 1, dy: 0, deg: 0 },
            'S': { dx: 0, dy: 1, deg: 90 },
            'W': { dx: -1, dy: 0, deg: 180 },
            'N': { dx: 0, dy: -1, deg: 270 }
        };

        const d = dirMap[inDir];
        if (!d) throw new Error(`Unknown inDir ${inDir}`);

        // Right-hand perpendicular (screen Y positive downward): (dy, -dx)
        const perpRight = { dx: d.dy, dy: -d.dx };
        const perp = (turnDir === 'right') ? perpRight : { dx: -perpRight.dx, dy: -perpRight.dy };

        const centerX = startX + perp.dx * r;
        const centerY = startY + perp.dy * r;

        // End point is calculated by rotating the vector from the center to the start.
        const startVector = { x: startX - centerX, y: startY - centerY };
        const endVector = { x: startVector.y, y: -startVector.x }; // 90-deg clockwise rotation
        const endX = centerX + endVector.x;
        const endY = centerY + endVector.y;

        // Calculate start and end angles directly from the points.
        // This is the most robust way to ensure the arc is drawn correctly.
        const startAngleRad = Math.atan2(startY - centerY, startX - centerX);
        const endAngleRad = Math.atan2(endY - centerY, endX - centerX);

        // Convert to degrees for the renderer.
        let startDeg = startAngleRad * 180 / Math.PI;
        let endDeg = endAngleRad * 180 / Math.PI;

        // Ensure angles are positive for consistency
        if (startDeg < 0) startDeg += 360;
        if (endDeg < 0) endDeg += 360;

        // Handle the 360/0 degree wrap-around case for p5.js arc drawing
        if (startDeg > endDeg && Math.abs(startDeg - endDeg) > 180) {
            endDeg += 360;
        }


        return { centerX, centerY, startDeg, endDeg, endX, endY };
    }

    _connectGroups(group1, group2, startSide, turnRadius) {
        // This function ONLY generates the connecting geometry (arcs, vertical lines).
        // It now uses the _computeQuarterArc helper for all turns for consistency.
        const segments = [];

        const startY = group1.y - 1;
        const startX = (startSide === 'left') ? group1.leftX : group1.rightX + 1;
        group1.connectedSides[startSide] = true;

        // 1. First Arc: A 90-degree turn downwards, starting directly from the shelf corner.
        const dirOut = (startSide === 'left') ? 'W' : 'E';
        const turnDir1 = (startSide === 'left') ? 'left' : 'right';
        const arc1 = this._computeQuarterArc(startX, startY, dirOut, turnDir1, turnRadius);

        if (this.debugMode) {
            console.log('[ARC1_DEBUG]', {
                inputs: { startX, startY, dirOut, turnDir1, turnRadius },
                outputs: arc1
            });
        }

        segments.push({
            type: 'arc',
            centerX: arc1.centerX,
            centerY: arc1.centerY,
            radius: turnRadius,
            startAngle: arc1.startDeg,
            endAngle: arc1.endDeg
        });

        // 2. Determine the target point on the destination shelf.
        const targetSide = (Math.abs(arc1.endX - group2.leftX) < Math.abs(arc1.endX - (group2.rightX + 1))) ? 'left' : 'right';
        const targetX = (targetSide === 'left') ? group2.leftX : group2.rightX + 1;
        const targetY = group2.y - 1;
        group2.connectedSides[targetSide] = true;

        // 3. The connecting path geometry.
        const verticalEndY = targetY + turnRadius;
        const turnDir2 = (arc1.endX < targetX) ? 'left' : 'right';
        const arc2 = this._computeQuarterArc(arc1.endX, verticalEndY, 'S', turnDir2, turnRadius);

        // A. Line from first arc to the start of the second arc's turning radius.
        segments.push({ type: 'line', startX: arc1.endX, startY: arc1.endY, endX: arc1.endX, endY: verticalEndY });
        // B. Second Arc: The 90-degree turn upwards into the target shelf.
        segments.push({
            type: 'arc',
            centerX: arc2.centerX,
            centerY: arc2.centerY,
            radius: turnRadius,
            startAngle: arc2.startDeg,
            endAngle: arc2.endDeg
        });
        // C. Final horizontal line to connect the arc to the shelf corner.
        if (Math.abs(arc2.endX - targetX) > 0.01) {
            segments.push({ type: 'line', startX: arc2.endX, startY: targetY, endX: targetX, endY: targetY });
        }

        return segments;
    }

    _buildConnectionQueue() {
        const queue = [];
        let activeGroups = JSON.parse(JSON.stringify(this.groups)); // Deep copy for state tracking

        const dashedMinX = 0;
        const dashedMaxX = Math.max(...activeGroups.map(g => g.rightX));

        // 1. Initial Top-to-Bottom Connection
        const top = activeGroups[activeGroups.length - 1];
        const bottom = activeGroups[0];
        if (top !== bottom) {
            const side = this._chooseSideCloserToWall(top, dashedMinX, dashedMaxX);
            queue.push({ from: top, to: bottom, side });
            top.completed = true;
        }

        // 2. Main Bottom-up Connection Loop
        let safety = 0;
        while (activeGroups.some(g => !g.completed) && safety < this.maxIterations) {
            safety++;
            const low = activeGroups.find(g => !g.completed);
            if (!low) break;

            const high = this._findNextHigherIncomplete(low, activeGroups);
            if (!high) {
                low.completed = true;
                continue;
            }

            const side = !low.connectedSides.left ? 'left' : (!low.connectedSides.right ? 'right' : null);
            if (side) {
                queue.push({ from: low, to: high, side });
                low.connectedSides[side] = true; // Mark side used for next iteration
            }
            low.completed = true;
        }

        return queue;
    }
}

// Only export the class when in a Node.js environment (e.g., during Jest tests)
// Ignored when the app is running in the browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CurveWall;
} 