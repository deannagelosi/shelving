// Mock process.exit to prevent test termination
const mockExit = jest.fn();
jest.spyOn(process, 'exit').mockImplementation(mockExit);

// Mock the slow annealing process to make tests fast and predictable
jest.mock('../js/core/Anneal', () => {
    const MockAnneal = jest.fn().mockImplementation((shapes, aspectRatioPref) => {
        const solution = new (jest.requireActual('../js/core/Solution'))(shapes);
        solution.randomLayout();
        solution.calcScore();
        solution.valid = true;
        solution.score = 150.5; // Predictable score

        return {
            shapes: shapes,
            currentSolution: solution,
            finalSolution: solution,
            maxIteration: 100,
            iteration: 50,
            run: jest.fn().mockImplementation(async function (progressCallback) {
                // Simulate annealing progress if callback provided
                if (progressCallback && typeof progressCallback === 'function') {
                    progressCallback(this.finalSolution);
                }
                // Quick completion
                return this.finalSolution;
            })
        };
    });
    return MockAnneal;
});

// Mock Cellular to make it fast and predictable  
jest.mock('../js/core/Cellular', () => {
    const MockCellular = jest.fn().mockImplementation((solution) => {
        return {
            solution: solution,
            cellSpace: [[[], []], [[], []]], // Predictable cell space structure
            maxTerrain: 25,
            numAlive: 42,
            growCells: jest.fn().mockImplementation(function () {
                // Quick cellular growth completion
                return {
                    cellSpace: this.cellSpace,
                    maxTerrain: this.maxTerrain,
                    numAlive: this.numAlive
                };
            })
        };
    });
    return MockCellular;
});

const { loadShapesFromFixture } = require('./fixtures/loader');

// Mock the web worker environment for testing
global.self = {
    postMessage: jest.fn(),
    importScripts: jest.fn(),
    onmessage: null,
    onerror: null
};

// Mock global variables that the core classes expect
global.canvasWidth = 800;
global.canvasHeight = 600;
global.aspectRatioPref = 0;
global.detailView = false;

// Mock importScripts to work in Node.js environment
global.importScripts = jest.fn();

// Import core classes directly for Node.js testing
const EventEmitter = require('../js/core/EventEmitter');
const Shape = require('../js/core/Shape');
const Solution = require('../js/core/Solution');
const Cellular = require('../js/core/Cellular');
const Anneal = require('../js/core/Anneal');
const Board = require('../js/core/Board');
const Export = require('../js/core/Export');

// Make core classes available globally (as importScripts would do in browser)
global.EventEmitter = EventEmitter;
global.Shape = Shape;
global.Solution = Solution;
global.Cellular = Cellular;
global.Anneal = Anneal;
global.Board = Board;
global.Export = Export;

// Import the worker after setting up the environment
const SolutionWorker = require('../js/workers/solution-worker');

describe('Solution Worker - Web Worker Pipeline Tests', () => {
    let worker;
    let testShapes;
    let mockParentPort;

    beforeEach(() => {
        // Reset mocks
        mockParentPort = {
            postMessage: jest.fn(),
            on: jest.fn()
        };
        mockExit.mockClear();

        // Create fresh worker instance with mocked dependencies
        worker = new SolutionWorker({
            Anneal: global.Anneal,
            Cellular: global.Cellular,
            Solution: global.Solution,
            Board: global.Board,
            Export: global.Export
        });
        // Mock the parentPort for Node.js environment testing
        worker.parentPort = mockParentPort;

        // Load test shapes
        testShapes = loadShapesFromFixture().slice(0, 2); // Use 2 shapes for testing
    });

    describe('Message Handling', () => {
        test('should handle SET_MODE message correctly', async () => {
            const modePayload = {
                mode: 'bulk',
                config: { aspectRatioPref: 1.5 }
            };

            await worker.processMessage({
                type: 'SET_MODE',
                payload: modePayload
            });

            expect(worker.mode).toBe('bulk');
            expect(worker.config).toEqual(modePayload.config);

            // Should send confirmation message
            expect(mockParentPort.postMessage).toHaveBeenCalledWith({
                type: 'MODE_SET',
                payload: modePayload
            });
        });

        test('should handle unknown message types gracefully', async () => {
            await worker.processMessage({
                type: 'UNKNOWN_TYPE',
                payload: {}
            });

            expect(mockParentPort.postMessage).toHaveBeenCalledWith({
                type: 'ERROR',
                payload: expect.objectContaining({
                    message: 'Unknown message type: UNKNOWN_TYPE'
                })
            });
        });
    });

    describe('Solution Generation Pipeline', () => {


        test('should produce export-compatible data structure', async () => {
            worker.mode = 'single';

            const generatePayload = {
                shapes: testShapes,
                jobId: 'export-test-789',
                startId: 0,
                aspectRatioPref: 0,
                annealConfig: { maxIterations: 3 } // Minimal for testing
            };

            await worker.processMessage({
                type: 'GENERATE_SOLUTION',
                payload: generatePayload
            });

            const sentMessages = mockParentPort.postMessage.mock.calls;
            const resultMessage = sentMessages.find(call => call[0].type === 'RESULT');

            expect(resultMessage).toBeTruthy();

            const result = resultMessage[0].payload;

            // Verify export compatibility structure
            expect(result.finalSolution).toBeDefined();
            expect(result.finalSolution.score).toBeDefined();
            expect(result.finalSolution.valid).toBeDefined();
            expect(result.cellular).toBeDefined();
            expect(result.metadata).toBeDefined();

            // Result should be serializable (no circular references, etc.)
            expect(() => JSON.stringify(result)).not.toThrow();
        });


    });

    describe('Error Handling', () => {
        test('should handle errors during solution generation gracefully', async () => {
            worker.mode = 'bulk';

            // Pass invalid shapes to trigger an error
            const invalidPayload = {
                shapes: null, // This should cause an error
                jobId: 'error-test-001',
                startId: 0
            };

            await worker.processMessage({
                type: 'GENERATE_SOLUTION',
                payload: invalidPayload
            });

            const sentMessages = mockParentPort.postMessage.mock.calls;
            const errorMessages = sentMessages.filter(call => call[0].type === 'ERROR');

            expect(errorMessages.length).toBeGreaterThan(0);

            const errorPayload = errorMessages[0][0].payload;
            expect(errorPayload).toHaveProperty('message');
            expect(errorPayload).toHaveProperty('jobId', 'error-test-001');
            expect(errorPayload).toHaveProperty('timestamp');
        });

        test('should include job context in error messages', async () => {
            worker.mode = 'bulk';

            // Create a scenario that will fail
            const faultyPayload = {
                shapes: [], // Empty shapes array should cause issues
                jobId: 'context-test-002',
                startId: 5
            };

            await worker.processMessage({
                type: 'GENERATE_SOLUTION',
                payload: faultyPayload
            });

            const sentMessages = mockParentPort.postMessage.mock.calls;
            const errorMessages = sentMessages.filter(call => call[0].type === 'ERROR');

            // Assert that at least one error message was received
            expect(errorMessages.length).toBeGreaterThan(0);

            const errorPayload = errorMessages[0][0].payload;
            expect(errorPayload.jobId).toBe('context-test-002');
            expect(errorPayload.startId).toBe(5);
        });
    });






}); 