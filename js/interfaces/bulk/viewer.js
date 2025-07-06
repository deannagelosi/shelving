// Bulk Results Viewer - p5.js sketch
// Loads SQLite database results and displays optimized solutions alongside baselines

let viewerUI;
let currentDatabase = null;
let currentJobs = [];
let currentSolutions = [];
let selectedSolution = null;

// Debug state variables (similar to main web app)
let viewerDevMode = false;
let viewerNumGrow = 0;

// Off-screen graphics buffers for rendering
let optimizedBuffer, gridBuffer, naiveCellularBuffer;
let solutionRenderer, cellularRenderer;

// Canvas dimensions
const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 600;
const BUFFER_WIDTH = 380;
const BUFFER_HEIGHT = 560;

function setup() {
    // Create main canvas
    let canvas = createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
    canvas.parent('canvas-container');

    // Initialize ViewerUI
    viewerUI = new ViewerUI();

    // Create off-screen graphics buffers
    optimizedBuffer = createGraphics(BUFFER_WIDTH, BUFFER_HEIGHT);
    gridBuffer = createGraphics(BUFFER_WIDTH, BUFFER_HEIGHT);
    naiveCellularBuffer = createGraphics(BUFFER_WIDTH, BUFFER_HEIGHT);

    // Initialize renderers as stateless utilities (correct pattern)
    solutionRenderer = new SolutionRenderer();
    cellularRenderer = new CellularRenderer();

    // Initialize SQL.js
    initSqlJs({
        locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`
    }).then(function (SQL) {
        window.SQL = SQL;
        viewerUI.showMessage('SQL.js loaded successfully. Attempting to auto-load database...', 'info');

        // Attempt to auto-load the default database
        viewerUI.autoLoadDatabase();
    }).catch(function (err) {
        viewerUI.showMessage('Failed to load SQL.js: ' + err.message, 'error');
    });
}

function draw() {
    background(240);

    if (selectedSolution) {
        // Draw the three buffers side by side
        image(optimizedBuffer, 10, 20);
        image(gridBuffer, 410, 20);
        image(naiveCellularBuffer, 810, 20);

        // Draw labels
        drawLabels();
    } else {
        // Show instructions
        fill(100);
        textAlign(CENTER, CENTER);
        textSize(16);
        text('Load a database file and select a solution to view comparisons', width / 2, height / 2);
    }
}

function drawLabels() {
    fill(0);
    textAlign(CENTER, TOP);
    textSize(14);

    // Optimized solution label
    text('Optimized Solution', 10 + BUFFER_WIDTH / 2, 5);

    // Grid baseline label
    text('Grid Baseline', 410 + BUFFER_WIDTH / 2, 5);

    // Naive cellular label
    let naiveLabel = 'Naive Cellular Baseline';
    if (viewerDevMode) {
        naiveLabel += ` (Step ${viewerNumGrow})`;
    }
    text(naiveLabel, 810 + BUFFER_WIDTH / 2, 5);
}

function keyPressed() {
    // Debug key commands for viewer (similar to main web app)
    if (key === 'd') {
        // Toggle viewer dev mode on and off
        viewerDevMode = !viewerDevMode;
        viewerNumGrow = 0;
        if (selectedSolution) {
            viewerUI.renderSolution();
            viewerUI.showMessage(`Debug mode ${viewerDevMode ? 'enabled' : 'disabled'}`, 'info');
        }
    }
    else if (key === 'g' && viewerDevMode) {
        // Advance one growth step at a time in dev mode
        viewerNumGrow++;
        if (selectedSolution) {
            viewerUI.renderSolution();
            viewerUI.showMessage(`Growth step: ${viewerNumGrow}`, 'info');
        }
    }
}

class ViewerUI {
    constructor() {
        this.fileInput = null;
        this.messageDiv = null;
        this.jobListDiv = null;
        this.setupUI();
    }

    setupUI() {
        // Create file input
        this.fileInput = createFileInput(this.handleDatabaseFile.bind(this));
        this.fileInput.parent('file-input-container');
        this.fileInput.attribute('accept', '.sqlite,.db');

        // Create message div
        this.messageDiv = createDiv('Select a SQLite database file to begin');
        this.messageDiv.parent('file-input-container');
        this.messageDiv.class('info-message');

        // Create job list container
        this.jobListDiv = createDiv('');
        this.jobListDiv.parent('job-list-container');
    }

    autoLoadDatabase() {
        // Attempt to automatically load the default database file
        const defaultDbPath = '../../models/results.sqlite';

        fetch(defaultDbPath)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                return response.arrayBuffer();
            })
            .then(arrayBuffer => {
                try {
                    const uInt8Array = new Uint8Array(arrayBuffer);
                    currentDatabase = new window.SQL.Database(uInt8Array);

                    this.loadJobs();
                    this.showMessage(`Auto-loaded database: ${defaultDbPath}`, 'info');
                } catch (error) {
                    throw new Error(`Failed to parse database: ${error.message}`);
                }
            })
            .catch(error => {
                this.showMessage(`Auto-load failed: ${error.message}. Please select a database file manually.`, 'warning');
                console.warn('Auto-load failed:', error);
            });
    }

    handleDatabaseFile(file) {
        if (!file || !window.SQL) {
            this.showMessage('SQL.js not loaded or no file selected', 'error');
            return;
        }

        this.showMessage('Loading database...', 'info');

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const arrayBuffer = event.target.result;
                const uInt8Array = new Uint8Array(arrayBuffer);
                currentDatabase = new window.SQL.Database(uInt8Array);

                this.loadJobs();
                this.showMessage(`Database loaded successfully: ${file.name}`, 'info');
            } catch (error) {
                this.showMessage(`Failed to load database: ${error.message}`, 'error');
            }
        };

        reader.onerror = () => {
            this.showMessage('Failed to read file', 'error');
        };

        reader.readAsArrayBuffer(file.file);
    }

    loadJobs() {
        if (!currentDatabase) return;

        try {
            const stmt = currentDatabase.prepare('SELECT * FROM bulk_jobs ORDER BY created_at DESC');
            currentJobs = [];

            while (stmt.step()) {
                const row = stmt.getAsObject();
                currentJobs.push(row);
            }

            stmt.free();
            this.displayJobs();
        } catch (error) {
            this.showMessage(`Failed to load jobs: ${error.message}`, 'error');
        }
    }

    displayJobs() {
        // Clear existing job list
        this.jobListDiv.html('');

        if (currentJobs.length === 0) {
            this.jobListDiv.html('<p>No jobs found in database</p>');
            return;
        }

        // Create job list
        const jobListTitle = createDiv('<strong>Available Jobs:</strong>');
        jobListTitle.parent(this.jobListDiv);

        for (let job of currentJobs) {
            const jobDiv = createDiv('');
            jobDiv.parent(this.jobListDiv);
            jobDiv.class('job-item');

            const jobInfo = `Job ${job.job_id.substring(0, 8)}... (${job.completed_workers}/${job.total_workers} completed)`;
            jobDiv.html(jobInfo);

            jobDiv.mousePressed(() => this.loadSolutions(job.job_id));
        }
    }

    loadSolutions(jobId) {
        if (!currentDatabase) return;

        try {
            const stmt = currentDatabase.prepare(`
                SELECT solution_id, start_id, score, valid, 
                       baseline_grid_json, baseline_cellular_json, score_grid, score_cellular_naive,
                       export_data_json, cellular_json
                FROM solutions 
                WHERE job_id = ? 
                ORDER BY start_id
            `);
            stmt.bind([jobId]);

            currentSolutions = [];
            while (stmt.step()) {
                const row = stmt.getAsObject();
                currentSolutions.push(row);
            }

            stmt.free();
            this.displaySolutions();
        } catch (error) {
            this.showMessage(`Failed to load solutions: ${error.message}`, 'error');
        }
    }

    displaySolutions() {
        // Clear existing solution list
        const existingSolutions = selectAll('.solution-item');
        for (let el of existingSolutions) {
            el.remove();
        }

        if (currentSolutions.length === 0) {
            this.jobListDiv.html(this.jobListDiv.html() + '<p>No solutions found for this job</p>');
            return;
        }

        // Create solution list
        const solutionListTitle = createDiv('<strong>Solutions:</strong>');
        solutionListTitle.parent(this.jobListDiv);

        for (let solution of currentSolutions) {
            const solutionDiv = createDiv('');
            solutionDiv.parent(this.jobListDiv);
            solutionDiv.class('solution-item');

            const hasBaselines = solution.baseline_grid_json && solution.baseline_cellular_json;
            const baselineText = hasBaselines ? ' (with baselines)' : ' (no baselines)';
            const solutionInfo = `Solution ${solution.start_id + 1} - Score: ${solution.score.toFixed(2)}${baselineText}`;
            solutionDiv.html(solutionInfo);

            if (hasBaselines) {
                solutionDiv.mousePressed(() => this.selectSolution(solution));
            } else {
                solutionDiv.style('opacity', '0.5');
                solutionDiv.style('cursor', 'not-allowed');
            }
        }
    }

    selectSolution(solution) {
        selectedSolution = solution;
        this.renderSolution();
        this.showMessage(`Loaded solution ${solution.start_id + 1}`, 'info');
    }

    renderSolution() {
        if (!selectedSolution) return;

        try {
            // Parse the solution data
            const exportData = JSON.parse(selectedSolution.export_data_json);
            const cellularData = JSON.parse(selectedSolution.cellular_json);
            const baselineGrid = JSON.parse(selectedSolution.baseline_grid_json);
            const baselineNaiveCellular = JSON.parse(selectedSolution.baseline_cellular_json);

            // Create Solution instances for rendering
            const optimizedSolution = Solution.fromDataObject(exportData.savedAnneals[0].finalSolution);
            const gridSolution = Solution.fromDataObject(baselineGrid.solution);

            // Create Cellular instances by rehydrating the raw data or upgrading legacy data
            let optimizedCellular;
            if (this.isLegacyCellularData(cellularData)) {
                console.log('Detected legacy optimized data. Regenerating with standard algorithm...');
                optimizedCellular = new Cellular(optimizedSolution);
                optimizedCellular.growCells();
            } else {
                optimizedCellular = Cellular.fromDataObject(cellularData, optimizedSolution);
            }

            let naiveCellular;
            if (this.isLegacyCellularData(baselineNaiveCellular)) {
                console.log('Detected legacy naive data. Regenerating with naive algorithm...');
                naiveCellular = new Cellular(optimizedSolution);
                naiveCellular.growCellsNaive();
            } else {
                naiveCellular = Cellular.fromDataObject(baselineNaiveCellular, optimizedSolution);
            }

            // Calculate rendering configuration for each buffer
            const optimizedConfig = this.calculateRenderConfig(optimizedSolution, optimizedBuffer);
            const gridConfig = this.calculateRenderConfig(gridSolution, gridBuffer);
            const naiveConfig = this.calculateRenderConfig(optimizedSolution, naiveCellularBuffer); // Use same layout as optimized

            // Pass viewer debug state to configs
            optimizedConfig.devMode = viewerDevMode;
            naiveConfig.devMode = viewerDevMode;

            // Create canvas objects for each buffer (renderers expect this structure)
            const optimizedCanvas = { height: BUFFER_HEIGHT, width: BUFFER_WIDTH };
            const gridCanvas = { height: BUFFER_HEIGHT, width: BUFFER_WIDTH };
            const naiveCanvas = { height: BUFFER_HEIGHT, width: BUFFER_WIDTH };

            // Clear buffers
            optimizedBuffer.clear();
            gridBuffer.clear();
            naiveCellularBuffer.clear();

            // Render optimized solution (solution + cellular)
            this.renderToBuffer(optimizedBuffer, () => {
                solutionRenderer.renderLayout(optimizedSolution, optimizedCanvas, optimizedConfig);
                const optimizedCellLines = optimizedCellular.getCellRenderLines();
                cellularRenderer.renderCellLines(optimizedCellLines, optimizedCanvas, optimizedConfig);
                if (optimizedConfig.devMode) {
                    cellularRenderer.renderTerrain(optimizedSolution.layout, optimizedCanvas, { ...optimizedConfig, maxTerrain: optimizedCellular.maxTerrain });
                    cellularRenderer.renderCells(optimizedCellular.cellSpace, optimizedCanvas, optimizedConfig);
                }
            });

            // Render grid baseline (solution only)
            this.renderToBuffer(gridBuffer, () => {
                solutionRenderer.renderLayout(gridSolution, gridCanvas, gridConfig);
            });

            // Render naive cellular baseline (cellular only on optimized layout)
            this.renderToBuffer(naiveCellularBuffer, () => {
                solutionRenderer.renderLayout(optimizedSolution, naiveCanvas, naiveConfig);

                // Handle naive cellular rendering based on debug mode
                if (viewerDevMode) {
                    // Debug mode: re-simulate naive growth from initial conditions up to viewerNumGrow steps
                    const debugCellular = new Cellular(optimizedSolution, true, viewerNumGrow);
                    debugCellular.createTerrain();
                    debugCellular.calcPathValues();
                    debugCellular.makeInitialCells();

                    // Run naive growth for the specified number of steps (0 = just initial setup)
                    for (let i = 0; i < viewerNumGrow; i++) {
                        debugCellular.growOnceNaive();
                    }

                    const debugCellLines = debugCellular.getCellRenderLines();
                    cellularRenderer.renderCellLines(debugCellLines, naiveCanvas, naiveConfig);
                    if (naiveConfig.devMode) {
                        cellularRenderer.renderTerrain(optimizedSolution.layout, naiveCanvas, { ...naiveConfig, maxTerrain: debugCellular.maxTerrain });
                        cellularRenderer.renderCells(debugCellular.cellSpace, naiveCanvas, naiveConfig);
                    }
                } else {
                    // Normal mode: use stored baseline data (authoritative source)
                    const naiveCellLines = naiveCellular.getCellRenderLines();
                    cellularRenderer.renderCellLines(naiveCellLines, naiveCanvas, naiveConfig);
                    if (naiveConfig.devMode) {
                        cellularRenderer.renderTerrain(optimizedSolution.layout, naiveCanvas, { ...naiveConfig, maxTerrain: naiveCellular.maxTerrain });
                        cellularRenderer.renderCells(naiveCellular.cellSpace, naiveCanvas, naiveConfig);
                    }
                }
            });

        } catch (error) {
            this.showMessage(`Failed to render solution: ${error.message}`, 'error');
            console.error('Render error:', error);
            console.error('Error stack:', error.stack);
        }
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

    renderToBuffer(buffer, renderFunction) {
        // Set the drawing context to the buffer and execute render function
        // This ensures all p5.js drawing commands go to the buffer
        buffer.push();
        buffer.background(255);

        // Temporarily override p5.js global functions to use buffer
        const originalFill = window.fill;
        const originalStroke = window.stroke;
        const originalNoStroke = window.noStroke;
        const originalStrokeWeight = window.strokeWeight;
        const originalRect = window.rect;
        const originalCircle = window.circle;
        const originalLine = window.line;
        const originalText = window.text;
        const originalTextAlign = window.textAlign;
        const originalTextSize = window.textSize;

        // Override with buffer methods
        window.fill = buffer.fill.bind(buffer);
        window.stroke = buffer.stroke.bind(buffer);
        window.noStroke = buffer.noStroke.bind(buffer);
        window.strokeWeight = buffer.strokeWeight.bind(buffer);
        window.rect = buffer.rect.bind(buffer);
        window.circle = buffer.circle.bind(buffer);
        window.line = buffer.line.bind(buffer);
        window.text = buffer.text.bind(buffer);
        window.textAlign = buffer.textAlign.bind(buffer);
        window.textSize = buffer.textSize.bind(buffer);

        try {
            renderFunction();
        } finally {
            // Restore original functions
            window.fill = originalFill;
            window.stroke = originalStroke;
            window.noStroke = originalNoStroke;
            window.strokeWeight = originalStrokeWeight;
            window.rect = originalRect;
            window.circle = originalCircle;
            window.line = originalLine;
            window.text = originalText;
            window.textAlign = originalTextAlign;
            window.textSize = originalTextSize;
        }

        buffer.pop();
    }

    calculateRenderConfig(solution, buffer) {
        // Calculate rendering configuration similar to DesignUI.calculateLayoutProperties
        if (!solution || !solution.layout || solution.layout.length === 0) {
            return {
                squareSize: 15,
                buffer: 15,
                xPadding: 10,
                yPadding: 10,
                devMode: false,
                detailView: false
            };
        }

        let layoutHeight = solution.layout.length;
        let layoutWidth = solution.layout[0].length;
        let squareHeight = BUFFER_HEIGHT / (layoutHeight + 2); // + 2 for buffer space
        let squareWidth = BUFFER_WIDTH / (layoutWidth + 2);
        let squareSize = Math.min(squareHeight, squareWidth);
        let bufferSize = squareSize * 0.5;
        let yPadding = ((BUFFER_HEIGHT - (layoutHeight * squareSize)) / 2) - bufferSize;
        let xPadding = ((BUFFER_WIDTH - (layoutWidth * squareSize)) / 2) - bufferSize;

        return {
            squareSize: squareSize,
            buffer: bufferSize,
            xPadding: xPadding,
            yPadding: yPadding,
            devMode: false,
            detailView: false
        };
    }



    showMessage(message, type = 'info') {
        this.messageDiv.html(message);
        this.messageDiv.class(type + '-message');
    }
} 