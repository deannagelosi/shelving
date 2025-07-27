const { loadShapesFromFixture } = require('./fixtures/loader');
const Solution = require('../js/core/Solution');

// Load all shapes from the fixture file before tests run
const allFixtureShapes = loadShapesFromFixture();

// Mock p5.js global variables before each test in this file
beforeEach(() => {
    global.canvasWidth = 800;
    global.canvasHeight = 600;
    global.aspectRatioPref = 0; // Square preference
    global.devMode = false;
    global.detailView = false;
});

describe('Solution', () => {
    test('should correctly calculate score for a simple layout', () => {
        // 1. Setup - Use a simple shape from fixtures
        const shape = allFixtureShapes.slice(0, 1); // Take first shape only
        const solution = new Solution(shape);

        // 2. Execute
        solution.randomLayout();
        solution.calcScore();

        // 3. Assert - Score should be a number and solution should have basic properties
        expect(typeof solution.score).toBe('number');
        expect(solution.score).toBeGreaterThanOrEqual(0);
        expect(typeof solution.valid).toBe('boolean');
    });

    test('should correctly trim layout and update coordinates', () => {
        // 1. Setup - Create shapes with specific positions that will need trimming
        const shapes = allFixtureShapes.slice(0, 2);
        shapes[0].posX = 5; // Place first shape away from origin
        shapes[0].posY = 5;
        shapes[1].posX = 7;
        shapes[1].posY = 7;
        const solution = new Solution(shapes);

        // 2. Execute
        solution.makeLayout();

        // 3. Assert - Layout should be trimmed and coordinates adjusted
        expect(solution.layout.length).toBeGreaterThan(0);
        expect(solution.layout[0].length).toBeGreaterThan(0);

        // At least one shape should have had its coordinates adjusted (moved closer to origin)
        const hasAdjustedCoords = shapes.some(shape => shape.posX < 5 || shape.posY < 5);
        expect(hasAdjustedCoords).toBe(true);
    });

    test('should penalize overlapping shapes', () => {
        // 1. Setup - Create overlapping shapes
        const shapes = allFixtureShapes.slice(0, 2);
        shapes[0].posX = 0;
        shapes[0].posY = 0;
        shapes[1].posX = 0; // Same position = guaranteed overlap
        shapes[1].posY = 0;
        const solution = new Solution(shapes);

        // 2. Execute
        solution.makeLayout();
        solution.calcScore();

        // 3. Assert - Should not be valid due to overlaps and should have high penalty
        expect(solution.valid).toBe(false);
        expect(solution.score).toBeGreaterThan(100); // Overlaps should create significant penalty
    });

    test('should correctly set valid flag for overlapping vs. non-overlapping solutions', () => {
        // 1. Setup a valid, non-overlapping solution
        const validShapes = allFixtureShapes.slice(0, 1);
        validShapes[0].posX = 0;
        validShapes[0].posY = 0; // On the bottom
        const validSolution = new Solution(validShapes);
        validSolution.makeLayout();
        validSolution.calcScore();

        // 2. Setup an invalid, overlapping solution
        const overlappingShapes = allFixtureShapes.slice(0, 2);
        overlappingShapes[0].posX = 0;
        overlappingShapes[0].posY = 0;
        overlappingShapes[1].posX = 0; // Same position = overlap
        const overlappingSolution = new Solution(overlappingShapes);
        overlappingSolution.makeLayout();
        overlappingSolution.calcScore();

        // 3. Assert
        expect(validSolution.valid).toBe(true);
        expect(overlappingSolution.valid).toBe(false);
    });

    test('should handle createNeighbor functionality', () => {
        // 1. Setup
        const shapes = allFixtureShapes.slice(0, 2);
        const solution = new Solution(shapes);
        solution.randomLayout();

        // 2. Execute
        const neighbor = solution.createNeighbor(2); // Max shift of 2

        // 3. Assert - Neighbor should be a different solution but with same shape count
        expect(neighbor).toBeInstanceOf(Solution);
        expect(neighbor.shapes.length).toBe(solution.shapes.length);
        expect(neighbor.startID).toBe(solution.startID);

        // At least one shape should have moved (or positions should be swapped)
        const hasChanged = neighbor.shapes.some((shape, i) =>
            shape.posX !== solution.shapes[i].posX || shape.posY !== solution.shapes[i].posY
        );
        expect(hasChanged).toBe(true);
    });

    test('should execute specific movement cases in createNeighbor', () => {
        // 1. Setup
        const shapes = allFixtureShapes.slice(0, 2);
        const solution = new Solution(shapes);
        solution.randomLayout();

        // Store original positions
        const originalPosX = solution.shapes[0].posX;
        const originalPosY = solution.shapes[0].posY;

        // 2. Execute & Assert different movement cases

        // Test case 1: Left movement (randOption = 1)
        jest.spyOn(Math, 'random')
            .mockReturnValueOnce(0) // Shape selection (first shape)
            .mockReturnValueOnce(0.05); // Movement option (case 1 = left)

        const leftNeighbor = solution.createNeighbor(2);
        expect(leftNeighbor.shapes[0].posX).toBeLessThanOrEqual(originalPosX);

        // Test case 3: Up movement (randOption = 3)
        Math.random
            .mockReturnValueOnce(0) // Shape selection
            .mockReturnValueOnce(0.25); // Movement option (case 3 = up)

        const upNeighbor = solution.createNeighbor(2);
        expect(upNeighbor.shapes[0].posY).toBeGreaterThanOrEqual(originalPosY);

        // Test case 5: Right movement (randOption = 5)
        Math.random
            .mockReturnValueOnce(0) // Shape selection
            .mockReturnValueOnce(0.45); // Movement option (case 5 = right)

        const rightNeighbor = solution.createNeighbor(2);
        expect(rightNeighbor.shapes[0].posX).toBeGreaterThanOrEqual(originalPosX);

        // Test case 9: Swap positions (randOption = 9)
        Math.random
            .mockReturnValueOnce(0) // First shape selection
            .mockReturnValueOnce(0.95) // Movement option (case 9 = swap)
            .mockReturnValueOnce(0.9); // Second shape selection (different from first)

        const swapNeighbor = solution.createNeighbor(2);
        // After swap, positions should be different from original
        const positionsChanged = swapNeighbor.shapes.some((shape, i) =>
            shape.posX !== solution.shapes[i].posX || shape.posY !== solution.shapes[i].posY
        );
        expect(positionsChanged).toBe(true);

        // Restore Math.random
        Math.random.mockRestore();
    });
});

