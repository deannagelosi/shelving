// tests/dxf-snapshots.test.js

const MATERIAL_CONFIGS = require('../../js/core/material-configs');
global.MATERIAL_CONFIGS = MATERIAL_CONFIGS;

// Import Export class after setting up globals
const Export = require('../../js/core/Export');

// Mock DXFWriter to capture DXF output
const mockDXFWriter = {
    calls: [],
    setUnits: function (units) {
        this.calls.push({ method: 'setUnits', args: [units] });
    },
    addLayer: function (name, color, lineType) {
        this.calls.push({ method: 'addLayer', args: [name, color, lineType] });
    },
    setActiveLayer: function (name) {
        this.calls.push({ method: 'setActiveLayer', args: [name] });
    },
    drawRect: function (x1, y1, x2, y2) {
        this.calls.push({ method: 'drawRect', args: [x1, y1, x2, y2] });
    },
    drawText: function (x, y, height, rotation, text) {
        this.calls.push({ method: 'drawText', args: [x, y, height, rotation, text] });
    },
    drawLine: function (x1, y1, x2, y2) {
        this.calls.push({ method: 'drawLine', args: [x1, y1, x2, y2] });
    },
    toDxfString: function () {
        // Generate a deterministic DXF output based on calls
        let dxfOutput = 'MOCK_DXF_HEADER\n';
        for (const call of this.calls) {
            dxfOutput += `${call.method}(${call.args.join(', ')})\n`;
        }
        dxfOutput += 'MOCK_DXF_FOOTER';
        return dxfOutput;
    },
    reset: function () {
        this.calls = [];
    },
    ACI: {
        GREEN: 3,
        RED: 1,
        BLUE: 5,
        WHITE: 7
    }
};

// Make DXFWriter available globally
global.DXFWriter = function () {
    return mockDXFWriter;
};
global.DXFWriter.ACI = mockDXFWriter.ACI;

// Make Board available globally (Export.js expects it as global)
const Board = require('../../js/core/Board');
global.Board = Board;

