// Material-specific configurations for export system
// This file defines the behavior differences between materials

const COMMON_SETTINGS = {
    thicknessIn: {
        name: 'thicknessIn',
        container: 'materialProps',
        inputType: 'number',
        label: 'Thickness (in)',
        cssClass: 'dimension-input',
        defaultValue: 0.25,
        validation: { min: 0.13, max: 0.75, step: 0.01 }
    },
    kerfIn: {
        name: 'kerfIn',
        container: 'materialProps',
        inputType: 'number',
        label: 'Kerf Width (in)',
        cssClass: 'dimension-input',
        defaultValue: 0.00,
        validation: { min: 0, max: 0.05, step: 0.01 }
    },
    caseDepthIn: {
        name: 'caseDepthIn',
        defaultValue: 3,
        container: 'caseProps',
        inputType: 'number',
        label: 'Depth (in)',
        cssClass: 'dimension-input',
        validation: { min: 1, max: 10, step: 0.5 }
    },
    sheetWidthIn: {
        name: 'sheetWidthIn',
        defaultValue: 36,
        container: 'sheetLayout',
        inputType: 'number',
        label: 'Width (in)',
        cssClass: 'dimension-input',
        validation: { min: 1, step: 1 }
    },
    sheetHeightIn: {
        name: 'sheetHeightIn',
        defaultValue: 24,
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
        validation: { min: 0.1, max: 2.3, step: 0.1 }
    }
};

