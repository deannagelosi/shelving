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
    test('should initialize with proper configuration values', () => {
        // 1. Setup
        const shapes = allFixtureShapes.slice(0, 2);

        // 2. Execute
        const anneal = new Anneal(shapes);

        // 3. Assert - Verify annealing parameters are set correctly
        expect(anneal.shapes).toBe(shapes);
        expect(anneal.numStarts).toBe(10);
        expect(anneal.maxIterations).toBe(1000);
        expect(anneal.initialTemp).toBeGreaterThan(0);
        expect(anneal.minTemp).toBeGreaterThan(0);
        expect(anneal.initialTemp).toBeGreaterThan(anneal.minTemp);
        expect(anneal.multiStartSolutions).toEqual([]);
        expect(anneal.finalSolution).toBe(null);
    });

    test('calcMovementRange should return expected values based on temperature', () => {
        // 1. Setup
        const shapes = allFixtureShapes.slice(0, 1);

        const anneal = new Anneal(shapes);

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
        const anneal = new Anneal(shapes);

        // 2. Test better solutions - should always accept
        expect(anneal.acceptSolution(-10, 100)).toBe(true);
        expect(anneal.acceptSolution(-1, 100)).toBe(true);
        expect(anneal.acceptSolution(-0.1, 1)).toBe(true);

        // 3. Test worse solutions - acceptance probability follows Boltzmann distribution
        // At high temperature, should accept more worse solutions
        let acceptedHighTemp = 0;
        for (let i = 0; i < 100; i++) {
            if (anneal.acceptSolution(5, 1000)) acceptedHighTemp++;
        }
        
        // At low temperature, should accept fewer worse solutions  
        let acceptedLowTemp = 0;
        for (let i = 0; i < 100; i++) {
            if (anneal.acceptSolution(5, 10)) acceptedLowTemp++;
        }
        
        // High temperature should accept worse solutions more often
        expect(acceptedHighTemp).toBeGreaterThan(acceptedLowTemp);
        expect(acceptedHighTemp).toBeGreaterThan(20); // Should accept some at high temp
        expect(acceptedLowTemp).toBeLessThan(80); // Should accept fewer at low temp
    });

    test('calcMovementRange should return values proportional to temperature', () => {
        // 1. Setup
        const shapes = allFixtureShapes.slice(0, 1);
        const anneal = new Anneal(shapes);
        const initialTemp = 1000;
        const minTemp = 1;

        // 2. Execute - Test movement range at different temperatures
        const highTempRange = anneal.calcMovementRange(initialTemp, initialTemp);
        const midTempRange = anneal.calcMovementRange(initialTemp * 0.5, initialTemp);
        const lowTempRange = anneal.calcMovementRange(minTemp, initialTemp);

        // 3. Assert - Movement range should decrease as temperature decreases
        expect(highTempRange).toBeGreaterThanOrEqual(1);
        expect(highTempRange).toBeLessThanOrEqual(5);
        expect(midTempRange).toBeGreaterThanOrEqual(1);
        expect(midTempRange).toBeLessThanOrEqual(5);
        expect(lowTempRange).toBeGreaterThanOrEqual(1);
        expect(lowTempRange).toBeLessThanOrEqual(5);
        
        // Higher temperature should generally allow larger movements
        expect(highTempRange).toBeGreaterThanOrEqual(lowTempRange);
    });

    test('control methods should set appropriate flags', () => {
        // 1. Setup
        const shapes = allFixtureShapes.slice(0, 1);
        const anneal = new Anneal(shapes);

        // 2. Execute & Assert restart functionality
        expect(anneal.stopAnneal).toBe(false);
        expect(anneal.restartAnneal).toBe(false);

        anneal.reAnneal();
        expect(anneal.stopAnneal).toBe(true);
        expect(anneal.restartAnneal).toBe(true);

        // Reset and test stop functionality
        anneal.stopAnneal = false;
        anneal.restartAnneal = false;

        anneal.endAnneal();
        expect(anneal.stopAnneal).toBe(true);
        expect(anneal.restartAnneal).toBe(false);
    });
}); 