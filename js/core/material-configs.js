// Material-specific configurations for export system
// This file defines the behavior differences between materials

const COMMON_SETTINGS = {
    thicknessIn: {
        name: 'thicknessIn',
        container: 'materialProps',
        inputType: 'number',
        label: 'Thickness (in)',
        cssClass: 'dimension-input',
        defaultValue: 0.75,
        validation: { min: 0.13, max: 0.75, step: 0.01 }
    },
    kerfIn: {
        name: 'kerfIn',
        container: 'materialProps',
        inputType: 'number',
        label: 'Kerf Width (in)',
        cssClass: 'dimension-input',
        defaultValue: 0.00,
        validation: { min: 0, max: 0.04, step: 0.01 }
    },
    caseDepthIn: {
        name: 'caseDepthIn',
        defaultValue: 4,
        container: 'caseProps',
        inputType: 'number',
        label: 'Depth (in)',
        cssClass: 'dimension-input',
        validation: { min: 1, max: 10, step: 0.5 }
    },
    sheetWidthIn: {
        name: 'sheetWidthIn',
        defaultValue: 44,
        container: 'sheetLayout',
        inputType: 'number',
        label: 'Width (in)',
        cssClass: 'dimension-input',
        validation: { min: 1, step: 1 }
    },
    sheetHeightIn: {
        name: 'sheetHeightIn',
        defaultValue: 35,
        container: 'sheetLayout',
        inputType: 'number',
        label: 'Height (in)',
        cssClass: 'dimension-input',
        validation: { min: 1, step: 1 }
    },
    gapIn: {
        name: 'gapIn',
        defaultValue: 0.5,
        container: 'sheetLayout',
        inputType: 'number',
        label: 'Gap (in)',
        cssClass: 'dimension-input',
        validation: { min: 0.1, max: 1, step: 0.1 }
    }
};

const COMMON_CONTAINERS = {
    materialProps: {
        label: 'Material Properties',
        cssClass: 'settings-group'
    },
    caseProps: {
        label: 'Case Properties',
        cssClass: 'settings-group'
    },
    sheetLayout: {
        label: 'Sheet Layout',
        cssClass: 'settings-group'
    }
};

