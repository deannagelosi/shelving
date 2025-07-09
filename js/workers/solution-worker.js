// web worker for solution generation pipeline
// supports both single-run and bulk-run modes using the same core algorithms
// single-run mode is used by the web interface
// bulk-run mode is used by the bulk CLI tool for statistical analysis

class SolutionWorker {
    constructor(dependencies) {
        // Dependencies are injected for environment compatibility
        this.Anneal = dependencies.Anneal;
        this.Cellular = dependencies.Cellular;
        this.Solution = dependencies.Solution;
        this.Export = dependencies.Export;
        this.Board = dependencies.Board;

        this.mode = null; // 'single' or 'bulk'
        this.config = null;
        this.currentJob = null;
    }

    async processMessage(data) {
        const { type, payload } = data;

        try {
            switch (type) {
                case 'GENERATE_SOLUTION':
                    await this.generateSolution(payload);
                    break;
                case 'SET_MODE':
                    this.setMode(payload);
                    break;
                case 'TEST':
                    // Test message to verify communication channel
                    console.log(`[WORKER ${process.pid}]: Received TEST message - communication channel is working!`);
                    break;
                default:
                    this.sendError(`Unknown message type: ${type}`);
            }
        } catch (error) {
            this.sendError(`Worker error: ${error.message}`, error.stack);
        }
    }

    setMode(payload) {
        const { mode, config } = payload;
        this.mode = mode;
        this.config = config;

        this.sendMessage('MODE_SET', { mode, config });
    }

    async generateSolution(payload) {
        const {
            shapes,
            jobId,
            startId = 0,
            aspectRatioPref = 0,
            devMode = false,
            annealConfig = {}
        } = payload;

        this.currentJob = { jobId, startId };

        try {
            // Convert plain shape data objects to Shape class instances
            // (postMessage serialization strips class methods)
            const shapeInstances = shapes.map(shapeData => Shape.fromDataObject(shapeData));

            // Phase 1: Create initial solution
            this.sendProgress('PHASE_START', { phase: 'anneal', message: 'Starting annealing process...' });

            // create Anneal instance
            const anneal = new this.Anneal(
                shapeInstances,
                devMode,
                aspectRatioPref
            );

            // create progress callback for worker messaging
            const progressCallback = (solution) => {
                if (this.mode === 'single') {
                    // send solution data for canvas updates
                    this.sendProgress('ANNEAL_PROGRESS', {
                        score: solution.score,
                        valid: solution.valid,
                        iterationEstimate: 'in progress',
                        // include visual data for single mode
                        visualData: {
                            layout: solution.layout,
                            shapes: solution.shapes.map(shape => ({
                                posX: shape.posX,
                                posY: shape.posY,
                                data: {
                                    title: shape.data.title,
                                    highResShape: shape.data.highResShape
                                }
                            }))
                        }
                    });
                } else {
                    // send basic progress info for bulk mode
                    this.sendProgress('ANNEAL_PROGRESS', {
                        score: solution.score,
                        valid: solution.valid,
                        iterationEstimate: 'in progress'
                    });
                }
            };

            // run the annealing process with the progress callback
            await anneal.run(progressCallback);

            if (!anneal.finalSolution) {
                throw new Error('Annealing failed to produce a solution');
            }

            this.sendProgress('PHASE_COMPLETE', { phase: 'anneal', score: anneal.finalSolution.score });

            // Generate grid-packing baseline (bulk mode only)
            let gridBaseline = null;
            if (this.mode === 'bulk') {
                this.sendProgress('PHASE_START', { phase: 'baseline-grid', message: 'Generating grid-packing baseline...' });
                gridBaseline = this.Solution.createGridBaseline(shapeInstances, aspectRatioPref);
                this.sendProgress('PHASE_COMPLETE', { phase: 'baseline-grid', score: gridBaseline.score });
            }

            // Phase 2: Cellular growth
            this.sendProgress('PHASE_START', { phase: 'cellular', message: 'Growing cellular structure...' });

            const cellular = new this.Cellular(anneal.finalSolution, devMode);
            cellular.growCells();

            this.sendProgress('PHASE_COMPLETE', { phase: 'cellular', cellCount: cellular.numAlive || 0 });

            // Generate baseline algorithm (bulk mode only)
            let baselineCellular = null;
            if (this.mode === 'bulk') {
                this.sendProgress('PHASE_START', { phase: 'baseline-cellular', message: 'Generating baseline wall growth...' });
                baselineCellular = new this.Cellular(anneal.finalSolution, devMode);
                baselineCellular.growBaseline();
                this.sendProgress('PHASE_COMPLETE', { phase: 'baseline-cellular', cellCount: baselineCellular.numAlive || 0 });
            }

            // Phase 3: Data preparation
            this.sendProgress('PHASE_START', { phase: 'export', message: 'Preparing data for storage...' });

            if (this.mode === 'single') {
                // For single mode, use the legacy nested result structure
                const result = {
                    title: `solution-${this.currentJob.startId + 1}`,
                    finalSolution: anneal.finalSolution.toDataObject(),
                    enabledShapes: shapeInstances.map(() => true),
                    solutionHistory: [], // Empty for bulk runs to reduce size
                    cellular: {
                        cellSpace: cellular.cellSpace,
                        maxTerrain: cellular.maxTerrain,
                        numAlive: cellular.numAlive || 0
                    },
                    metadata: {
                        timestamp: Date.now(),
                        mode: this.mode,
                        devMode: devMode,
                        aspectRatioPref: aspectRatioPref
                    }
                };
                this.sendResult(result);
            } else {
                // For bulk mode, calculate statistics and create flat record
                this.sendProgress('PHASE_START', { phase: 'statistics', message: 'Calculating statistics...' });
                const statistics = this.calculateStatistics(anneal, gridBaseline, cellular, baselineCellular);
                this.sendProgress('PHASE_COMPLETE', { phase: 'statistics', message: 'Statistics calculated' });

                // Create flat record that matches database schema exactly
                const flatRecord = this.createFlatRecord(
                    anneal,
                    gridBaseline,
                    cellular,
                    baselineCellular,
                    statistics,
                    shapeInstances
                );
                this.sendResult(flatRecord);
            }

            this.sendProgress('PHASE_COMPLETE', { phase: 'export', message: 'Data prepared for storage' });

            // Terminate immediately after sending result in bulk mode
            if (this.mode === 'bulk') {
                process.exit(0);
            }

        } catch (error) {
            this.sendError(`Solution generation failed: ${error.message}`, error.stack);
        } finally {
            this.currentJob = null;
        }
    }