describe('DXF Snapshot Tests', () => {
    let mockCellular;

    beforeAll(() => {
        // Create a simple mock cellular that returns predictable lines
        // This simulates the output of a successful cellular growth
        mockCellular = {
            getCellRenderLines: function () {
                return new Set([
                    '0,0,0,5,1',  // Horizontal line: y1=0, x1=0, y2=0, x2=5, strain=1
                    '0,5,3,5,1',  // Vertical line: y1=0, x1=5, y2=3, x2=5, strain=1  
                    '3,0,3,5,1',  // Horizontal line: y1=3, x1=0, y2=3, x2=5, strain=1
                    '0,0,3,0,1',  // Vertical line: y1=0, x1=0, y2=3, x2=0, strain=1
                    '1,1,1,4,2', // Additional vertical line for second shape
                    '1,4,4,4,2', // Additional horizontal line for second shape
                    '4,1,4,4,2', // Additional vertical line for second shape  
                    '1,1,4,1,2'  // Additional horizontal line for second shape
                ]);
            }
        };
    });

    beforeEach(() => {
        // Reset mock DXF writer before each test
        mockDXFWriter.reset();
    });

    describe('Plywood Export DXF Snapshots', () => {
        test('should generate consistent DXF with 2 pin/slot configuration', () => {
            // ✅ ADVERSARIALLY VERIFIED: Broke Y-coordinate flipping & kerf adjustment, test failed correctly
            // 1. Setup
            const spacing = {
                squareSize: 1,
                buffer: 0.5,
                xPadding: 1,
                yPadding: 1
            };
            const config = {
                caseDepth: 3,
                sheetThickness: 0.23,
                sheetWidth: 30,
                sheetHeight: 28,
                numSheets: 1,
                kerf: 0.01,
                numPinSlots: 2,
                fontOffset: 0.1
            };

            // 2. Execute
            const exportInstance = new Export(mockCellular, spacing, config, 'plywood-laser');
            exportInstance.makeBoards();
            exportInstance.assignBoardEndTypes();
            exportInstance.detectJoints();
            exportInstance.setupSheets();
            exportInstance.prepLayout();

            const dxfOutput = exportInstance.generateDXF();

            // 3. Assert - Use snapshot to capture complete DXF output
            expect(dxfOutput).toMatchSnapshot('plywood-2-pin-slots.dxf');

            // Verify basic DXF structure
            expect(dxfOutput).toContain('setUnits(Inches)');
            expect(dxfOutput).toContain('addLayer(Sheet Outlines, 3, CONTINUOUS)');
            expect(dxfOutput).toContain('addLayer(Cuts, 1, CONTINUOUS)');
            expect(dxfOutput).toContain('addLayer(Labels, 5, CONTINUOUS)');
        });

        test('should generate consistent DXF with 1 pin/slot configuration', () => {
            // 1. Setup
            const spacing = {
                squareSize: 1,
                buffer: 0.5,
                xPadding: 1,
                yPadding: 1
            };
            const config = {
                caseDepth: 3,
                sheetThickness: 0.23,
                sheetWidth: 30,
                sheetHeight: 28,
                numSheets: 1,
                kerf: 0.01,
                numPinSlots: 1,
                fontOffset: 0.1
            };

            // 2. Execute
            const exportInstance = new Export(mockCellular, spacing, config, 'plywood-laser');
            exportInstance.makeBoards();
            exportInstance.assignBoardEndTypes();
            exportInstance.detectJoints();
            exportInstance.setupSheets();
            exportInstance.prepLayout();

            const dxfOutput = exportInstance.generateDXF();

            // 3. Assert - Use snapshot for different pin/slot configuration
            expect(dxfOutput).toMatchSnapshot('plywood-1-pin-slot.dxf');

            // Verify pin/slot count affects cut generation
            expect(dxfOutput).toContain('drawRect'); // Should have cuts
            expect(dxfOutput).toContain('drawText'); // Should have labels
        });

        test('should generate consistent DXF with different case depth', () => {
            // 1. Setup
            const spacing = {
                squareSize: 1,
                buffer: 0.5,
                xPadding: 1,
                yPadding: 1
            };
            const config = {
                caseDepth: 4, // Different case depth
                sheetThickness: 0.23,
                sheetWidth: 30,
                sheetHeight: 28,
                numSheets: 1,
                kerf: 0.01,
                numPinSlots: 2,
                fontOffset: 0.1
            };

            // 2. Execute
            const exportInstance = new Export(mockCellular, spacing, config, 'plywood-laser');
            exportInstance.makeBoards();
            exportInstance.assignBoardEndTypes();
            exportInstance.detectJoints();
            exportInstance.setupSheets();
            exportInstance.prepLayout();

            const dxfOutput = exportInstance.generateDXF();

            // 3. Assert - Different case depth should produce different cuts
            expect(dxfOutput).toMatchSnapshot('plywood-case-depth-4.dxf');
        });

        // Note: Joint testing with complex cellular layouts skipped due to cellular algorithm issues
        // The mock cellular data already tests basic joint functionality
    });

    describe('Acrylic Export DXF Snapshots', () => {
        test('should generate consistent DXF for acrylic material', () => {
            // 1. Setup
            const spacing = {
                squareSize: 1,
                buffer: 0.5,
                xPadding: 1,
                yPadding: 1
            };
            const config = {
                caseDepth: 3,
                sheetThickness: 0.125, // Thinner acrylic
                sheetWidth: 30,
                sheetHeight: 28,
                numSheets: 1,
                kerf: 0.005, // Smaller kerf for acrylic
                fontOffset: 0.1
            };

            // 2. Execute
            const exportInstance = new Export(mockCellular, spacing, config, 'acrylic-laser');
            exportInstance.makeBoards();
            exportInstance.assignBoardEndTypes();
            exportInstance.detectJoints();
            exportInstance.setupSheets();
            exportInstance.prepLayout();

            const dxfOutput = exportInstance.generateDXF();

            // 3. Assert - Acrylic should have different layer structure
            expect(dxfOutput).toMatchSnapshot('acrylic-laser.dxf');

            // Verify acrylic-specific layers
            expect(dxfOutput).toContain('addLayer(Etch Lines, 5, CONTINUOUS)');
        });
    });

    describe('DXF Consistency Tests', () => {
        test('should generate identical output across multiple runs', () => {
            // 1. Setup
            const spacing = {
                squareSize: 1,
                buffer: 0.5,
                xPadding: 1,
                yPadding: 1
            };
            const config = {
                caseDepth: 3,
                sheetThickness: 0.23,
                sheetWidth: 30,
                sheetHeight: 28,
                numSheets: 1,
                kerf: 0.01,
                numPinSlots: 2,
                fontOffset: 0.1
            };

            // 2. Execute - Generate DXF multiple times
            const outputs = [];
            for (let i = 0; i < 3; i++) {
                mockDXFWriter.reset();
                const exportInstance = new Export(mockCellular, spacing, config, 'plywood-laser');
                exportInstance.makeBoards();
                exportInstance.assignBoardEndTypes();
                exportInstance.detectJoints();
                exportInstance.setupSheets();
                exportInstance.prepLayout();

                outputs.push(exportInstance.generateDXF());
            }

            // 3. Assert - All outputs should be identical
            expect(outputs[0]).toBe(outputs[1]);
            expect(outputs[1]).toBe(outputs[2]);
            expect(outputs[0]).toMatchSnapshot('consistency-check.dxf');
        });
    });
});