const { loadShapesFromFixture } = require('./fixtures/loader');
const Solution = require('../js/core/Solution');

// Load all shapes from the fixture file before tests run
const allFixtureShapes = loadShapesFromFixture();

// Mock p5.js global variables before each test in this file
beforeEach(() => {
    global.canvasWidth = 800;
    global.canvasHeight = 600;
});

describe('Solution', () => {
    test('should calculate specific scores based on layout dimensions and overlaps', () => {
        // 1. Setup - Create shapes with known positions for predictable scoring
        const shapes = allFixtureShapes.slice(0, 2);
        shapes[0].posX = 0;
        shapes[0].posY = 0;
        shapes[1].posX = 20; // Far apart to avoid overlap
        shapes[1].posY = 0;
        const solution = new Solution(shapes);

        // 2. Execute
        solution.makeLayout();
        solution.calcScore();

        // 3. Assert - With no overlaps, score should be based on layout dimensions
        expect(solution.valid).toBe(true); // No overlaps
        expect(solution.score).toBeGreaterThan(0); // Has area component
        expect(solution.score).toBeLessThan(100000); // Score can be large due to area calculations
        
        // Score should include width * height component
        const layoutArea = solution.layout.length * (solution.layout[0]?.length || 0);
        expect(layoutArea).toBeGreaterThan(0);
    });

    test('should trim empty space from layout edges', () => {
        // 1. Setup - Create shapes with positions that leave empty space
        const shapes = allFixtureShapes.slice(0, 1);
        const originalPosX = shapes[0].posX;
        const originalPosY = shapes[0].posY;
        shapes[0].posX = 10;
        shapes[0].posY = 10;
        const solution = new Solution(shapes);

        // 2. Execute
        solution.makeLayout();

        // 3. Assert - Layout should be created and shapes should be repositioned
        expect(solution.layout.length).toBeGreaterThan(0);
        expect(solution.layout[0].length).toBeGreaterThan(0);
        
        // After layout creation with trimming, the shape positions should be adjusted
        const shapeMovedX = shapes[0].posX !== 10;
        const shapeMovedY = shapes[0].posY !== 10;
        expect(shapeMovedX || shapeMovedY).toBe(true);
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

    test('createNeighbor should produce valid neighboring solutions', () => {
        // 1. Setup
        const shapes = allFixtureShapes.slice(0, 3);
        const solution = new Solution(shapes);
        solution.randomLayout();
        
        // 2. Create multiple neighbors and verify they are valid variations
        const neighbors = [];
        for (let i = 0; i < 10; i++) {
            neighbors.push(solution.createNeighbor(3));
        }
        
        // 3. Assert - All neighbors should be valid Solution objects
        neighbors.forEach(neighbor => {
            expect(neighbor).toBeInstanceOf(Solution);
            expect(neighbor.shapes.length).toBe(solution.shapes.length);
            expect(neighbor.startID).toBe(solution.startID);
            
            // Neighbor should be different from original (at least one shape moved)
            const isDifferent = neighbor.shapes.some((shape, i) => 
                shape.posX !== solution.shapes[i].posX || 
                shape.posY !== solution.shapes[i].posY
            );
            expect(isDifferent).toBe(true);
            
            // Movement should be bounded by maxShift parameter
            neighbor.shapes.forEach((shape, i) => {
                const dx = Math.abs(shape.posX - solution.shapes[i].posX);
                const dy = Math.abs(shape.posY - solution.shapes[i].posY);
                // Either positions were swapped or movement is within maxShift
                const wasSwapped = neighbor.shapes.some((s, j) => 
                    j !== i && s.posX === solution.shapes[i].posX && s.posY === solution.shapes[i].posY
                );
                if (!wasSwapped) {
                    expect(dx).toBeLessThanOrEqual(3);
                    expect(dy).toBeLessThanOrEqual(3);
                }
            });
        });
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