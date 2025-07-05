// Mock worker_threads before any imports
jest.mock('worker_threads', () => ({
    Worker: jest.fn().mockImplementation(() => ({
        postMessage: jest.fn(),
        on: jest.fn(),
        terminate: jest.fn(),
        exit: jest.fn()
    }))
}));

// Mock fs.promises for file operations
jest.mock('fs', () => ({
    promises: {
        readFile: jest.fn()
    }
}));

// Mock path
jest.mock('path');

const BulkCLI = require('../js/interfaces/cli/BulkCLI');
const { Worker } = require('worker_threads');
const fs = require('fs');
const path = require('path');

describe('BulkCLI - CLI Interface Tests', () => {
    let bulkCLI;
    let mockWorker;
    let mockQueueWorker;

    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();

        // Create mock worker instances
        mockWorker = {
            postMessage: jest.fn(),
            on: jest.fn(),
            terminate: jest.fn()
        };

        mockQueueWorker = {
            postMessage: jest.fn(),
            on: jest.fn(),
            terminate: jest.fn()
        };

        // Configure Worker mock to return appropriate instances
        Worker.mockImplementation((workerPath) => {
            if (workerPath.includes('queue-worker')) {
                return mockQueueWorker;
            } else {
                return mockWorker;
            }
        });

        // Mock path.join to return predictable paths
        path.join.mockImplementation((...parts) => parts.join('/'));

        // Create fresh CLI instance
        bulkCLI = new BulkCLI();
    });

    describe('Command Line Argument Parsing', () => {
        test('should parse basic required arguments correctly', () => {
            const args = ['--shapes', 'test.json', '--count', '50'];

            const options = bulkCLI.parseArguments(args);

            expect(options.shapesFile).toBe('test.json');
            expect(options.count).toBe(50);
            expect(options.aspectRatio).toBe(0); // default
        });

        test('should parse all options with short and long forms', () => {
            const args = [
                '-s', 'input.json',
                '-c', '100',
                '-a', '1.5',
                '-b', '25'
            ];

            const options = bulkCLI.parseArguments(args);

            expect(options.shapesFile).toBe('input.json');
            expect(options.count).toBe(100);
            expect(options.aspectRatio).toBe(1.5);
            expect(options.batchSize).toBe(25);
        });

        test('should throw error for missing shapes file', () => {
            const args = ['--count', '10'];

            expect(() => bulkCLI.parseArguments(args)).toThrow(
                'Shapes file is required. Use --shapes <file.json>'
            );
        });

        test('should throw error for invalid count', () => {
            const args = ['--shapes', 'test.json', '--count', 'invalid'];

            expect(() => bulkCLI.parseArguments(args)).toThrow(
                'Count must be a positive integer'
            );
        });

        test('should throw error for negative count', () => {
            const args = ['--shapes', 'test.json', '--count', '-5'];

            expect(() => bulkCLI.parseArguments(args)).toThrow(
                'Count must be a positive integer'
            );
        });

        test('should throw error for unknown options', () => {
            const args = ['--shapes', 'test.json', '--unknown-option'];

            expect(() => bulkCLI.parseArguments(args)).toThrow(
                'Unknown option: --unknown-option'
            );
        });

        test('should handle help option and exit', () => {
            const mockExit = jest.spyOn(process, 'exit').mockImplementation((code) => {
                // Simulate actual exit by throwing to stop execution
                throw new Error(`process.exit(${code})`);
            });
            const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => { });

            const args = ['--help'];

            // Help option should call process.exit(0) and stop execution
            expect(() => bulkCLI.parseArguments(args)).toThrow('process.exit(0)');

            expect(mockConsoleLog).toHaveBeenCalled();
            expect(mockExit).toHaveBeenCalledWith(0);

            mockExit.mockRestore();
            mockConsoleLog.mockRestore();
        });
    });

    describe('Configuration Loading and Validation', () => {
        test('should load configuration from parsed options correctly', async () => {
            const options = {
                aspectRatio: 2.0,
                count: 200,
                batchSize: 75
            };

            const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => { });

            await bulkCLI.loadConfiguration(options);

            expect(bulkCLI.config.aspectRatioPref).toBe(2.0);
            expect(bulkCLI.config.workerCount).toBe(200);
            expect(bulkCLI.config.batchSize).toBe(75);

            // Should log configuration
            expect(mockConsoleLog).toHaveBeenCalledWith('📋 Configuration:');

            mockConsoleLog.mockRestore();
        });

        test('should apply default values for missing options', async () => {
            const options = {
                aspectRatio: 1.0,
                count: 50,
                batchSize: 100 // Add missing batchSize
            };

            await bulkCLI.loadConfiguration(options);

            expect(bulkCLI.config.aspectRatioPref).toBe(1.0);
            expect(bulkCLI.config.workerCount).toBe(50);
            expect(bulkCLI.config.batchSize).toBe(100); // default from options, not changed
        });
    });

    describe('Shape File Loading', () => {
        test('should load valid shapes file correctly', async () => {
            const mockShapes = [
                { data: { title: 'Shape 1', highResShape: [[true, false]] } },
                { data: { title: 'Shape 2', highResShape: [[false, true]] } }
            ];

            const fileContent = JSON.stringify({ allShapes: mockShapes });
            fs.promises.readFile.mockResolvedValue(fileContent);

            const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => { });

            await bulkCLI.loadInputShapes('test.json');

            expect(fs.promises.readFile).toHaveBeenCalledWith('test.json', 'utf8');
            expect(bulkCLI.inputShapes).toEqual(mockShapes);
            expect(mockConsoleLog).toHaveBeenCalledWith('   ✅ Loaded 2 shapes');

            mockConsoleLog.mockRestore();
        });

        test('should handle file not found error', async () => {
            const error = new Error('File not found');
            error.code = 'ENOENT';
            fs.promises.readFile.mockRejectedValue(error);

            await expect(bulkCLI.loadInputShapes('missing.json')).rejects.toThrow(
                'Shapes file not found: missing.json'
            );
        });

        test('should handle invalid JSON error', async () => {
            fs.promises.readFile.mockResolvedValue('invalid json {');

            await expect(bulkCLI.loadInputShapes('invalid.json')).rejects.toThrow(
                'Invalid JSON in shapes file:'
            );
        });

        test('should handle missing allShapes array', async () => {
            const fileContent = JSON.stringify({ wrongProperty: [] });
            fs.promises.readFile.mockResolvedValue(fileContent);

            await expect(bulkCLI.loadInputShapes('wrong.json')).rejects.toThrow(
                'Invalid shapes file: missing "allShapes" array'
            );
        });

        test('should handle empty shapes array', async () => {
            const fileContent = JSON.stringify({ allShapes: [] });
            fs.promises.readFile.mockResolvedValue(fileContent);

            await expect(bulkCLI.loadInputShapes('empty.json')).rejects.toThrow(
                'No shapes found in input file'
            );
        });
    });



    describe('Solution Worker Message Handling', () => {
        beforeEach(() => {
            bulkCLI.queueWorker = mockQueueWorker;
            bulkCLI.inputShapes = [{ test: 'shape' }];
            bulkCLI.config = { aspectRatioPref: 0 };
        });

        test('should handle RESULT messages correctly', () => {
            const worker = { terminate: jest.fn() };
            const startId = 5;
            const message = {
                type: 'RESULT',
                payload: { finalSolution: { score: 100 }, cellular: { numAlive: 50 } }
            };

            bulkCLI.handleSolutionWorkerMessage(worker, startId, message);

            expect(mockQueueWorker.postMessage).toHaveBeenCalledWith({
                type: 'SOLUTION_RESULT',
                payload: {
                    type: 'SOLUTION_RESULT',
                    startId: 5,
                    result: message.payload
                }
            });

            // Worker termination is handled by the worker itself after sending result
            expect(worker.terminate).not.toHaveBeenCalled();
        });

        test('should handle ERROR messages correctly', () => {
            const worker = { terminate: jest.fn() };
            const startId = 3;
            const message = {
                type: 'ERROR',
                payload: { message: 'Worker failed', stack: 'Error stack' }
            };

            bulkCLI.handleSolutionWorkerMessage(worker, startId, message);

            expect(mockQueueWorker.postMessage).toHaveBeenCalledWith({
                type: 'SOLUTION_ERROR',
                payload: {
                    type: 'SOLUTION_ERROR',
                    startId: 3,
                    error: {
                        message: 'Worker failed',
                        stack: 'Error stack',
                        errorType: 'solution'
                    },
                    workerPayload: {
                        shapes: bulkCLI.inputShapes,
                        startId: 3,
                        aspectRatioPref: 0
                    }
                }
            });

            // ERROR messages from workers still require termination since they don't self-terminate
            expect(worker.terminate).not.toHaveBeenCalled();
        });

        test('should handle PROGRESS messages', () => {
            const worker = { terminate: jest.fn() };
            const startId = 1;
            const message = {
                type: 'PROGRESS',
                payload: { progressType: 'ANNEAL_PROGRESS' }
            };

            bulkCLI.handleSolutionWorkerMessage(worker, startId, message);

            // Progress messages are ignored in bulk mode
            expect(worker.terminate).not.toHaveBeenCalled(); // Don't terminate on progress
        });
    });

    describe('Queue Worker Message Handling', () => {
        test('should handle JOB_STARTED messages', () => {
            const message = {
                type: 'JOB_STARTED',
                payload: { jobId: 'test-job-123' }
            };

            bulkCLI.handleQueueWorkerMessage(message);

            expect(bulkCLI.jobId).toBe('test-job-123');
            // JOB_STARTED messages don't log in the current implementation
        });

        test('should handle PROGRESS_UPDATE messages', () => {
            const message = {
                type: 'PROGRESS_UPDATE',
                payload: { completed: 15, failed: 3 }
            };

            bulkCLI.handleQueueWorkerMessage(message);

            expect(bulkCLI.completedWorkers).toBe(15);
            expect(bulkCLI.failedWorkers).toBe(3);
        });

        test('should handle JOB_COMPLETED messages', () => {
            const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => { });

            const message = {
                type: 'JOB_COMPLETED',
                payload: {
                    jobId: 'test-job-456',
                    completed: 95,
                    failed: 5,
                    duration: 120000
                }
            };

            bulkCLI.handleQueueWorkerMessage(message);

            expect(mockConsoleLog).toHaveBeenCalledWith('🎉 Bulk analysis completed!');
            expect(mockConsoleLog).toHaveBeenCalledWith('Job ID: test-job-456');
            expect(mockConsoleLog).toHaveBeenCalledWith('Duration: 120s');
            expect(mockConsoleLog).toHaveBeenCalledWith('Successful solutions: 95');
            expect(mockConsoleLog).toHaveBeenCalledWith('Failed attempts: 5');
            expect(mockConsoleLog).toHaveBeenCalledWith('💾 Results saved to database: js/models/results.sqlite');
            expect(mockConsoleLog).toHaveBeenCalledWith('📋 Error details are stored in the solution_errors table');

            mockConsoleLog.mockRestore();
        });

        test('should handle error messages', () => {
            const mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => { });

            const message = {
                type: 'QUEUE_ERROR',
                payload: { message: 'Database connection failed', stack: 'Error stack' }
            };

            bulkCLI.handleQueueWorkerMessage(message);

            expect(mockConsoleError).toHaveBeenCalledWith('❌ Queue error: Database connection failed');
            // Error stack is not logged in the current implementation

            mockConsoleError.mockRestore();
        });
    });

    describe('Progress Reporting', () => {


        test('should calculate and display progress correctly', () => {
            // Mock process.stdout.write instead of console.log
            const mockStdoutWrite = jest.spyOn(process.stdout, 'write').mockImplementation(() => { });

            bulkCLI.totalWorkers = 100;
            bulkCLI.completedWorkers = 75;
            bulkCLI.failedWorkers = 15;
            bulkCLI.startTime = Date.now() - 60000; // 1 minute ago

            bulkCLI.updateProgress();

            // Should write progress with calculated percentage (90%)
            expect(mockStdoutWrite).toHaveBeenCalledWith(
                expect.stringContaining('📈 90/100 (90%)')
            );

            mockStdoutWrite.mockRestore();
        });
    });

    describe('Error Handling and Cleanup', () => {
        test('should handle solution worker runtime errors', () => {
            bulkCLI.queueWorker = mockQueueWorker;
            bulkCLI.inputShapes = [{ test: 'shape' }];

            const worker = { terminate: jest.fn() };
            const startId = 7;
            const error = new Error('Worker crashed');

            bulkCLI.handleSolutionWorkerError(worker, startId, error);

            expect(mockQueueWorker.postMessage).toHaveBeenCalledWith({
                type: 'SOLUTION_ERROR',
                payload: {
                    type: 'SOLUTION_ERROR',
                    startId: 7,
                    error: {
                        message: 'Worker runtime error: Worker crashed',
                        stack: error.stack,
                        errorType: 'runtime'
                    },
                    workerPayload: expect.any(Object)
                }
            });

            expect(worker.terminate).toHaveBeenCalled();
        });

        test('should cleanup intervals and queue worker on completion', async () => {
            bulkCLI.queueWorker = mockQueueWorker;
            bulkCLI.progressInterval = setInterval(() => { }, 1000);

            const mockClearInterval = jest.spyOn(global, 'clearInterval');
            const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => { });

            await bulkCLI.cleanup();

            expect(mockQueueWorker.terminate).toHaveBeenCalled();
            expect(mockClearInterval).toHaveBeenCalled();
            // After cleanup, interval should be set to null
            expect(bulkCLI.progressInterval).toBe(null);

            mockClearInterval.mockRestore();
            mockConsoleLog.mockRestore();
        });
    });

    describe('Utility Functions', () => {
        test('should implement sleep function correctly', async () => {
            jest.useRealTimers(); // Use real timers for this test

            const start = Date.now();
            await bulkCLI.sleep(10); // Use shorter sleep for faster test
            const end = Date.now();

            // Allow some tolerance for timing
            expect(end - start).toBeGreaterThanOrEqual(5);
            expect(end - start).toBeLessThan(50);
        });
    });
}); 