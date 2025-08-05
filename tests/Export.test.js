// tests/Export.test.js

const Board = require('../js/core/Board');

// Make Board available globally (Export.js expects it as global)
global.Board = Board;

// Import the real MATERIAL_CONFIGS and create mocks for functions
const MATERIAL_CONFIGS = require('../js/core/material-configs');

// Create a shallow copy to preserve functions, then mock specific functions for testing
const mockMaterialConfigs = {
    'plywood-laser': {
        ...MATERIAL_CONFIGS['plywood-laser'],
        generateJointCuts: jest.fn(),
        generateBoardEtches: jest.fn()
    },
    'acrylic-laser': {
        ...MATERIAL_CONFIGS['acrylic-laser']
    }
};

// Make MATERIAL_CONFIGS available globally
global.MATERIAL_CONFIGS = mockMaterialConfigs;

// Mock DXFWriter
const mockDXFWriter = {
    setUnits: jest.fn(),
    addLayer: jest.fn(),
    setActiveLayer: jest.fn(),
    drawRect: jest.fn(),
    drawText: jest.fn(),
    toDxfString: jest.fn().mockReturnValue('MOCK_DXF_OUTPUT'),
    ACI: {
        GREEN: 3,
        RED: 1,
        BLUE: 5,
        WHITE: 7
    }
};

global.DXFWriter = jest.fn(() => mockDXFWriter);
global.DXFWriter.ACI = mockDXFWriter.ACI;

// Import Export after setting up mocks
const Export = require('../js/core/Export');

