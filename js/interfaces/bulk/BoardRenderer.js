class BoardRenderer {
    constructor() {
        // Stateless renderer utility class
    }

    renderBoards(boardData, canvas, config, options = {}) {
        // Render boards with unique colors for each board
        if (!boardData || boardData.length === 0) return;

        const showLabels = options.showLabels !== false; // default to true
        const strokeWeightValue = options.strokeWeight || 5;

        // Set up drawing properties
        strokeWeight(strokeWeightValue);

        for (const board of boardData) {
            // Calculate unique color for each board using HSB color mode
            const hue = (board.id * 137.5) % 360; // Golden angle distribution for good color separation
            const saturation = 80;
            const brightness = 70;

            // Convert HSB to RGB (p5.js style)
            push();
            colorMode(HSB, 360, 100, 100);
            const boardColor = color(hue, saturation, brightness);
            pop();

            stroke(boardColor);

            // Calculate canvas coordinates from grid coordinates
            const startX = (board.start.x * config.squareSize) + config.buffer + config.xPadding;
            const startY = ((canvas.height - config.yPadding) - config.buffer) - (board.start.y * config.squareSize);
            const endX = (board.end.x * config.squareSize) + config.buffer + config.xPadding;
            const endY = ((canvas.height - config.yPadding) - config.buffer) - (board.end.y * config.squareSize);

            // Draw the board line
            line(startX, startY, endX, endY);

            // Draw board labels if enabled
            if (showLabels) {
                fill(boardColor);
                stroke('white');
                strokeWeight(2);
                textSize(12);
                textAlign(CENTER, CENTER);

                // Position label at the midpoint of the board
                const labelX = (startX + endX) / 2;
                const labelY = (startY + endY) / 2;

                // Offset label slightly based on board orientation to avoid overlap
                const offsetDistance = 15;
                let finalLabelX = labelX;
                let finalLabelY = labelY;

                if (board.orientation === 'x') {
                    // Horizontal board - offset label above the line
                    finalLabelY -= offsetDistance;
                } else {
                    // Vertical board - offset label to the right of the line
                    finalLabelX += offsetDistance;
                }

                text(board.id, finalLabelX, finalLabelY);
            }
        }

        // Reset drawing properties
        noStroke();
        noFill();
    }
}

// Only export the class when in a Node.js environment (e.g., during Jest tests)
// Ignored when the app is running in the browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BoardRenderer;
} 