describe('Solution.normalizeCoordinates', () => {
    let shapes;

    beforeEach(() => {
        // Create fresh shapes for each test to avoid side-effects
        shapes = [
            { id: 0, posX: 10, posY: 20 },
            { id: 1, posX: 30, posY: 40 },
        ];
    });

    test('should not change coordinates when all are positive', () => {
        const solution = new Solution(shapes);
        const originalPositions = solution.shapes.map(s => ({ posX: s.posX, posY: s.posY }));

        solution.normalizeCoordinates();

        solution.shapes.forEach((shape, i) => {
            expect(shape.posX).toBe(originalPositions[i].posX);
            expect(shape.posY).toBe(originalPositions[i].posY);
        });
    });

    test('should shift all shapes when one has negative X', () => {
        shapes[0].posX = -5;
        const solution = new Solution(shapes);

        const originalPositions = solution.shapes.map(s => ({ posX: s.posX, posY: s.posY }));
        const expectedShiftX = 5;

        solution.normalizeCoordinates();

        expect(solution.shapes[0].posX).toBe(0);
        expect(solution.shapes[1].posX).toBe(originalPositions[1].posX + expectedShiftX);
        expect(solution.shapes[0].posY).toBe(originalPositions[0].posY);
        expect(solution.shapes[1].posY).toBe(originalPositions[1].posY);
    });

    test('should shift all shapes when one has negative Y', () => {
        shapes[1].posY = -10;
        const solution = new Solution(shapes);

        const originalPositions = solution.shapes.map(s => ({ posX: s.posX, posY: s.posY }));
        const expectedShiftY = 10;

        solution.normalizeCoordinates();

        expect(solution.shapes[1].posY).toBe(0);
        expect(solution.shapes[0].posY).toBe(originalPositions[0].posY + expectedShiftY);
        expect(solution.shapes[0].posX).toBe(originalPositions[0].posX);
        expect(solution.shapes[1].posX).toBe(originalPositions[1].posX);
    });

    test('should shift all shapes when there are negative X and Y values', () => {
        shapes[0].posX = -15;
        shapes[1].posY = -25;
        const solution = new Solution(shapes);

        const originalPositions = solution.shapes.map(s => ({ posX: s.posX, posY: s.posY }));
        const expectedShiftX = 15;
        const expectedShiftY = 25;

        solution.normalizeCoordinates();

        expect(solution.shapes[0].posX).toBe(0);
        expect(solution.shapes[1].posY).toBe(0);
        expect(solution.shapes[1].posX).toBe(originalPositions[1].posX + expectedShiftX);
        expect(solution.shapes[0].posY).toBe(originalPositions[0].posY + expectedShiftY);
    });
}); 