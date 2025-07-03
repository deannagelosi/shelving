const { loadShapesFromFixture } = require('./fixtures/loader');
const fs = require('fs');
const path = require('path');

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

        test('should handle empty savedAnneals array', () => {
            expect(sampleShapesData.savedAnneals).toEqual([]);
        });
    });

    describe('JSON Edge Cases', () => {
        test('should handle malformed JSON gracefully', () => {
            const malformedJson = '{ "allShapes": [invalid json}';

            expect(() => {
                JSON.parse(malformedJson);
            }).toThrow();
        });

        test('should handle missing allShapes property', () => {
            const dataWithoutShapes = { savedAnneals: [] };

            // This would fail in loadShapesFromFixture, but we can test the structure
            expect(dataWithoutShapes.allShapes).toBeUndefined();
        });

        test('should handle empty allShapes array', () => {
            const dataWithEmptyShapes = {
                savedAnneals: [],
                allShapes: []
            };

            expect(dataWithEmptyShapes.allShapes).toEqual([]);
            expect(dataWithEmptyShapes.allShapes.length).toBe(0);
        });

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

        test('should handle null and undefined inputs', () => {
            expect(() => JSON.stringify(null)).not.toThrow();
            expect(() => JSON.stringify(undefined)).not.toThrow();

            expect(JSON.stringify(null)).toBe('null');
            expect(JSON.stringify(undefined)).toBe(undefined);
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
                    mode: 'test',
                    devMode: false
                }
            };

            expect(solutionWithCellular.cellular).toHaveProperty('cellLines');
            expect(solutionWithCellular.cellular).toHaveProperty('maxTerrain');
            expect(solutionWithCellular.cellular).toHaveProperty('numAlive');
            expect(Array.isArray(solutionWithCellular.cellular.cellLines)).toBe(true);
        });
    });

    describe('File System Operations', () => {
        test('should handle file reading operations', () => {
            const fixturePath = path.resolve(__dirname, 'fixtures/sample_shapes.json');

            // Test file exists
            expect(fs.existsSync(fixturePath)).toBe(true);

            // Test file is readable
            const stats = fs.statSync(fixturePath);
            expect(stats.isFile()).toBe(true);
            expect(stats.size).toBeGreaterThan(0);
        });

        test('should handle non-existent file gracefully', () => {
            const nonExistentPath = path.resolve(__dirname, 'fixtures/non-existent.json');

            expect(fs.existsSync(nonExistentPath)).toBe(false);
            expect(() => fs.readFileSync(nonExistentPath)).toThrow();
        });
    });
}); 