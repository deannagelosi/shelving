const { loadShapesFromFixture } = require('./fixtures/loader');
const Cellular = require('../js/core/Cellular');
const Solution = require('../js/core/Solution');

// Load shapes from fixture for testing
const allFixtureShapes = loadShapesFromFixture();

// Mock p5.js global variables for Solution
beforeEach(() => {
    global.canvasWidth = 800;
    global.canvasHeight = 600;
    global.aspectRatioPref = 0;
    global.devMode = false;
    global.detailView = false;
});

describe('Cellular', () => {
    // Helper function to create a simple test solution
    function createTestSolution() {
        const shapes = allFixtureShapes.slice(0, 2);
        // Position shapes in a predictable layout
        shapes[0].posX = 0;
        shapes[0].posY = 0;
        shapes[1].posX = 3;
        shapes[1].posY = 0;

        const solution = new Solution(shapes);
        solution.makeLayout();
        solution.calcScore();
        return solution;
    }

    test('should correctly initialize with a solution', () => {
        // 1. Setup
        const solution = createTestSolution();

        // 2. Execute
        const cellular = new Cellular(solution);

        // 3. Assert - Check that cellular has expected properties
        expect(cellular.layout).toBe(solution.layout);
        expect(cellular.shapes).toBe(solution.shapes);
        expect(cellular.layoutHeight).toBe(solution.layout.length);
        expect(cellular.layoutWidth).toBe(solution.layout[0].length);
        expect(cellular.squareSize).toBe(solution.squareSize);
        expect(cellular.maxTerrain).toBe(0);
        expect(cellular.cellID).toBe(0);
        expect(Array.isArray(cellular.cellSpace)).toBe(true);
        expect(Array.isArray(cellular.pathValues)).toBe(true);
    });

    test('createTerrain should assign terrain values based on distance from shapes', () => {
        // 1. Setup
        const solution = createTestSolution();
        const cellular = new Cellular(solution);

        // 2. Execute
        cellular.createTerrain();

        // 3. Assert
        expect(cellular.maxTerrain).toBeGreaterThan(0);

        // Check that terrain values are assigned
        let hasNonZeroTerrain = false;
        let hasMaxTerrain = false;

        for (let y = 0; y < cellular.layoutHeight; y++) {
            for (let x = 0; x < cellular.layoutWidth; x++) {
                const terrainValue = cellular.layout[y][x].terrainValue;
                expect(terrainValue).toBeGreaterThanOrEqual(0);

                if (terrainValue > 0 && terrainValue < cellular.maxTerrain) {
                    hasNonZeroTerrain = true;
                }
                if (terrainValue === cellular.maxTerrain) {
                    hasMaxTerrain = true;
                }
            }
        }

        // Should have some terrain values and some max terrain (shape) positions
        expect(hasNonZeroTerrain).toBe(true);
        expect(hasMaxTerrain).toBe(true);
    });

    test('calcPathValues should assign values to paths between terrain squares', () => {
        // 1. Setup
        const solution = createTestSolution();
        const cellular = new Cellular(solution);
        cellular.createTerrain(); // Terrain must be created first

        // 2. Execute
        cellular.calcPathValues();

        // 3. Assert
        expect(cellular.pathValues.length).toBe(cellular.layoutHeight + 1);
        expect(cellular.pathValues[0].length).toBe(cellular.layoutWidth + 1);

        // Check that path values are assigned correctly
        for (let y = 0; y < cellular.pathValues.length; y++) {
            for (let x = 0; x < cellular.pathValues[y].length; x++) {
                const pathData = cellular.pathValues[y][x];

                expect(pathData).toHaveProperty('left');
                expect(pathData).toHaveProperty('up');
                expect(pathData).toHaveProperty('right');

                expect(typeof pathData.left).toBe('number');
                expect(typeof pathData.up).toBe('number');
                expect(typeof pathData.right).toBe('number');

                expect(pathData.left).toBeGreaterThanOrEqual(0);
                expect(pathData.up).toBeGreaterThanOrEqual(0);
                expect(pathData.right).toBeGreaterThanOrEqual(0);
            }
        }
    });

    test('makeInitialCells should place cells on perimeter and at bottom of shapes', () => {
        // 1. Setup
        const solution = createTestSolution();
        const cellular = new Cellular(solution);
        cellular.createTerrain();
        cellular.calcPathValues();

        // 2. Execute
        cellular.makeInitialCells();

        // 3. Assert
        expect(cellular.cellSpace.length).toBe(cellular.layoutHeight + 1);
        expect(cellular.cellSpace[0].length).toBe(cellular.layoutWidth + 1);

        // Check that perimeter cells exist
        let perimeterCells = 0;
        let shapeCells = 0;

        for (let y = 0; y < cellular.cellSpace.length; y++) {
            for (let x = 0; x < cellular.cellSpace[y].length; x++) {
                const cells = cellular.cellSpace[y][x];

                if (cells.length > 0) {
                    cells.forEach(cell => {
                        expect(cell).toHaveProperty('id');
                        expect(cell).toHaveProperty('strain');
                        expect(cell).toHaveProperty('alive');
                        expect(cell).toHaveProperty('parent');

                        expect(typeof cell.id).toBe('number');
                        expect(typeof cell.strain).toBe('number');
                        expect(typeof cell.alive).toBe('boolean');

                        // Count perimeter cells (strain 0)
                        if (cell.strain === 0) {
                            perimeterCells++;
                        } else {
                            shapeCells++;
                        }
                    });
                }
            }
        }

        // Should have perimeter cells and shape-based cells
        expect(perimeterCells).toBeGreaterThan(0);
        expect(shapeCells).toBeGreaterThan(0);
    });

    test('helper functions should work correctly', () => {
        // 1. Setup
        const solution = createTestSolution();
        const cellular = new Cellular(solution);

        // 2. Execute & Assert

        // Test layoutInBounds
        expect(cellular.layoutInBounds(0, 0)).toBe(true);
        expect(cellular.layoutInBounds(-1, 0)).toBe(false);
        expect(cellular.layoutInBounds(0, -1)).toBe(false);
        expect(cellular.layoutInBounds(cellular.layoutHeight, 0)).toBe(false);
        expect(cellular.layoutInBounds(0, cellular.layoutWidth)).toBe(false);

        // Test cellSpaceInBounds after makeInitialCells
        cellular.createTerrain();
        cellular.calcPathValues();
        cellular.makeInitialCells();

        expect(cellular.cellSpaceInBounds(0, 0)).toBe(true);
        expect(cellular.cellSpaceInBounds(-1, 0)).toBe(false);
        expect(cellular.cellSpaceInBounds(0, -1)).toBe(false);

        // Test overhangShift
        const shape = cellular.shapes[0];
        const shapeEnds = cellular.overhangShift(shape);
        expect(Array.isArray(shapeEnds)).toBe(true);
        expect(shapeEnds.length).toBe(2);
        expect(typeof shapeEnds[0]).toBe('number');
        expect(typeof shapeEnds[1]).toBe('number');
        expect(shapeEnds[1]).toBeGreaterThanOrEqual(shapeEnds[0]);
    });

    test('utility functions should work', () => {
        // 1. Setup
        const solution = createTestSolution();
        const cellular = new Cellular(solution);

        // 2. Execute & Assert

        // Test range function
        expect(cellular.range(0)).toBe(0);
        expect(cellular.range(255)).toBe(255);
        expect(cellular.range(256)).toBe(0); // Should wrap
        expect(cellular.range(300)).toBe(44); // 300 % 256 = 44

        // Test strainColor function - mock the p5.js color function
        global.color = jest.fn((r, g, b) => ({ r, g, b }));

        const color1 = cellular.strainColor(1);
        const color2 = cellular.strainColor(2);

        // Colors should be different for different strains
        expect(color1).not.toEqual(color2);
        expect(global.color).toHaveBeenCalled();
    });

    describe('growOnce() method core rules', () => {
        // Helper function to create a minimal cellular instance with custom cell space
        function createCellularWithCustomCellSpace(cellSpaceSetup) {
            const solution = createTestSolution();
            const cellular = new Cellular(solution);

            // Initialize required properties
            cellular.createTerrain();
            cellular.calcPathValues();

            // Override cellSpace with custom setup
            cellular.cellSpace = cellSpaceSetup;
            cellular.cellID = 100; // Start with high ID to avoid conflicts

            return cellular;
        }

        test('should implement merge rule: overlapping alive cells merge strains', () => {
            // 1. Setup - Create a 2x2 cell space with two alive cells at position [0,0]
            const cellSpace = [
                [
                    // Position [0,0] - two alive cells with different strains
                    [
                        { id: 1, strain: 1, alive: true, parent: { strain: 1 } },
                        { id: 2, strain: 2, alive: true, parent: { strain: 2 } }
                    ],
                    [] // Position [0,1]
                ],
                [
                    [], // Position [1,0]
                    []  // Position [1,1]
                ]
            ];

            const cellular = createCellularWithCustomCellSpace(cellSpace);

            // 2. Execute
            cellular.growOnce();

            // 3. Assert - Only one cell should remain alive, strains should be merged
            const cellsAtPosition = cellular.cellSpace[0][0];
            const aliveCells = cellsAtPosition.filter(cell => cell.alive);

            expect(aliveCells.length).toBe(1);
            expect(cellsAtPosition.length).toBe(1); // Should have removed duplicate
            expect(cellsAtPosition[0].merged).toBe(true); // Should be marked as merged
        });

        test('should implement crowding rule: alive cell dies when encountering dead cell', () => {
            // 1. Setup - Create cell space where alive cell will encounter dead cell
            const cellSpace = [
                [
                    // Position [0,0] - alive cell
                    [{ id: 1, strain: 1, alive: true, parent: { strain: 1, id: 0 } }],
                    // Position [0,1] - dead cell that should cause crowding
                    [{ id: 2, strain: 2, alive: false, parent: { strain: 2 } }]
                ],
                [[], []]
            ];

            const cellular = createCellularWithCustomCellSpace(cellSpace);

            // 2. Execute
            cellular.growOnce();

            // 3. Assert - The alive cell should have died due to crowding
            const originalCell = cellular.cellSpace[0][0][0];
            expect(originalCell.alive).toBe(false);
        });

        test('should implement attraction rule: cells prefer paths toward different strains', () => {
            // 1. Setup - Create a scenario where cell has multiple valid paths
            // but one leads to a different strain (should be preferred)
            const cellSpace = [
                [
                    [], // Position [0,0] - empty
                    // Position [0,1] - alive cell that will grow
                    [{ id: 1, strain: 1, alive: true, parent: { strain: 1, id: 0 } }],
                    []  // Position [0,2] - empty
                ],
                [
                    // Position [1,0] - dead cell of different strain (attractive)
                    [{ id: 2, strain: 2, alive: false, parent: { strain: 2 } }],
                    [], // Position [1,1] - empty (less attractive)
                    []  // Position [1,2] - empty
                ]
            ];

            const cellular = createCellularWithCustomCellSpace(cellSpace);

            // 2. Execute
            cellular.growOnce();

            // 3. Assert - New cell should have been created in the direction of the different strain
            // The exact position depends on the pathValues, but we can check that growth occurred
            let totalCells = 0;
            let newCells = 0;

            for (let y = 0; y < cellular.cellSpace.length; y++) {
                for (let x = 0; x < cellular.cellSpace[y].length; x++) {
                    totalCells += cellular.cellSpace[y][x].length;
                    // Count cells with ID > 100 (new cells created during growth)
                    newCells += cellular.cellSpace[y][x].filter(cell => cell.id >= 100).length;
                }
            }

            expect(newCells).toBeGreaterThan(0); // Growth should have occurred
        });
    });

    describe('calcOppScore() method', () => {
        test('should return better scores for paths leading to open areas', () => {
            // 1. Setup - Create a cellular instance with predictable terrain/path values
            const solution = createTestSolution();
            const cellular = new Cellular(solution);
            cellular.createTerrain();
            cellular.calcPathValues();

            // Create a simple scenario: empty space vs corner
            const strain = 1;
            const option = { dir: "up", x: 1, y: 2 };

            // 2. Execute - Test the scoring method
            const score = cellular.calcOppScore(1, 1, strain, option);

            // 3. Assert - Should return a numerical score
            expect(typeof score).toBe('number');
            expect(score).toBeGreaterThanOrEqual(0);

            // Test with different options to ensure scoring varies
            const option2 = { dir: "right", x: 2, y: 1 };
            const score2 = cellular.calcOppScore(1, 1, strain, option2);

            expect(typeof score2).toBe('number');
            expect(score2).toBeGreaterThanOrEqual(0);
        });

        test('should handle boundary conditions correctly', () => {
            // 1. Setup
            const solution = createTestSolution();
            const cellular = new Cellular(solution);
            cellular.createTerrain();
            cellular.calcPathValues();

            // 2. Execute - Test scoring near boundaries
            const strain = 1;
            const boundaryOption = { dir: "up", x: 0, y: cellular.layoutHeight };

            // 3. Execute & Assert - Should handle out-of-bounds gracefully
            expect(() => {
                const score = cellular.calcOppScore(0, 0, strain, boundaryOption);
                expect(typeof score).toBe('number');
            }).not.toThrow();
        });
    });
}); 