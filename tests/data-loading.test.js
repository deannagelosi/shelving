const { loadShapesFromFixture } = require('./fixtures/loader');
const Shape = require('../js/core/Shape');
const Solution = require('../js/core/Solution');
const fs = require('fs');
const path = require('path');

// Make classes globally available for environment compatibility (like worker does)
global.Shape = Shape;
global.Solution = Solution;

describe('Data Loading & Export Tests', () => {
    let sampleShapesData;

    beforeAll(() => {
        // Load sample data for testing
        const fixturePath = path.resolve(__dirname, 'fixtures/sample_shapes.json');
        const fileContents = fs.readFileSync(fixturePath, 'utf8');
        sampleShapesData = JSON.parse(fileContents);
    });

    describe('loadShapesFromFixture function', () => {
        test('should load shapes from fixture file successfully', () => {
            const shapes = loadShapesFromFixture();

            expect(Array.isArray(shapes)).toBe(true);
            expect(shapes.length).toBeGreaterThan(0);

            // Each shape should be a proper Shape object
            shapes.forEach(shape => {
                expect(shape.data).toBeTruthy();
                expect(shape.data.title).toBeTruthy();
                expect(Array.isArray(shape.data.highResShape)).toBe(true);
                expect(shape.data.highResShape.length).toBeGreaterThan(0);
            });
        });

        test('should handle shapes with various titles', () => {
            const shapes = loadShapesFromFixture();

            // Should have shapes with different titles
            const titles = shapes.map(shape => shape.data.title);
            const uniqueTitles = [...new Set(titles)];

            expect(uniqueTitles.length).toBeGreaterThan(1);
            expect(titles).toContain('Burt'); // Known shape from fixtures
        });
    });

    describe('Export Format Validation', () => {
        test('sample_shapes.json should match expected export format', () => {
            // Test root structure
            expect(sampleShapesData).toHaveProperty('savedAnneals');
            expect(sampleShapesData).toHaveProperty('allShapes');
            expect(Array.isArray(sampleShapesData.savedAnneals)).toBe(true);
            expect(Array.isArray(sampleShapesData.allShapes)).toBe(true);
        });

        test('allShapes should have correct shape object structure', () => {
            const shapes = sampleShapesData.allShapes;
            expect(shapes.length).toBeGreaterThan(0);

            shapes.forEach(shape => {
                // Test shape object structure
                expect(shape).toHaveProperty('data');
                expect(shape.data).toHaveProperty('highResShape');
                expect(shape.data).toHaveProperty('title');

                // Test data types
                expect(Array.isArray(shape.data.highResShape)).toBe(true);
                expect(typeof shape.data.title).toBe('string');

                // Test grid structure
                expect(shape.data.highResShape.length).toBeGreaterThan(0);
                shape.data.highResShape.forEach(row => {
                    expect(Array.isArray(row)).toBe(true);
                    row.forEach(cell => {
                        expect(typeof cell).toBe('boolean');
                    });
                });
            });
        });


    });

    describe('JSON Edge Cases', () => {






        test('should handle shapes with empty highResShape', () => {
            const shapeWithEmptyGrid = {
                data: {
                    title: 'Empty Shape',
                    highResShape: []
                }
            };

            expect(shapeWithEmptyGrid.data.highResShape).toEqual([]);
            expect(shapeWithEmptyGrid.data.highResShape.length).toBe(0);
        });

        test('should handle shapes with missing title', () => {
            const shapeWithoutTitle = {
                data: {
                    highResShape: [[true, false], [false, true]]
                }
            };

            expect(shapeWithoutTitle.data.title).toBeUndefined();
        });


    });

    describe('Data Consistency Validation', () => {
        test('should validate grid dimensions are consistent', () => {
            const shapes = sampleShapesData.allShapes;

            shapes.forEach(shape => {
                const grid = shape.data.highResShape;
                if (grid.length > 0) {
                    const firstRowLength = grid[0].length;

                    // All rows should have same length
                    grid.forEach((row, index) => {
                        expect(row.length).toBe(firstRowLength);
                    });
                }
            });
        });

        test('should validate boolean values in grid', () => {
            const shapes = sampleShapesData.allShapes.slice(0, 3); // Test first 3 for speed

            shapes.forEach(shape => {
                const grid = shape.data.highResShape;

                grid.forEach(row => {
                    row.forEach(cell => {
                        expect(typeof cell).toBe('boolean');
                        expect(cell === true || cell === false).toBe(true);
                    });
                });
            });
        });

        test('should validate shapes have content (not all false)', () => {
            const shapes = sampleShapesData.allShapes.slice(0, 3);

            shapes.forEach(shape => {
                const grid = shape.data.highResShape;
                let hasContent = false;

                grid.forEach(row => {
                    row.forEach(cell => {
                        if (cell === true) {
                            hasContent = true;
                        }
                    });
                });

                expect(hasContent).toBe(true);
            });
        });
    });

    describe('Export Format Compatibility', () => {
        test('should create export-compatible structure', () => {
            // Test creating an export structure manually
            const exportData = {
                savedAnneals: [
                    {
                        title: 'solution-1',
                        finalSolution: {
                            shapes: sampleShapesData.allShapes.slice(0, 2).map(shape => ({
                                ...shape,
                                posX: 10,
                                posY: 20
                            })),
                            score: 150.5,
                            valid: true,
                            buffer: 10,
                            yPadding: 15,
                            xPadding: 15
                        }
                    }
                ],
                allShapes: sampleShapesData.allShapes.slice(0, 2)
            };

            // Should match expected format
            expect(exportData).toHaveProperty('savedAnneals');
            expect(exportData).toHaveProperty('allShapes');
            expect(exportData.savedAnneals[0]).toHaveProperty('title');
            expect(exportData.savedAnneals[0]).toHaveProperty('finalSolution');
            expect(exportData.savedAnneals[0].finalSolution).toHaveProperty('score');
            expect(exportData.savedAnneals[0].finalSolution).toHaveProperty('valid');
        });

        test('should handle solution with cellular data', () => {
            const solutionWithCellular = {
                finalSolution: {
                    shapes: [],
                    score: 100,
                    valid: true
                },
                cellular: {
                    cellLines: [[0, 0, 10, 10], [5, 5, 15, 15]],
                    maxTerrain: 25,
                    numAlive: 42
                },
                metadata: {
                    timestamp: Date.now(),
                    mode: 'test'
                }
            };

            expect(solutionWithCellular.cellular).toHaveProperty('cellLines');
            expect(solutionWithCellular.cellular).toHaveProperty('maxTerrain');
            expect(solutionWithCellular.cellular).toHaveProperty('numAlive');
            expect(Array.isArray(solutionWithCellular.cellular.cellLines)).toBe(true);
        });
    });

    describe('Unified Data Methods', () => {
        describe('Shape.fromDataObject()', () => {
            test('should create Shape instance from valid data', () => {
                const shapeData = sampleShapesData.allShapes[0];
                const shape = Shape.fromDataObject(shapeData);

                expect(shape).toBeInstanceOf(Shape);
                expect(shape.data.title).toBe(shapeData.data.title);
                expect(shape.data.highResShape).toEqual(shapeData.data.highResShape);
            });

            test('should handle position and enabled properties', () => {
                const shapeData = {
                    data: { title: 'Test', highResShape: [[true]] },
                    posX: 5,
                    posY: 10,
                    enabled: false
                };
                const shape = Shape.fromDataObject(shapeData);

                expect(shape.posX).toBe(5);
                expect(shape.posY).toBe(10);
                expect(shape.enabled).toBe(false);
            });
        });

        describe('Shape.toDataObject()', () => {
            test('should export Shape to plain object', () => {
                const shape = new Shape();
                shape.saveUserInput('Test Shape', [[true, false], [false, true]]);
                shape.posX = 3;
                shape.posY = 7;
                shape.enabled = false;

                const exported = shape.toDataObject();

                expect(exported.data.title).toBe('Test Shape');
                // Shape.saveUserInput automatically pads to be divisible by 4
                expect(Array.isArray(exported.data.highResShape)).toBe(true);
                expect(exported.data.highResShape.length).toBeGreaterThan(0);
                expect(exported.posX).toBe(3);
                expect(exported.posY).toBe(7);
                expect(exported.enabled).toBe(false);
            });
        });

        describe('Solution.fromDataObject()', () => {
            test('should create Solution and recalculate layout when missing', () => {
                const testData = {
                    shapes: [sampleShapesData.allShapes[0]],
                    startID: 0,
                    aspectRatioPref: 0
                    // No layout, score, or valid - simulating imported data
                };

                const solution = Solution.fromDataObject(testData);

                expect(solution).toBeInstanceOf(Solution);
                expect(Array.isArray(solution.layout)).toBe(true);
                expect(typeof solution.score).toBe('number');
                expect(typeof solution.valid).toBe('boolean');
            });

            test('should use existing layout when provided', () => {
                const mockLayout = [[[]]];
                const testData = {
                    shapes: [sampleShapesData.allShapes[0]],
                    startID: 0,
                    aspectRatioPref: 0,
                    layout: mockLayout,
                    score: 100,
                    valid: true
                };

                const solution = Solution.fromDataObject(testData);

                expect(solution.layout).toBe(mockLayout);
                expect(solution.score).toBe(100);
                expect(solution.valid).toBe(true);
            });
        });

        describe('Solution.toDataObject()', () => {
            test('should export Solution without layout', () => {
                const shapes = [Shape.fromDataObject(sampleShapesData.allShapes[0])];
                const solution = new Solution(shapes, 0, 1);
                solution.makeLayout();
                solution.calcScore();

                const exported = solution.toDataObject();

                expect(exported.shapes).toHaveLength(1);
                expect(exported.startID).toBe(0);
                expect(exported.aspectRatioPref).toBe(1);
                expect(typeof exported.score).toBe('number');
                expect(typeof exported.valid).toBe('boolean');
                expect(exported.layout).toBeUndefined(); // Should not include layout
            });
        });
    });


}); 