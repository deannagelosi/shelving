const { loadShapesFromFixture } = require('./fixtures/loader');
const Shape = require('../js/core/Shape');
const RenderConfig = require('../js/interfaces/web/RenderConfig');
const MathUtils = require('../js/core/MathUtils');

// Make required classes available globally for Shape.js
global.RenderConfig = RenderConfig;
global.MathUtils = MathUtils;

// Load all shapes from the fixture file before tests run
const allFixtureShapes = loadShapesFromFixture();

describe('Shape', () => {
    test('should correctly trim and pad the input grid on save', () => {
        // 1. Setup - Create a shape with padding around actual shape data
        const shape = new Shape();
        const inputGrid = [
            [false, false, false, false, false],
            [false, false, true, true, false], // The actual shape data
            [false, false, true, true, false],
            [false, false, false, false, false]
        ];
        const title = 'Test Trim Shape';

        // 2. Execute
        shape.saveUserInput(title, inputGrid);

        // 3. Assert - highResShape should contain the trimmed shape data without expansion
        // Original 2x2 shape from the middle of the 4x5 input grid
        const expectedGrid = [
            [true, true],  // Trimmed shape data only
            [true, true] 
        ];
        expect(shape.data.highResShape).toEqual(expectedGrid);
        expect(shape.data.title).toBe(title);
    });

    test('should correctly generate lowResShape by scaling down 4x', () => {
        // 1. Setup - Create a 8x8 shape (2x2 in low res)
        const shape = new Shape();
        const inputGrid = Array(8).fill().map(() => Array(8).fill(true));

        // 2. Execute
        shape.saveUserInput('Test Low Res', inputGrid);

        // 3. Assert - 8x8 input is already divisible by scale factor 4, so no padding needed
        // Results in clean 2x2 low-res shape
        expect(shape.data.lowResShape).toEqual([
            [true, true],
            [true, true]
        ]);
    });

    test('should correctly generate bufferShape with under-hang protection', () => {
        // 1. Setup - Create a shape that will have gaps in the lowResShape that need filling
        // This creates a shape that will have discontinuous true values in a row after scaling down
        const shape = new Shape();
        const inputGrid = [
            // Create a pattern that scales down to: [true, false, true] in low res
            // This requires a 12-wide high-res pattern (since it scales down 4x to 3 wide)
            [true, true, true, true, false, false, false, false, true, true, true, true],
            [true, true, true, true, false, false, false, false, true, true, true, true],
            [true, true, true, true, false, false, false, false, true, true, true, true],
            [true, true, true, true, false, false, false, false, true, true, true, true],
        ];

        // 2. Execute - use larger buffer to ensure visible buffer expansion
        const config = {
            customBufferSize: 1.0,  // 1 inch buffer for clear size difference
            centerShape: false,
            minWallLength: 1.0
        };
        shape.saveUserInput('Gapped Shape', inputGrid, config);

        // 3. Assert - Buffer shape should fill gaps to prevent under-hangs
        // Buffer is applied at high-res level
        // The buffer shape may have same dimensions but more filled cells
        expect(shape.data.bufferShape.length).toBeGreaterThanOrEqual(shape.data.lowResShape.length);
        expect(shape.data.bufferShape[0].length).toBeGreaterThanOrEqual(shape.data.lowResShape[0].length);

        // Check that buffer fills horizontal gaps (setTrueBetween logic)
        // For this input, lowResShape should be [[true, false, true]]
        // After setTrueBetween, first row of bufferShape should be [true, true, true, false]
        const firstRow = shape.data.bufferShape[0];
        const firstTrue = firstRow.indexOf(true);
        const lastTrue = firstRow.lastIndexOf(true);

        // The key test: all positions between first and last true should be true
        // This will fail if setTrueBetween is disabled because the gap won't be filled
        for (let i = firstTrue; i <= lastTrue; i++) {
            expect(firstRow[i]).toBe(true);
        }
    });

    test('should work with fixture shapes', () => {
        // 1. Setup - Use a shape from the fixture file
        expect(allFixtureShapes.length).toBeGreaterThan(0);
        const fixtureShape = allFixtureShapes[0];

        // 2. Assert - The fixture shape should have all required properties
        expect(fixtureShape.data.title).toBeDefined();
        expect(fixtureShape.data.highResShape).toBeDefined();
        expect(fixtureShape.data.lowResShape).toBeDefined();
        expect(fixtureShape.data.bufferShape).toBeDefined();
        expect(Array.isArray(fixtureShape.data.highResShape)).toBe(true);
        expect(Array.isArray(fixtureShape.data.lowResShape)).toBe(true);
        expect(Array.isArray(fixtureShape.data.bufferShape)).toBe(true);
    });

    test('should handle edge case of single cell shape', () => {
        // 1. Setup
        const shape = new Shape();
        const inputGrid = [[true]];

        // 2. Execute
        shape.saveUserInput('Single Cell', inputGrid);

        // 3. Assert - highResShape should be trimmed to exact content (1x1)
        // Padding for scale factor alignment only occurs during low-res conversion
        expect(shape.data.highResShape).toEqual([[true]]);
        expect(shape.data.highResShape[0].length).toBe(1);
        expect(shape.data.lowResShape).toBeDefined();
        expect(shape.data.bufferShape).toBeDefined();
    });

    test('should process complex shapes without crashing', () => {
        // 1. Setup - Create complex shapes that could potentially break the processing pipeline
        const shape = new Shape();

        // Test with an "O" shaped piece with internal complexity
        const inputGrid = [
            [false, false, false, false, false, false],
            [false, true, true, true, true, false],
            [false, true, false, false, true, false], // Internal hole
            [false, true, false, false, true, false], // Internal hole  
            [false, true, true, true, true, false],
            [false, false, false, false, false, false]
        ];

        // 2. Execute - This should not crash or throw errors, use larger buffer for size tests
        const config = {
            customBufferSize: 1.0,  // 1 inch buffer for clear size difference
            centerShape: false,
            minWallLength: 1.0
        };
        expect(() => {
            shape.saveUserInput('Complex-Shape', inputGrid, config);
        }).not.toThrow();

        // 3. Assert - All processing stages should complete successfully and produce valid outputs

        // highResShape should be properly processed
        const highRes = shape.data.highResShape;
        expect(highRes).toBeDefined();
        expect(Array.isArray(highRes)).toBe(true);
        expect(highRes.length).toBeGreaterThan(0);
        expect(highRes[0].length % 4).toBe(0); // Should be padded to divisible by 4
        expect(highRes[0].length).toBeGreaterThanOrEqual(4); // Should have minimum width

        // lowResShape should be generated successfully
        const lowRes = shape.data.lowResShape;
        expect(lowRes).toBeDefined();
        expect(Array.isArray(lowRes)).toBe(true);
        expect(lowRes.length).toBeGreaterThan(0);
        expect(lowRes[0].length).toBeGreaterThan(0);

        // bufferShape should be generated successfully  
        const bufferShape = shape.data.bufferShape;
        expect(bufferShape).toBeDefined();
        expect(Array.isArray(bufferShape)).toBe(true);
        expect(bufferShape.length).toBeGreaterThanOrEqual(lowRes.length); // May be same size
        expect(bufferShape[0].length).toBeGreaterThanOrEqual(lowRes[0].length);

        // Shape should contain some true values (not be completely empty)
        const hasTrue = highRes.some(row => row.some(cell => cell === true));
        expect(hasTrue).toBe(true);

        // Title should be preserved
        expect(shape.data.title).toBe('Complex-Shape');
    });
});

