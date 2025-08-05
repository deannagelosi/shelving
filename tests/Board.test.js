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

        test('should calculate correct length including thickness', () => {
            // 1. Setup
            const firstCoord = { x: 0, y: 0 };
            const secondCoord = { x: 5, y: 0 };
            const thickness = 0.23;

            // 2. Execute
            const board = new Board(1, firstCoord, secondCoord, 'x', thickness);

            // 3. Assert
            expect(board.len).toBe(5 + 0.23); // getLength() + thickness
        });
    });

    describe('getLength', () => {
        test('should calculate horizontal board length correctly', () => {
            // 1. Setup
            const firstCoord = { x: 2, y: 5 };
            const secondCoord = { x: 10, y: 5 };
            const board = new Board(1, firstCoord, secondCoord, 'x', 0);

            // 2. Execute
            const length = board.getLength();

            // 3. Assert
            expect(length).toBe(8); // 10 - 2 = 8
        });

        test('should calculate vertical board length correctly', () => {
            // 1. Setup
            const firstCoord = { x: 3, y: 1 };
            const secondCoord = { x: 3, y: 7 };
            const board = new Board(1, firstCoord, secondCoord, 'y', 0);

            // 2. Execute
            const length = board.getLength();

            // 3. Assert
            expect(length).toBe(6); // 7 - 1 = 6
        });

        test('should return null and log error for invalid board coordinates', () => {
            // 1. Setup
            const firstCoord = { x: 2, y: 5 };
            const secondCoord = { x: 10, y: 7 }; // Different x AND y - invalid
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

            const board = new Board(1, firstCoord, secondCoord, 'x', 0);

            // 2. Execute
            const length = board.getLength();

            // 3. Assert
            expect(length).toBeNull();
            expect(consoleSpy).toHaveBeenCalledWith("Board length error. start: ", board.coords.start, "end: ", board.coords.end);

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

            // 2. Execute - this will cause errors due to invalid orientation
            expect(() => {
                new Board(1, firstCoord, secondCoord, 'invalid', 0);
            }).toThrow(); // Board constructor will fail when getLength() tries to access undefined coords

            // 3. Assert
            expect(consoleSpy).toHaveBeenCalledWith("Board missing orientation. start: ", firstCoord, "end: ", secondCoord, "orientation: ", 'invalid');

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
});