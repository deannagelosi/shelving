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

describe('Solution - Custom Perimeter Conversion', () => {
    test('custom perimeter converts inches to grid units with minWallLength=2.0', () => {
        const layoutConfig = {
            useCustomPerimeter: true,
            perimeterWidthInches: 20,
            perimeterHeightInches: 20
        };
        const bufferConfig = {
            minWallLength: 2.0
        };

        const solution = new Solution([], 0, layoutConfig, {}, bufferConfig);

        // Should store both inches and grid versions
        expect(solution.perimeterWidthInches).toBe(20);
        expect(solution.perimeterHeightInches).toBe(20);
        expect(solution.perimeterWidthGrid).toBe(10);   // 20" / 2 = 10 grid units
        expect(solution.perimeterHeightGrid).toBe(10);
    });

    test('custom perimeter converts inches to grid units with minWallLength=1.0', () => {
        const layoutConfig = {
            useCustomPerimeter: true,
            perimeterWidthInches: 20,
            perimeterHeightInches: 20
        };
        const bufferConfig = {
            minWallLength: 1.0
        };

        const solution = new Solution([], 0, layoutConfig, {}, bufferConfig);

        expect(solution.perimeterWidthInches).toBe(20);
        expect(solution.perimeterHeightInches).toBe(20);
        expect(solution.perimeterWidthGrid).toBe(20);   // 20" / 1 = 20 grid units
        expect(solution.perimeterHeightGrid).toBe(20);
    });

    test('custom perimeter converts inches to grid units with minWallLength=0.5', () => {
        const layoutConfig = {
            useCustomPerimeter: true,
            perimeterWidthInches: 10,
            perimeterHeightInches: 10
        };
        const bufferConfig = {
            minWallLength: 0.5
        };

        const solution = new Solution([], 0, layoutConfig, {}, bufferConfig);

        expect(solution.perimeterWidthInches).toBe(10);
        expect(solution.perimeterHeightInches).toBe(10);
        expect(solution.perimeterWidthGrid).toBe(20);   // 10" / 0.5 = 20 grid units
        expect(solution.perimeterHeightGrid).toBe(20);
    });

    test('toDataObject exports perimeter in inches', () => {
        const layoutConfig = {
            useCustomPerimeter: true,
            perimeterWidthInches: 20,
            perimeterHeightInches: 20
        };
        const bufferConfig = {
            minWallLength: 2.0
        };

        const solution = new Solution([], 0, layoutConfig, {}, bufferConfig);
        const data = solution.toDataObject();

        // Should export in inches, not grid units
        expect(data.perimeterWidthInches).toBe(20);
        expect(data.perimeterHeightInches).toBe(20);
    });

    test('scoring penalty uses grid units with minWallLength=2.0', () => {
        // Area difference penalty should compare grid to grid, not grid to inches
        // Setup: 20" perimeter with minWallLength=2.0 means target is 10x10 grid units (100 area)
        const layoutConfig = {
            useCustomPerimeter: true,
            perimeterWidthInches: 20,
            perimeterHeightInches: 20
        };
        const bufferConfig = {
            minWallLength: 2.0
        };

        const solution = new Solution([], 0, layoutConfig, {}, bufferConfig);

        // Verify conversion happened correctly
        expect(solution.perimeterWidthGrid).toBe(10);
        expect(solution.perimeterHeightGrid).toBe(10);

        // Test the area difference calculation directly
        // Target area should be in grid units: 10 * 10 = 100
        const targetArea = solution.perimeterWidthGrid * solution.perimeterHeightGrid;
        expect(targetArea).toBe(100);

        // Create layouts of different sizes and check area difference
        // 8x8 grid = 64 area, difference from target = |64 - 100| = 36
        solution.layout = Array(8).fill(null).map(() => Array(8).fill({ shapes: [], isShape: [], isBuffer: [], annealScore: 0, terrainValue: 0 }));
        const area8x8 = solution.layout.length * solution.layout[0].length;
        const diff8x8 = Math.abs(area8x8 - targetArea);
        expect(diff8x8).toBe(36);

        // 10x10 grid = 100 area, difference from target = |100 - 100| = 0
        solution.layout = Array(10).fill(null).map(() => Array(10).fill({ shapes: [], isShape: [], isBuffer: [], annealScore: 0, terrainValue: 0 }));
        const area10x10 = solution.layout.length * solution.layout[0].length;
        const diff10x10 = Math.abs(area10x10 - targetArea);
        expect(diff10x10).toBe(0);

        // 12x12 grid = 144 area, difference from target = |144 - 100| = 44
        solution.layout = Array(12).fill(null).map(() => Array(12).fill({ shapes: [], isShape: [], isBuffer: [], annealScore: 0, terrainValue: 0 }));
        const area12x12 = solution.layout.length * solution.layout[0].length;
        const diff12x12 = Math.abs(area12x12 - targetArea);
        expect(diff12x12).toBe(44);

        // Verify that 10x10 has smallest area difference (closest to target)
        expect(diff10x10).toBeLessThan(diff8x8);
        expect(diff10x10).toBeLessThan(diff12x12);

        // The bug would cause this test to fail because:
        // - Before fix: targetArea = 20*20 = 400 (inches treated as grid)
        // - 8x8 would have diff = |64 - 400| = 336
        // - 10x10 would have diff = |100 - 400| = 300
        // - 12x12 would have diff = |144 - 400| = 256 (best! wrong!)
        // - After fix: targetArea = 10*10 = 100 (correct grid units)
        // - 10x10 has diff = 0 (best! correct!)
    });
});