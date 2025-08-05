// tests/material-configs.test.js

const MATERIAL_CONFIGS = require('../js/core/material-configs');
global.MATERIAL_CONFIGS = MATERIAL_CONFIGS;

describe('Material Configurations', () => {
    describe('Plywood Laser Configuration', () => {
        let plywoodConfig;

        beforeEach(() => {
            plywoodConfig = global.MATERIAL_CONFIGS['plywood-laser'];
        });

        test('should have correct structure', () => {
            // 1. Setup is in beforeEach

            // 2. Execute - check structure exists

            // 3. Assert
            expect(plywoodConfig).toBeDefined();
            expect(plywoodConfig.jointTypes).toBeDefined();
            expect(plywoodConfig.dxfLayers).toBeDefined();
            expect(typeof plywoodConfig.assignBoardEnds).toBe('function');
            expect(typeof plywoodConfig.generateJointCuts).toBe('function');
            expect(typeof plywoodConfig.generateBoardEtches).toBe('function');
        });

        test('should have correct jointTypes structure', () => {
            // 1. Setup is in beforeEach

            // 2. Execute - access jointTypes
            const jointTypes = plywoodConfig.jointTypes;

            // 3. Assert
            expect(jointTypes.corner.horizontal).toBe('pin');
            expect(jointTypes.corner.vertical).toBe('slot');
            expect(jointTypes.tJoint.ending).toBe('pin');
            expect(jointTypes.tJoint.intersected).toBe('slot');
            expect(jointTypes.xJoint.intersected).toBe('half-lap');
        });

        test('should have correct DXF layers configuration', () => {
            // 1. Setup is in beforeEach

            // 2. Execute - access dxfLayers
            const layers = plywoodConfig.dxfLayers;

            // 3. Assert
            expect(Array.isArray(layers)).toBe(true);
            expect(layers).toHaveLength(3);

            const outlineLayer = layers.find(l => l.content === 'outlines');
            const cutLayer = layers.find(l => l.content === 'cuts');
            const etchLayer = layers.find(l => l.content === 'etches');

            expect(outlineLayer).toEqual({ name: 'Sheet Outlines', color: 'GREEN', content: 'outlines' });
            expect(cutLayer).toEqual({ name: 'Cuts', color: 'RED', content: 'cuts' });
            expect(etchLayer).toEqual({ name: 'Labels', color: 'BLUE', content: 'etches' });
        });
    });

    describe('assignBoardEnds function', () => {
        let plywoodConfig;

        beforeEach(() => {
            plywoodConfig = global.MATERIAL_CONFIGS['plywood-laser'];
        });

        test('should assign pin ends to horizontal boards', () => {
            // 1. Setup
            const mockBoard = {
                orientation: 'x',
                poi: { start: 'unassigned', end: 'unassigned' }
            };

            // 2. Execute
            plywoodConfig.assignBoardEnds.call(plywoodConfig, mockBoard);

            // 3. Assert
            expect(mockBoard.poi.start).toBe('pin');
            expect(mockBoard.poi.end).toBe('pin');
        });

        test('should assign slot ends to vertical boards', () => {
            // 1. Setup
            const mockBoard = {
                orientation: 'y',
                poi: { start: 'unassigned', end: 'unassigned' }
            };

            // 2. Execute
            plywoodConfig.assignBoardEnds.call(plywoodConfig, mockBoard);

            // 3. Assert
            expect(mockBoard.poi.start).toBe('slot');
            expect(mockBoard.poi.end).toBe('slot');
        });
    });

    describe('generateJointCuts function', () => {
        let plywoodConfig;
        let mockBoard;
        let mockConfig;
        let cutList;

        beforeEach(() => {
            plywoodConfig = global.MATERIAL_CONFIGS['plywood-laser'];
            mockBoard = {
                id: 1,
                orientation: 'x',
                thickness: 0.23,
                poi: {
                    start: 'pin',
                    end: 'pin',
                    tJoints: [3, 7], // Two T-joints
                    xJoints: [5] // One X-joint
                },
                getLength: function () { return 10; } // Mock fixed length for testing
            };
            mockConfig = {
                caseDepth: 3,
                sheetThickness: 0.23,
                numPinSlots: 2
            };
            cutList = [];
        });

        test('should generate cuts for pin ends', () => {
            // 1. Setup is in beforeEach

            // 2. Execute
            plywoodConfig.generateJointCuts.call(plywoodConfig, mockBoard, mockConfig, 0, 0, cutList);

            // 3. Assert - should have cuts for start pin, end pin, T-joints, and X-joints
            expect(cutList.length).toBeGreaterThan(0);

            // Verify we have cuts (exact number depends on pin/slot configuration)
            // With 2 pin slots: 3 pin cuts per end + 2 slot cuts per T-joint + 1 X-joint cut
            const expectedCuts = 3 + 3 + (2 * 2) + 1; // start pins + end pins + t-joints + x-joints
            expect(cutList).toHaveLength(expectedCuts);
        });

        test('should generate cuts for slot ends', () => {
            // 1. Setup
            mockBoard.poi.start = 'slot';
            mockBoard.poi.end = 'slot';

            // 2. Execute
            plywoodConfig.generateJointCuts.call(plywoodConfig, mockBoard, mockConfig, 0, 0, cutList);

            // 3. Assert
            expect(cutList.length).toBeGreaterThan(0);

            // With 2 pin slots: 2 slot cuts per end + 2 slot cuts per T-joint + 1 X-joint cut
            const expectedCuts = 2 + 2 + (2 * 2) + 1;
            expect(cutList).toHaveLength(expectedCuts);
        });

        test('should generate cuts for T-joints', () => {
            // 1. Setup - board with only T-joints, no end cuts
            mockBoard.poi.start = 'unassigned';
            mockBoard.poi.end = 'unassigned';
            mockBoard.poi.xJoints = []; // Remove X-joints for cleaner test

            // 2. Execute
            plywoodConfig.generateJointCuts.call(plywoodConfig, mockBoard, mockConfig, 0, 0, cutList);

            // 3. Assert - should only have T-joint cuts
            // 2 T-joints × 2 slot cuts each = 4 cuts
            expect(cutList).toHaveLength(4);

            // Verify T-joint cuts are at correct positions
            const tJoint1Cuts = cutList.filter(cut => cut.x === 3);
            const tJoint2Cuts = cutList.filter(cut => cut.x === 7);
            expect(tJoint1Cuts).toHaveLength(2);
            expect(tJoint2Cuts).toHaveLength(2);
        });

        test('should generate cuts for X-joints', () => {
            // 1. Setup - board with only X-joints
            mockBoard.poi.start = 'unassigned';
            mockBoard.poi.end = 'unassigned';
            mockBoard.poi.tJoints = []; // Remove T-joints

            // 2. Execute
            plywoodConfig.generateJointCuts.call(plywoodConfig, mockBoard, mockConfig, 0, 0, cutList);

            // 3. Assert - should only have X-joint cuts
            expect(cutList).toHaveLength(1);

            // Verify X-joint cut properties
            const xJointCut = cutList[0];
            expect(xJointCut.x).toBe(5); // X-joint position
            expect(xJointCut.w).toBe(mockConfig.sheetThickness);
            expect(xJointCut.h).toBe(mockConfig.caseDepth / 2); // Half-lap cut
        });

        test('should handle different pin/slot configurations', () => {
            // 1. Setup - test with 1 pin/slot instead of 2
            mockConfig.numPinSlots = 1;
            mockBoard.poi.tJoints = []; // Simplify
            mockBoard.poi.xJoints = [];

            // 2. Execute
            plywoodConfig.generateJointCuts.call(plywoodConfig, mockBoard, mockConfig, 0, 0, cutList);

            // 3. Assert - with 1 pin slot: 2 pin cuts per end
            expect(cutList).toHaveLength(4); // 2 + 2 for start and end pins
        });

        test('should position cuts correctly based on board start coordinates', () => {
            // 1. Setup
            const boardStartX = 100;
            const boardStartY = 50;
            mockBoard.poi.tJoints = [];
            mockBoard.poi.xJoints = [];

            // 2. Execute
            plywoodConfig.generateJointCuts.call(plywoodConfig, mockBoard, mockConfig, boardStartX, boardStartY, cutList);

            // 3. Assert - cuts should be offset by board start position
            cutList.forEach(cut => {
                expect(cut.x).toBeGreaterThanOrEqual(boardStartX);
                expect(cut.y).toBeGreaterThanOrEqual(boardStartY);
            });
        });
    });

    describe('generateBoardEtches function', () => {
        let plywoodConfig;

        beforeEach(() => {
            plywoodConfig = global.MATERIAL_CONFIGS['plywood-laser'];
        });

        test('should generate board label etch', () => {
            // 1. Setup
            const mockBoard = { id: 'Board123' };
            const mockConfig = { fontOffset: 0.1 };
            const boardStartX = 10;
            const boardStartY = 20;
            const etchList = [];

            // 2. Execute
            plywoodConfig.generateBoardEtches.call(plywoodConfig, mockBoard, mockConfig, boardStartX, boardStartY, etchList);

            // 3. Assert
            expect(etchList).toHaveLength(1);
            expect(etchList[0]).toEqual({
                type: 'text',
                text: 'Board123',
                x: boardStartX,
                y: boardStartY - mockConfig.fontOffset
            });
        });
    });

    describe('Acrylic Laser Configuration', () => {
        let acrylicConfig;

        beforeEach(() => {
            acrylicConfig = global.MATERIAL_CONFIGS['acrylic-laser'];
        });

        test('should have correct structure', () => {
            // 1. Setup is in beforeEach

            // 2. Execute - check structure exists

            // 3. Assert
            expect(acrylicConfig).toBeDefined();
            expect(acrylicConfig.jointTypes).toBeDefined();
            expect(acrylicConfig.dxfLayers).toBeDefined();
            expect(typeof acrylicConfig.assignBoardEnds).toBe('function');
            expect(typeof acrylicConfig.generateJointCuts).toBe('function');
            expect(typeof acrylicConfig.generateBoardEtches).toBe('function');
        });

        test('should have correct jointTypes for acrylic', () => {
            // 1. Setup is in beforeEach

            // 2. Execute - access jointTypes
            const jointTypes = acrylicConfig.jointTypes;

            // 3. Assert
            expect(jointTypes.corner.horizontal).toBe('etch-line');
            expect(jointTypes.corner.vertical).toBe('short');
            expect(jointTypes.tJoint.ending).toBe('short');
            expect(jointTypes.tJoint.intersected).toBe('etch-line');
            expect(jointTypes.xJoint.intersected).toBe('half-lap');
        });
    });
});