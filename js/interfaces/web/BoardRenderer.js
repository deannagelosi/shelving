class BoardRenderer {
    constructor() {
        // renderer class for board fabrication visualization
        // all render methods use only parameters, no global state
    }

    renderLayout(cutList, etchList, sheetOutline, config) {
        // renders DXF sheet layout preview from inch-based fabrication data
        // cutList: array of cut rectangles (boards, joints) in inches
        // etchList: array of etch elements (text, lines) in inches
        // sheetOutline: array of sheet rectangles in inches
        // config: { canvasWidth, canvasHeight, sheetWidthIn, sheetHeightIn, numSheets, fontSizeIn, showDevMarkers }

        const ctx = config.renderer || window;

        // calculate scaling factor to fit preview in canvas (using inches)
        const totalSheetHeightIn = config.sheetHeightIn * config.numSheets;
        const scaleX = config.canvasWidth / config.sheetWidthIn;
        const scaleY = config.canvasHeight / totalSheetHeightIn;
        const scaleValue = min(scaleX, scaleY) * 0.9; // 90% of available space for margins

        // clear canvas before rendering
        ctx.clear();
        ctx.background(255);

        // set up the drawing environment
        ctx.push();
        ctx.translate(config.canvasWidth / 2, config.canvasHeight / 2);
        ctx.scale(scaleValue);
        ctx.translate(-config.sheetWidthIn / 2, -totalSheetHeightIn / 2);

        // draw the sheets (green to match DXF layer)
        ctx.noFill();
        ctx.stroke('green');
        ctx.strokeWeight(1 / scaleValue);
        for (let sheet of sheetOutline) {
            ctx.rect(sheet.x, sheet.y, sheet.w, sheet.h);
        }

        // draw the cuts (red to match DXF layer)
        ctx.noFill();
        ctx.stroke('red');
        ctx.strokeWeight(1 / scaleValue);
        for (let cut of cutList) {
            ctx.rect(cut.x, cut.y, cut.w, cut.h);
        }

        // draw the label etches (blue to match DXF layer)
        for (let etch of etchList) {
            if (etch.type === 'text' || !etch.type) {
                // text labels (board IDs)
                ctx.fill('blue');
                ctx.noStroke();
                ctx.textAlign(LEFT, BASELINE);
                ctx.textSize((config.fontSizeIn * scaleValue) / 10);
                ctx.text(etch.text, etch.x, etch.y);
            } else if (etch.type === 'line') {
                // etch lines (alignment guides)
                ctx.stroke('blue');
                ctx.strokeWeight(0.5 / scaleValue);
                ctx.noFill();
                ctx.line(etch.x1, etch.y1, etch.x2, etch.y2);
            }
        }

        // dev/debug mode: Show board direction indicators and measurements
        if (config.showDevMarkers) {
            this._renderLayoutDevMarkers(cutList, scaleValue, ctx);
        }

        ctx.pop();
    }

    renderCase(boards, cellular, config) {
        // renders board assembly visualization from inch-based board data
        // boards: array of Board objects with coordinates in inches
        // cellular: Cellular instance for optional grid line rendering
        // config: { canvasWidth, canvasHeight, squareSize, buffer, xPadding, yPadding, minWallLength, showDevMarkers, renderer }

        const ctx = config.renderer || window;
        const isDevMode = config.showDevMarkers || false;

        ctx.clear();
        ctx.background(255);

        // coordinate conversion helpers (inches → grid units → pixels)
        const inchesToPixelX = (inches) => ((MathUtils.inchesToGridUnits(inches, config.minWallLength) * config.squareSize) + config.buffer + config.xPadding);
        const inchesToPixelY = (inches) => (((ctx.height - config.yPadding) - config.buffer) - (MathUtils.inchesToGridUnits(inches, config.minWallLength) * config.squareSize));

        // draw cellular grid lines in debug mode
        if (isDevMode && !config.renderer && cellular) {
            ctx.push();
            const cellLines = cellular.getCellRenderLines();
            if (typeof CellularRenderer !== 'undefined') {
                const cellularRenderer = new CellularRenderer();
                const cellConfig = {
                    squareSize: config.squareSize,
                    buffer: config.buffer,
                    xPadding: config.xPadding,
                    yPadding: config.yPadding
                };
                cellularRenderer.renderCellLines(cellLines, ctx, cellConfig, "red");
            } else {
                console.warn('[BoardRenderer.renderCase] CellularRenderer not available, skipping cell line rendering');
            }
            ctx.pop();
        }

        // draw the boards
        ctx.strokeWeight(7);
        for (let board of boards) {
            // use RenderConfig colors
            if (typeof RenderConfig !== 'undefined') {
                const colors = RenderConfig.getColors(isDevMode);
                ctx.stroke(colors.boardColor);
            }

            const x1 = inchesToPixelX(board.coords.start.x);
            const y1 = inchesToPixelY(board.coords.start.y);
            const x2 = inchesToPixelX(board.coords.end.x);
            const y2 = inchesToPixelY(board.coords.end.y);

            ctx.line(x1, y1, x2, y2);
        }

        // draw board labels
        this._renderBoardLabels(boards, inchesToPixelX, inchesToPixelY, ctx);

        // draw joint markers in debug mode
        if (isDevMode && !config.renderer) {
            this._renderJointMarkers(boards, inchesToPixelX, inchesToPixelY, config, ctx);
        }
    }

    // ============================================================================
    // PRIVATE HELPER METHODS
    // ============================================================================

    _renderLayoutDevMarkers(cutList, scaleValue, ctx) {
        // draw board direction indicators and measurements for layout preview
        ctx.noFill();

        // Filter cutList to only board rectangles (not joint/halflap cuts)
        const boardCuts = cutList.filter(cut => cut.type === 'board');

        // draw board direction indicators
        ctx.strokeWeight(1 / scaleValue);
        for (let boardCut of boardCuts) {
            // all boards are laid horizontally on the sheet (vertical boards are rotated)
            // Board START is always at left edge (x), END is always at right edge (x + w)

            // green line on left edge (board start)
            ctx.stroke('lime');
            ctx.line(boardCut.x, boardCut.y, boardCut.x, boardCut.y + boardCut.h);

            // purple line on right edge (board end)
            ctx.stroke('purple');
            ctx.line(boardCut.x + boardCut.w, boardCut.y, boardCut.x + boardCut.w, boardCut.y + boardCut.h);
        }

        // draw 1-inch increment markers (grey lines, with pink lines every 5 inches)
        ctx.strokeWeight(0.5 / scaleValue);

        for (let boardCut of boardCuts) {
            // In the 2D design layout, board are laid out with zero thickness intersections.
            // With real boards these 2D intersections are at a centerline inside the connected boards.
            // The added board thickness extends a half-thickness on either side of this centerline.
            // (Kerf is not a factor here since it is just a fabrication tooling adjustment.)
            // i.e. the poi starting x-coord is at the centerline of the intersecting board's thickness.
            const sheetThicknessIn = boardCut.sheetThicknessIn;
            const boardBodyStartX = boardCut.x + (sheetThicknessIn / 2);
            const boardBodyEndX = boardCut.x + boardCut.w - (sheetThicknessIn / 2);
            const boardBodyWidth = boardBodyEndX - boardBodyStartX;

            // draw vertical lines at 1-inch increments across the board body
            for (let i = 0; i <= boardBodyWidth; i += 1) {
                const xPos = boardBodyStartX + i;
                if (xPos <= boardBodyEndX) {
                    // Color: great, with pink for the first and every 5th inch
                    if (i === 0 || i % 5 === 0) {
                        ctx.stroke('pink');
                    } else {
                        ctx.stroke('grey');
                    }
                    ctx.line(xPos, boardCut.y, xPos, boardCut.y + boardCut.h);
                }
            }

            // draw horizontal lines at 1-inch increments from center outward
            const centerY = boardCut.y + (boardCut.h / 2);

            // center line
            ctx.line(boardCut.x, centerY, boardCut.x + boardCut.w, centerY);

            // lines above and below center at 1-inch increments
            const maxDistanceY = Math.max(boardCut.h / 2);
            for (let i = 1; i <= maxDistanceY; i += 1) {
                // line above center
                if (centerY - i >= boardCut.y) {
                    ctx.line(boardCut.x, centerY - i, boardCut.x + boardCut.w, centerY - i);
                }
                // line below center
                if (centerY + i <= boardCut.y + boardCut.h) {
                    ctx.line(boardCut.x, centerY + i, boardCut.x + boardCut.w, centerY + i);
                }
            }
        }
    }

    _renderBoardLabels(boards, inchesToPixelX, inchesToPixelY, ctx) {
        // render board ID labels at board start coordinates
        ctx.fill("black");
        ctx.stroke("white");
        ctx.strokeWeight(3);
        ctx.textSize(20);
        const labelOffset = 10;

        for (const board of boards) {
            let textX, textY;
            // position label based on board orientation
            if (board.orientation === "x") {
                // horizontal board: draw text to the right of the start coords
                textX = inchesToPixelX(board.coords.start.x) + labelOffset;
                textY = inchesToPixelY(board.coords.start.y) + 8;
            } else {
                // vertical board: draw text above the start coords
                textX = inchesToPixelX(board.coords.start.x) - 8;
                textY = inchesToPixelY(board.coords.start.y) - labelOffset;
            }
            ctx.text(board.id, textX, textY);
        }
    }

    _renderJointMarkers(boards, inchesToPixelX, inchesToPixelY, config, ctx) {
        // draw joint type markers for debug visualization
        ctx.push();
        ctx.noStroke();

        // slot ends (salmon circles)
        for (const board of boards) {
            ctx.fill("salmon");
            if (board.poi.start === "slot") {
                ctx.ellipse(inchesToPixelX(board.coords.start.x), inchesToPixelY(board.coords.start.y), 30);
            }
            if (board.poi.end === "slot") {
                ctx.ellipse(inchesToPixelX(board.coords.end.x), inchesToPixelY(board.coords.end.y), 30);
            }
        }

        // pin ends (pink circles)
        for (const board of boards) {
            ctx.fill("pink");
            if (board.poi.start === "pin") {
                ctx.ellipse(inchesToPixelX(board.coords.start.x), inchesToPixelY(board.coords.start.y), 22);
            }
            if (board.poi.end === "pin") {
                ctx.ellipse(inchesToPixelX(board.coords.end.x), inchesToPixelY(board.coords.end.y), 22);
            }
        }

        // t-joints (teal circles)
        for (const board of boards) {
            for (const tJoint of board.poi.tJoints) {
                ctx.fill("teal");
                // tJoint positions are in inches, convert to pixels for rendering
                const tJointPixels = MathUtils.inchesToGridUnits(tJoint, config.minWallLength) * config.squareSize;
                if (board.orientation === "x") {
                    // add t-joint on x-axis from start coord
                    ctx.ellipse(inchesToPixelX(board.coords.start.x) + tJointPixels, inchesToPixelY(board.coords.start.y), 14);
                } else {
                    // subtract t-joint on y-axis from start coord
                    ctx.ellipse(inchesToPixelX(board.coords.start.x), inchesToPixelY(board.coords.start.y) - tJointPixels, 14);
                }
            }
        }

        // X-joints (white circles with black stroke)
        for (const board of boards) {
            ctx.fill("white");
            ctx.stroke("black");
            ctx.strokeWeight(0.25);
            for (const xJoint of board.poi.xJoints) {
                // xJoint positions are in inches, convert to pixels for rendering
                const xJointPixels = MathUtils.inchesToGridUnits(xJoint, config.minWallLength) * config.squareSize;
                if (board.orientation === "x") {
                    // add x-joint on x-axis from start coord
                    ctx.ellipse(inchesToPixelX(board.coords.start.x) + xJointPixels, inchesToPixelY(board.coords.start.y), 10);
                } else {
                    // add x-joint on y-axis from start coord
                    ctx.ellipse(inchesToPixelX(board.coords.start.x), inchesToPixelY(board.coords.start.y) - xJointPixels, 10);
                }
            }
        }

        ctx.pop();
    }
}
