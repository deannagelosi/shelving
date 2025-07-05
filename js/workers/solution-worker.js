// web worker for solution generation pipeline
// supports both single-run and bulk-run modes using the same core algorithms
// single-run mode is used by the web interface
// bulk-run mode is used by the bulk CLI tool for statistical analysis

try {
    importScripts('../core/EventEmitter.js');
    importScripts('../core/Shape.js');
    importScripts('../core/Solution.js');
    importScripts('../core/Cellular.js');
    importScripts('../core/Anneal.js');
} catch (error) {
    console.error('Failed to import core scripts:', error);
}

class SolutionWorker {
    constructor() {
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

            const cellular = new Cellular(anneal.finalSolution, devMode);
            cellular.growCells();

            this.sendProgress('PHASE_COMPLETE', { phase: 'cellular', cellCount: cellular.numAlive || 0 });

            // Phase 3: Export preparation
            this.sendProgress('PHASE_START', { phase: 'export', message: 'Preparing export data...' });

            // send the complete final solution data
            const result = {
                finalSolution: anneal.finalSolution,
                cellular: {
                    cellLines: Array.from(cellular.cellLines || []),
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

        } catch (error) {
            this.sendError(`Solution generation failed: ${error.message}`, error.stack);
        } finally {
            this.currentJob = null;
        }
    }

    sendMessage(type, payload = {}) {
        self.postMessage({ type, payload });
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

// initialize worker instance
const worker = new SolutionWorker();

// handle messages from main thread
self.onmessage = function (event) {
    worker.processMessage(event.data);
};

// handle worker errors
self.onerror = function (error) {
    worker.sendError(`Worker runtime error: ${error.message}`, error.stack);
};

// export for unit testing (i.e. if in Node environment)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SolutionWorker;
} 