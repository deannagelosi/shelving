class ViewerRenderer {
    constructor(state) {
        this.state = state;

        // Canvas dimensions
        this.CANVAS_WIDTH = 1200;
        this.CANVAS_HEIGHT = 600;
        this.BUFFER_WIDTH = 380;
        this.BUFFER_HEIGHT = 560;

        // Create the main canvas
        let canvas = createCanvas(this.CANVAS_WIDTH, this.CANVAS_HEIGHT);
        canvas.parent('canvas-container');

        // Off-screen graphics buffers
        this.optimizedBuffer = createGraphics(this.BUFFER_WIDTH, this.BUFFER_HEIGHT);
        this.gridBuffer = createGraphics(this.BUFFER_WIDTH, this.BUFFER_HEIGHT);

        // Core renderers
        this.solutionRenderer = new SolutionRenderer();
        this.cellularRenderer = new CellularRenderer();
        this.boardRenderer = new BoardRenderer();
    }

    draw() {
        background(240);

        if (this.state.selectedSolution) {
            this.renderSolutionToBuffers();
            // Centered layout for two buffers
            const bufferX1 = (this.CANVAS_WIDTH / 2) - this.BUFFER_WIDTH - 20;
            const bufferX2 = (this.CANVAS_WIDTH / 2) + 20;
            image(this.gridBuffer, bufferX1, 20);
            image(this.optimizedBuffer, bufferX2, 20);
            this.drawLabels();
            this.drawStats();
        } else {
            fill(100);
            textAlign(CENTER, CENTER);
            textSize(16);
            text('Load a database file and select a solution to view comparisons', this.CANVAS_WIDTH / 2, this.CANVAS_HEIGHT / 2);
        }
    }

    drawLabels() {
        fill(0);
        textAlign(CENTER, TOP);
        textSize(14);

        const bufferX1 = (this.CANVAS_WIDTH / 2) - this.BUFFER_WIDTH - 20;
        const bufferX2 = (this.CANVAS_WIDTH / 2) + 20;

        text('Grid Baseline', bufferX1 + this.BUFFER_WIDTH / 2, 5);
        text('Optimized Solution', bufferX2 + this.BUFFER_WIDTH / 2, 5);
    }

    drawStats() {
        if (!this.state.selectedSolution) return;
        fill(50);
        textAlign(CENTER, TOP);
        textSize(12);
        const yPos = 20 + this.BUFFER_HEIGHT + 5;
        const bufferX1 = (this.CANVAS_WIDTH / 2) - this.BUFFER_WIDTH - 20;
        const bufferX2 = (this.CANVAS_WIDTH / 2) + 20;

        let yOffset = 0;
        if (this.state.stats.rRmse !== null) {
            const rRmseText = `Ideal-Fit Error (rRMSE): ${this.state.stats.rRmse.toFixed(4)}`;
            text(rRmseText, bufferX2 + this.BUFFER_WIDTH / 2, yPos);
            yOffset += 15;
        }
        if (this.state.stats.rMae !== null) {
            const rMaeText = `Ideal-Fit Error (rMAE): ${this.state.stats.rMae.toFixed(4)}`;
            text(rMaeText, bufferX2 + this.BUFFER_WIDTH / 2, yPos + yOffset);
        }
        if (this.state.stats.emptySpaceGrid !== null) {
            const gridText = `Empty Space: ${this.state.stats.emptySpaceGrid.toFixed(2)} units`;
            text(gridText, bufferX1 + this.BUFFER_WIDTH / 2, yPos);
        }
    }

    handleKeyPress(key) {
        if (key === 'd') {
            this.state.devMode = !this.state.devMode;
            this.state.numGrow = 0;
        } else if (key === 'g' && this.state.devMode) {
            this.state.numGrow++;
        }
    }

    renderSolutionToBuffers() {
        if (!this.state.selectedSolution) return;

        let statsBreakdown = {};
        try {
            statsBreakdown = JSON.parse(this.state.selectedSolution.stats_breakdown_json || '{}');
        } catch (error) {
            console.warn('Failed to parse stats_breakdown_json:', error);
        }

        const cubbyAreasOptimized = statsBreakdown.cubby_areas_optimized || [];

        try {
            const exportData = JSON.parse(this.state.selectedSolution.export_data_json);
            const cellularData = JSON.parse(this.state.selectedSolution.cellular_json);
            const baselineGrid = JSON.parse(this.state.selectedSolution.baseline_grid_json);

            const savedAnneal = exportData.savedAnneals[0];
            const optimizedSolution = Solution.fromDataObject(savedAnneal.finalSolution);
            const gridSolution = Solution.fromDataObject(baselineGrid.solution);

            // Create Cellular instances from the raw data
            let optimizedCellular;
            if (this.state.devMode) {
                // In dev mode, always regenerate to calculate terrain to allow step-through
                optimizedCellular = new Cellular(optimizedSolution, this.state.devMode, this.state.numGrow);
                optimizedCellular.growCells();
            } else if (this.isLegacyCellularData(cellularData)) {
                // legacy version, regenerating with updated algorithm
                optimizedCellular = new Cellular(optimizedSolution);
                optimizedCellular.growCells();
            } else {
                optimizedCellular = Cellular.fromDataObject(cellularData, optimizedSolution);
            }

            // Get board render data from database if available, otherwise calculate
            let optimizedBoardData;
            if (this.state.selectedSolution.board_render_data_optimized) {
                // Use pre-calculated board render data
                optimizedBoardData = JSON.parse(this.state.selectedSolution.board_render_data_optimized);
            } else {
                // Fallback: calculate board render data
                const exportConfig = {
                    caseDepth: 3,
                    sheetThickness: 0.23,
                    sheetWidth: 30,
                    sheetHeight: 28,
                    numSheets: 1,
                    kerf: 0,
                    numPinSlots: 2
                };
                const spacing = {
                    buffer: savedAnneal.buffer,
                    xPadding: savedAnneal.xPadding,
                    yPadding: savedAnneal.yPadding
                };

                const optimizedExport = new Export(optimizedCellular, spacing, exportConfig);
                optimizedExport.makeBoards();
                optimizedBoardData = optimizedExport.getBoardRenderData();

            }

            const optimizedConfig = this.calculateRenderConfig(optimizedSolution, this.optimizedBuffer);
            const gridConfig = this.calculateRenderConfig(gridSolution, this.gridBuffer);
            optimizedConfig.devMode = this.state.devMode;

            const optimizedCanvas = { height: this.BUFFER_HEIGHT, width: this.BUFFER_WIDTH };
            const gridCanvas = { height: this.BUFFER_HEIGHT, width: this.BUFFER_WIDTH };

            this.optimizedBuffer.clear();
            this.gridBuffer.clear();

            this.renderToBuffer(this.optimizedBuffer, () => {
                this.solutionRenderer.renderLayout(optimizedSolution, optimizedCanvas, optimizedConfig);
                const optimizedCellLines = optimizedCellular.getCellRenderLines();
                this.cellularRenderer.renderCellLines(optimizedCellLines, optimizedCanvas, optimizedConfig);
                if (!optimizedConfig.devMode) {
                    this.boardRenderer.renderBoards(optimizedBoardData, optimizedCanvas, optimizedConfig, { showLabels: true });
                }
                if (optimizedConfig.devMode) {
                    this.cellularRenderer.renderTerrain(optimizedSolution.layout, optimizedCanvas, { ...optimizedConfig, maxTerrain: optimizedCellular.maxTerrain });
                    this.cellularRenderer.renderCells(optimizedCellular.cellSpace, optimizedCanvas, optimizedConfig);
                    this.cellularRenderer.renderFloodFillVisualization(cubbyAreasOptimized, optimizedCanvas, optimizedConfig);
                    this.renderAreaLabels(cubbyAreasOptimized, optimizedCanvas, optimizedConfig);
                }
            });

            this.renderToBuffer(this.gridBuffer, () => {
                this.solutionRenderer.renderLayout(gridSolution, gridCanvas, gridConfig);
            });

        } catch (error) {
            console.error('Render error:', error, error.stack);
        }
    }

    renderAreaLabels(areaDataArray, canvas, config) {
        if (!areaDataArray || areaDataArray.length === 0) return;
        textAlign(CENTER, CENTER);
        textSize(10);
        fill(0, 0, 0, 200);
        strokeWeight(2);
        stroke(255, 255, 255, 200);
        for (const areaData of areaDataArray) {
            const { cubbyArea, shapeArea, labelCoords } = areaData;
            const canvasX = (labelCoords.x * config.squareSize) + config.xPadding + (config.squareSize / 2);
            const canvasY = canvas.height - ((labelCoords.y * config.squareSize) + config.yPadding + (config.squareSize / 2));
            const labelText = `C:${cubbyArea} / S:${shapeArea}`;
            text(labelText, canvasX, canvasY);
        }
        noStroke();
    }

    renderToBuffer(buffer, renderFunction) {
        buffer.push();
        buffer.background(255);
        const originalFuncs = { fill: window.fill, stroke: window.stroke, noStroke: window.noStroke, strokeWeight: window.strokeWeight, rect: window.rect, circle: window.circle, line: window.line, text: window.text, textAlign: window.textAlign, textSize: window.textSize };
        Object.keys(originalFuncs).forEach(key => window[key] = buffer[key].bind(buffer));
        try {
            renderFunction();
        } finally {
            Object.keys(originalFuncs).forEach(key => window[key] = originalFuncs[key]);
        }
        buffer.pop();
    }

    calculateRenderConfig(solution, buffer) {
        if (!solution || !solution.layout || solution.layout.length === 0) {
            return { squareSize: 15, buffer: 15, xPadding: 10, yPadding: 10, devMode: false, detailView: false };
        }
        let layoutHeight = solution.layout.length;
        let layoutWidth = solution.layout[0].length;
        let squareHeight = this.BUFFER_HEIGHT / (layoutHeight + 2);
        let squareWidth = this.BUFFER_WIDTH / (layoutWidth + 2);
        let squareSize = Math.min(squareHeight, squareWidth);
        let bufferSize = squareSize * 0.5;
        let yPadding = ((this.BUFFER_HEIGHT - (layoutHeight * squareSize)) / 2) - bufferSize;
        let xPadding = ((this.BUFFER_WIDTH - (layoutWidth * squareSize)) / 2) - bufferSize;
        return { squareSize, buffer: bufferSize, xPadding, yPadding, devMode: false, detailView: false };
    }

    isLegacyCellularData(cellularData) {
        // Check if the cellular data is in the old format (missing parentCoords)
        if (!cellularData || !cellularData.cellSpace || !Array.isArray(cellularData.cellSpace)) {
            return true; // Invalid or missing data, treat as legacy
        }

        // Find the first cell in the cellSpace to inspect
        for (let row of cellularData.cellSpace) {
            if (Array.isArray(row)) {
                for (let cellArray of row) {
                    if (Array.isArray(cellArray) && cellArray.length > 0) {
                        const firstCell = cellArray[0];
                        // If the first cell doesn't have parentCoords, it's legacy data
                        return !firstCell.hasOwnProperty('parentCoords');
                    }
                }
            }
        }

        // If no cells found, treat as legacy (will be regenerated)
        return true;
    }
} 