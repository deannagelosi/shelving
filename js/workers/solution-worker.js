// web worker for solution generation pipeline
// supports both single-run and bulk-run modes using the same core algorithms
// single-run mode is used by the web interface
// bulk-run mode is used by the bulk CLI tool for statistical analysis

class SolutionWorker {
    constructor(dependencies) {
        // Dependencies are injected for environment compatibility
        this.Anneal = dependencies.Anneal;
        this.Cellular = dependencies.Cellular;

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

            // Phase 2: Cellular growth
            this.sendProgress('PHASE_START', { phase: 'cellular', message: 'Growing cellular structure...' });

            const cellular = new this.Cellular(anneal.finalSolution, devMode);
            cellular.growCells();

            this.sendProgress('PHASE_COMPLETE', { phase: 'cellular', cellCount: cellular.numAlive || 0 });

            // Phase 3: Export preparation
            this.sendProgress('PHASE_START', { phase: 'export', message: 'Preparing export data...' });

            // send the complete final solution data
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

            this.sendProgress('PHASE_COMPLETE', { phase: 'export', message: 'Export data prepared' });

            // send final result
            this.sendResult(result);

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
        '../core/Anneal.js'
    );

    // In the browser, classes are available in the global scope
    const worker = new SolutionWorker({ Anneal, Cellular });

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

    // Make dependencies available in global scope
    if (typeof global !== 'undefined') {
        if (!global.Solution) global.Solution = Solution;
        if (!global.Shape) global.Shape = Shape;
    }

    // Create worker instance
    const worker = new SolutionWorker({ Anneal, Cellular });

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