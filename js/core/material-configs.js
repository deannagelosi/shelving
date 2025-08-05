// Material-specific configurations for export system
// This file defines the behavior differences between materials

const MATERIAL_CONFIGS = {
    'plywood-laser': {
        // ============================================================================
        // PLYWOOD CONFIGURATION - Defines controls and ui layout
        // ============================================================================
        settings: [
            {
                name: 'thickness',
                defaultValue: 0.23,
                container: 'materialProps',
                inputType: 'number',
                label: 'Thickness (in)',
                cssClass: 'dimension-input',
                validation: { min: 0.13, max: 0.5, step: 0.01 }
            },
            {
                name: 'kerf',
                defaultValue: 0,
                container: 'materialProps',
                inputType: 'number',
                label: 'Kerf Width (in)',
                cssClass: 'dimension-input',
                validation: { min: 0, max: 0.04, step: 0.01 }
            },
            {
                name: 'caseDepth',
                defaultValue: 3,
                container: 'caseProps',
                inputType: 'number',
                label: 'Depth (in)',
                cssClass: 'dimension-input',
                validation: { min: 1, max: 10, step: 0.5 }
            },
            {
                name: 'pinSlots',
                defaultValue: 2,
                container: 'caseProps',
                inputType: 'select',
                label: '# Pin/Slots',
                cssClass: 'dimension-input',
                options: [{ value: 2, text: '2' }, { value: 1, text: '1' }]
            },
            {
                name: 'sheetWidth',
                defaultValue: 30,
                container: 'sheetDimensions',
                inputType: 'number',
                label: 'Width (in)',
                cssClass: 'dimension-input',
                validation: { min: 1, step: 1 }
            },
            {
                name: 'sheetHeight',
                defaultValue: 28,
                container: 'sheetDimensions',
                inputType: 'number',
                label: 'Height (in)',
                cssClass: 'dimension-input',
                validation: { min: 1, step: 1 }
            }
        ],

        // Container definitions
        containers: {
            materialProps: {
                label: 'Material Properties',
                cssClass: 'settings-group'
            },
            caseProps: {
                label: 'Case Properties',
                cssClass: 'settings-group'
            },
            sheetDimensions: {
                label: 'Sheet Dimensions',
                cssClass: 'settings-group'
            }
        },

        // Joint type definitions
        jointTypes: {
            corner: {
                horizontal: 'pin',
                vertical: 'slot'
            },
            tJoint: {
                ending: 'pin',
                intersected: 'slot'
            },
            xJoint: {
                intersected: 'half-lap'
            }
        },

        // DXF layer definitions
        dxfLayers: [
            { name: 'Sheet Outlines', color: 'GREEN', content: 'outlines' },
            { name: 'Cuts', color: 'RED', content: 'cuts' },
            { name: 'Labels', color: 'BLUE', content: 'etches' }
        ],

        // ============================================================================
        // BOARD ASSIGNMENT LOGIC - Determines initial end types for each board
        // ============================================================================
        assignBoardEnds: function (board) {
            if (board.orientation === 'x') {
                board.poi.start = this.jointTypes.corner.horizontal;
                board.poi.end = this.jointTypes.corner.horizontal;
            } else {
                board.poi.start = this.jointTypes.corner.vertical;
                board.poi.end = this.jointTypes.corner.vertical;
            }
        },

        // ============================================================================
        // CUTTING STRATEGY - Generates rectangles to cut for joints and connections
        // ============================================================================
        generateJointCuts: function (board, config, boardStartX, boardStartY, cutList) {
            // Joint configuration
            const numPinSlots = config.numPinSlots || 2;
            const jointConfig = {
                numSlotCuts: numPinSlots,
                numPinCuts: numPinSlots + 1,
                totalCuts: (numPinSlots * 2) + 1
            };

            const numJoints = jointConfig.totalCuts;
            const cutoutRatio = (1 / numJoints);
            const jointHeight = cutoutRatio * config.caseDepth;

            // Start joint
            if (board.poi.start === "slot") {
                for (let i = 0; i < jointConfig.numSlotCuts; i++) {
                    let ratio = i === 0 ? 1 : 3;
                    let x = boardStartX;
                    let y = boardStartY + config.caseDepth * (ratio * cutoutRatio);
                    cutList.push({ x, y, w: config.sheetThickness, h: jointHeight });
                }
            } else if (board.poi.start === "pin") {
                for (let i = 0; i < jointConfig.numPinCuts; i++) {
                    let ratio = i === 0 ? 0 : i === 1 ? 2 : 4;
                    let x = boardStartX;
                    let y = boardStartY + config.caseDepth * (ratio * cutoutRatio);
                    cutList.push({ x, y, w: config.sheetThickness, h: jointHeight });
                }
            }

            // End joint
            if (board.poi.end === "slot") {
                for (let i = 0; i < jointConfig.numSlotCuts; i++) {
                    let ratio = i === 0 ? 1 : 3;
                    let x = boardStartX + board.getLength() - config.sheetThickness;
                    let y = boardStartY + config.caseDepth * (ratio * cutoutRatio);
                    cutList.push({ x, y, w: config.sheetThickness, h: jointHeight });
                }
            } else if (board.poi.end === "pin") {
                for (let i = 0; i < jointConfig.numPinCuts; i++) {
                    let ratio = i === 0 ? 0 : i === 1 ? 2 : 4;
                    let x = boardStartX + board.getLength() - config.sheetThickness;
                    let y = boardStartY + config.caseDepth * (ratio * cutoutRatio);
                    cutList.push({ x, y, w: config.sheetThickness, h: jointHeight });
                }
            }

            // T-joints
            for (let tJoint of board.poi.tJoints) {
                for (let i = 0; i < jointConfig.numSlotCuts; i++) {
                    let ratio = i === 0 ? 1 : 3;
                    let x = boardStartX + tJoint;
                    let y = boardStartY + config.caseDepth * (ratio * cutoutRatio);
                    cutList.push({ x, y, w: config.sheetThickness, h: jointHeight });
                }
            }

            // Half-lap cuts (X-joints)
            for (let xJoint of board.poi.xJoints) {
                generateHalfLapCut(board, xJoint, config, boardStartX, boardStartY, cutList);
            }
        },

        // ============================================================================
        // ETCHING STRATEGY - Generates text labels and alignment guides to etch
        // ============================================================================
        generateBoardEtches: function (board, config, boardStartX, boardStartY, etchList) {
            // Add board ID label
            etchList.push({
                type: 'text',
                text: board.id,
                x: boardStartX,
                y: boardStartY - config.fontOffset
            });
        }
    },

    'acrylic-laser': {

        // ============================================================================
        // ACRYLIC CONFIGURATION - Defines controls and ui layout
        // ============================================================================
        settings: [
            {
                name: 'thickness',
                defaultValue: 0.375,
                container: 'materialProps',
                inputType: 'number',
                label: 'Thickness (in)',
                cssClass: 'dimension-input',
                validation: { min: 0.13, max: 0.5, step: 0.01 }
            },
            {
                name: 'kerf',
                defaultValue: 0.01,
                container: 'materialProps',
                inputType: 'number',
                label: 'Kerf Width (in)',
                cssClass: 'dimension-input',
                validation: { min: 0, max: 0.04, step: 0.01 }
            },
            {
                name: 'caseDepth',
                defaultValue: 3,
                container: 'caseProps',
                inputType: 'number',
                label: 'Depth (in)',
                cssClass: 'dimension-input',
                validation: { min: 1, max: 10, step: 0.5 }
            },
            {
                name: 'sheetWidth',
                defaultValue: 30,
                container: 'sheetDimensions',
                inputType: 'number',
                label: 'Width (in)',
                cssClass: 'dimension-input',
                validation: { min: 1, step: 1 }
            },
            {
                name: 'sheetHeight',
                defaultValue: 28,
                container: 'sheetDimensions',
                inputType: 'number',
                label: 'Height (in)',
                cssClass: 'dimension-input',
                validation: { min: 1, step: 1 }
            }
        ],

        // Container definitions
        containers: {
            materialProps: {
                label: 'Material Properties',
                cssClass: 'settings-group'
            },
            caseProps: {
                label: 'Case Properties',
                cssClass: 'settings-group'
            },
            sheetDimensions: {
                label: 'Sheet Dimensions',
                cssClass: 'settings-group'
            }
        },

        // Joint type definitions
        jointTypes: {
            corner: {
                horizontal: 'etch-line',
                vertical: 'short'
            },
            tJoint: {
                ending: 'short',
                intersected: 'etch-alignment'
            },
            xJoint: {
                intersected: 'half-lap'
            }
        },

        // DXF layer definitions
        dxfLayers: [
            { name: 'Sheet Outlines', color: 'GREEN', content: 'outlines' },
            { name: 'Cuts', color: 'RED', content: 'cuts' },
            { name: 'Etch Lines', color: 'BLUE', content: 'etches' }
        ],

        // ============================================================================
        // BOARD ASSIGNMENT LOGIC - Determines initial end types for each board
        // ============================================================================
        assignBoardEnds: function (board) {
            if (board.orientation === 'x') {
                board.poi.start = this.jointTypes.corner.horizontal;
                board.poi.end = this.jointTypes.corner.horizontal;
            } else {
                board.poi.start = this.jointTypes.corner.vertical;
                board.poi.end = this.jointTypes.corner.vertical;
            }
        },

        // ============================================================================
        // CUTTING STRATEGY - Generates rectangles to cut for joints and connections
        // ============================================================================
        generateJointCuts: function (board, config, boardStartX, boardStartY, cutList) {
            // Acrylic boards don't need pin/slot cuts at ends
            // 'short' ends are already shortened via getLength()
            // 'etch-line' ends just get etched guides (handled in generateBoardEtches)

            // Half-lap cuts (X-joints) - same as plywood
            for (let xJoint of board.poi.xJoints) {
                generateHalfLapCut(board, xJoint, config, boardStartX, boardStartY, cutList);
            }

            // T-joints get etch guides only (no cuts) - handled in generateBoardEtches
        },

        // ============================================================================
        // ETCHING STRATEGY - Generates text labels and alignment guides to etch
        // ============================================================================
        generateBoardEtches: function (board, config, boardStartX, boardStartY, etchList) {
            // Add board ID label
            etchList.push({
                type: 'text',
                text: board.id,
                x: boardStartX,
                y: boardStartY - config.fontOffset
            });

            // Handle 'etch-line' ends - single line inset by thickness from board end
            if (board.poi.start === 'etch-line') {
                // Vertical etch line one thickness in from start
                etchList.push({
                    type: 'line',
                    x1: boardStartX + config.sheetThickness,
                    y1: boardStartY,
                    x2: boardStartX + config.sheetThickness,
                    y2: boardStartY + config.caseDepth
                });
            }

            if (board.poi.end === 'etch-line') {
                // Vertical etch line one thickness in from end
                etchList.push({
                    type: 'line',
                    x1: boardStartX + board.getLength() - config.sheetThickness,
                    y1: boardStartY,
                    x2: boardStartX + board.getLength() - config.sheetThickness,
                    y2: boardStartY + config.caseDepth
                });
            }

            // Handle T-joint alignment etches - two lines showing where board edges will be
            for (let tJoint of board.poi.tJoints) {
                let centerX = boardStartX + tJoint;

                // Top edge guide line (left side of intersecting board)
                etchList.push({
                    type: 'line',
                    x1: centerX - (config.sheetThickness / 2),
                    y1: boardStartY,
                    x2: centerX - (config.sheetThickness / 2),
                    y2: boardStartY + config.caseDepth
                });

                // Bottom edge guide line (right side of intersecting board)
                etchList.push({
                    type: 'line',
                    x1: centerX + (config.sheetThickness / 2),
                    y1: boardStartY,
                    x2: centerX + (config.sheetThickness / 2),
                    y2: boardStartY + config.caseDepth
                });
            }
        }
    }
};

// ============================================================================
// SHARED FUNCTIONS - Used by multiple material configurations
// ============================================================================

// Half-lap (X-joint) cuts
function generateHalfLapCut(board, xJointPosition, config, boardStartX, boardStartY, cutList) {
    let xJointX = boardStartX + xJointPosition;
    if (board.orientation === "y") {
        // Vertical board: cut from top
        cutList.push({
            x: xJointX,
            y: boardStartY,
            w: config.sheetThickness,
            h: config.caseDepth / 2
        });
    } else {
        // Horizontal board: cut from bottom
        cutList.push({
            x: xJointX,
            y: boardStartY + (config.caseDepth / 2),
            w: config.sheetThickness,
            h: config.caseDepth / 2
        });
    }
}

// Only export the MATERIAL_CONFIGS when in a Node.js environment (e.g., during Jest tests)
// Ignored when the app is running in the browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MATERIAL_CONFIGS;
}