const MATERIAL_CONFIGS = {
    'plywood-laser': {
        // ============================================================================
        // PLYWOOD CONFIGURATION - Defines controls and ui layout
        // ============================================================================
        settings: [
            COMMON_SETTINGS.thicknessIn,
            COMMON_SETTINGS.kerfIn,
            COMMON_SETTINGS.caseDepthIn,
            {
                name: 'pinSlots',
                defaultValue: 2,
                container: 'caseProps',
                inputType: 'select',
                label: 'Pin Type',
                cssClass: 'dimension-input',
                options: [{ value: 3, text: '2 Pin' }, { value: 2, text: '1 Pin' }, { value: 1, text: 'Lazy' }]
            },
            COMMON_SETTINGS.sheetWidthIn,
            COMMON_SETTINGS.sheetHeightIn,
            COMMON_SETTINGS.gapIn
        ],

        // Container definitions
        containers: COMMON_CONTAINERS,

        // Joint type definitions
        jointTypes: {
            corner: {
                horizontal: 'pin-corner',
                vertical: 'slot'
            },
            tJoint: {
                ending: 'pin-tjoint',
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
            assignBoardEnds(board, this.jointTypes);
        },

        // ============================================================================
        // CUTTING STRATEGY - Generates rectangles to cut for joints and connections
        // ============================================================================
        generateJointCuts: function (board, config, boardStartX, boardStartY, cutList) {
            const numPinSlots = config.numPinSlots || 2; // 1=Lazy, 2=1 Pin, 3=2 Pin

            // Apply kerfIn adjustments for plywood
            const effectiveDepth = config.caseDepthIn + (config.kerfIn || 0);
            const slotWidth = config.sheetThicknessIn - (config.kerfIn || 0);

            if (numPinSlots === 1) {
                // LAZY FINGER MODE - Special positioning based on board orientation and joint type
                const lazySlotHeight = effectiveDepth * 0.5 - (config.kerfIn || 0);

                // Start joint
                if (board.poi.start === "slot") {
                    // Vertical board: slot at top
                    cutList.push({ type: 'joint', x: boardStartX, y: boardStartY, w: slotWidth, h: lazySlotHeight });
                } else if (board.poi.start === "pin-corner") {
                    // Horizontal board: slot at bottom
                    cutList.push({ type: 'joint', x: boardStartX, y: boardStartY + effectiveDepth - lazySlotHeight, w: slotWidth, h: lazySlotHeight });
                } else if (board.poi.start === "pin-tjoint") {
                    // T-joint end: centered pin (two slots above/below)
                    const cutRatio = 1 / 3;
                    const jointHeight = effectiveDepth * cutRatio - (config.kerfIn || 0);
                    cutList.push({ type: 'joint', x: boardStartX, y: boardStartY, w: slotWidth, h: jointHeight });
                    cutList.push({ type: 'joint', x: boardStartX, y: boardStartY + effectiveDepth * (2 * cutRatio), w: slotWidth, h: jointHeight });
                }

                // End joint
                const endX = boardStartX + board.getLength() - slotWidth;
                if (board.poi.end === "slot") {
                    // Vertical board: slot at top
                    cutList.push({ type: 'joint', x: endX, y: boardStartY, w: slotWidth, h: lazySlotHeight });
                } else if (board.poi.end === "pin-corner") {
                    // Horizontal board: slot at bottom
                    cutList.push({ type: 'joint', x: endX, y: boardStartY + effectiveDepth - lazySlotHeight, w: slotWidth, h: lazySlotHeight });
                } else if (board.poi.end === "pin-tjoint") {
                    // T-joint end: centered pin (two slots above/below)
                    const cutRatio = 1 / 3;
                    const jointHeight = effectiveDepth * cutRatio - (config.kerfIn || 0);
                    cutList.push({ type: 'joint', x: endX, y: boardStartY, w: slotWidth, h: jointHeight });
                    cutList.push({ type: 'joint', x: endX, y: boardStartY + effectiveDepth * (2 * cutRatio), w: slotWidth, h: jointHeight });
                }
            } else {
                // STANDARD MODE (1 Pin or 2 Pin) - Use original ratio-based approach
                const jointConfig = {
                    numSlotCuts: numPinSlots - 1,
                    numPinCuts: numPinSlots,
                    totalCuts: (numPinSlots * 2) - 1
                };

                const cutoutRatio = (1 / jointConfig.totalCuts);
                const jointHeight = cutoutRatio * effectiveDepth - (config.kerfIn || 0);

                // Start joint
                if (board.poi.start === "slot") {
                    for (let i = 0; i < jointConfig.numSlotCuts; i++) {
                        let ratio = i === 0 ? 1 : 3;
                        cutList.push({
                            type: 'joint',
                            x: boardStartX,
                            y: boardStartY + effectiveDepth * (ratio * cutoutRatio),
                            w: slotWidth,
                            h: jointHeight
                        });
                    }
                } else if (board.poi.start === "pin-corner" || board.poi.start === "pin-tjoint") {
                    for (let i = 0; i < jointConfig.numPinCuts; i++) {
                        let ratio = i === 0 ? 0 : i === 1 ? 2 : 4;
                        cutList.push({
                            type: 'joint',
                            x: boardStartX,
                            y: boardStartY + effectiveDepth * (ratio * cutoutRatio),
                            w: slotWidth,
                            h: jointHeight
                        });
                    }
                }

                // End joint
                const endX = boardStartX + board.getLength() - slotWidth;
                if (board.poi.end === "slot") {
                    for (let i = 0; i < jointConfig.numSlotCuts; i++) {
                        let ratio = i === 0 ? 1 : 3;
                        cutList.push({
                            type: 'joint',
                            x: endX,
                            y: boardStartY + effectiveDepth * (ratio * cutoutRatio),
                            w: slotWidth,
                            h: jointHeight
                        });
                    }
                } else if (board.poi.end === "pin-corner" || board.poi.end === "pin-tjoint") {
                    for (let i = 0; i < jointConfig.numPinCuts; i++) {
                        let ratio = i === 0 ? 0 : i === 1 ? 2 : 4;
                        cutList.push({
                            type: 'joint',
                            x: endX,
                            y: boardStartY + effectiveDepth * (ratio * cutoutRatio),
                            w: slotWidth,
                            h: jointHeight
                        });
                    }
                }
            }

            // T-joints (same for all pin modes)
            for (let tJoint of board.poi.tJoints) {
                const { x, width } = calculateCenteredJointCut(tJoint, config, boardStartX);
                if (numPinSlots === 1) {
                    // Lazy mode T-joints use 1-pin approach (single slot)
                    let y = boardStartY + effectiveDepth * (1 / 3);
                    cutList.push({ type: 'joint', x, y, w: width, h: effectiveDepth * (1 / 3) - (config.kerfIn || 0) });
                } else {
                    // Standard mode T-joints
                    const numSlotCuts = numPinSlots - 1;
                    const cutRatio = 1 / (numPinSlots * 2 - 1);
                    const jointHeight = effectiveDepth * cutRatio - (config.kerfIn || 0);

                    for (let i = 0; i < numSlotCuts; i++) {
                        let ratio = i === 0 ? 1 : 3;
                        let y = boardStartY + effectiveDepth * (ratio * cutRatio);
                        cutList.push({ type: 'joint', x, y, w: width, h: jointHeight });
                    }
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
            COMMON_SETTINGS.thicknessIn,
            COMMON_SETTINGS.kerfIn,
            COMMON_SETTINGS.caseDepthIn,
            COMMON_SETTINGS.sheetWidthIn,
            COMMON_SETTINGS.sheetHeightIn,
            COMMON_SETTINGS.gapIn
        ],

        // Container definitions
        containers: COMMON_CONTAINERS,

        // Joint type definitions
        jointTypes: {
            corner: {
                horizontal: 'etch-line',
                vertical: 'short'
            },
            tJoint: {
                ending: 'short',
                intersected: 'etch-line'
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
            assignBoardEnds(board, this.jointTypes);
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

            // Handle 'etch-line' ends - single line inset by thicknessIn from board end
            if (board.poi.start === 'etch-line') {
                // Vertical etch line one thicknessIn in from start
                etchList.push({
                    type: 'line',
                    x1: boardStartX + config.sheetThicknessIn,
                    y1: boardStartY,
                    x2: boardStartX + config.sheetThicknessIn,
                    y2: boardStartY + config.caseDepthIn
                });
            }

            if (board.poi.end === 'etch-line') {
                // Vertical etch line one thicknessIn in from end
                etchList.push({
                    type: 'line',
                    x1: boardStartX + board.getLength() - config.sheetThicknessIn,
                    y1: boardStartY,
                    x2: boardStartX + board.getLength() - config.sheetThicknessIn,
                    y2: boardStartY + config.caseDepthIn
                });
            }

            // Handle T-joint alignment etches - two lines showing where board edges will be
            for (let tJoint of board.poi.tJoints) {
                // Finding x position of tJoint:
                // 1) Base Offset:
                // - tJoint value is the base distance (as if thickness was zero)
                // - Need to adjust by half thickness to account for board centerline
                let baseOffset = (config.sheetThicknessIn / 2);

                // 2) Short End Offset:
                // - for acrylic, boards are welded so no slots or pins
                // - plywood slot end boards (vertical, T ends) are shorter instead
                // - plywood pin end boards (horizontal) have etch lines instead (not shorter)
                // - the end type of the board effects length, which affects our t-joint etch position
                // - find x-coord from the start end of the board by checking the start end type
                let startEndType = board.poi.start;
                let shortOffset = 0;
                if (startEndType === 'short') {
                    // board is shorter by 1 thicknessIn, so lines are closer to the start end
                    shortOffset = -config.sheetThicknessIn;
                }

                let totalOffset = shortOffset + baseOffset;

                let centerX = boardStartX + tJoint + totalOffset;
                // - draw the lines for the board edges, not the centerline
                // - draw lines a half thicknessIn from the centerline in either direction
                let leftX = centerX - (config.sheetThicknessIn / 2);
                let rightX = centerX + (config.sheetThicknessIn / 2);

                // Left edge guide line (left side of intersecting board)
                etchList.push({
                    type: 'line',
                    x1: leftX,
                    y1: boardStartY,
                    x2: leftX,
                    y2: boardStartY + config.caseDepthIn
                });

                // Right edge guide line (right side of intersecting board)
                etchList.push({
                    type: 'line',
                    x1: rightX,
                    y1: boardStartY,
                    x2: rightX,
                    y2: boardStartY + config.caseDepthIn
                });
            }
        }
    },

    'clay-plastic-3d': {
        // ============================================================================
        // 3D PRINTER CONFIGURATION - For clay or plastic 3D printed cubbies
        // ============================================================================
        settings: [
            {
                name: 'cubbyMode',
                defaultValue: 'one',
                container: 'caseProps',
                inputType: 'select',
                label: 'Cubby Mode',
                cssClass: 'dimension-input',
                options: [
                    { value: 'one', text: 'One (merge cubbies)' },
                    { value: 'many', text: 'Many (individual cubbies)' }
                ]
            },
            {
                name: 'shrinkFactor',
                defaultValue: 0,
                container: 'materialProps',
                inputType: 'number',
                label: 'Shrink Factor (%)',
                cssClass: 'dimension-input',
                validation: { min: 0, max: 50, step: 1 }
            },
            {
                name: 'wallThickness',
                defaultValue: 0.25,
                container: 'caseProps',
                inputType: 'number',
                label: 'Wall Thickness (in)',
                cssClass: 'dimension-input',
                validation: { min: 0.05, max: 1.0, step: 0.01 }
            },
            {
                name: 'cubbyCurveRadius',
                defaultValue: 0.5,
                container: 'caseProps',
                inputType: 'number',
                label: 'Curve Radius',
                cssClass: 'dimension-input',
                validation: { min: 0, max: 1.0, step: 0.1 }
            },
            {
                name: 'printBedWidth',
                defaultValue: 12,
                container: 'printBedDimensions',
                inputType: 'number',
                label: 'Width (in)',
                cssClass: 'dimension-input',
                validation: { min: 1, step: 1 }
            },
            {
                name: 'printBedHeight',
                defaultValue: 12,
                container: 'printBedDimensions',
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
                label: 'Wall Properties',
                cssClass: 'settings-group'
            },
            printBedDimensions: {
                label: 'Print Bed Dimensions',
                cssClass: 'settings-group'
            }
        },

        // No joint types for 3D printing (individual cubbies)
        jointTypes: {},

        // DXF layer definitions for cubbies
        dxfLayers: [
            { name: 'Edge Lines', color: 'MAGENTA', content: 'edges' },
            { name: 'Interior Lines', color: 'GREEN', content: 'interior' },
            { name: 'Labels', color: 'BLUE', content: 'labels' }
        ],

        // ============================================================================
        // CUBBY GENERATION - No boards, just detect and export cubbies
        // ============================================================================
        assignBoardEnds: function (board) {
            // No boards for 3D printing - this is a no-op
            return;
        },

        generateJointCuts: function (board, config, boardStartX, boardStartY, cutList) {
            // No joint cuts for 3D printing - cubbies are individual pieces
            return;
        },

        generateBoardEtches: function (board, config, boardStartX, boardStartY, etchList) {
            // No board etches for 3D printing - labels handled differently
            return;
        }
    }
};

// ============================================================================
// SHARED FUNCTIONS - Used by multiple material configurations
// ============================================================================

// Calculate rectangle start position for a joint cut centered on it's poi (point of interest)
function calculateCenteredJointCut(poiCenter, config, boardStartX) {
    const slotWidth = config.sheetThicknessIn - (config.kerfIn || 0);
    const rectStartX = boardStartX + poiCenter - (slotWidth / 2);
    return { x: rectStartX, width: slotWidth };
}

// Board end assignment based on orientation and joint types
function assignBoardEnds(board, jointTypes) {
    if (board.orientation === 'x') {
        board.poi.start = jointTypes.corner.horizontal;
        board.poi.end = jointTypes.corner.horizontal;
    } else {
        board.poi.start = jointTypes.corner.vertical;
        board.poi.end = jointTypes.corner.vertical;
    }
}

// Half-lap (X-joint) cuts
function generateHalfLapCut(board, xJointPosition, config, boardStartX, boardStartY, cutList) {
    const { x, width } = calculateCenteredJointCut(xJointPosition, config, boardStartX);
    if (board.orientation === "y") {
        // Vertical board: cut from top
        cutList.push({
            type: 'halflap',
            x: x,
            y: boardStartY,
            w: width,
            h: config.caseDepthIn / 2
        });
    } else {
        // Horizontal board: cut from bottom
        cutList.push({
            type: 'halflap',
            x: x,
            y: boardStartY + (config.caseDepthIn / 2),
            w: width,
            h: config.caseDepthIn / 2
        });
    }
}

// Only export the MATERIAL_CONFIGS when in a Node.js environment (e.g., during Jest tests)
// Ignored when the app is running in the browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MATERIAL_CONFIGS;
}