    sendMessage(type, payload = {}) {
        if (this.parentPort) {
            // Node.js environment
            this.parentPort.postMessage({ type, payload });
        } else if (typeof self !== 'undefined' && self.postMessage) {
            // Browser environment
            self.postMessage({ type, payload });
        } else if (typeof process !== 'undefined' && process.send) {
            // Node.js child_process (fallback)
            process.send({ type, payload });
        } else {
            console.error(`WORKER: Unable to send message: ${type}`, payload);
        }
    }

    sendProgress(progressType, data) {
        this.sendMessage('PROGRESS', {
            progressType,
            mode: this.mode,
            jobId: this.currentJob?.jobId,
            startId: this.currentJob?.startId,
            ...data
        });
    }

    sendResult(result) {
        this.sendMessage('RESULT', result);
    }

    sendError(message, stack = null) {
        this.sendMessage('ERROR', {
            message,
            stack,
            jobId: this.currentJob?.jobId,
            startId: this.currentJob?.startId,
            timestamp: Date.now()
        });
    }

    calculateStatistics(anneal, gridBaseline, cellular, baselineCellular) {
        // Calculate statistics for bulk mode storage
        const statistics = {};

        // Calculate empty space for optimized and grid solutions
        statistics.emptySpaceOptimized = anneal.finalSolution.calculateEmptySpace();
        statistics.emptySpaceGrid = gridBaseline.calculateEmptySpace();

        // Define export configuration (hardcoded for bulk mode)
        const exportConfig = {
            caseDepth: 3,
            sheetThickness: 0.23,
            sheetWidth: 30,
            sheetHeight: 28,
            numSheets: 1,
            kerf: 0,
            numPinSlots: 2
        };

        // Extract spacing from anneal instance
        const spacing = {
            buffer: anneal.buffer,
            xPadding: anneal.xPadding,
            yPadding: anneal.yPadding
        };

        // Calculate board counts, lengths, and render data for optimized solution
        const optimizedExport = new this.Export(cellular, spacing, exportConfig);
        optimizedExport.makeBoards();
        statistics.boardCountOptimized = optimizedExport.boards.length;
        statistics.totalBoardLengthOptimized = optimizedExport.getTotalBoardLength();
        statistics.boardRenderDataOptimized = optimizedExport.getBoardRenderData();

        // Calculate board counts, lengths, and render data for baseline algorithm
        const baselineExport = new this.Export(baselineCellular, spacing, exportConfig);
        baselineExport.makeBoards();
        statistics.boardCountBaseline = baselineExport.boards.length;
        statistics.totalBoardLengthBaseline = baselineExport.getTotalBoardLength();
        statistics.boardRenderDataBaseline = baselineExport.getBoardRenderData();

        return statistics;
    }

