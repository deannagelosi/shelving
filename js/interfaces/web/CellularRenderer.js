class CellularRenderer {
    constructor() {
        // renderer class for Cellular visualization        
        // all render methods use only parameters, no global state
    }

    renderCells(cellSpace, canvas, config) {
        // loop cell space and display cells on the canvas
        for (let y = 0; y < cellSpace.length; y++) {
            for (let x = 0; x < cellSpace[y].length; x++) {
                for (let cell of cellSpace[y][x]) {
                    if (cell.alive) {
                        let cellColor = this.strainColor(cell.strain);
                        fill(cellColor);
                        noStroke();
                        let dotX = (x * config.squareSize) + config.buffer + config.xPadding;
                        let dotY = ((canvas.height - config.yPadding) - config.buffer) - (y * config.squareSize);
                        circle(dotX, dotY, 12);
                    }
                }
            }
        }
    }

    renderCellLines(cellLines, canvas, config, overrideColor = null) {
        // draw all unique lines from the provided set
        strokeWeight(7);
        for (let lineKey of cellLines) {
            const [y1, x1, y2, x2, strain] = lineKey.split(',').map(Number);

            // calculate canvas coordinates
            let startX = (x1 * config.squareSize) + config.buffer + config.xPadding;
            let startY = ((canvas.height - config.yPadding) - config.buffer) - (y1 * config.squareSize);
            let endX = (x2 * config.squareSize) + config.buffer + config.xPadding;
            let endY = ((canvas.height - config.yPadding) - config.buffer) - (y2 * config.squareSize);

            // set line color based on strain
            let lineColor;
            if (config.devMode) {
                lineColor = this.strainColor(strain);
            } else {
                lineColor = "rgb(175, 141, 117)";
            }

            if (overrideColor) {
                // use override color if provided
                lineColor = overrideColor;
                strokeWeight(2);
            }

            stroke(lineColor);

            // draw the line
            line(startX, startY, endX, endY);
        }
    }

    renderTerrain(layout, canvas, config) {
        // display terrain values on the canvas
        fill(75); // dark grey
        strokeWeight(0);
        textAlign(CENTER, CENTER);
        let txtXOffset = config.squareSize / 2;
        let txtYOffset = config.squareSize / 2;
        let txtSize = config.squareSize / 2;
        textSize(txtSize);

        let layoutWidth = layout[0].length;
        let layoutHeight = layout.length;

        for (let x = 0; x < layoutWidth; x++) {
            for (let y = 0; y < layoutHeight; y++) {
                if (layout[y][x].terrainValue !== config.maxTerrain) {
                    // calc text position, finding y from bottom up
                    let rectX = (x * config.squareSize) + config.buffer + config.xPadding + txtXOffset;
                    let rectY = ((canvas.height - config.yPadding) - config.squareSize - config.buffer) - (y * config.squareSize) + txtYOffset;
                    // display the terrain value
                    text(layout[y][x].terrainValue, rectX, rectY);
                }
            }
        }
    }

    renderFloodFillVisualization(areaDataArray, canvas, config) {
        // Visualize flood-fill exploration by drawing visited cells
        // Each shape's visited cells are drawn in a different color with proper grid alignment

        if (!areaDataArray || areaDataArray.length === 0) {
            return; // No area data to visualize
        }

        // Color palette for different shapes (semi-transparent)
        const colors = [
            [255, 100, 100, 80],  // Red
            [100, 255, 100, 80],  // Green
            [100, 100, 255, 80],  // Blue
            [255, 255, 100, 80],  // Yellow
            [255, 100, 255, 80],  // Magenta
            [100, 255, 255, 80],  // Cyan
            [255, 150, 100, 80],  // Orange
            [150, 100, 255, 80],  // Purple
        ];

        noStroke();

        for (let i = 0; i < areaDataArray.length; i++) {
            const areaData = areaDataArray[i];
            const { visitedCells, labelCoords } = areaData;
            console.log("Label coords: ", labelCoords);

            if (!visitedCells || visitedCells.length === 0) {
                console.log("No visited cells data for label: ", labelCoords);
                continue; // Skip if no visited cells data
            }

            // Select color based on shape index, cycling through palette
            const colorIndex = i % colors.length;
            const [r, g, b, a] = colors[colorIndex];
            fill(r, g, b, a);

            // Draw a rectangle for each visited cell
            for (const cell of visitedCells) {
                // Convert layout coordinates to canvas coordinates using same approach as other methods
                let canvasX = (cell.x * config.squareSize) + config.buffer + config.xPadding;
                let canvasY = ((canvas.height - config.yPadding) - config.squareSize - config.buffer) - (cell.y * config.squareSize);

                // Draw the rectangle representing the visited cell
                rect(canvasX, canvasY, config.squareSize, config.squareSize);

                // Check if this cell is the seed location and add visual indicator
                if (labelCoords && cell.x === labelCoords.x && cell.y === labelCoords.y) {
                    // Draw a thick border around the seed cell
                    noFill();
                    stroke(r, g, b, 255); // Use same color as fill but fully opaque
                    strokeWeight(3);
                    rect(canvasX, canvasY, config.squareSize, config.squareSize);
                    
                    // Reset stroke settings for next iteration
                    noStroke();
                    fill(r, g, b, a);
                }
            }
        }
    }

    //== helper methods
    strainColor(strain) {
        let value = ((strain + 1) * 255) % 256;
        return color(this.range(value), this.range(value * 70), this.range(value * 56));
    }

    range(num) {
        return num % 256;
    }
} 