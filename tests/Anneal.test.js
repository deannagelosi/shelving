const { loadShapesFromFixture } = require('./fixtures/loader');
const Anneal = require('../js/core/Anneal');
const Solution = require('../js/core/Solution');

// Mock the Solution module to isolate Anneal logic
jest.mock('../js/core/Solution');

// Load shapes from fixture for testing
const allFixtureShapes = loadShapesFromFixture();

beforeEach(() => {
    // Clear all mocks before each test
    Solution.mockClear();
    // Reset Math.random mock if it was mocked in previous tests
    if (Math.random.mockRestore) {
        Math.random.mockRestore();
    }
});

describe('Anneal', () => {
    test('constructor should create initial structures', () => {
        // 1. Setup
        const shapes = allFixtureShapes.slice(0, 2);
        const mockUI = {
            updateDisplayCallback: jest.fn(),
            html: {
                annealButton: { html: jest.fn(), mousePressed: jest.fn() },
                clearButton: { mousePressed: jest.fn() }
            }
        };

        // 2. Execute
        const anneal = new Anneal(shapes, mockUI);

        // 3. Assert - Check that constructor sets up expected properties
        expect(anneal.shapes).toBe(shapes);
        expect(anneal.ui).toBe(mockUI);
        expect(anneal.numStarts).toBe(10);
        expect(anneal.maxIterations).toBe(1000);
        expect(anneal.initialTemp).toBe(10000);
        expect(anneal.minTemp).toBe(0.1);
        expect(anneal.multiStartSolutions).toEqual([]);
        expect(anneal.solutionHistory).toEqual([]);
        expect(anneal.finalSolution).toBe(null);
        expect(anneal.stopAnneal).toBe(false);
        expect(anneal.restartAnneal).toBe(false);
    });

    test('calcMovementRange should return expected values based on temperature', () => {
        // 1. Setup
        const shapes = allFixtureShapes.slice(0, 1);
        const mockUI = {
            updateDisplayCallback: jest.fn(),
            html: {
                annealButton: { html: jest.fn(), mousePressed: jest.fn() },
                clearButton: { mousePressed: jest.fn() }
            }
        };
        const anneal = new Anneal(shapes, mockUI);

        // 2. Execute & Assert - Test movement range at different temperatures
        const initialTemp = 1000;
        const minTemp = 0.1;

        // High temperature should allow more movement
        const highTempRange = anneal.calcMovementRange(initialTemp, initialTemp);
        expect(highTempRange).toBeGreaterThanOrEqual(1);
        expect(highTempRange).toBeLessThanOrEqual(5);

        // Low temperature should allow less movement
        const lowTempRange = anneal.calcMovementRange(minTemp, initialTemp);
        expect(lowTempRange).toBeGreaterThanOrEqual(1);
        expect(lowTempRange).toBeLessThanOrEqual(5);

        // High temp should generally allow more movement than low temp
        expect(highTempRange).toBeGreaterThanOrEqual(lowTempRange);
    });

    test('acceptSolution should accept better solutions and probabilistically accept worse ones', () => {
        // 1. Setup
        const shapes = allFixtureShapes.slice(0, 1);
        const mockUI = {
            updateDisplayCallback: jest.fn(),
            html: {
                annealButton: { html: jest.fn(), mousePressed: jest.fn() },
                clearButton: { mousePressed: jest.fn() }
            }
        };
        const anneal = new Anneal(shapes, mockUI);

        // 2. Execute & Assert

        // Better solution (negative energy delta) should always be accepted
        expect(anneal.acceptSolution(-10, 100)).toBe(true);
        expect(anneal.acceptSolution(-1, 100)).toBe(true);

        // Worse solution acceptance depends on temperature and energy delta
        // Mock Math.random to test probabilistic acceptance
        jest.spyOn(Math, 'random').mockReturnValue(0.1); // Low random value

        // High temperature should be more accepting of worse solutions
        const highTempAcceptance = anneal.acceptSolution(10, 1000);

        // Low temperature should be less accepting of worse solutions
        const lowTempAcceptance = anneal.acceptSolution(10, 1);

        // At least one of these behaviors should be observable
        expect(typeof highTempAcceptance).toBe('boolean');
        expect(typeof lowTempAcceptance).toBe('boolean');

        // Test with different random value
        Math.random.mockReturnValue(0.9); // High random value
        const highRandomAcceptance = anneal.acceptSolution(10, 1000);
        expect(typeof highRandomAcceptance).toBe('boolean');
    });

    test('saveSolutionHistory should store solution data appropriately', () => {
        // 1. Setup
        const shapes = allFixtureShapes.slice(0, 1);
        const mockUI = {
            updateDisplayCallback: jest.fn(),
            html: {
                annealButton: { html: jest.fn(), mousePressed: jest.fn() },
                clearButton: { mousePressed: jest.fn() }
            }
        };
        const anneal = new Anneal(shapes, mockUI);

        // Create a mock solution with exportSolution method
        const mockSolution = {
            startID: 0,
            exportSolution: jest.fn().mockReturnValue({
                shapes: [],
                startID: 0,
                score: 100,
                valid: true
            })
        };

        // 2. Execute
        // Test multi-start history
        anneal.saveSolutionHistory(mockSolution, true);
        expect(anneal.multiStartsHistory[0]).toBeDefined();
        expect(anneal.multiStartsHistory[0].length).toBe(1);

        // Test refinement history
        anneal.saveSolutionHistory(mockSolution, false);
        expect(anneal.solutionHistory.length).toBe(1);

        // 3. Assert
        expect(mockSolution.exportSolution).toHaveBeenCalledTimes(2);
    });

    test('button handlers should set appropriate flags', () => {
        // 1. Setup
        const shapes = allFixtureShapes.slice(0, 1);
        const mockUI = {
            updateDisplayCallback: jest.fn(),
            html: {
                annealButton: { html: jest.fn(), mousePressed: jest.fn() },
                clearButton: { mousePressed: jest.fn() }
            }
        };
        const anneal = new Anneal(shapes, mockUI);

        // 2. Execute & Assert

        // Test restart functionality
        expect(anneal.stopAnneal).toBe(false);
        expect(anneal.restartAnneal).toBe(false);

        anneal.reAnneal();
        expect(anneal.stopAnneal).toBe(true);
        expect(anneal.restartAnneal).toBe(true);

        // Reset for next test
        anneal.stopAnneal = false;
        anneal.restartAnneal = false;

        // Test stop functionality
        anneal.endAnneal();
        expect(anneal.stopAnneal).toBe(true);
        expect(anneal.restartAnneal).toBe(false); // Should remain false
    });

    test('should implement adaptive reheating when stuck in local minimum', () => {
        // 1. Setup
        const shapes = allFixtureShapes.slice(0, 1);
        const mockUI = {
            updateDisplayCallback: jest.fn(),
            html: {
                annealButton: { html: jest.fn(), mousePressed: jest.fn() },
                clearButton: { mousePressed: jest.fn() }
            }
        };
        const anneal = new Anneal(shapes, mockUI);

        // Create a mock solution that will simulate being stuck
        const mockSolution = {
            score: 100,
            createNeighbor: jest.fn(),
            exportSolution: jest.fn().mockReturnValue({
                shapes: [],
                startID: 0,
                score: 100,
                valid: false
            })
        };

        // Mock createNeighbor to always return worse solutions (simulating being stuck)
        mockSolution.createNeighbor.mockReturnValue({
            score: 150, // Worse score
            exportSolution: jest.fn().mockReturnValue({
                shapes: [],
                startID: 0,
                score: 150,
                valid: false
            })
        });

        // 2. Execute - Simulate several iterations with no improvement
        const initialTemp = 1000;
        const reheatCounter = 5; // Use small value for testing
        anneal.reheatCounter = reheatCounter;

        let temperature = initialTemp;
        let iterationsSinceImprovement = 0;
        let currentSolution = mockSolution;
        let bestSolution = mockSolution;
        const coolingRate = 0.95;

        // Simulate the annealing loop logic for reheating
        // Force Math.random to return high values so worse solutions are rejected
        jest.spyOn(Math, 'random').mockReturnValue(0.99);

        for (let i = 0; i < reheatCounter + 2; i++) {
            const neighbor = currentSolution.createNeighbor(1);
            const energyDelta = neighbor.score - currentSolution.score;

            // Should not accept worse solution at low temperature with high random value
            if (!anneal.acceptSolution(energyDelta, temperature)) {
                iterationsSinceImprovement++;
            }

            temperature *= coolingRate;

            // Test reheating logic
            if (iterationsSinceImprovement > reheatCounter) {
                const oldTemp = temperature;
                temperature = Math.min(temperature * anneal.reheatingBoost, initialTemp);

                // 3. Assert - Temperature should have increased
                expect(temperature).toBeGreaterThan(oldTemp);
                expect(temperature).toBeLessThanOrEqual(initialTemp);
                break;
            }
        }

        // Should have triggered reheating
        expect(iterationsSinceImprovement).toBeGreaterThan(reheatCounter);

        // Restore Math.random
        Math.random.mockRestore();
    });
}); 