const Result = require('../js/models/Result.js');
const { loadShapesFromFixture } = require('./fixtures/loader.js');

describe('Result.js Database Operations', () => {
    let result;
    let testShapes;
    let testConfig;

    beforeAll(async () => {
        // Load test shapes from fixtures
        testShapes = loadShapesFromFixture().slice(0, 3); // Use first 3 shapes for testing
        testConfig = { aspectRatioPref: 0 };
    });

    beforeEach(async () => {
        // Create new in-memory database for each test
        result = new Result(':memory:');
        await result.init();
    });

    afterEach(async () => {
        // Clean up database connection
        if (result) {
            await result.close();
        }
    });

    describe('Database Initialization', () => {
        test('should initialize database and create tables', async () => {
            // Database should be initialized in beforeEach
            expect(result.db).toBeTruthy();

            // Test that tables exist by trying to query them
            const tables = await new Promise((resolve, reject) => {
                result.db.all("SELECT name FROM sqlite_master WHERE type='table'", [], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows.map(row => row.name));
                });
            });

            expect(tables).toContain('bulk_jobs');
            expect(tables).toContain('solutions');
            expect(tables).toContain('solution_errors');
        });

        test('should create indexes for performance', async () => {
            const indexes = await new Promise((resolve, reject) => {
                result.db.all("SELECT name FROM sqlite_master WHERE type='index'", [], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows.map(row => row.name));
                });
            });

            // Check for our custom indexes (SQLite auto-creates some)
            const customIndexes = indexes.filter(name => name.startsWith('idx_'));
            expect(customIndexes.length).toBeGreaterThan(0);
        });
    });

    describe('Bulk Job Operations', () => {
        test('should create bulk job and return UUID', async () => {
            const jobId = await result.createBulkJob(testConfig, testShapes, 10);

            expect(jobId).toBeTruthy();
            expect(typeof jobId).toBe('string');
            expect(jobId.length).toBe(36); // UUID v4 length
        });

        test('should update bulk job progress', async () => {
            const jobId = await result.createBulkJob(testConfig, testShapes, 10);

            const changedRows = await result.updateBulkJobProgress(jobId, 5, 2);
            expect(changedRows).toBe(1);

            // Verify the update worked by checking return value
            const secondUpdate = await result.updateBulkJobProgress(jobId, 8, 3);
            expect(secondUpdate).toBe(1); // Should successfully update existing record
        });

        test('should complete bulk job with status', async () => {
            const jobId = await result.createBulkJob(testConfig, testShapes, 10);

            const changedRows = await result.completeBulkJob(jobId, 'completed');
            expect(changedRows).toBe(1);

            // Verify completion worked by checking return value indicates successful update
            expect(changedRows).toBeGreaterThan(0);
        });


    });

    describe('Solution Batch Operations', () => {
        let jobId;
        let mockSolutionResult;

        beforeEach(async () => {
            jobId = await result.createBulkJob(testConfig, testShapes, 5);

            // Create mock solution result that matches solution-worker output format
            mockSolutionResult = {
                finalSolution: {
                    shapes: testShapes.map((shape, index) => ({
                        posX: index * 10,
                        posY: index * 5,
                        data: shape.data
                    })),
                    score: 150.5,
                    valid: true,
                    buffer: 10,
                    yPadding: 15,
                    xPadding: 15
                },
                cellular: {
                    cellLines: [[0, 0, 10, 10], [5, 5, 15, 15]],
                    maxTerrain: 25,
                    numAlive: 42
                },
                metadata: {
                    timestamp: Date.now(),
                    mode: 'bulk',
                    aspectRatioPref: 0
                }
            };
        });

        test('should save solution batch in transaction', async () => {
            const batch = [
                { jobId, startId: 0, result: mockSolutionResult },
                { jobId, startId: 1, result: { ...mockSolutionResult, finalSolution: { ...mockSolutionResult.finalSolution, score: 200.0 } } },
                { jobId, startId: 2, result: { ...mockSolutionResult, finalSolution: { ...mockSolutionResult.finalSolution, score: 100.0 } } }
            ];

            const savedIds = await result.saveSolutionBatch(batch, testShapes);

            expect(savedIds).toHaveLength(3);
            expect(savedIds.every(id => typeof id === 'string')).toBe(true);
        });

        test('should save solution batch with provided inputShapes', async () => {
            const batch = [
                { jobId, startId: 0, result: mockSolutionResult }
            ];

            // Test the optimization by providing inputShapes directly
            const savedIds = await result.saveSolutionBatch(batch, testShapes);

            expect(savedIds).toHaveLength(1);
            expect(typeof savedIds[0]).toBe('string');
        });
    });

    describe('Error Batch Operations', () => {
        let jobId;
        let mockError;
        let mockWorkerPayload;

        beforeEach(async () => {
            jobId = await result.createBulkJob(testConfig, testShapes, 5);

            mockError = {
                message: 'Annealing failed to converge',
                stack: 'Error: Annealing failed\n    at Anneal.run (anneal.js:45:12)'
            };

            mockWorkerPayload = {
                shapes: testShapes,
                startId: 3,
                aspectRatioPref: 0
            };
        });

        test('should save error batch in transaction', async () => {
            const batch = [
                { jobId, startId: 1, error: mockError, workerPayload: mockWorkerPayload },
                { jobId, startId: 3, error: { ...mockError, message: 'Different error' }, workerPayload: mockWorkerPayload },
                { jobId, startId: 4, error: mockError, workerPayload: mockWorkerPayload }
            ];

            const savedIds = await result.saveErrorBatch(batch);

            expect(savedIds).toHaveLength(3);
            expect(savedIds.every(id => typeof id === 'string')).toBe(true);
        });
    });





    describe('Error Handling', () => {


        test('should handle malformed data in batch operations', async () => {
            const jobId = await result.createBulkJob(testConfig, testShapes, 5);

            // This should fail due to missing required fields
            const invalidBatch = [
                { jobId, startId: 0 } // Missing 'result' field
            ];

            await expect(result.saveSolutionBatch(invalidBatch)).rejects.toThrow();
        });
    });
}); 