describe('Shape ID Management', () => {
    beforeEach(() => {
        // Reset the static ID counter before each test to ensure isolation
        Shape.nextId = 0;
    });

    test('should assign unique, auto-incrementing IDs to new shapes', () => {
        const shape1 = new Shape();
        const shape2 = new Shape();

        expect(shape1.id).toBe(0);
        expect(shape2.id).toBe(1);
        expect(Shape.nextId).toBe(2);
    });

    test('should restore ID from data object', () => {
        const shapeData = {
            data: { title: 'Restored Shape', highResShape: [[true]] },
            id: 10
        };

        const shape = Shape.fromDataObject(shapeData);

        expect(shape.id).toBe(10);
    });

    test('should update nextId counter when restoring an ID', () => {
        // Restore a shape with an ID of 10
        const shapeData = {
            data: { title: 'Restored Shape', highResShape: [[true]] },
            id: 10
        };
        Shape.fromDataObject(shapeData);

        // The nextId should now be 11
        expect(Shape.nextId).toBe(11);

        // A new shape should get the next sequential ID
        const newShape = new Shape();
        expect(newShape.id).toBe(11);
        expect(Shape.nextId).toBe(12);
    });

    test('should not let a restored ID be smaller than the current nextId', () => {
        // Reset and set the counter to a known high value
        Shape.nextId = 20;

        // Restore a shape with a lower ID
        const shapeData = {
            data: { title: 'Old Shape', highResShape: [[true]] },
            id: 5
        };
        const shape = Shape.fromDataObject(shapeData);

        // The restored shape should have its original ID
        expect(shape.id).toBe(5);
        // The static counter should be incremented due to constructor call but remain higher than restored ID
        expect(Shape.nextId).toBe(21);

        // A new shape should get an ID from the higher counter
        const newShape = new Shape();
        expect(newShape.id).toBe(21);
        expect(Shape.nextId).toBe(22);
    });
}); 