    createFlatRecord(anneal, gridBaseline, cellular, baselineCellular, statistics, shapeInstances) {
        // Create export format structure for export_data_json
        const exportData = {
            savedAnneals: [{
                title: `solution-${this.currentJob.startId + 1}`,
                finalSolution: anneal.finalSolution.toDataObject(),
                enabledShapes: shapeInstances.map(() => true), // All shapes enabled in bulk runs
                solutionHistory: [] // Empty for bulk runs
            }],
            allShapes: shapeInstances.map(shape => shape.toDataObject())
        };

        // Create cellular data structure
        const cellularData = {
            cellSpace: cellular.cellSpace,
            maxTerrain: cellular.maxTerrain,
            numAlive: cellular.numAlive || 0
        };

        // Create metadata
        const metadata = {
            timestamp: Date.now(),
            mode: this.mode,
            devMode: false, // Always false in bulk mode
            aspectRatioPref: anneal.finalSolution.aspectRatioPref
        };

        // Create stats breakdown object containing all raw statistical values
        const statsBreakdown = {
            empty_space_optimized: statistics.emptySpaceOptimized,
            empty_space_grid: statistics.emptySpaceGrid,
            board_count_optimized: statistics.boardCountOptimized,
            board_count_baseline: statistics.boardCountBaseline,
            total_board_length_optimized: statistics.totalBoardLengthOptimized,
            total_board_length_baseline: statistics.totalBoardLengthBaseline
        };

        // Create flat record that matches database schema exactly
        return {
            // Job identifiers
            jobId: this.currentJob.jobId,
            startId: this.currentJob.startId,

            // Simple metrics (numbers/booleans)
            score: anneal.finalSolution.score,
            valid: anneal.finalSolution.valid,

            // Consolidated statistical data
            stats_breakdown_json: JSON.stringify(statsBreakdown),

            // Complex data (pre-stringified JSON)
            export_data_json: JSON.stringify(exportData),
            cellular_json: JSON.stringify(cellularData),
            metadata_json: JSON.stringify(metadata),
            baseline_grid_json: JSON.stringify({
                solution: gridBaseline.toDataObject(),
                score: gridBaseline.score
            }),
            baseline_cellular_json: JSON.stringify({
                cellSpace: baselineCellular.cellSpace,
                maxTerrain: baselineCellular.maxTerrain,
                numAlive: baselineCellular.numAlive || 0
            }),
            board_render_data_optimized: JSON.stringify(statistics.boardRenderDataOptimized),
            board_render_data_baseline: JSON.stringify(statistics.boardRenderDataBaseline)
        };
    }
}

// Export for unit testing when imported as a module
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SolutionWorker;
}

//== Worker Initialization
if (typeof module === 'undefined' || !module.parent) {
    let worker;

    // Environment-agnostic initialization
    if (typeof importScripts === 'function') {
        // Browser Web Worker Environment
        try {
            worker = initializeBrowserWorker();
        } catch (error) {
            self.postMessage({ type: 'ERROR', payload: { message: 'Worker initialization failed: ' + error.message } });
        }

    } else if (typeof require === 'function') {
        // Node.js worker_threads Environment  

        try {
            worker = initializeNodeWorker();
        } catch (error) {
            console.error(`FATAL ERROR during initialization: ${error.message}`);
            process.exit(1);
        }
    }
}

/**
 * Initialize worker in browser environment
 */
function initializeBrowserWorker() {
    // Load dependencies
    importScripts(
        '../core/EventEmitter.js',
        '../core/Shape.js',
        '../core/Solution.js',
        '../core/Cellular.js',
        '../core/Anneal.js',
        '../core/Export.js',
        '../core/Board.js'
    );

    // In the browser, classes are available in the global scope
    const worker = new SolutionWorker({ Anneal, Cellular, Solution, Export, Board });

    // Set up browser event handlers
    self.onmessage = function (event) {
        if (worker) {
            worker.processMessage(event.data);
        }
    };

    self.onerror = function (error) {
        if (worker) {
            worker.sendError(`Worker runtime error: ${error.message}`, error.stack);
        }
    };

    return worker;
}

/**
 * Initialize worker in Node.js environment
 */
function initializeNodeWorker() {
    const { parentPort } = require('worker_threads');

    // Load dependencies
    const Solution = require('../core/Solution.js');
    const Shape = require('../core/Shape.js');
    const Anneal = require('../core/Anneal.js');
    const Cellular = require('../core/Cellular.js');
    const Export = require('../core/Export.js');
    const Board = require('../core/Board.js');

    // Make dependencies available in global scope
    if (typeof global !== 'undefined') {
        if (!global.Solution) global.Solution = Solution;
        if (!global.Shape) global.Shape = Shape;
        if (!global.Board) global.Board = Board;
    }

    // Create worker instance
    const worker = new SolutionWorker({ Anneal, Cellular, Solution, Export, Board });

    // Store parentPort reference for message sending
    worker.parentPort = parentPort;

    // Set up Node.js worker_threads event handlers
    parentPort.on('message', (data) => {
        if (worker) {
            worker.processMessage(data);
        }
    });

    parentPort.on('error', (error) => {
        if (worker) {
            worker.sendError(`Worker runtime error: ${error.message}`, error.stack);
        }
    });

    return worker;
}