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

    //== helper methods
    strainColor(strain) {
        let value = ((strain + 1) * 255) % 256;
        return color(this.range(value), this.range(value * 70), this.range(value * 56));
    }

    range(num) {
        return num % 256;
    }
} 