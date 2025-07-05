const { Worker } = require('worker_threads');
const fs = require('fs').promises;
const path = require('path');

/**
 * BulkCLI.js - Command line interface for bulk analysis orchestration
 * 
 * Orchestrates bulk statistical analysis by:
 * - Loading input configurations and shapes
 * - Spawning multiple solution-workers in parallel
 * - Coordinating with queue-worker for result persistence
 * - Providing real-time console progress updates
 * - Managing cleanup and completion
 */
class BulkCLI {
    constructor() {
        this.config = {
            // Default configuration
            aspectRatioPref: 0,         // Square preference
            workerCount: 10,            // Number of parallel workers
            batchSize: 50,              // Workers per batch before extended delay
            staggerDelay: 100,          // Delay between worker launches (ms)
        };

        // Constants for worker staggering behavior
        this.BATCH_BOUNDARY_DELAY_MULTIPLIER = 10; // Extended delay multiplier at batch boundaries

        this.queueWorker = null;
        this.completedWorkers = 0;
        this.failedWorkers = 0;
        this.totalWorkers = 0;
        this.inputShapes = [];
        this.jobId = null;
        this.startTime = null;
        this.progressInterval = null;
        this.completionPromise = null; // Promise for job completion notification
        this.completionResolve = null; // Function to signal job completion
        this.jobStartedPromise = null; // Promise for job ID assignment
        this.jobStartedResolve = null; // Function to signal job ID received
    }

    /**
     * Main entry point for CLI execution
     */
    async run(args = process.argv.slice(2)) {
        try {
            console.log('🚀 Uniquely Shaped Spaces - Bulk Analysis Tool');
            console.log('='.repeat(50));

            // Parse command line arguments
            const options = this.parseArguments(args);

            // Validate and load configuration
            await this.loadConfiguration(options);

            // Load input shapes
            await this.loadInputShapes(options.shapesFile);

            // Initialize queue worker
            await this.initializeQueueWorker();

            // Start bulk analysis
            await this.startBulkAnalysis();

            // Wait for completion
            await this.waitForCompletion();

            // Clean up and exit
            await this.cleanup();

        } catch (error) {
            console.error('❌ Bulk analysis failed:', error.message);
            await this.cleanup();
            process.exit(1);
        }
    }

    /**
     * Parse command line arguments
     */
    parseArguments(args) {
        const options = {
            shapesFile: null,
            count: this.config.workerCount,
            aspectRatio: this.config.aspectRatioPref,
            batchSize: this.config.batchSize,
            help: false
        };

        for (let i = 0; i < args.length; i++) {
            const arg = args[i];
            const nextArg = args[i + 1];

            switch (arg) {
                case '--shapes':
                case '-s':
                    options.shapesFile = nextArg;
                    i++;
                    break;
                case '--count':
                case '-c':
                    options.count = parseInt(nextArg, 10);
                    i++;
                    break;
                case '--aspect-ratio':
                case '-a':
                    options.aspectRatio = parseFloat(nextArg);
                    i++;
                    break;
                case '--batch-size':
                case '-b':
                    options.batchSize = parseInt(nextArg, 10);
                    i++;
                    break;
                case '--help':
                case '-h':
                    options.help = true;
                    break;
                default:
                    if (arg.startsWith('-')) {
                        throw new Error(`Unknown option: ${arg}`);
                    }
            }
        }

        if (options.help) {
            this.showHelp();
            process.exit(0);
        }

        if (!options.shapesFile) {
            throw new Error('Shapes file is required. Use --shapes <file.json>');
        }

        if (isNaN(options.count) || options.count < 1) {
            throw new Error('Count must be a positive integer');
        }

        return options;
    }

    /**
     * Show help message
     */
    showHelp() {
        console.log(`
Usage: node bulk-cli.js [options]

Options:
  -s, --shapes <file>          Input shapes JSON file (required)
  -c, --count <number>         Number of solutions to generate (default: 10)
  -a, --aspect-ratio <number>  Aspect ratio preference (default: 0)
  -b, --batch-size <num>       Workers per batch before extended delay (default: 50)
  -h, --help                   Show this help message

Examples:
  node bulk-cli.js --shapes input.json --count 100
  node bulk-cli.js -s shapes.json -c 500 --aspect-ratio 1.5
  node bulk-cli.js -s data.json -c 1000 -b 50
        `);
    }

    /**
     * Load and validate configuration
     */
    async loadConfiguration(options) {
        this.config.aspectRatioPref = options.aspectRatio;
        this.config.workerCount = options.count;
        this.config.batchSize = options.batchSize;

        console.log('📋 Configuration:');
        console.log(`   - Solutions to generate: ${this.config.workerCount}`);
        console.log(`   - Aspect ratio preference: ${this.config.aspectRatioPref}`);
        console.log(`   - Batch size: ${this.config.batchSize}`);
        console.log('');
    }

