// Mock Result.js database operations BEFORE any imports
jest.mock('../js/models/Result', () => {
    return jest.fn().mockImplementation(() => ({
        init: jest.fn().mockResolvedValue(true),
        createBulkJob: jest.fn().mockResolvedValue('mock-job-id'),
        saveSolutionBatch: jest.fn().mockResolvedValue(true),
        saveErrorBatch: jest.fn().mockResolvedValue(true),
        updateBulkJobProgress: jest.fn().mockResolvedValue(true),
        completeBulkJob: jest.fn().mockResolvedValue(true),
        close: jest.fn().mockResolvedValue(true)
    }));
});

// Mock fs.promises for file operations
jest.mock('fs', () => ({
    promises: {
        mkdir: jest.fn().mockResolvedValue(true)
    }
}));

const { loadShapesFromFixture } = require('./fixtures/loader');

// Mock the Node.js worker_threads environment for testing
const mockParentPort = {
    postMessage: jest.fn(),
    on: jest.fn()
};

jest.mock('worker_threads', () => ({
    parentPort: mockParentPort
}));

// Import the queue worker after setting up mocks
const QueueWorker = require('../js/workers/queue-worker');
const fs = require('fs');

describe('Queue Worker - Drain-and-Process Pattern Tests', () => {
    let queueWorker;
    let mockResult;

    beforeEach(async () => {
        // Reset all mocks
        mockParentPort.postMessage.mockClear();
        fs.promises.mkdir.mockClear();

        // Create fresh queue worker instance
        queueWorker = new QueueWorker();

        // Initialize the worker (this will create the Result instance)
        await queueWorker.init();

        // Get reference to the mocked Result instance
        mockResult = queueWorker.result;
    });

    describe('Initialization', () => {
        test('should initialize with database connection', async () => {
            const worker = new QueueWorker();

            await worker.init();

            expect(worker.result).toBeDefined();
            expect(worker.result.init).toHaveBeenCalled();
        });

        test('should handle initialization errors gracefully', async () => {
            // Create a separate worker instance for this test
            const isolatedWorker = new QueueWorker();
            const initError = new Error('Database connection failed');

            // Suppress console.error for this expected error
            const mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => { });

            // Create a spy on the Result constructor that will fail for this specific test
            const Result = require('../js/models/Result');
            const mockFailingResult = {
                init: jest.fn().mockRejectedValue(initError),
                createBulkJob: jest.fn(),
                saveSolutionBatch: jest.fn(),
                saveErrorBatch: jest.fn(),
                updateBulkJobProgress: jest.fn(),
                completeBulkJob: jest.fn(),
                close: jest.fn()
            };

            // Use spyOn to temporarily override the constructor for this test
            const constructorSpy = jest.spyOn(Result, 'mockImplementation');
            Result.mockImplementationOnce(() => mockFailingResult);

            // Attempt initialization - should throw the error
            await expect(isolatedWorker.init()).rejects.toThrow('Database connection failed');

            // Verify the worker has the Result instance but init was called and failed
            expect(isolatedWorker.result).toBe(mockFailingResult);
            expect(mockFailingResult.init).toHaveBeenCalled();

            // Clean up spies
            mockConsoleError.mockRestore();
            constructorSpy.mockRestore();
        });


    });

    describe('Job Management', () => {
        test('should start a new bulk job correctly', async () => {
            const jobConfig = {
                shapesFile: 'test.json',
                count: 100,
                aspectRatio: 1.5
            };
            const inputShapes = [{ id: 1, name: 'test' }];
            const totalSolutions = 100;

            await queueWorker.handleMessage({
                type: 'START_JOB',
                payload: {
                    config: jobConfig,
                    inputShapes: inputShapes,
                    totalSolutions: totalSolutions
                }
            });

            expect(mockResult.createBulkJob).toHaveBeenCalledWith(
                jobConfig, inputShapes, totalSolutions
            );
            expect(queueWorker.currentJobId).toBe('mock-job-id');
            expect(queueWorker.totalExpected).toBe(100);
            expect(mockParentPort.postMessage).toHaveBeenCalledWith({
                type: 'JOB_STARTED',
                payload: {
                    jobId: 'mock-job-id',
                    totalSolutions: 100
                }
            });
        });
    });

    describe('Message Handling and Inbox Management', () => {
        test('should add solution results to inbox', async () => {
            // Mock processBatch to prevent automatic processing
            const originalProcessBatch = queueWorker.processBatch;
            queueWorker.processBatch = jest.fn();

            const testPayload = {
                type: 'SOLUTION_RESULT',
                startId: 1,
                result: {
                    finalSolution: { score: 100, valid: true },
                    cellular: { numAlive: 50 }
                }
            };

            await queueWorker.handleMessage({
                type: 'SOLUTION_RESULT',
                payload: testPayload
            });

            expect(queueWorker.inbox.length).toBe(1);
            expect(queueWorker.inbox[0]).toEqual({
                type: 'SOLUTION_RESULT',
                flatRecord: testPayload
            });
            expect(queueWorker.processBatch).toHaveBeenCalled();

            // Restore original method
            queueWorker.processBatch = originalProcessBatch;
        });

        test('should add error results to inbox', async () => {
            // Mock processBatch to prevent automatic processing
            const originalProcessBatch = queueWorker.processBatch;
            queueWorker.processBatch = jest.fn();

            const errorMessage = {
                type: 'SOLUTION_ERROR',
                startId: 2,
                error: {
                    message: 'Worker failed',
                    stack: 'Error stack trace'
                }
            };

            await queueWorker.handleMessage({
                type: 'SOLUTION_ERROR',
                payload: errorMessage
            });

            expect(queueWorker.inbox.length).toBe(1);
            expect(queueWorker.inbox[0].type).toBe('SOLUTION_ERROR');
            expect(queueWorker.processBatch).toHaveBeenCalled();

            // Restore original method
            queueWorker.processBatch = originalProcessBatch;
        });
    });



    describe('Batch Processing Logic', () => {
        beforeEach(() => {
            queueWorker.currentJobId = 'batch-test-job';
        });

        test('should separate solutions from errors in batch processing', async () => {
            // Set up inputShapes for the optimization
            queueWorker.currentInputShapes = [{ id: 1, name: 'test-shape' }];

            const mixedBatch = [
                {
                    type: 'SOLUTION_RESULT',
                    flatRecord: { jobId: 'batch-test-job', startId: 1, result: { finalSolution: { score: 100, valid: true } } }
                },
                {
                    type: 'SOLUTION_ERROR',
                    startId: 2,
                    error: { message: 'Worker failed' }
                },
                {
                    type: 'SOLUTION_RESULT',
                    flatRecord: { jobId: 'batch-test-job', startId: 3, result: { finalSolution: { score: 200, valid: false } } }
                }
            ];

            queueWorker.inbox = [...mixedBatch];
            await queueWorker.processBatch();

            // Should call saveSolutionBatch with 2 solutions
            expect(mockResult.saveSolutionBatch).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({
                        jobId: 'batch-test-job',
                        startId: 1
                    }),
                    expect.objectContaining({
                        jobId: 'batch-test-job',
                        startId: 3
                    })
                ])
            );

            // Should call saveErrorBatch with 1 error
            expect(mockResult.saveErrorBatch).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({ startId: 2 })
                ])
            );
        });

        test('should handle batch with only solutions', async () => {
            // Set up inputShapes for the optimization
            queueWorker.currentInputShapes = [{ id: 1, name: 'test-shape' }];

            const solutionBatch = [
                { type: 'SOLUTION_RESULT', startId: 1, result: { finalSolution: { score: 100 } } },
                { type: 'SOLUTION_RESULT', startId: 2, result: { finalSolution: { score: 200 } } }
            ];

            queueWorker.inbox = [...solutionBatch];
            await queueWorker.processBatch();

            expect(mockResult.saveSolutionBatch).toHaveBeenCalledTimes(1);
            expect(mockResult.saveErrorBatch).not.toHaveBeenCalled();
        });

        test('should handle batch with only errors', async () => {
            const errorBatch = [
                { type: 'SOLUTION_ERROR', startId: 1, error: { message: 'Error 1' } },
                { type: 'SOLUTION_ERROR', startId: 2, error: { message: 'Error 2' } }
            ];

            queueWorker.inbox = [...errorBatch];
            await queueWorker.processBatch();

            expect(mockResult.saveErrorBatch).toHaveBeenCalledTimes(1);
            expect(mockResult.saveSolutionBatch).not.toHaveBeenCalled();
        });
    });

    describe('Progress Tracking and Job Completion', () => {
        beforeEach(() => {
            queueWorker.currentJobId = 'progress-job';
        });

        test('should track progress updates correctly', async () => {
            // Set up inputShapes for the optimization
            queueWorker.currentInputShapes = [{ id: 1, name: 'test-shape' }];

            queueWorker.totalExpected = 10;
            queueWorker.completedCount = 5;
            queueWorker.failedCount = 2;

            const progressBatch = [
                { type: 'SOLUTION_RESULT', startId: 6, result: { finalSolution: { score: 100 } } },
                { type: 'SOLUTION_ERROR', startId: 7, error: { message: 'Worker failed' } }
            ];

            queueWorker.inbox = [...progressBatch];
            await queueWorker.processBatch();

            // Should update progress: 5 + 1 = 6 completed, 2 + 1 = 3 failed
            expect(mockResult.updateBulkJobProgress).toHaveBeenCalledWith(
                'progress-job', 6, 3
            );

            expect(mockParentPort.postMessage).toHaveBeenCalledWith({
                type: 'PROGRESS_UPDATE',
                payload: expect.objectContaining({
                    jobId: 'progress-job',
                    completed: 6,
                    failed: 3,
                    total: 10,
                    percentage: 90
                })
            });
        });

        test('should detect job completion and finalize', async () => {
            // Set up inputShapes for the optimization
            queueWorker.currentInputShapes = [{ id: 1, name: 'test-shape' }];

            queueWorker.totalExpected = 3;
            queueWorker.completedCount = 2;
            queueWorker.failedCount = 0;

            const completionBatch = [
                { type: 'SOLUTION_RESULT', startId: 3, result: { finalSolution: { score: 100 } } }
            ];

            queueWorker.inbox = [...completionBatch];
            await queueWorker.processBatch();

            // Should detect completion (3 expected, 3 total completed+failed)
            expect(mockResult.completeBulkJob).toHaveBeenCalledWith('progress-job', 'completed');
            expect(mockParentPort.postMessage).toHaveBeenCalledWith({
                type: 'JOB_COMPLETED',
                payload: expect.objectContaining({
                    jobId: 'progress-job',
                    completed: 3,
                    failed: 0
                })
            });
        });
    });

    describe('Error Handling', () => {
        beforeEach(() => {
            queueWorker.currentJobId = 'error-handling-job';
            queueWorker.currentJobConfig = { test: 'config' };
        });

        test('should handle job completion with errors', async () => {
            queueWorker.totalExpected = 2;
            queueWorker.completedCount = 1;
            queueWorker.failedCount = 0;

            const errorBatch = [
                { type: 'SOLUTION_ERROR', startId: 2, error: { message: 'Final error' } }
            ];

            queueWorker.inbox = [...errorBatch];
            await queueWorker.processBatch();

            // Should save error to database
            expect(mockResult.saveErrorBatch).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({ startId: 2 })
                ])
            );

            // Should complete job with error status (since there's 1 failed worker)
            expect(mockResult.completeBulkJob).toHaveBeenCalledWith('error-handling-job', 'failed');
        });


    });

    describe('Database Integration', () => {
        test('should handle database errors gracefully', async () => {
            queueWorker.currentJobId = 'db-error-job';
            // Set up inputShapes for the optimization
            queueWorker.currentInputShapes = [{ id: 1, name: 'test-shape' }];
            // Set totalExpected to prevent job completion from resetting counts
            queueWorker.totalExpected = 10; // Higher than the 1 failed item

            // Suppress console.error for this expected error
            const mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => { });

            // Override the mock for this specific test
            const errorMessage = 'Database connection failed';
            mockResult.saveSolutionBatch.mockRejectedValueOnce(new Error(errorMessage));
            // Ensure updateBulkJobProgress still works so error handling completes
            mockResult.updateBulkJobProgress.mockResolvedValueOnce(true);

            queueWorker.inbox = [
                { type: 'SOLUTION_RESULT', startId: 1, result: { finalSolution: { score: 100 } } }
            ];

            // Should not throw error
            await expect(queueWorker.processBatch()).resolves.not.toThrow();

            // Should handle the error gracefully and continue processing
            expect(queueWorker.failedCount).toBe(1);

            // In this specific mock setup, the recursive save is prevented,
            // so we assert it's NOT called, but the failure is counted.
            expect(mockResult.saveErrorBatch).not.toHaveBeenCalled();

            mockConsoleError.mockRestore();
        });

        test('should close database connection properly', async () => {
            await queueWorker.close();

            expect(mockResult.close).toHaveBeenCalled();
            expect(queueWorker.result).toBe(null);
        });
    });
}); 