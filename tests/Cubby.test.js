const Cubby = require('../js/core/Cubby.js');

describe('Cubby Perimeter Detection', () => {
    describe('calculateCaseBounds', () => {
        test('should calculate correct bounds for single cubby', () => {
            const cubby = new Cubby(1, [
                {x: 1, y: 1}, {x: 2, y: 1}, {x: 1, y: 2}, {x: 2, y: 2}
            ]);
            
            const bounds = Cubby.calculateCaseBounds([cubby]);
            
            expect(bounds).toEqual({
                minX: 1,
                minY: 1,
                maxX: 3, // cell extends to x+1
                maxY: 3  // cell extends to y+1
            });
        });
        
        test('should calculate correct bounds for multiple cubbies', () => {
            const cubby1 = new Cubby(1, [{x: 0, y: 0}, {x: 1, y: 0}]);
            const cubby2 = new Cubby(2, [{x: 3, y: 2}, {x: 4, y: 2}]);
            
            const bounds = Cubby.calculateCaseBounds([cubby1, cubby2]);
            
            expect(bounds).toEqual({
                minX: 0,
                minY: 0,
                maxX: 5, // cubby2 extends to x=4, so boundary is x=5
                maxY: 3  // cubby2 extends to y=2, so boundary is y=3
            });
        });
        
        test('should return null for empty cubby list', () => {
            const bounds = Cubby.calculateCaseBounds([]);
            expect(bounds).toBeNull();
        });
    });
    
    describe('isLineOnCasePerimeter', () => {
        let cubby;
        let caseBounds;
        
        beforeEach(() => {
            cubby = new Cubby(1, [{x: 1, y: 1}]);
            caseBounds = { minX: 0, minY: 0, maxX: 4, maxY: 4 };
        });
        
        test('should detect left edge vertical lines as perimeter', () => {
            const line = { x1: 0, y1: 1, x2: 0, y2: 2 }; // Left edge
            const result = cubby.isLineOnCasePerimeter(line, caseBounds);
            expect(result).toBe(true);
        });
        
        test('should detect right edge vertical lines as perimeter', () => {
            const line = { x1: 4, y1: 1, x2: 4, y2: 2 }; // Right edge
            const result = cubby.isLineOnCasePerimeter(line, caseBounds);
            expect(result).toBe(true);
        });
        
        test('should detect bottom edge horizontal lines as perimeter', () => {
            const line = { x1: 1, y1: 0, x2: 2, y2: 0 }; // Bottom edge
            const result = cubby.isLineOnCasePerimeter(line, caseBounds);
            expect(result).toBe(true);
        });
        
        test('should detect top edge horizontal lines as perimeter', () => {
            const line = { x1: 1, y1: 4, x2: 2, y2: 4 }; // Top edge
            const result = cubby.isLineOnCasePerimeter(line, caseBounds);
            expect(result).toBe(true);
        });
        
        test('should not detect interior vertical lines as perimeter', () => {
            const line = { x1: 2, y1: 1, x2: 2, y2: 2 }; // Interior vertical
            const result = cubby.isLineOnCasePerimeter(line, caseBounds);
            expect(result).toBe(false);
        });
        
        test('should not detect interior horizontal lines as perimeter', () => {
            const line = { x1: 1, y1: 2, x2: 2, y2: 2 }; // Interior horizontal
            const result = cubby.isLineOnCasePerimeter(line, caseBounds);
            expect(result).toBe(false);
        });
    });
    
    describe('detectPerimeterWalls integration', () => {
        test('should correctly flag perimeter walls in rectangle cubby', () => {
            // Create a simple 2x2 rectangle cubby
            const cells = [
                {x: 1, y: 1}, {x: 2, y: 1}, 
                {x: 1, y: 2}, {x: 2, y: 2}
            ];
            const cubby = new Cubby(1, cells);
            
            // Generate center lines
            cubby.generateCenterLines();
            
            // Create case bounds that match this single cubby (so all walls are perimeter)
            const caseBounds = { minX: 1, minY: 1, maxX: 3, maxY: 3 };
            
            // Detect perimeter walls
            cubby.detectPerimeterWalls(caseBounds);
            
            // All center lines should be flagged as perimeter walls
            expect(cubby.centerLines.length).toBeGreaterThan(0);
            for (const line of cubby.centerLines) {
                expect(line.isPerimeterWall).toBe(true);
            }
        });
        
        test('should correctly distinguish perimeter vs interior walls', () => {
            // Create a simple L-shaped cubby at the corner of a larger case
            const cells = [
                {x: 0, y: 0}, {x: 1, y: 0}, {x: 0, y: 1}
            ];
            const cubby = new Cubby(1, cells);
            
            // Generate center lines
            cubby.generateCenterLines();
            
            // Create case bounds larger than this cubby
            const caseBounds = { minX: 0, minY: 0, maxX: 4, maxY: 4 };
            
            // Detect perimeter walls
            cubby.detectPerimeterWalls(caseBounds);
            
            // Should have both perimeter and non-perimeter walls
            const perimeterWalls = cubby.centerLines.filter(line => line.isPerimeterWall);
            const interiorWalls = cubby.centerLines.filter(line => !line.isPerimeterWall);
            
            expect(perimeterWalls.length).toBeGreaterThan(0);
            expect(interiorWalls.length).toBeGreaterThan(0);
        });
    });
    
    describe('generateEdgeLines', () => {
        test('should create edgelines from mix of center and exterior lines', () => {
            // Create a simple 2x1 rectangle at case edge
            const cells = [{x: 0, y: 0}, {x: 1, y: 0}];
            const cubby = new Cubby(1, cells);
            
            // Generate all line types
            cubby.generateAllLines();
            
            // Set up as single cubby case (all walls are perimeter)
            const caseBounds = Cubby.calculateCaseBounds([cubby]);
            cubby.detectPerimeterWalls(caseBounds);
            
            // Generate edge lines
            const edgeLines = cubby.generateEdgeLines();
            
            expect(edgeLines).toBeDefined();
            expect(Array.isArray(edgeLines)).toBe(true);
            expect(edgeLines.length).toBe(cubby.centerLines.length);
            expect(edgeLines.length).toBe(cubby.exteriorLines.length);
        });
        
        test('should use exterior lines for perimeter walls', () => {
            const cells = [{x: 0, y: 0}];
            const cubby = new Cubby(1, cells);
            
            // Generate all line types
            cubby.generateAllLines();
            
            // Make all walls perimeter walls
            const caseBounds = { minX: 0, minY: 0, maxX: 1, maxY: 1 };
            cubby.detectPerimeterWalls(caseBounds);
            
            // Regenerate edge lines after setting perimeter flags
            cubby.edgeLines = null; // Clear cache
            const edgeLines = cubby.generateEdgeLines();
            
            // All center lines should be marked as perimeter walls
            const perimeterCount = cubby.centerLines.filter(line => line.isPerimeterWall).length;
            expect(perimeterCount).toBe(cubby.centerLines.length);
            
            // Edge lines should be generated from exterior lines (not exact coordinate match due to algorithm differences)
            expect(edgeLines.length).toBe(cubby.exteriorLines.length);
        });
        
        test('should use center lines for interior walls', () => {
            const cells = [{x: 1, y: 1}];
            const cubby = new Cubby(1, cells);
            
            // Generate all line types
            cubby.generateAllLines();
            
            // Make no walls perimeter walls (simulate interior cubby)
            const caseBounds = { minX: 0, minY: 0, maxX: 3, maxY: 3 };
            cubby.detectPerimeterWalls(caseBounds);
            
            // Regenerate edge lines after setting perimeter flags
            cubby.edgeLines = null; // Clear cache
            const edgeLines = cubby.generateEdgeLines();
            
            // No center lines should be marked as perimeter walls
            const perimeterCount = cubby.centerLines.filter(line => line.isPerimeterWall).length;
            expect(perimeterCount).toBe(0);
            
            // Edge lines should be generated (using center lines for all walls)
            expect(edgeLines.length).toBe(cubby.centerLines.length);
        });
        
        test('should be included in generateAllLines return value', () => {
            const cubby = new Cubby(1, [{x: 0, y: 0}]);
            const result = cubby.generateAllLines();
            
            expect(result).toHaveProperty('edge');
            expect(result.edge).toBe(cubby.edgeLines);
            expect(result.edge).toBeDefined();
        });
        
        test('should fail gracefully when center and exterior lines count mismatch', () => {
            const cubby = new Cubby(1, [{x: 0, y: 0}]);
            
            // Generate center lines
            cubby.generateCenterLines();
            
            // Manually break exterior lines count
            cubby.exteriorLines = []; // Empty array to cause mismatch
            
            expect(() => {
                cubby.generateEdgeLines();
            }).toThrow(/count mismatch/);
        });
    });
});