// tests/Export.test.js

const Board = require('../js/core/Board');
const BoardExporter = require('../js/core/BoardExporter');
const MATERIAL_CONFIGS = require('../js/core/material-configs');

// Make minimal globals available (BoardExporter.js expects these)
global.Board = Board;
global.MATERIAL_CONFIGS = MATERIAL_CONFIGS;

describe('BoardExporter', () => {
    let mockCellular;
    let testConfig;
    let testSpacing;

    beforeEach(() => {
        // Create simple mock cellular data
        mockCellular = {
            getCellRenderLines: jest.fn().mockReturnValue(new Set([
                '0,0,0,2,1', // Horizontal line
                '0,2,2,2,1', // Vertical line  
                '2,0,2,2,1'  // Another horizontal line
            ]))
        };

        // Real config values for predictable testing
        testConfig = {
            caseDepth: 3,
            sheetThickness: 0.25,
            sheetWidth: 30,
            sheetHeight: 24,
            numSheets: 1,
            kerf: 0.1,
            numPinSlots: 2
        };

        testSpacing = {
            squareSize: 1,
            buffer: 0.5,
            xPadding: 1,
            yPadding: 1
        };
    });

    describe('Constructor', () => {
        test('should initialize with correct material configuration', () => {
            // 1. Setup & Execute - Use BoardExporter with config containing material type
            const exportInstance = new BoardExporter(mockCellular, testConfig, testSpacing);

            // 2. Assert - Should use default plywood material
            expect(exportInstance.materialType).toBe('plywood-laser');
            expect(exportInstance.materialConfig).toBe(MATERIAL_CONFIGS['plywood-laser']);
            expect(exportInstance.cellular).toBe(mockCellular);
            expect(exportInstance.caseDepth).toBe(testConfig.caseDepth);
            expect(exportInstance.sheetThickness).toBe(testConfig.sheetThickness);
        });

        test('should accept specified material type', () => {
            // 1. Setup & Execute - Pass material type in config object
            const configWithMaterial = { ...testConfig, materialType: 'acrylic-laser' };
            const exportInstance = new BoardExporter(mockCellular, configWithMaterial, testSpacing);

            // 2. Assert
            expect(exportInstance.materialType).toBe('acrylic-laser');
            expect(exportInstance.materialConfig).toBe(MATERIAL_CONFIGS['acrylic-laser']);
        });

        test('should handle unknown material type gracefully', () => {
            // 1. Setup - Mock console.error to suppress error output
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

            // 2. Execute - Pass unknown material type in config
            const configWithUnknown = { ...testConfig, materialType: 'unknown-material' };
            const exportInstance = new BoardExporter(mockCellular, configWithUnknown, testSpacing);

            // 3. Assert - Should fallback to plywood config but keep specified type name
            expect(exportInstance.materialType).toBe('unknown-material');
            expect(exportInstance.materialConfig).toBe(MATERIAL_CONFIGS['plywood-laser']);
            expect(consoleSpy).toHaveBeenCalled();

            // Cleanup
            consoleSpy.mockRestore();
        });
    });

    describe('makeBoards', () => {
        test('should convert cellular lines to Board objects', () => {
            // 1. Setup
            const exportInstance = new BoardExporter(mockCellular, testConfig, testSpacing);

            // 2. Execute
            exportInstance.makeBoards();

            // 3. Assert - Should create boards from cellular data
            expect(mockCellular.getCellRenderLines).toHaveBeenCalled();
            expect(exportInstance.boards.length).toBe(3); // Based on our 3 mock lines
            expect(exportInstance.boards[0]).toBeInstanceOf(Board);
            
            // Each board should have proper thickness from config
            exportInstance.boards.forEach(board => {
                expect(board.thickness).toBe(testConfig.sheetThickness);
            });
        });

        test('should sort boards by length in descending order', () => {
            // 1. Setup
            const exportInstance = new BoardExporter(mockCellular, testConfig, testSpacing);

            // 2. Execute  
            exportInstance.makeBoards();

            // 3. Assert - Boards should be sorted longest to shortest
            for (let i = 0; i < exportInstance.boards.length - 1; i++) {
                const currentLength = exportInstance.boards[i].getLength();
                const nextLength = exportInstance.boards[i + 1].getLength();
                expect(currentLength).toBeGreaterThanOrEqual(nextLength);
            }
        });
    });

    describe('assignBoardEndTypes', () => {
        test('should process all boards for end type assignment', () => {
            // 1. Setup
            const exportInstance = new BoardExporter(mockCellular, testConfig, testSpacing);
            const testBoard = new Board(1, { x: 0, y: 0 }, { x: 5, y: 0 }, 'x', 0.25);
            exportInstance.boards = [testBoard];
            
            // Spy on the material config method
            const assignSpy = jest.spyOn(exportInstance.materialConfig, 'assignBoardEnds');

            // 2. Execute
            exportInstance.assignBoardEndTypes();

            // 3. Assert - Should call material config for each board
            expect(assignSpy).toHaveBeenCalledWith(testBoard);
            expect(assignSpy).toHaveBeenCalledTimes(1);
            
            // Cleanup
            assignSpy.mockRestore();
        });
    });

    describe('prepJoints', () => {
        test('should generate cuts and etches for board joints', () => {
            // 1. Setup
            const exportInstance = new BoardExporter(mockCellular, testConfig, testSpacing);
            const testBoard = new Board(1, { x: 0, y: 0 }, { x: 5, y: 0 }, 'x', 0.25);
            const boardStartX = 5;
            const boardStartY = 10;
            
            // Spy on material config methods
            const cutsSpy = jest.spyOn(exportInstance.materialConfig, 'generateJointCuts');
            const etchesSpy = jest.spyOn(exportInstance.materialConfig, 'generateBoardEtches');

            // 2. Execute
            exportInstance.prepJoints(testBoard, boardStartX, boardStartY);

            // 3. Assert - Should call both cut and etch generation
            expect(cutsSpy).toHaveBeenCalledWith(
                testBoard,
                expect.objectContaining({
                    caseDepth: testConfig.caseDepth,
                    sheetThickness: testConfig.sheetThickness,
                    numPinSlots: testConfig.numPinSlots
                }),
                boardStartX,
                boardStartY,
                exportInstance.cutList
            );

            expect(etchesSpy).toHaveBeenCalledWith(
                testBoard,
                expect.objectContaining({
                    caseDepth: testConfig.caseDepth,
                    sheetThickness: testConfig.sheetThickness,
                    numPinSlots: testConfig.numPinSlots
                }),
                boardStartX,
                boardStartY,
                exportInstance.etchList
            );
            
            // Cleanup
            cutsSpy.mockRestore();
            etchesSpy.mockRestore();
        });
    });

    describe('setupSheets', () => {
        test('should calculate correct sheet layout based on configuration', () => {
            // 1. Setup
            const exportInstance = new BoardExporter(mockCellular, testConfig, testSpacing);

            // 2. Execute
            exportInstance.setupSheets();

            // 3. Assert - Should create sheets array with calculated rows
            expect(exportInstance.sheets).toHaveLength(testConfig.numSheets);
            expect(Array.isArray(exportInstance.sheets[0])).toBe(true);
            expect(exportInstance.totalHeight).toBe(testConfig.sheetHeight * testConfig.numSheets);
            
            // Row calculation should be based on case depth and spacing
            const expectedRows = Math.floor(testConfig.sheetHeight / (testConfig.caseDepth + (testSpacing.buffer * 1.25)));
            expect(exportInstance.sheets[0].length).toBe(expectedRows);
        });
    });

});