    /**
     * Load input shapes from JSON file
     */
    async loadInputShapes(shapesFile) {
        try {
            console.log(`📁 Loading shapes from: ${shapesFile}`);

            const fileContent = await fs.readFile(shapesFile, 'utf8');
            const data = JSON.parse(fileContent);

            if (!data.allShapes || !Array.isArray(data.allShapes)) {
                throw new Error('Invalid shapes file: missing "allShapes" array');
            }

            this.inputShapes = data.allShapes;

            if (this.inputShapes.length === 0) {
                throw new Error('No shapes found in input file');
            }

            console.log(`   ✅ Loaded ${this.inputShapes.length} shapes`);
            console.log('');

        } catch (error) {
            if (error.code === 'ENOENT') {
                throw new Error(`Shapes file not found: ${shapesFile}`);
            } else if (error instanceof SyntaxError) {
                throw new Error(`Invalid JSON in shapes file: ${error.message}`);
            } else {
                throw error;
            }
        }
    }

    /**
     * Initialize queue worker for result persistence
     */
    async initializeQueueWorker() {
        console.log('🔧 Initializing queue worker...');

        const queueWorkerPath = path.join(__dirname, '../../workers/queue-worker.js');
        this.queueWorker = new Worker(queueWorkerPath);

        // Set up queue worker message handling
        this.queueWorker.on('message', (message) => {
            this.handleQueueWorkerMessage(message);
        });

        this.queueWorker.on('error', (error) => {
            console.error('❌ Queue worker error:', error);
        });

        this.queueWorker.on('exit', (code) => {
            if (code !== 0) {
                console.error(`❌ Queue worker exited with code ${code}`);
            }
        });

        console.log('   ✅ Queue worker initialized');
        console.log('');
    }

    /**
     * Start the bulk analysis process
     */
    async startBulkAnalysis() {
        this.startTime = Date.now();
        this.totalWorkers = this.config.workerCount;

        console.log('🎯 Starting bulk analysis...');
        console.log(`   - Target: ${this.totalWorkers} solutions`);
        console.log('');

        // Set up completion notification mechanism
        this.completionPromise = new Promise((resolve) => {
            this.completionResolve = resolve;
        });

        // Start job in queue worker and wait for job ID
        await this.startJobAndWaitForId();

        // Start progress reporting
        this.startProgressReporting();

        // Launch solution workers with staggering
        await this.launchSolutionWorkers();
    }

    /**
     * Start job in queue worker and wait for the job ID to be assigned
     */
    async startJobAndWaitForId() {
        // Set up promise for job ID assignment
        this.jobStartedPromise = new Promise((resolve) => {
            this.jobStartedResolve = resolve;
        });

        // Start job in queue worker
        this.queueWorker.postMessage({
            type: 'START_JOB',
            payload: {
                config: { aspectRatioPref: this.config.aspectRatioPref },
                inputShapes: this.inputShapes,
                totalWorkers: this.totalWorkers
            }
        });

        // Wait for job ID to be assigned
        await this.jobStartedPromise;
    }

    /**
     * Launch solution workers with proper staggering
     */
    async launchSolutionWorkers() {
        const solutionWorkerPath = path.join(__dirname, '../../workers/solution-worker.js');

        for (let i = 0; i < this.totalWorkers; i++) {
            // Implement staggering if we have many workers
            if (i > 0 && i % this.config.batchSize === 0) {
                // Wait a bit when hitting batch boundary
                await this.sleep(this.config.staggerDelay * this.BATCH_BOUNDARY_DELAY_MULTIPLIER);
            } else if (i > 0) {
                // Small delay between each worker
                await this.sleep(this.config.staggerDelay);
            }

            this.launchSolutionWorker(solutionWorkerPath, i);
        }
    }

    /**
     * Launch a single solution worker
     */
    launchSolutionWorker(workerPath, startId) {
        const worker = new Worker(workerPath);

        // Set up worker message handling
        worker.on('message', (message) => {
            this.handleSolutionWorkerMessage(worker, startId, message);
        });

        worker.on('error', (error) => {
            this.handleSolutionWorkerError(worker, startId, error);
        });

        worker.on('exit', (code) => {
            // Workers self-terminate after completion, no tracking needed
        });

        // Configure worker for bulk mode
        worker.postMessage({
            type: 'SET_MODE',
            payload: {
                mode: 'bulk',
                config: { aspectRatioPref: this.config.aspectRatioPref }
            }
        });

        // Start solution generation
        worker.postMessage({
            type: 'GENERATE_SOLUTION',
            payload: {
                shapes: this.inputShapes,
                jobId: this.jobId,
                startId: startId,
                aspectRatioPref: this.config.aspectRatioPref
            }
        });
    }

    /**
     * Create error payload for queue worker
     */
    createSolutionErrorPayload(startId, error, errorType = 'solution') {
        return {
            type: 'SOLUTION_ERROR',
            payload: {
                type: 'SOLUTION_ERROR',
                startId: startId,
                error: {
                    message: error.message,
                    stack: error.stack,
                    errorType: errorType // 'solution' or 'runtime'
                },
                workerPayload: {
                    shapes: this.inputShapes,
                    startId: startId,
                    aspectRatioPref: this.config.aspectRatioPref
                }
            }
        };
    }

