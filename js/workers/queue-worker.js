const Result = require('../models/Result.js');
const { v4: uuidv4 } = require('uuid');

/**
 * queue-worker.js - Web worker for bulk result queue management and persistence
 * 
 * Implements drain-and-process pattern for handling concurrent solution results
 * from multiple solution-workers. Manages database persistence for both successful
 * solutions and errors.
 * 
 * Used only by bulk CLI - not used by web interface
 */
class QueueWorker {
    constructor() {
        this.inbox = [];
        this.processing = false;
        this.result = null;
        this.currentJobId = null;
        this.currentJobConfig = null;
        this.completedCount = 0;
        this.failedCount = 0;
        this.totalExpected = 0;
        this.jobStartTime = null;
        this.savingDatabaseErrors = false;
    }

    async init() {
        try {
            this.result = new Result();
            await this.result.init();
        } catch (error) {
            console.error('Failed to initialize queue worker:', error);
            throw error;
        }
    }

    async close() {
        if (this.result) {
            await this.result.close();
            this.result = null;
        }
    }

    /**
     * Main message handler - receives messages from bulk CLI
     */
    async handleMessage(data) {
        const { type, payload } = data;

        try {
            switch (type) {
                case 'START_JOB':
                    await this.startJob(payload);
                    break;
                case 'SOLUTION_RESULT':
                    this.queueResult({ type: 'SOLUTION_RESULT', flatRecord: payload });
                    break;
                case 'SOLUTION_ERROR':
                    this.queueResult({ type: 'SOLUTION_ERROR', ...payload });
                    break;
                default:
                    console.warn(`Unknown message type: ${type}`);
            }
        } catch (error) {
            console.error(`Queue worker error handling ${type}:`, error);
            this.sendMessage('QUEUE_ERROR', {
                message: error.message,
                stack: error.stack,
                originalType: type
            });
        }
    }

    /**
     * Start a new bulk job
     */
    async startJob(payload) {
        const { config, inputShapes, totalSolutions } = payload;

        this.currentJobId = await this.result.createBulkJob(config, inputShapes, totalSolutions);
        this.currentJobConfig = config;
        this.totalExpected = totalSolutions;
        this.completedCount = 0;
        this.failedCount = 0;
        this.jobStartTime = Date.now();
        this.savingDatabaseErrors = false; // Reset circuit breaker for new job

        this.sendMessage('JOB_STARTED', {
            jobId: this.currentJobId,
            totalSolutions: totalSolutions
        });
    }

    // drain-and-process pattern
    queueResult(result) {
        this.inbox.push(result);
        this.processBatch(); // Non-blocking trigger
    }

    async processBatch() {
        if (this.processing) return; // Prevent concurrent processing
        this.processing = true;

        try {
            // Atomic drain operation
            const batch = [...this.inbox]; // Copy
            this.inbox = []; // Clear original

            if (batch.length === 0) {
                this.processing = false;
                return;
            }

            // Process entire batch (no race conditions)
            await this.writeBatchToDatabase(batch);

            this.processing = false;

            // Check if more items arrived during processing
            if (this.inbox.length > 0) {
                this.processBatch(); // Process any items that arrived
            }

            // Check if job is complete
            await this.checkJobCompletion();

        } catch (error) {
            console.error('Error processing batch:', error);
            this.processing = false;

            // TODO: Add retry logic for failed batches
            this.sendMessage('BATCH_ERROR', {
                message: error.message,
                stack: error.stack,
                batchSize: batch.length
            });
        }
    }