describe('Export', () => {
    let mockCellular;
    let mockConfig;
    let mockSpacing;

    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();
        mockMaterialConfigs['plywood-laser'].generateJointCuts.mockClear();
        mockMaterialConfigs['plywood-laser'].generateBoardEtches.mockClear();

        // Mock Cellular with getCellRenderLines method
        mockCellular = {
            getCellRenderLines: jest.fn().mockReturnValue(new Set([
                '0,0,0,2,1', // Horizontal line: y1=0, x1=0, y2=0, x2=2, strain=1
                '0,2,2,2,1', // Vertical line: y1=0, x1=2, y2=2, x2=2, strain=1
                '2,0,2,2,1'  // Horizontal line: y1=2, x1=0, y2=2, x2=2, strain=1
            ]))
        };

        // Standard config for testing
        mockConfig = {
            caseDepth: 3,
            sheetThickness: 0.23,
            sheetWidth: 30,
            sheetHeight: 28,
            numSheets: 1,
            kerf: 0.01,
            numPinSlots: 2
        };

        // Standard spacing for testing
        mockSpacing = {
            squareSize: 1,
            buffer: 0.5,
            xPadding: 1,
            yPadding: 1
        };
    });

    describe('Constructor', () => {
        test('should initialize with default plywood material type', () => {
            // ✅ BULK VERIFIED: Multiple Export.js lines broken, 11/13 tests failed correctly
            // 1. Setup & Execute
            const exportInstance = new Export(mockCellular, mockSpacing, mockConfig);

            // 3. Assert
            expect(exportInstance.materialType).toBe('plywood-laser');
            expect(exportInstance.materialConfig).toBe(mockMaterialConfigs['plywood-laser']);
            expect(exportInstance.cellData).toBe(mockCellular);
            expect(exportInstance.caseDepth).toBe(3);
            expect(exportInstance.sheetThickness).toBe(0.23);
        });

        test('should use specified material type', () => {
            // ✅ BULK VERIFIED: Multiple Export.js lines broken, 11/13 tests failed correctly
            // 1. Setup & Execute
            const exportInstance = new Export(mockCellular, mockSpacing, mockConfig, 'plywood-laser');

            // 3. Assert
            expect(exportInstance.materialType).toBe('plywood-laser');
            expect(exportInstance.materialConfig).toBe(mockMaterialConfigs['plywood-laser']);
        });

        test('should fallback to plywood-laser for unknown material type', () => {
            // Suppress console.error for this test
            const originalConsoleError = console.error;
            console.error = jest.fn();

            try {
                // 1. Setup & Execute
                const exportInstance = new Export(mockCellular, mockSpacing, mockConfig, 'unknown-material');

                // 3. Assert
                expect(exportInstance.materialType).toBe('unknown-material');
                expect(exportInstance.materialConfig).toBe(mockMaterialConfigs['plywood-laser']);
            } finally {
                // Restore console.error after test
                console.error = originalConsoleError;
            }
        });
    });

    describe('makeBoards', () => {
        test('should create boards from cellular lines', () => {
            // 1. Setup
            const exportInstance = new Export(mockCellular, mockSpacing, mockConfig);

            // 2. Execute
            exportInstance.makeBoards();

            // 3. Assert
            expect(mockCellular.getCellRenderLines).toHaveBeenCalled();
            expect(exportInstance.boards.length).toBeGreaterThan(0);
            expect(exportInstance.boards[0]).toBeInstanceOf(Board);
        });

        test('should sort boards by length descending', () => {
            // 1. Setup - using real Board objects with real cellular data
            const exportInstance = new Export(mockCellular, mockSpacing, mockConfig);

            // 2. Execute
            exportInstance.makeBoards();

            // 3. Assert - verify boards are sorted by length
            if (exportInstance.boards.length > 1) {
                for (let i = 0; i < exportInstance.boards.length - 1; i++) {
                    expect(exportInstance.boards[i].getLength()).toBeGreaterThanOrEqual(exportInstance.boards[i + 1].getLength());
                }
            }
        });
    });

    describe('assignBoardEndTypes', () => {
        test('should delegate to material configuration', () => {
            // 1. Setup
            const exportInstance = new Export(mockCellular, mockSpacing, mockConfig);
            const realBoard = new Board(1, { x: 0, y: 0 }, { x: 5, y: 0 }, 'x', 0.25);
            exportInstance.boards = [realBoard];

            // Spy on the assignBoardEnds method
            const assignBoardEndsSpy = jest.spyOn(mockMaterialConfigs['plywood-laser'], 'assignBoardEnds');

            // 2. Execute
            exportInstance.assignBoardEndTypes();

            // 3. Assert
            expect(assignBoardEndsSpy).toHaveBeenCalledWith(realBoard);
        });
    });

    describe('prepJoints', () => {
        test('should delegate to material configuration functions', () => {
            // 1. Setup
            const exportInstance = new Export(mockCellular, mockSpacing, mockConfig);
            const realBoard = new Board(1, { x: 0, y: 0 }, { x: 5, y: 0 }, 'x', 0.25);
            const boardStartX = 5;
            const boardStartY = 10;

            // 2. Execute
            exportInstance.prepJoints(realBoard, boardStartX, boardStartY);

            // 3. Assert
            expect(mockMaterialConfigs['plywood-laser'].generateJointCuts).toHaveBeenCalledWith(
                realBoard,
                expect.objectContaining({
                    caseDepth: mockConfig.caseDepth,
                    sheetThickness: mockConfig.sheetThickness,
                    numPinSlots: mockConfig.numPinSlots
                }),
                boardStartX,
                boardStartY,
                exportInstance.cutList
            );

            expect(mockMaterialConfigs['plywood-laser'].generateBoardEtches).toHaveBeenCalledWith(
                realBoard,
                expect.objectContaining({
                    caseDepth: mockConfig.caseDepth,
                    sheetThickness: mockConfig.sheetThickness,
                    numPinSlots: mockConfig.numPinSlots
                }),
                boardStartX,
                boardStartY,
                exportInstance.etchList
            );
        });
    });

    describe('DXF Generation', () => {
        let exportInstance;

        beforeEach(() => {
            exportInstance = new Export(mockCellular, mockSpacing, mockConfig);
            // Mock the arrays that would be populated by prepLayout
            exportInstance.sheetOutline = [
                { x: 0, y: 0, w: 30, h: 28 }
            ];
            exportInstance.cutList = [
                { x: 5, y: 10, w: 15, h: 3 },
                { x: 10, y: 15, w: 8, h: 3 }
            ];
            exportInstance.etchList = [
                { text: 'Board1', x: 5, y: 9.9 },
                { text: 'Board2', x: 10, y: 14.9 }
            ];
            exportInstance.totalHeight = 28;
        });

        test('should create DXF with layers from material config', () => {
            // 1. Setup is in beforeEach

            // 2. Execute
            const result = exportInstance.generateDXF();

            // 3. Assert
            expect(global.DXFWriter).toHaveBeenCalled();
            expect(mockDXFWriter.setUnits).toHaveBeenCalledWith('Inches');

            // Verify layers are created from material config
            expect(mockDXFWriter.addLayer).toHaveBeenCalledWith('Sheet Outlines', 3, 'CONTINUOUS'); // GREEN
            expect(mockDXFWriter.addLayer).toHaveBeenCalledWith('Cuts', 1, 'CONTINUOUS'); // RED
            expect(mockDXFWriter.addLayer).toHaveBeenCalledWith('Labels', 5, 'CONTINUOUS'); // BLUE

            expect(result).toBe('MOCK_DXF_OUTPUT');
        });

        test('should populate outline layer correctly', () => {
            // 1. Setup is in beforeEach

            // 2. Execute
            exportInstance.populateOutlineLayer(mockDXFWriter);

            // 3. Assert
            expect(mockDXFWriter.setActiveLayer).toHaveBeenCalledWith('Sheet Outlines');
            expect(mockDXFWriter.drawRect).toHaveBeenCalledWith(0, 28, 30, 0); // x, y1, x+w, y2 with flipped y
        });

        test('should populate cut layer with kerf adjustment', () => {
            // 1. Setup is in beforeEach

            // 2. Execute
            exportInstance.populateCutLayer(mockDXFWriter);

            // 3. Assert
            expect(mockDXFWriter.setActiveLayer).toHaveBeenCalledWith('Cuts');

            // First cut: x=5, y=10, w=15, h=3 with kerf=0.01 and flipped y
            expect(mockDXFWriter.drawRect).toHaveBeenCalledWith(5, 18, 5 + 15 - 0.01, 15); // y1=28-10=18, y2=28-13=15

            // Second cut: x=10, y=15, w=8, h=3 with kerf=0.01 and flipped y  
            expect(mockDXFWriter.drawRect).toHaveBeenCalledWith(10, 13, 10 + 8 - 0.01, 10); // y1=28-15=13, y2=28-18=10
        });

        test('should populate etch layer with coordinate transformation', () => {
            // 1. Setup is in beforeEach

            // 2. Execute
            exportInstance.populateEtchLayer(mockDXFWriter);

            // 3. Assert
            expect(mockDXFWriter.setActiveLayer).toHaveBeenCalledWith('Labels');

            // First etch with flipped y coordinate
            expect(mockDXFWriter.drawText).toHaveBeenCalledWith(5, 18.1, 0.10, 0, 'Board1'); // y=28-9.9=18.1

            // Second etch with flipped y coordinate
            expect(mockDXFWriter.drawText).toHaveBeenCalledWith(10, 13.1, 0.10, 0, 'Board2'); // y=28-14.9=13.1
        });

        test('should handle missing layers gracefully', () => {
            // 1. Setup - temporarily modify material config to have missing layer
            const originalLayers = exportInstance.materialConfig.dxfLayers;
            exportInstance.materialConfig.dxfLayers = [
                { name: 'Sheet Outlines', color: 'GREEN', content: 'outlines' }
                // Missing cuts and etches layers
            ];

            // 2. Execute
            exportInstance.populateOutlineLayer(mockDXFWriter);
            exportInstance.populateCutLayer(mockDXFWriter);
            exportInstance.populateEtchLayer(mockDXFWriter);

            // 3. Assert - should not crash, only outline layer should be used
            expect(mockDXFWriter.setActiveLayer).toHaveBeenCalledWith('Sheet Outlines');
            expect(mockDXFWriter.setActiveLayer).not.toHaveBeenCalledWith('Cuts');
            expect(mockDXFWriter.setActiveLayer).not.toHaveBeenCalledWith('Labels');

            // Cleanup
            exportInstance.materialConfig.dxfLayers = originalLayers;
        });
    });

    describe('setupSheets', () => {
        test('should calculate correct number of rows based on sheet height and case depth', () => {
            // 1. Setup
            const exportInstance = new Export(mockCellular, mockSpacing, mockConfig);

            // 2. Execute
            exportInstance.setupSheets();

            // 3. Assert
            const expectedRows = Math.floor(mockConfig.sheetHeight / (mockConfig.caseDepth + (0.5 * 1.25)));
            expect(exportInstance.sheets).toHaveLength(mockConfig.numSheets);
            expect(exportInstance.sheets[0]).toHaveLength(expectedRows);
            expect(exportInstance.totalHeight).toBe(mockConfig.sheetHeight * mockConfig.numSheets);
        });
    });
});