const COMMON_CONTAINERS = {
    materialProps: {
        label: 'Material Properties',
        cssClass: 'settings-group'
    },
    caseProps: {
        label: 'Shelving Properties',
        cssClass: 'settings-group'
    },
    sheetLayout: {
        label: 'Sheet Size',
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
                name: 'pinMode',
                defaultValue: 'lazy',
                container: 'caseProps',
                inputType: 'select',
                label: 'Pin Type',
                cssClass: 'dimension-input',
                options: [{ value: '2-pin', text: '2 Pin' }, { value: '1-pin', text: '1 Pin' }, { value: 'lazy', text: 'Lazy' }]
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
            const pinMode = config.pinMode;
            const slotKerfWidth = getSlotKerfWidth(config);

            // Note: poi = point of interest (such as the location of a slot along a board)
            // In the 2D layout (with zero material thickness), POIs are measured from the board's starting edge.
            // When board thickness is added, it extends equally on both sides of the layout centerline.
            // i.e. the poi starting x-coord is at the centerline of the intersecting board's thickness.
            const boardStartXCenterline = boardStartX + (config.sheetThicknessIn / 2);

            // Generate start end joints
            generateBoardEndJoints(board.poi.start, pinMode, boardStartX, boardStartY, config, cutList);

            // Generate end end joints
            const endX = boardStartX + board.getLength() - slotKerfWidth;
            generateBoardEndJoints(board.poi.end, pinMode, endX, boardStartY, config, cutList);

            // T-joints (middle of boards)
            for (let tJoint of board.poi.tJoints) {
                const rectStartX = calculateJointRectStartX(tJoint, config, boardStartXCenterline);
                generateTJointSlots(pinMode, rectStartX, boardStartY, config, cutList);
            }

            // Half-lap cuts (X-joints)
            for (let xJoint of board.poi.xJoints) {
                generateHalfLapCut(board, xJoint, config, boardStartXCenterline, boardStartY, cutList);
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
    }
};

// ============================================================================
// SHARED FUNCTIONS - Used by multiple material configurations
// ============================================================================

// Calculate kerf-adjusted slot dimensions
function getSlotKerfWidth(config) {
    return config.sheetThicknessIn - config.kerfIn;
}

function getSlotKerfHeight(caseKerfDepth, ratio, kerfIn) {
    return (caseKerfDepth * ratio) - kerfIn;
}

function getCaseKerfDepth(config) {
    return config.caseDepthIn + config.kerfIn;
}

// Calculate rectangle start X for a joint cut (POI is the centerline, convert to left edge)
function calculateJointRectStartX(poiCenter, config, boardStartX) {
    const slotKerfWidth = getSlotKerfWidth(config);
    return boardStartX + poiCenter - (slotKerfWidth / 2);
}

// Generate slot cuts for a board end based on pin mode and end type
function generateBoardEndJoints(endType, pinMode, x, boardStartY, config, cutList) {
    if (pinMode === 'lazy') {
        generateLazyEndJoints(endType, x, boardStartY, config, cutList);
    } else if (pinMode === '1-pin') {
        generate1PinEndJoints(endType, x, boardStartY, config, cutList);
    } else if (pinMode === '2-pin') {
        generate2PinEndJoints(endType, x, boardStartY, config, cutList);
    }
}

function generateLazyEndJoints(endType, x, boardStartY, config, cutList) {
    const slotKerfWidth = getSlotKerfWidth(config);
    const caseKerfDepth = getCaseKerfDepth(config);
    const slotKerfHeight = getSlotKerfHeight(caseKerfDepth, 0.5, config.kerfIn);

    if (endType === "slot") {
        // Vertical board: single slot at top
        cutList.push({ type: 'joint', x, y: boardStartY, w: slotKerfWidth, h: slotKerfHeight });
    } else if (endType === "pin-corner") {
        // Horizontal board: single slot at bottom
        cutList.push({ type: 'joint', x, y: boardStartY + caseKerfDepth - slotKerfHeight, w: slotKerfWidth, h: slotKerfHeight });
    } else if (endType === "pin-tjoint") {
        // T-joint end: two slots (top and bottom thirds)
        const slotKerfHeight = getSlotKerfHeight(caseKerfDepth, 1 / 3, config.kerfIn);
        cutList.push({ type: 'joint', x, y: boardStartY, w: slotKerfWidth, h: slotKerfHeight });
        cutList.push({ type: 'joint', x, y: boardStartY + caseKerfDepth * (2 / 3), w: slotKerfWidth, h: slotKerfHeight });
    }
}

function generate1PinEndJoints(endType, x, boardStartY, config, cutList) {
    const slotKerfWidth = getSlotKerfWidth(config);
    const caseKerfDepth = getCaseKerfDepth(config);
    const slotKerfHeight = getSlotKerfHeight(caseKerfDepth, 1 / 3, config.kerfIn);

    if (endType === "slot") {
        // Single centered slot at position 1/3
        cutList.push({ type: 'joint', x, y: boardStartY + caseKerfDepth * (1 / 3), w: slotKerfWidth, h: slotKerfHeight });
    } else if (endType === "pin-corner" || endType === "pin-tjoint") {
        // Two slots: at positions 0 and 2/3
        cutList.push({ type: 'joint', x, y: boardStartY, w: slotKerfWidth, h: slotKerfHeight });
        cutList.push({ type: 'joint', x, y: boardStartY + caseKerfDepth * (2 / 3), w: slotKerfWidth, h: slotKerfHeight });
    }
}

function generate2PinEndJoints(endType, x, boardStartY, config, cutList) {
    const slotKerfWidth = getSlotKerfWidth(config);
    const caseKerfDepth = getCaseKerfDepth(config);
    const slotKerfHeight = getSlotKerfHeight(caseKerfDepth, 1 / 5, config.kerfIn);

    if (endType === "slot") {
        // Two slots: at positions 1/5 and 3/5
        cutList.push({ type: 'joint', x, y: boardStartY + caseKerfDepth * (1 / 5), w: slotKerfWidth, h: slotKerfHeight });
        cutList.push({ type: 'joint', x, y: boardStartY + caseKerfDepth * (3 / 5), w: slotKerfWidth, h: slotKerfHeight });
    } else if (endType === "pin-corner" || endType === "pin-tjoint") {
        // Three slots: at positions 0, 2/5, and 4/5
        cutList.push({ type: 'joint', x, y: boardStartY, w: slotKerfWidth, h: slotKerfHeight });
        cutList.push({ type: 'joint', x, y: boardStartY + caseKerfDepth * (2 / 5), w: slotKerfWidth, h: slotKerfHeight });
        cutList.push({ type: 'joint', x, y: boardStartY + caseKerfDepth * (4 / 5), w: slotKerfWidth, h: slotKerfHeight });
    }
}

// Generate slot cuts for T-joints in the middle of boards
function generateTJointSlots(pinMode, x, boardStartY, config, cutList) {
    const slotKerfWidth = getSlotKerfWidth(config);
    const caseKerfDepth = getCaseKerfDepth(config);

    if (pinMode === 'lazy' || pinMode === '1-pin') {
        // Single centered slot at 1/3 depth
        const slotKerfHeight = getSlotKerfHeight(caseKerfDepth, 1 / 3, config.kerfIn);
        cutList.push({ type: 'joint', x, y: boardStartY + caseKerfDepth * (1 / 3), w: slotKerfWidth, h: slotKerfHeight });
    } else if (pinMode === '2-pin') {
        // Two slots at 1/5 and 3/5 depth
        const slotKerfHeight = getSlotKerfHeight(caseKerfDepth, 1 / 5, config.kerfIn);
        cutList.push({ type: 'joint', x, y: boardStartY + caseKerfDepth * (1 / 5), w: slotKerfWidth, h: slotKerfHeight });
        cutList.push({ type: 'joint', x, y: boardStartY + caseKerfDepth * (3 / 5), w: slotKerfWidth, h: slotKerfHeight });
    }
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
    const rectStartX = calculateJointRectStartX(xJointPosition, config, boardStartX);
    const slotKerfWidth = getSlotKerfWidth(config);

    if (board.orientation === "y") {
        // Vertical board: cut from top
        cutList.push({
            type: 'halflap',
            x: rectStartX,
            y: boardStartY,
            w: slotKerfWidth,
            h: config.caseDepthIn / 2
        });
    } else {
        // Horizontal board: cut from bottom
        cutList.push({
            type: 'halflap',
            x: rectStartX,
            y: boardStartY + (config.caseDepthIn / 2),
            w: slotKerfWidth,
            h: config.caseDepthIn / 2
        });
    }
}

// Only export the MATERIAL_CONFIGS when in a Node.js environment (e.g., during Jest tests)
// Ignored when the app is running in the browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MATERIAL_CONFIGS;
}