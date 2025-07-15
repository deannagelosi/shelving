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

/**
 * Inner class for managing a pool of workers with concurrency limit
 */
class WorkerPool {
    constructor({ totalTasks, maxWorkers, staggerDelay, launchFn }) {
        this.totalTasks = totalTasks;
        this.maxWorkers = maxWorkers;
        this.staggerDelay = staggerDelay;
        this.launchFn = launchFn; // Function to launch a worker with startId
        this.nextId = 0;
        this.active = 0;
    }

    async start() {
        // Launch initial workers up to max
        while (this.active < this.maxWorkers && this.nextId < this.totalTasks) {
            await this.launchNext();
        }
    }

    async launchNext() {
        if (this.nextId >= this.totalTasks) return;
        const id = this.nextId++;
        this.active++;
        this.launchFn(id);
        if (this.active < this.maxWorkers && this.nextId < this.totalTasks) {
            await this.sleep(this.staggerDelay);
        }
    }

    onFinished() {
        this.active--;
        if (this.nextId < this.totalTasks) {
            this.launchNext();
        }
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

class BulkCLI {
    constructor() {
        this.config = {
            // Default configuration
            aspectRatioPref: 0,         // Square preference
            solutionCount: 100,         // Default total solutions
            maxWorkers: 4,              // Max parallel workers (concurrency limit)
            staggerDelay: 500,          // Delay between worker launches (ms)
        };

        // Constants for worker staggering behavior

        this.queueWorker = null;
        this.completedWorkers = 0;
        this.failedWorkers = 0;
        this.inputShapes = [];
        this.jobId = null;
        this.startTime = null;
        this.progressInterval = null;
        this.completionPromise = null; // Promise for job completion notification
        this.completionResolve = null; // Function to signal job completion
        this.jobStartedPromise = null; // Promise for job ID assignment
        this.jobStartedResolve = null; // Function to signal job ID received
        this.totalSolutions = 0; // Store total solutions requested
        this.pool = null; // WorkerPool instance
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

            // Check and initialize database if needed
            const databaseInitialized = await this.checkAndInitializeDatabase();
            if (!databaseInitialized) {
                // Database was just created, exit and prompt for rerun
                return;
            }

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
            count: this.config.solutionCount,
            aspectRatio: this.config.aspectRatioPref,
            workers: this.config.maxWorkers,
            randMin: null,
            randMax: null,
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
                case '--workers':
                case '-w':
                    options.workers = parseInt(nextArg, 10);
                    i++;
                    break;
                case '--rand-min':
                    options.randMin = parseInt(nextArg, 10);
                    i++;
                    break;
                case '--rand-max':
                    options.randMax = parseInt(nextArg, 10);
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

        if (isNaN(options.workers) || options.workers < 1) {
            throw new Error('Workers must be a positive integer');
        }

        // Validate random sampling parameters
        if ((options.randMin !== null) !== (options.randMax !== null)) {
            throw new Error('Both --rand-min and --rand-max must be provided together');
        }

        if (options.randMin !== null && options.randMax !== null) {
            if (isNaN(options.randMin) || isNaN(options.randMax)) {
                throw new Error('Random sampling bounds must be valid integers');
            }

            if (options.randMin < 1) {
                throw new Error('--rand-min must be at least 1');
            }

            if (options.randMax < options.randMin) {
                throw new Error('--rand-max must be greater than or equal to --rand-min');
            }
        }

        return options;
    }

    /**
     * Show help message
     */
    showHelp() {
        console.log(`
Usage: node BulkCLI.js [options]

Options:
  -s, --shapes <file>          Input shapes JSON file (required)
  -c, --count <number>         Number of solutions to generate (default: 10)
  -a, --aspect-ratio <number>  Aspect ratio preference (default: 0)
  -w, --workers <number>       Max parallel workers (default: 4)
      --rand-min <number>      Minimum shapes to sample per solution (requires --rand-max)
      --rand-max <number>      Maximum shapes to sample per solution (requires --rand-min)
  -h, --help                   Show this help message

Examples:
  node BulkCLI.js --shapes input.json --count 100
  node BulkCLI.js -s shapes.json -c 500 --aspect-ratio 1.5
  node BulkCLI.js -s data.json -c 1000 -w 50
  node BulkCLI.js -s input.json -c 200 --rand-min 5 --rand-max 15
        `);
    }

    /**
     * Load and validate configuration
     */
    async loadConfiguration(options) {
        this.config.aspectRatioPref = options.aspectRatio;
        this.config.maxWorkers = options.workers;
        this.config.randMin = options.randMin;
        this.config.randMax = options.randMax;
        this.totalSolutions = options.count;

        console.log('📋 Configuration:');
        console.log(`   - Solutions to generate: ${options.count}`);
        console.log(`   - Max parallel workers: ${this.config.maxWorkers}`);
        console.log(`   - Aspect ratio preference: ${this.config.aspectRatioPref}`);
        if (this.config.randMin !== null && this.config.randMax !== null) {
            console.log(`   - Random sampling: ${this.config.randMin} to ${this.config.randMax} shapes per solution`);
        } else {
            console.log(`   - Shape selection: All shapes`);
        }
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

            // Validate random sampling bounds against total shape count
            if (this.config.randMin !== null && this.config.randMax !== null) {
                if (this.config.randMax > this.inputShapes.length) {
                    throw new Error(`--rand-max (${this.config.randMax}) cannot exceed total number of shapes (${this.inputShapes.length})`);
                }
                console.log(`   ✅ Random sampling validated: ${this.config.randMin} to ${this.config.randMax} shapes per solution`);
            } else {
                console.log(`   ℹ️  Using all ${this.inputShapes.length} shapes for each solution`);
            }
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
     * Check and initialize database if needed
     */
    async checkAndInitializeDatabase() {
        const dbPath = path.join(__dirname, '../../models/results.sqlite');

        try {
            await fs.access(dbPath);
            console.log('📁 Database found at: ' + dbPath);
            return true;
        } catch (error) {
            if (error.code === 'ENOENT') {
                console.log('📁 Database not found at: ' + dbPath);
                console.log('💾 Initializing new database...');

                // Import and initialize the Result class to create the database
                const Result = require('../../models/Result.js');
                const result = new Result();

                try {
                    await result.init();
                    await result.close();

                    console.log('✅ Database initialized successfully.');
                    console.log('');
                    console.log('🔄 Database is now ready. Please run the command again to start bulk analysis.');
                    console.log('');

                    return false; // Indicate that database was just initialized
                } catch (initError) {
                    console.error('❌ Database initialization failed:', initError.message);
                    process.exit(1);
                }
            } else {
                throw error; // Re-throw other errors
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

        console.log('🎯 Starting bulk analysis...');
        console.log(`   - Target: ${this.totalSolutions} solutions`);
        console.log(`   - Max parallel workers: ${this.config.maxWorkers}`);
        console.log('');

        // Set up completion notification mechanism
        this.completionPromise = new Promise((resolve) => {
            this.completionResolve = resolve;
        });

        // Start job in queue worker and wait for job ID
        await this.startJobAndWaitForId();

        // Start progress reporting
        this.startProgressReporting();

        // Set up WorkerPool
        const solutionWorkerPath = path.join(__dirname, '../../workers/solution-worker.js');
        this.pool = new WorkerPool({
            totalTasks: this.totalSolutions,
            maxWorkers: this.config.maxWorkers,
            staggerDelay: this.config.staggerDelay,
            launchFn: (startId) => this.launchSolutionWorker(solutionWorkerPath, startId)
        });

        // Launch workers via pool
        await this.pool.start();
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
                config: {
                    aspectRatioPref: this.config.aspectRatioPref,
                    randMin: this.config.randMin,
                    randMax: this.config.randMax
                },
                inputShapes: this.inputShapes,
                totalSolutions: this.totalSolutions
            }
        });

        // Wait for job ID to be assigned
        await this.jobStartedPromise;
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
                config: {
                    aspectRatioPref: this.config.aspectRatioPref,
                    randMin: this.config.randMin,
                    randMax: this.config.randMax
                }
            }
        });