    /**
     * Handle messages from solution workers
     */
    handleSolutionWorkerMessage(worker, startId, message) {
        const { type, payload } = message;

        switch (type) {
            case 'RESULT':
                // Forward result to queue worker
                // Note: Worker will self-terminate after sending result
                this.queueWorker.postMessage({
                    type: 'SOLUTION_RESULT',
                    payload: {
                        type: 'SOLUTION_RESULT',
                        startId: startId,
                        result: payload
                    }
                });
                break;

            case 'ERROR':
                // Forward error to queue worker
                this.queueWorker.postMessage(
                    this.createSolutionErrorPayload(startId, payload, 'solution')
                );
                // Note: Worker will self-terminate after sending error
                break;

            case 'PROGRESS':
                // In bulk mode only track completion
                break;
        }
    }

    /**
     * Handle solution worker errors
     */
    handleSolutionWorkerError(worker, startId, error) {
        // Create enhanced error object with runtime context
        const runtimeError = {
            message: `Worker runtime error: ${error.message}`,
            stack: error.stack
        };

        // Forward error to queue worker
        this.queueWorker.postMessage(
            this.createSolutionErrorPayload(startId, runtimeError, 'runtime')
        );

        // Terminate worker on runtime errors (not self-terminating in this case)
        worker.terminate();
    }

    /**
     * Handle messages from queue worker
     */
    handleQueueWorkerMessage(message) {
        const { type, payload } = message;

        switch (type) {
            case 'JOB_STARTED':
                this.jobId = payload.jobId;
                // Signal job ID assignment completion
                if (this.jobStartedResolve) {
                    this.jobStartedResolve();
                    this.jobStartedResolve = null;
                    this.jobStartedPromise = null;
                }
                break;

            case 'PROGRESS_UPDATE':
                this.completedWorkers = payload.completed;
                this.failedWorkers = payload.failed;
                // Progress display is handled by interval timer
                break;

            case 'JOB_COMPLETED':
                this.handleJobCompletion(payload);
                break;

            case 'QUEUE_ERROR':
            case 'BATCH_ERROR':
            case 'COMPLETION_ERROR':
                console.error(`❌ Queue error: ${payload.message}`);
                break;
        }
    }

    /**
     * Handle job completion
     */
    handleJobCompletion(payload) {
        // Clear current progress line
        process.stdout.write('\r\x1b[K');

        console.log('🎉 Bulk analysis completed!');
        console.log('='.repeat(50));
        console.log(`Job ID: ${payload.jobId}`);
        console.log(`Duration: ${Math.round(payload.duration / 1000)}s`);
        console.log(`Successful solutions: ${payload.completed}`);
        console.log(`Failed attempts: ${payload.failed}`);
        console.log(`Total processed: ${payload.completed + payload.failed}`);

        console.log('');
        console.log('💾 Results saved to database: js/models/results.sqlite');
        if (payload.failed > 0) {
            console.log('📋 Error details are stored in the solution_errors table');
        }
        console.log('');

        // Signal job completion
        if (this.completionResolve) {
            this.completionResolve();
            this.completionResolve = null;
        }
    }

    /**
     * Start progress reporting
     */
    startProgressReporting() {
        this.progressInterval = setInterval(() => {
            this.updateProgress();
        }, 1000); // Update every second
    }

    /**
     * Update progress display
     */
    updateProgress() {
        const totalProcessed = this.completedWorkers + this.failedWorkers;
        const percentage = Math.round((totalProcessed / this.totalWorkers) * 100);
        const elapsed = Math.round((Date.now() - this.startTime) / 1000);

        // Calculate rate and estimate
        const rate = totalProcessed > 0 ? totalProcessed / (elapsed || 1) : 0;
        const remaining = this.totalWorkers - totalProcessed;
        const eta = rate > 0 ? Math.round(remaining / rate) : 0;

        // Format time
        const formatTime = (seconds) => {
            if (seconds < 60) return `${seconds}s`;
            const minutes = Math.floor(seconds / 60);
            const secs = seconds % 60;
            return `${minutes}m ${secs}s`;
        };

        // Clear line and write progress
        process.stdout.write('\r\x1b[K');
        process.stdout.write(
            `📈 ${totalProcessed}/${this.totalWorkers} (${percentage}%) | ` +
            `✅ ${this.completedWorkers} | ❌ ${this.failedWorkers} | ` +
            `⏱️ ${formatTime(elapsed)}${eta > 0 ? ` | ETA ${formatTime(eta)}` : ''}`
        );
    }

    /**
     * Wait for job completion
     */
    async waitForCompletion() {
        // Return promise that resolves when job completes
        return this.completionPromise;
    }

    /**
     * Clean up resources
     */
    async cleanup() {
        console.log('🧹 Cleaning up...');

        // Stop progress reporting
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
            this.progressInterval = null;
        }

        // Close queue worker
        if (this.queueWorker) {
            await this.queueWorker.terminate();
            this.queueWorker = null;
        }

        console.log('   ✅ Cleanup complete');
    }

    /**
     * Sleep utility function
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// CLI entry point
if (require.main === module) {
    const cli = new BulkCLI();
    cli.run().catch((error) => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

module.exports = BulkCLI; 