    /**
     * Write batch to database with proper error handling and separation
     */
    async writeBatchToDatabase(batch) {
        // Separate results from errors
        const solutions = batch.filter(item => item.type === 'SOLUTION_RESULT');
        const errors = batch.filter(item => item.type === 'SOLUTION_ERROR');

        // Process solutions in batch
        if (solutions.length > 0) {
            try {
                // Extract flat records directly from batch items
                const flatRecords = solutions.map(item => item.flatRecord);

                await this.result.saveSolutionBatch(flatRecords);
                this.completedCount += solutions.length;

            } catch (error) {
                console.error('Failed to save solution batch:', error);
                // Save failed solutions as errors in database
                if (!this.savingDatabaseErrors) {
                    try {
                        this.savingDatabaseErrors = true;
                        const errorData = solutions.map(item => ({
                            jobId: this.currentJobId,
                            startId: item.flatRecord.startId,
                            error: {
                                message: `Database save failed: ${error.message}`,
                                stack: error.stack
                            },
                            workerPayload: item.flatRecord
                        }));
                        await this.result.saveErrorBatch(errorData);
                    } catch (recursiveError) {
                        console.error('Critical: Failed to save database errors:', recursiveError);
                    } finally {
                        this.savingDatabaseErrors = false;
                    }
                }
                this.failedCount += solutions.length;
            }
        }

        // Process errors in batch
        if (errors.length > 0) {
            try {
                const errorData = errors.map(item => ({
                    jobId: this.currentJobId,
                    startId: item.startId,
                    error: item.error,
                    workerPayload: item.workerPayload
                }));

                await this.result.saveErrorBatch(errorData);
                this.failedCount += errors.length;

            } catch (error) {
                console.error('Failed to save error batch:', error);
                // Circuit breaker: Don't try to save database errors recursively
                if (!this.savingDatabaseErrors) {
                    console.error('Critical: Cannot save error batch due to database issues. Error details:', {
                        message: error.message,
                        affectedErrors: errors.length,
                        jobId: this.currentJobId
                    });
                } else {
                    console.error('Critical: Recursive database error detected');
                }
                this.failedCount += errors.length;
            }
        }

        // Update job progress
        await this.result.updateBulkJobProgress(
            this.currentJobId,
            this.completedCount,
            this.failedCount
        );

        // Send progress update
        this.sendMessage('PROGRESS_UPDATE', {
            jobId: this.currentJobId,
            completed: this.completedCount,
            failed: this.failedCount,
            total: this.totalExpected,
            percentage: Math.round(((this.completedCount + this.failedCount) / this.totalExpected) * 100)
        });
    }

    /**
     * Check if job is complete and handle completion
     */
    async checkJobCompletion() {
        const totalProcessed = this.completedCount + this.failedCount;

        if (totalProcessed >= this.totalExpected) {
            await this.completeJob();
        }
    }

    /**
     * Complete the current job
     */
    async completeJob() {
        if (!this.currentJobId) {
            console.warn('Attempted to complete job but no job is active');
            return;
        }

        try {
            // Determine job status
            const status = this.failedCount > 0 ? 'failed' : 'completed';

            // Mark job as complete in database
            await this.result.completeBulkJob(this.currentJobId, status);

            const jobDuration = Date.now() - this.jobStartTime;

            // Send completion message
            this.sendMessage('JOB_COMPLETED', {
                jobId: this.currentJobId,
                completed: this.completedCount,
                failed: this.failedCount,
                duration: jobDuration
            });

            // Reset state for next job
            this.currentJobId = null;
            this.currentJobConfig = null;
            this.completedCount = 0;
            this.failedCount = 0;
            this.totalExpected = 0;
            this.jobStartTime = null;

        } catch (error) {
            console.error('Error completing job:', error);
            this.sendMessage('COMPLETION_ERROR', {
                message: error.message,
                stack: error.stack,
                jobId: this.currentJobId
            });
        }
    }

    /**
     * Send message to main thread
     */
    sendMessage(type, payload = {}) {
        // Node.js worker_threads only
        const { parentPort } = require('worker_threads');
        if (parentPort) {
            parentPort.postMessage({ type, payload });
        } else {
            console.log(`Queue Worker Message: ${type}`, payload);
        }
    }
}

// Worker initialization for Node.js worker_threads only
let queueWorker = null;

async function initializeWorker() {
    try {
        queueWorker = new QueueWorker();
        await queueWorker.init();
    } catch (error) {
        console.error('Failed to initialize queue worker:', error);
        process.exit(1);
    }
}

// Node.js worker_threads message handling
const { parentPort } = require('worker_threads');

if (parentPort) {
    parentPort.on('message', async (data) => {
        if (!queueWorker) {
            await initializeWorker();
        }

        if (queueWorker) {
            await queueWorker.handleMessage(data);
        }
    });

    parentPort.on('error', (error) => {
        console.error('Queue worker runtime error:', error);
        process.exit(1);
    });

    // Initialize worker immediately
    initializeWorker();
}

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = QueueWorker;
} 