        // Start solution generation
        worker.postMessage({
            type: 'GENERATE_SOLUTION',
            payload: {
                shapes: this.inputShapes,
                jobId: this.jobId,
                startId: startId,
                aspectRatioPref: this.config.aspectRatioPref,
                randMin: this.config.randMin,
                randMax: this.config.randMax
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
                    aspectRatioPref: this.config.aspectRatioPref,
                    randMin: this.config.randMin,
                    randMax: this.config.randMax
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
                // Forward flat record directly to queue worker
                // Note: Worker will self-terminate after sending result
                this.queueWorker.postMessage({
                    type: 'SOLUTION_RESULT',
                    payload: payload
                });
                this.pool.onFinished(); // Signal worker finished
                break;

            case 'ERROR':
                // Forward error to queue worker
                this.queueWorker.postMessage(
                    this.createSolutionErrorPayload(startId, payload, 'solution')
                );
                // Note: Worker will self-terminate after sending error
                this.pool.onFinished(); // Signal worker finished
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
        this.pool.onFinished(); // Signal worker finished
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
        const percentage = Math.round((totalProcessed / this.totalSolutions) * 100);
        const elapsed = Math.round((Date.now() - this.startTime) / 1000);

        // Calculate rate and estimate
        const rate = totalProcessed > 0 ? totalProcessed / (elapsed || 1) : 0;
        const remaining = this.totalSolutions - totalProcessed;
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
            `📈 ${totalProcessed}/${this.totalSolutions} (${percentage}%) | ` +
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