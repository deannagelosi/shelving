class CurveWallRenderer {
    constructor() {
        // Rendering colors for different states
        this.colors = {
            wallPath: 'rgb(50, 50, 50)',
            debugGroup: 'rgba(255, 0, 0, 0.3)',
            completedGroup: 'rgba(0, 255, 0, 0.3)',
            activeGroup: 'rgba(0, 0, 255, 0.3)',
            forbiddenEnd: 'rgb(255, 0, 0)',
            availableEnd: 'rgb(0, 255, 0)',
            connectionLine: 'rgb(255, 165, 0)'
        };
    }

    /**
     * Render the final curved wall path
     * @param {Array} wallPath - Array of line and arc segments
     * @param {Object} canvas - Canvas dimensions
     * @param {Object} config - Rendering configuration
     */
    renderWallPath(wallPath, canvas, config) {
        if (!wallPath || wallPath.length === 0) {
            return;
        }

        push();
        strokeWeight(4);
        noFill();

        wallPath.forEach(segment => {
            // Color-code segments by their function: shelf vs. connection.
            if (segment.isShelf) {
                stroke('orange'); // A main shelf
            } else if (segment.type === 'line') {
                stroke('red');    // A connecting line (stub or vertical)
            } else if (segment.type === 'arc') {
                stroke('blue');   // A connecting arc
            }

            if (segment.type === 'line') {
                this._renderLineSegment(segment, config);
            } else if (segment.type === 'arc') {
                this._renderArcSegment(segment, config);
            }
        });

        // Render IDs on top of the segments
        this._renderSegmentIDs(wallPath, config);

        pop();
    }

    _renderSegmentIDs(wallPath, config) {
        push();
        fill('black');
        stroke('white');
        strokeWeight(2);
        textSize(12);
        textAlign(CENTER, CENTER);

        wallPath.forEach(segment => {
            let x, y;
            if (segment.type === 'line') {
                const canvasStartX = this._layoutToCanvasX(segment.startX, config);
                const canvasStartY = this._layoutToCanvasY(segment.startY, config);
                const canvasEndX = this._layoutToCanvasX(segment.endX, config);
                const canvasEndY = this._layoutToCanvasY(segment.endY, config);
                x = (canvasStartX + canvasEndX) / 2;
                y = (canvasStartY + canvasEndY) / 2;
            } else if (segment.type === 'arc') {
                // Handle both startDeg/endDeg (from CurveWall) and startAngle/endAngle (from golden path)
                const startAngleDeg = segment.startDeg !== undefined ? segment.startDeg : segment.startAngle;
                const endAngleDeg = segment.endDeg !== undefined ? segment.endDeg : segment.endAngle;
                const midAngle = radians((startAngleDeg + endAngleDeg) / 2);
                const centerX = this._layoutToCanvasX(segment.centerX, config);
                const centerY = this._layoutToCanvasY(segment.centerY, config);
                const radius = segment.radius * config.squareSize;
                x = centerX + (radius * cos(midAngle));
                y = centerY + (radius * sin(midAngle));
            }

            if (x !== undefined && y !== undefined) {
                text(segment.id, x, y);
            }
        });

        pop();
    }

    /**
     * Render debug visualization for curve wall generation
     * @param {Object} debugState - Current debug state from CurveWall
     * @param {Array} groups - Shape groups
     * @param {Object} canvas - Canvas dimensions
     * @param {Object} config - Rendering configuration
     */
    renderDebugState(debugState, groups, canvas, config) {
        if (!groups) {
            return;
        }

        // Render group highlights and endpoint indicators
        this._renderGroupHighlights(groups, config);
    }

    /**
     * Render shape group highlights with different colors based on completion status
     * @param {Array} groups - Shape groups
     * @param {Object} config - Rendering configuration
     */
    _renderGroupHighlights(groups, config) {
        push();
        noStroke();

        groups.forEach(group => {
            const color = group.completed ? this.colors.completedGroup : this.colors.debugGroup;
            fill(color);

            // Highlight the group area
            const groupWidth = group.rightX - group.leftX + 1;
            const groupHeight = 1; // Groups are single-row height

            const x = this._layoutToCanvasX(group.leftX, config);
            const y = this._layoutToCanvasY(group.y, config);
            const w = groupWidth * config.squareSize;
            const h = groupHeight * config.squareSize;

            rect(x, y, w, h);

            // Render endpoint indicators
            this._renderGroupEndpoints(group, config);
        });

        pop();
    }

    /**
     * Render group endpoint indicators (available vs forbidden)
     * @param {Object} group - Shape group
     * @param {Object} config - Rendering configuration
     */
    _renderGroupEndpoints(group, config) {
        const endpointSize = 8;
        const leftX = this._layoutToCanvasX(group.leftX, config);
        const rightX = this._layoutToCanvasX(group.rightX, config);
        const y = this._layoutToCanvasY(group.y, config) + config.squareSize / 2;

        // Left endpoint
        fill(group.connectedSides.left ? this.colors.forbiddenEnd : this.colors.availableEnd);
        circle(leftX, y, endpointSize);

        // Right endpoint
        fill(group.connectedSides.right ? this.colors.forbiddenEnd : this.colors.availableEnd);
        circle(rightX + config.squareSize, y, endpointSize);
    }

    /**
     * Render a line segment
     * @param {Object} segment - Line segment data
     * @param {Object} config - Rendering configuration
     */
    _renderLineSegment(segment, config) {
        const x1 = this._layoutToCanvasX(segment.startX, config);
        const y1 = this._layoutToCanvasY(segment.startY, config);
        const x2 = this._layoutToCanvasX(segment.endX, config);
        const y2 = this._layoutToCanvasY(segment.endY, config);

        line(x1, y1, x2, y2);
    }

    /**
     * Render an arc segment
     * @param {Object} segment - Arc segment data
     * @param {Object} config - Rendering configuration
     */
    _renderArcSegment(segment, config) {
        const centerX = this._layoutToCanvasX(segment.centerX, config);
        const centerY = this._layoutToCanvasY(segment.centerY, config);
        const radius = segment.radius * config.squareSize;

        // Convert angles from degrees to radians
        // CurveWall generates startDeg/endDeg, but golden path uses startAngle/endAngle
        const startAngleDeg = segment.startDeg !== undefined ? segment.startDeg : segment.startAngle;
        const endAngleDeg = segment.endDeg !== undefined ? segment.endDeg : segment.endAngle;
        const startAngle = radians(startAngleDeg);
        const endAngle = radians(endAngleDeg);

        arc(centerX, centerY, radius * 2, radius * 2, startAngle, endAngle);
    }

    /**
     * Render grouping debug information
     * @param {Object} debugState - Debug state
     * @param {Object} config - Rendering configuration
     */
    _renderGroupingDebug(debugState, config) {
        // Groups are already highlighted by _renderGroupHighlights
        // Add group labels
        push();
        fill(0);
        textAlign(CENTER, CENTER);
        textSize(12);

        debugState.groups.forEach(group => {
            const x = this._layoutToCanvasX((group.leftX + group.rightX) / 2, config);
            const y = this._layoutToCanvasY(group.y, config) + config.squareSize / 2;
            text(`Group ${group.id}`, x, y);
        });

        pop();
    }

    /**
     * Render connection debug information
     * @param {Object} debugState - Debug state
     * @param {Object} config - Rendering configuration
     */
    _renderConnectionDebug(debugState, config) {
        // Highlight active groups in connection
        push();
        stroke(this.colors.connectionLine);
        strokeWeight(3);
        noFill();

        // Draw connection indicator (simplified)
        // This would be enhanced with actual connection path rendering
        pop();
    }

    /**
     * Render group connection debug information
     * @param {Object} debugState - Debug state
     * @param {Object} config - Rendering configuration
     */
    _renderGroupConnectionDebug(debugState, config) {
        // Similar to connection debug but for group-to-group connections
        this._renderConnectionDebug(debugState, config);
    }

    /**
     * Render chain cap debug information
     * @param {Object} debugState - Debug state
     * @param {Object} config - Rendering configuration
     */
    _renderChainCapDebug(debugState, config) {
        // Highlight the capped group
        push();
        stroke(this.colors.forbiddenEnd);
        strokeWeight(4);
        noFill();

        if (debugState.group) {
            const x = this._layoutToCanvasX(debugState.group.leftX, config);
            const y = this._layoutToCanvasY(debugState.group.y, config);
            const w = (debugState.group.rightX - debugState.group.leftX + 1) * config.squareSize;
            const h = config.squareSize;

            rect(x, y, w, h);
        }

        pop();
    }

    /**
     * Render orphan connection debug information
     * @param {Object} debugState - Debug state
     * @param {Object} config - Rendering configuration
     */
    _renderOrphanDebug(debugState, config) {
        // Highlight the orphan group
        push();
        stroke(this.colors.activeGroup);
        strokeWeight(4);
        noFill();

        if (debugState.group) {
            const x = this._layoutToCanvasX(debugState.group.leftX, config);
            const y = this._layoutToCanvasY(debugState.group.y, config);
            const w = (debugState.group.rightX - debugState.group.leftX + 1) * config.squareSize;
            const h = config.squareSize;

            rect(x, y, w, h);
        }

        pop();
    }

    /**
     * Render debug message
     * @param {Object} debugState - Debug state
     * @param {Object} canvas - Canvas dimensions
     */
    _renderDebugMessage(debugState, canvas) {
        if (!debugState.message) {
            return;
        }

        push();
        fill(0);
        textAlign(LEFT, TOP);
        textSize(14);
        text(debugState.message, 10, 10);
        pop();
    }

    /**
     * Convert layout coordinates to canvas coordinates (X)
     * @param {number} layoutX - Layout X coordinate
     * @param {Object} config - Rendering configuration
     * @returns {number} Canvas X coordinate
     */
    _layoutToCanvasX(layoutX, config) {
        return (layoutX * config.squareSize) + config.buffer + config.xPadding;
    }

    /**
     * Convert layout coordinates to canvas coordinates (Y)
     * @param {number} layoutY - Layout Y coordinate
     * @param {Object} config - Rendering configuration
     * @returns {number} Canvas Y coordinate
     */
    _layoutToCanvasY(layoutY, config) {
        // This formula is now identical to the one in SolutionRenderer.js for consistency
        return ((config.canvasHeight - config.yPadding) - config.squareSize - config.buffer) - (layoutY * config.squareSize);
    }
}

// Only export the class when in a Node.js environment (e.g., during Jest tests)
// Ignored when the app is running in the browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CurveWallRenderer;
} 