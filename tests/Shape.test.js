const { loadShapesFromFixture } = require('./fixtures/loader');
const Shape = require('../js/core/Shape');

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

        // 3. Assert - Should trim empty rows/columns and pad to be divisible by 4
        // Original shape is 2x2, padded to 4x2 for divisibility by 4
        const expectedGrid = [
            [false, true, true, false], // Left padding: 1, Right padding: 1
            [false, true, true, false]
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

        // 3. Assert - Should be 2x2 with all true values
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

        // 2. Execute
        shape.saveUserInput('Gapped Shape', inputGrid);

        // 3. Assert - Buffer shape should fill gaps to prevent under-hangs
        // The exact buffer shape depends on the algorithm, but it should be larger
        // than the low res shape and have additional buffer squares
        expect(shape.data.bufferShape.length).toBeGreaterThan(shape.data.lowResShape.length);
        expect(shape.data.bufferShape[0].length).toBeGreaterThan(shape.data.lowResShape[0].length);

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

        // 3. Assert - Should pad to minimum 4-width
        expect(shape.data.highResShape[0].length % 4).toBe(0);
        expect(shape.data.highResShape[0].length).toBeGreaterThanOrEqual(4);
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

        // 2. Execute - This should not crash or throw errors
        expect(() => {
            shape.saveUserInput('Complex-Shape', inputGrid);
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
        expect(bufferShape.length).toBeGreaterThan(lowRes.length); // Should be larger than lowRes
        expect(bufferShape[0].length).toBeGreaterThan(lowRes[0].length);

        // Shape should contain some true values (not be completely empty)
        const hasTrue = highRes.some(row => row.some(cell => cell === true));
        expect(hasTrue).toBe(true);

        // Title should be preserved
        expect(shape.data.title).toBe('Complex-Shape');
    });
}); 