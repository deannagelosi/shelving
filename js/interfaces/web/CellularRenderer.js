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

    renderCellLines(cellSpace, canvas, config, overrideColor = null) {
        // loop through the cellSpace grid and add any neighboring cells of the same strain as pairs
        // use these pairs to draw all of the lines
        // store pairs in a Set to de-duplicate pairs
        let cellLines = new Set();

        // loop through all positions in cellSpace
        for (let y = 0; y < cellSpace.length; y++) {
            for (let x = 0; x < cellSpace[y].length; x++) {
                // check if there are cells at this position
                if (cellSpace[y][x].length > 0) {
                    // loop through all cells at this position
                    for (let cell of cellSpace[y][x]) {
                        // directions to check: right, up, left, down
                        const sides = [
                            { dir: "left", y: 0, x: -1 },
                            { dir: "up", y: 1, x: 0 },
                            { dir: "right", y: 0, x: 1 },
                            { dir: "down", y: -1, x: 0 }
                        ];
                        for (let side of sides) {
                            let newY = y + side.y;
                            let newX = x + side.x;

                            // check if the new position is within bounds
                            if (this.cellSpaceInBounds(newY, newX, cellSpace)) {
                                // check if there's a cell with the same strain in the new position
                                let matchingCell = cellSpace[newY][newX].find(c => c.strain === cell.strain);

                                if (matchingCell) {
                                    // to avoid duplicates create a string with the information and store in a Set
                                    // use min and max to always put the smaller coordinate first
                                    let lineKey = [
                                        Math.min(y, newY),
                                        Math.min(x, newX),
                                        Math.max(y, newY),
                                        Math.max(x, newX),
                                        cell.strain,
                                    ].join(',');

                                    // strings added to a Set are skipped if they already exist
                                    cellLines.add(lineKey);
                                }
                            }
                        }
                    }
                }
            }
        }

        // draw all unique lines
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
    cellSpaceInBounds(coordY, coordX, cellSpace) {
        // check if the grid is in bounds
        let yInBounds = coordY >= 0 && coordY < cellSpace.length;
        let xInBounds = coordX >= 0 && coordX < cellSpace[0].length;
        if (yInBounds && xInBounds) {
            return true;
        } else {
            return false;
        }
    }

    strainColor(strain) {
        let value = ((strain + 1) * 255) % 256;
        return color(this.range(value), this.range(value * 70), this.range(value * 56));
    }

    range(num) {
        return num % 256;
    }
} 