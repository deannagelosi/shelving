// Material-specific configurations for export system
// This file defines the behavior differences between materials

const MATERIAL_CONFIGS = {
    'plywood-laser': {
        // Complete UI definition with settings and layout
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

        // Joint type definitions for all joint scenarios
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

        // Whether to adjust board length for joint thickness
        adjustBoardLength: true,

        // DXF layer definitions
        dxfLayers: [
            { name: 'Sheet Outlines', color: 'GREEN', content: 'outlines' },
            { name: 'Cuts', color: 'RED', content: 'cuts' },
            { name: 'Labels', color: 'BLUE', content: 'etches' }
        ],

        // Function to assign board end types based on material rules
        assignBoardEnds: function (board) {
            if (board.orientation === 'x') {
                board.poi.start = this.jointTypes.corner.horizontal;
                board.poi.end = this.jointTypes.corner.horizontal;
            } else {
                board.poi.start = this.jointTypes.corner.vertical;
                board.poi.end = this.jointTypes.corner.vertical;
            }
        },

        // Function to generate joint cuts for a board (extracted from prepJoints)
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
                    let x = boardStartX + board.len - config.sheetThickness;
                    let y = boardStartY + config.caseDepth * (ratio * cutoutRatio);
                    cutList.push({ x, y, w: config.sheetThickness, h: jointHeight });
                }
            } else if (board.poi.end === "pin") {
                for (let i = 0; i < jointConfig.numPinCuts; i++) {
                    let ratio = i === 0 ? 0 : i === 1 ? 2 : 4;
                    let x = boardStartX + board.len - config.sheetThickness;
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

            // X-joints
            for (let xJoint of board.poi.xJoints) {
                let xJointX = boardStartX + xJoint;
                if (board.orientation == "y") {
                    // cut from top of board
                    cutList.push({ x: xJointX, y: boardStartY, w: config.sheetThickness, h: config.caseDepth / 2 });
                } else {
                    // cut from bottom of board
                    cutList.push({ x: xJointX, y: (boardStartY + (config.caseDepth / 2)), w: config.sheetThickness, h: config.caseDepth / 2 });
                }
            }
        },

        // Function to generate board label etches
        generateBoardEtches: function (board, config, boardStartX, boardStartY, etchList) {
            // Add board ID label
            etchList.push({ text: board.id, x: boardStartX, y: boardStartY - config.fontOffset });
        }
    },

    'acrylic-laser': {
        // Complete UI definition with settings and layout
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

        // Joint type definitions for all joint scenarios
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

        // Whether to adjust board length for joint thickness
        adjustBoardLength: false,

        // DXF layer definitions (placeholder - will be customized later)
        dxfLayers: [
            { name: 'Sheet Outlines', color: 'GREEN', content: 'outlines' },
            { name: 'Cuts', color: 'RED', content: 'cuts' },
            { name: 'Etch Lines', color: 'BLUE', content: 'etches' }
        ],

        // Function to assign board end types based on material rules
        assignBoardEnds: function (board) {
            if (board.orientation === 'x') {
                board.poi.start = this.jointTypes.corner.horizontal;
                board.poi.end = this.jointTypes.corner.horizontal;
            } else {
                board.poi.start = this.jointTypes.corner.vertical;
                board.poi.end = this.jointTypes.corner.vertical;
            }
        },

        // Function to generate joint cuts for acrylic (placeholder)
        generateJointCuts: function (board, config, boardStartX, boardStartY, cutList) {
            // Placeholder for acrylic-specific cutting logic
            // This will be implemented later based on user requirements
            // console.log(`[Acrylic] Generating cuts for board ${board.id} - placeholder implementation`);
        },

        // Function to generate etch lines for acrylic
        generateBoardEtches: function (board, config, boardStartX, boardStartY, etchList) {
            // Add board ID label
            etchList.push({ text: board.id, x: boardStartX, y: boardStartY - config.fontOffset });

            // Placeholder for etch line generation
            // This will include alignment lines for welding
            // console.log(`[Acrylic] Generating etch lines for board ${board.id} - placeholder implementation`);
        }
    }
};

// Only export the MATERIAL_CONFIGS when in a Node.js environment (e.g., during Jest tests)
// Ignored when the app is running in the browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MATERIAL_CONFIGS;
}