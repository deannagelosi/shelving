// tests/MathUtils.test.js

const MathUtils = require('../js/core/MathUtils');

describe('MathUtils', () => {
    describe('gridUnitsToInches', () => {
        test('should convert grid units to inches with 1.0" wall length', () => {
            // 1. Setup
            const gridUnits = 10;
            const minWallLength = 1.0;

            // 2. Execute
            const inches = MathUtils.gridUnitsToInches(gridUnits, minWallLength);

            // 3. Assert
            expect(inches).toBe(10);
        });

        test('should convert grid units to inches with 0.5" wall length', () => {
            // 1. Setup
            const gridUnits = 10;
            const minWallLength = 0.5;

            // 2. Execute
            const inches = MathUtils.gridUnitsToInches(gridUnits, minWallLength);

            // 3. Assert
            expect(inches).toBe(5);
        });

        test('should convert grid units to inches with 0.25" wall length', () => {
            // 1. Setup
            const gridUnits = 8;
            const minWallLength = 0.25;

            // 2. Execute
            const inches = MathUtils.gridUnitsToInches(gridUnits, minWallLength);

            // 3. Assert
            expect(inches).toBe(2);
        });

        test('should convert grid units to inches with 2.0" wall length', () => {
            // 1. Setup
            const gridUnits = 5;
            const minWallLength = 2.0;

            // 2. Execute
            const inches = MathUtils.gridUnitsToInches(gridUnits, minWallLength);

            // 3. Assert
            expect(inches).toBe(10);
        });

        test('should handle fractional grid units', () => {
            // 1. Setup
            const gridUnits = 3.5;
            const minWallLength = 1.0;

            // 2. Execute
            const inches = MathUtils.gridUnitsToInches(gridUnits, minWallLength);

            // 3. Assert
            expect(inches).toBe(3.5);
        });
    });

    describe('inchesToGridUnits', () => {
        test('should convert inches to grid units with 1.0" wall length', () => {
            // 1. Setup
            const inches = 10;
            const minWallLength = 1.0;

            // 2. Execute
            const gridUnits = MathUtils.inchesToGridUnits(inches, minWallLength);

            // 3. Assert
            expect(gridUnits).toBe(10);
        });

        test('should convert inches to grid units with 0.5" wall length', () => {
            // 1. Setup
            const inches = 5;
            const minWallLength = 0.5;

            // 2. Execute
            const gridUnits = MathUtils.inchesToGridUnits(inches, minWallLength);

            // 3. Assert
            expect(gridUnits).toBe(10);
        });

        test('should convert inches to grid units with 0.25" wall length', () => {
            // 1. Setup
            const inches = 2;
            const minWallLength = 0.25;

            // 2. Execute
            const gridUnits = MathUtils.inchesToGridUnits(inches, minWallLength);

            // 3. Assert
            expect(gridUnits).toBe(8);
        });

        test('should convert inches to grid units with 2.0" wall length', () => {
            // 1. Setup
            const inches = 10;
            const minWallLength = 2.0;

            // 2. Execute
            const gridUnits = MathUtils.inchesToGridUnits(inches, minWallLength);

            // 3. Assert
            expect(gridUnits).toBe(5);
        });

        test('should handle fractional inches', () => {
            // 1. Setup
            const inches = 7.5;
            const minWallLength = 1.0;

            // 2. Execute
            const gridUnits = MathUtils.inchesToGridUnits(inches, minWallLength);

            // 3. Assert
            expect(gridUnits).toBe(7.5);
        });
    });

    describe('inchesToHighres', () => {
        test('should convert 0.25 inches to 1 highres unit', () => {
            // 1. Setup
            const inches = 0.25;

            // 2. Execute
            const highres = MathUtils.inchesToHighres(inches);

            // 3. Assert
            expect(highres).toBe(1);
        });

        test('should convert 0.5 inches to 2 highres units', () => {
            // 1. Setup
            const inches = 0.5;

            // 2. Execute
            const highres = MathUtils.inchesToHighres(inches);

            // 3. Assert
            expect(highres).toBe(2);
        });

        test('should convert 1.0 inch to 4 highres units', () => {
            // 1. Setup
            const inches = 1.0;

            // 2. Execute
            const highres = MathUtils.inchesToHighres(inches);

            // 3. Assert
            expect(highres).toBe(4);
        });

        test('should convert 2.0 inches to 8 highres units', () => {
            // 1. Setup
            const inches = 2.0;

            // 2. Execute
            const highres = MathUtils.inchesToHighres(inches);

            // 3. Assert
            expect(highres).toBe(8);
        });

        test('should round to nearest highres unit', () => {
            // 1. Setup
            const inches = 0.3; // 1.2 highres units

            // 2. Execute
            const highres = MathUtils.inchesToHighres(inches);

            // 3. Assert - should round to 1
            expect(highres).toBe(1);
        });

        test('should round up at 0.5 threshold', () => {
            // 1. Setup
            const inches = 0.375; // 1.5 highres units

            // 2. Execute
            const highres = MathUtils.inchesToHighres(inches);

            // 3. Assert - should round to 2
            expect(highres).toBe(2);
        });
    });

    describe('highresToInches', () => {
        test('should convert 1 highres unit to 0.25 inches', () => {
            // 1. Setup
            const highres = 1;

            // 2. Execute
            const inches = MathUtils.highresToInches(highres);

            // 3. Assert
            expect(inches).toBe(0.25);
        });

        test('should convert 2 highres units to 0.5 inches', () => {
            // 1. Setup
            const highres = 2;

            // 2. Execute
            const inches = MathUtils.highresToInches(highres);

            // 3. Assert
            expect(inches).toBe(0.5);
        });

        test('should convert 4 highres units to 1.0 inch', () => {
            // 1. Setup
            const highres = 4;

            // 2. Execute
            const inches = MathUtils.highresToInches(highres);

            // 3. Assert
            expect(inches).toBe(1.0);
        });

        test('should convert 8 highres units to 2.0 inches', () => {
            // 1. Setup
            const highres = 8;

            // 2. Execute
            const inches = MathUtils.highresToInches(highres);

            // 3. Assert
            expect(inches).toBe(2.0);
        });
    });

    describe('highres conversion round-trip', () => {
        test('should maintain value when converting inches->highres->inches', () => {
            // 1. Setup
            const originalInches = 1.0;

            // 2. Execute
            const highres = MathUtils.inchesToHighres(originalInches);
            const backToInches = MathUtils.highresToInches(highres);

            // 3. Assert
            expect(backToInches).toBe(originalInches);
        });

        test('should maintain value when converting highres->inches->highres', () => {
            // 1. Setup
            const originalHighres = 8;

            // 2. Execute
            const inches = MathUtils.highresToInches(originalHighres);
            const backToHighres = MathUtils.inchesToHighres(inches);

            // 3. Assert
            expect(backToHighres).toBe(originalHighres);
        });

        test('should handle buffer conversion correctly (the bug fix verification)', () => {
            // 1. Setup - test the actual bug scenario
            const bufferInInches = 0.25;

            // 2. Execute
            const bufferSteps = MathUtils.inchesToHighres(bufferInInches);

            // 3. Assert - should always be 1 step regardless of minWallLength
            expect(bufferSteps).toBe(1);

            // Verify conversion back
            const actualBuffer = MathUtils.highresToInches(bufferSteps);
            expect(actualBuffer).toBe(0.25);
        });
    });

    describe('calculateBounds', () => {
        test('should calculate bounds for boolean array', () => {
            // 1. Setup
            const array = [
                [false, false, false, false],
                [false, true, true, false],
                [false, true, true, false],
                [false, false, false, false]
            ];

            // 2. Execute
            const bounds = MathUtils.calculateBounds(array);

            // 3. Assert
            expect(bounds).toEqual({
                minX: 1,
                maxX: 2,
                minY: 1,
                maxY: 2
            });
        });

        test('should calculate bounds for object array with occupied property', () => {
            // 1. Setup
            const array = [
                [{ occupied: false }, { occupied: false }, { occupied: false }],
                [{ occupied: false }, { occupied: true }, { occupied: true }],
                [{ occupied: false }, { occupied: false }, { occupied: false }]
            ];

            // 2. Execute
            const bounds = MathUtils.calculateBounds(array);

            // 3. Assert
            expect(bounds).toEqual({
                minX: 1,
                maxX: 2,
                minY: 1,
                maxY: 1
            });
        });

        test('should return null for empty array', () => {
            // 1. Setup
            const array = [];

            // 2. Execute
            const bounds = MathUtils.calculateBounds(array);

            // 3. Assert
            expect(bounds).toBeNull();
        });

        test('should return null for array with no occupied cells', () => {
            // 1. Setup
            const array = [
                [false, false, false],
                [false, false, false],
                [false, false, false]
            ];

            // 2. Execute
            const bounds = MathUtils.calculateBounds(array);

            // 3. Assert
            expect(bounds).toBeNull();
        });

        test('should work with custom cell accessor', () => {
            // 1. Setup
            const array = [
                [{ filled: false }, { filled: true }, { filled: false }],
                [{ filled: false }, { filled: true }, { filled: false }],
                [{ filled: false }, { filled: false }, { filled: false }]
            ];
            const customAccessor = (cell) => cell.filled;

            // 2. Execute
            const bounds = MathUtils.calculateBounds(array, customAccessor);

            // 3. Assert
            expect(bounds).toEqual({
                minX: 1,
                maxX: 1,
                minY: 0,
                maxY: 1
            });
        });
    });

    describe('distributePadding', () => {
        test('should distribute padding evenly when centered', () => {
            // 1. Setup
            const totalPadding = 10;
            const centerAlign = true;

            // 2. Execute
            const result = MathUtils.distributePadding(totalPadding, centerAlign);

            // 3. Assert
            expect(result).toEqual({
                start: 5,
                end: 5
            });
        });

        test('should distribute odd padding when centered (favor end)', () => {
            // 1. Setup
            const totalPadding = 11;
            const centerAlign = true;

            // 2. Execute
            const result = MathUtils.distributePadding(totalPadding, centerAlign);

            // 3. Assert
            expect(result).toEqual({
                start: 5,
                end: 6
            });
        });

        test('should put all padding at start when not centered', () => {
            // 1. Setup
            const totalPadding = 10;
            const centerAlign = false;

            // 2. Execute
            const result = MathUtils.distributePadding(totalPadding, centerAlign);

            // 3. Assert
            expect(result).toEqual({
                start: 10,
                end: 0
            });
        });

        test('should handle zero padding', () => {
            // 1. Setup
            const totalPadding = 0;
            const centerAlign = true;

            // 2. Execute
            const result = MathUtils.distributePadding(totalPadding, centerAlign);

            // 3. Assert
            expect(result).toEqual({
                start: 0,
                end: 0
            });
        });
    });

    describe('conversion round-trip', () => {
        test('should maintain value when converting grid->inches->grid', () => {
            // 1. Setup
            const originalGridUnits = 15;
            const minWallLength = 0.5;

            // 2. Execute
            const inches = MathUtils.gridUnitsToInches(originalGridUnits, minWallLength);
            const backToGrid = MathUtils.inchesToGridUnits(inches, minWallLength);

            // 3. Assert
            expect(backToGrid).toBe(originalGridUnits);
        });

        test('should maintain value when converting inches->grid->inches', () => {
            // 1. Setup
            const originalInches = 12;
            const minWallLength = 1.0;

            // 2. Execute
            const gridUnits = MathUtils.inchesToGridUnits(originalInches, minWallLength);
            const backToInches = MathUtils.gridUnitsToInches(gridUnits, minWallLength);

            // 3. Assert
            expect(backToInches).toBe(originalInches);
        });
    });
});
