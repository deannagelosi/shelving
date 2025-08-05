// tests/Board.test.js

const Board = require('../js/core/Board');

describe('Board', () => {
    describe('Constructor', () => {
        test('should initialize with neutral POI values', () => {
            // ✅ BULK VERIFIED: Broke Board.js POI init & length calc, 4/11 tests failed correctly
            // 1. Setup
            const id = 1;
            const firstCoord = { x: 0, y: 0 };
            const secondCoord = { x: 5, y: 0 };
            const orientation = 'x';
            const thickness = 0.23;

            // 2. Execute
            const board = new Board(id, firstCoord, secondCoord, orientation, thickness);

            // 3. Assert
            expect(board.id).toBe(1);
            expect(board.orientation).toBe('x');
            expect(board.poi.start).toBe('unassigned');
            expect(board.poi.end).toBe('unassigned');
            expect(Array.isArray(board.poi.tJoints)).toBe(true);
            expect(Array.isArray(board.poi.xJoints)).toBe(true);
            expect(board.poi.tJoints).toHaveLength(0);
            expect(board.poi.xJoints).toHaveLength(0);
        });

        test('should store thickness for length calculations', () => {
            // 1. Setup
            const firstCoord = { x: 0, y: 0 };
            const secondCoord = { x: 5, y: 0 };
            const thickness = 0.23;

            // 2. Execute
            const board = new Board(1, firstCoord, secondCoord, 'x', thickness);

            // 3. Assert - Board no longer has static .len property
            expect(board.thickness).toBe(0.23);
            expect(board.hasOwnProperty('len')).toBe(false);
        });
    });

    describe('getLength', () => {
        test('should calculate horizontal board length with thickness adjustment', () => {
            // 1. Setup
            const firstCoord = { x: 2, y: 5 };
            const secondCoord = { x: 10, y: 5 };
            const thickness = 0.25;
            const board = new Board(1, firstCoord, secondCoord, 'x', thickness);
            // Default poi ends are 'unassigned' (no poi adjustments)

            // 2. Execute
            const length = board.getLength();

            // 3. Assert - geometric length (8) + thickness (0.25) = 8.25
            expect(length).toBe(8.25);
        });

        test('should calculate vertical board length with thickness adjustment', () => {
            // 1. Setup
            const firstCoord = { x: 3, y: 1 };
            const secondCoord = { x: 3, y: 7 };
            const thickness = 0.25;
            const board = new Board(1, firstCoord, secondCoord, 'y', thickness);
            // Default poi ends are 'unassigned' (no poi adjustments)

            // 2. Execute
            const length = board.getLength();

            // 3. Assert - geometric length (6) + thickness (0.25) = 6.25
            expect(length).toBe(6.25);
        });

        test('should adjust length for short ends (acrylic material)', () => {
            // 1. Setup
            const firstCoord = { x: 0, y: 0 };
            const secondCoord = { x: 5, y: 0 };
            const thickness = 0.25;
            const board = new Board(1, firstCoord, secondCoord, 'x', thickness);

            // Set both ends to 'short' (acrylic style)
            board.poi.start = 'short';
            board.poi.end = 'short';

            // 2. Execute
            const length = board.getLength();

            // 3. Assert - geometric (5) + thickness (0.25) - start short (0.25) - end short (0.25) = 4.75
            expect(length).toBe(4.75);
        });

        test('should handle mixed end types', () => {
            // 1. Setup
            const firstCoord = { x: 0, y: 0 };
            const secondCoord = { x: 10, y: 0 };
            const thickness = 0.25;
            const board = new Board(1, firstCoord, secondCoord, 'x', thickness);

            // Set one end to 'short', leave other as default
            board.poi.start = 'short';
            board.poi.end = 'pin'; // No adjustment for pin

            // 2. Execute
            const length = board.getLength();

            // 3. Assert - geometric (10) + thickness (0.25) - start short (0.25) = 10
            expect(length).toBe(10);
        });

        test('should return 0 and log error for invalid board coordinates', () => {
            // 1. Setup
            const firstCoord = { x: 2, y: 5 };
            const secondCoord = { x: 10, y: 7 }; // Different x AND y - invalid
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

            const board = new Board(1, firstCoord, secondCoord, 'x', 0);

            // 2. Execute
            const length = board.getLength();

            // 3. Assert - safety check returns 0 for invalid coordinates
            expect(length).toBe(0);
            // Two error messages: one from getGeometricLength(), one from safety check
            expect(consoleSpy).toHaveBeenCalledWith("Board length error. start: ", board.coords.start, "end: ", board.coords.end);
            expect(consoleSpy).toHaveBeenCalledWith("Board 1 calculated invalid length: 0");

            // Cleanup
            consoleSpy.mockRestore();
        });
    });

    describe('setBoardDirection', () => {
        test('should set horizontal board direction with smaller x as start', () => {
            // 1. Setup - coordinates in reverse order
            const firstCoord = { x: 10, y: 3 };
            const secondCoord = { x: 2, y: 3 };
            const board = new Board(1, firstCoord, secondCoord, 'x', 0);

            // 2. Execute is in constructor

            // 3. Assert - should reorder so smaller x is start
            expect(board.coords.start).toEqual({ x: 2, y: 3 });
            expect(board.coords.end).toEqual({ x: 10, y: 3 });
        });

        test('should set vertical board direction with smaller y as start', () => {
            // 1. Setup - coordinates in reverse order
            const firstCoord = { x: 5, y: 8 };
            const secondCoord = { x: 5, y: 1 };
            const board = new Board(1, firstCoord, secondCoord, 'y', 0);

            // 2. Execute is in constructor

            // 3. Assert - should reorder so smaller y is start
            expect(board.coords.start).toEqual({ x: 5, y: 1 });
            expect(board.coords.end).toEqual({ x: 5, y: 8 });
        });

        test('should maintain correct order when coordinates are already sorted', () => {
            // 1. Setup - coordinates already in correct order
            const firstCoord = { x: 1, y: 4 };
            const secondCoord = { x: 6, y: 4 };
            const board = new Board(1, firstCoord, secondCoord, 'x', 0);

            // 2. Execute is in constructor

            // 3. Assert - should maintain order (both input order and sorted order should be the same)
            expect(board.coords.start).toEqual({ x: 1, y: 4 });
            expect(board.coords.end).toEqual({ x: 6, y: 4 });
        });

        test('should sort coordinates when input is in reverse order', () => {
            // 1. Setup - coordinates in reverse order (larger x first)
            const firstCoord = { x: 8, y: 3 };
            const secondCoord = { x: 2, y: 3 };
            const board = new Board(1, firstCoord, secondCoord, 'x', 0);

            // 2. Execute is in constructor

            // 3. Assert - should sort so smaller x comes first
            expect(board.coords.start).toEqual({ x: 2, y: 3 });
            expect(board.coords.end).toEqual({ x: 8, y: 3 });
        });

        test('should handle invalid orientation with error logging', () => {
            // 1. Setup
            const firstCoord = { x: 1, y: 4 };
            const secondCoord = { x: 6, y: 4 };
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

            // 2. Execute - Board constructor completes but setBoardDirection logs error
            const board = new Board(1, firstCoord, secondCoord, 'invalid', 0);

            // 3. Assert - should log error for invalid orientation
            expect(consoleSpy).toHaveBeenCalledWith("Board missing orientation. start: ", firstCoord, "end: ", secondCoord, "orientation: ", 'invalid');

            // Board should still be created but with undefined coords
            expect(board.coords.start).toBeUndefined();
            expect(board.coords.end).toBeUndefined();

            // Cleanup
            consoleSpy.mockRestore();
        });
    });

    describe('POI Structure', () => {
        test('should have correct POI structure after construction', () => {
            // 1. Setup
            const board = new Board(1, { x: 0, y: 0 }, { x: 5, y: 0 }, 'x', 0.23);

            // 2. Execute - POI is set in constructor

            // 3. Assert - verify POI structure
            expect(board.poi).toHaveProperty('start');
            expect(board.poi).toHaveProperty('end');
            expect(board.poi).toHaveProperty('tJoints');
            expect(board.poi).toHaveProperty('xJoints');

            expect(typeof board.poi.start).toBe('string');
            expect(typeof board.poi.end).toBe('string');
            expect(Array.isArray(board.poi.tJoints)).toBe(true);
            expect(Array.isArray(board.poi.xJoints)).toBe(true);
        });

        test('should allow POI values to be modified after construction', () => {
            // 1. Setup
            const board = new Board(1, { x: 0, y: 0 }, { x: 5, y: 0 }, 'x', 0.23);

            // 2. Execute - modify POI values
            board.poi.start = 'pin';
            board.poi.end = 'pin';
            board.poi.tJoints.push(2.5);
            board.poi.xJoints.push(1.0);

            // 3. Assert
            expect(board.poi.start).toBe('pin');
            expect(board.poi.end).toBe('pin');
            expect(board.poi.tJoints).toEqual([2.5]);
            expect(board.poi.xJoints).toEqual([1.0]);
        });
    });

    describe('getGeometricLength', () => {
        test('should return pure geometric distance for horizontal boards', () => {
            // 1. Setup
            const firstCoord = { x: 2, y: 5 };
            const secondCoord = { x: 10, y: 5 };
            const board = new Board(1, firstCoord, secondCoord, 'x', 0.25);

            // 2. Execute
            const geometricLength = board.getGeometricLength();

            // 3. Assert - pure distance without thickness or poi adjustments
            expect(geometricLength).toBe(8); // 10 - 2 = 8
        });

        test('should return pure geometric distance for vertical boards', () => {
            // 1. Setup
            const firstCoord = { x: 3, y: 1 };
            const secondCoord = { x: 3, y: 7 };
            const board = new Board(1, firstCoord, secondCoord, 'y', 0.25);

            // 2. Execute
            const geometricLength = board.getGeometricLength();

            // 3. Assert - pure distance without thickness or poi adjustments
            expect(geometricLength).toBe(6); // 7 - 1 = 6
        });
    });

    describe('Material-Aware Length Calculation', () => {
        test('should simulate plywood behavior with pin/slot ends', () => {
            // 1. Setup - typical plywood board
            const board = new Board(1, { x: 0, y: 0 }, { x: 5, y: 0 }, 'x', 0.25);
            board.poi.start = 'pin';   // plywood horizontal end
            board.poi.end = 'slot';    // plywood vertical end

            // 2. Execute
            const length = board.getLength();

            // 3. Assert - geometric (5) + thickness (0.25), no adjustments for pin/slot
            expect(length).toBe(5.25);
        });

        test('should simulate acrylic behavior with etch-line and short ends', () => {
            // 1. Setup - typical acrylic board configuration
            const board = new Board(1, { x: 0, y: 0 }, { x: 8, y: 0 }, 'x', 0.375);
            board.poi.start = 'etch-line'; // acrylic horizontal end (no adjustment)
            board.poi.end = 'short';       // acrylic vertical end (subtract thickness)

            // 2. Execute
            const length = board.getLength();

            // 3. Assert - geometric (8) + thickness (0.375) - short end (0.375) = 8
            expect(length).toBe(8);
        });

        test('should handle acrylic vertical board with both short ends', () => {
            // 1. Setup - acrylic vertical board that terminates into horizontal boards
            const board = new Board(1, { x: 2, y: 1 }, { x: 2, y: 6 }, 'y', 0.375);
            board.poi.start = 'short'; // welded to horizontal board at bottom
            board.poi.end = 'short';   // welded to horizontal board at top

            // 2. Execute
            const length = board.getLength();

            // 3. Assert - geometric (5) + thickness (0.375) - start short (0.375) - end short (0.375) = 4.625
            expect(length).toBe(4.625);
        });
    });
});