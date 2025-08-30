// centralized state object for app data across screens
const appState = {
    currentScreen: ScreenState.INPUT,
    shapes: [], // Shape objects [{data (reference), posX (int), posY (int)}]
    savedAnneals: [],
    totalSavedAnneals: 0,
    currentAnneal: null,
    currentViewedAnnealIndex: null,
    selectedShapeId: null, // ID of the currently selected shape for manual movement
    originalAnnealedSolution: null, // Deep copy of the solution before manual edits begin

    // Generation configuration
    generationConfig: {
        // Layout preferences (user-selectable in UI)
        aspectRatioPref: 0,           // -1=tall, 0=square, 1=wide
        useCustomPerimeter: false,
        perimeterWidth: 20,
        perimeterHeight: 20,

        // Fabrication type (user-selectable in Design UI)
        fabricationType: 'boards',     // 'boards', 'cubbies', 'bent'

        // Material type for export (user-selectable in Export UI)
        materialType: 'plywood-laser', // 'plywood-laser', 'acrylic-laser', 'clay-plastic-3d'

        // Shape processing (user-selectable in UI)
        customBufferSize: 0.25,        // inches, 0-1 in 0.25 increments, default 0.25
        centerShape: false,            // boolean, default false (false = drop to bottom, true = center vertically)
        minWallLength: 1.0,            // inches per low-res grid square, options: 1.0, 0.5, 0.25

        // Wall generation (user-selectable in UI)
        wallAlgorithm: 'cellular-organic',  // 'cellular-organic', 'cellular-rectilinear', 'bend'
        cubbyCurveRadius: 0.5,         // For cubbies: 0-1.0, radius for rounded corners
        wallThickness: 0.25,           // For cubbies: wall thickness in inches
        cubbyMode: 'one',              // 'one' (merge after fabrication), 'many' (individual cubbies)
        bendRadius: 1.0,               // For bent wood walls
        maxBends: 4
    },

    // Display/rendering configuration
    display: {
        detailView: false,  // show detailed buffer zones and grid info
        devMode: false,     // show debug information and step-by-step controls
        numGrow: 0,         // current cellular growth step in dev mode
        curveStep: 0,       // current curve growth step in dev mode
        previewShapeId: null, // ID of shape being previewed (null = no preview)
        previewMode: false   // whether in shape preview mode
    },

    // Configuration management methods
    setFabricationType(newType, source = 'user') {
        if (this.generationConfig.fabricationType !== newType) {
            const oldType = this.generationConfig.fabricationType;
            this.generationConfig.fabricationType = newType;

            // Emit event for UI updates
            if (typeof appEvents !== 'undefined') {
                appEvents.emit('fabricationTypeChanged', {
                    fabricationType: newType,
                    previousType: oldType,
                    source
                });
            }
        } else {
            console.log(`[appState] Fabrication type unchanged: ${newType} (${source})`);
        }
    },

    setCubbyMode(newMode, source = 'user') {
        if (this.generationConfig.cubbyMode !== newMode) {
            const oldMode = this.generationConfig.cubbyMode;
            this.generationConfig.cubbyMode = newMode;

            // Emit event for UI updates
            if (typeof appEvents !== 'undefined') {
                appEvents.emit('cubbyModeChanged', { cubbyMode: newMode, source });
            }
        } else {
            console.log(`[appState] Cubby mode unchanged: ${newMode} (${source})`);
        }
    },

    setMaterialType(newType) {
        if (this.generationConfig.materialType !== newType) {
            const oldType = this.generationConfig.materialType;
            this.generationConfig.materialType = newType;

            // Sync wall thickness from material config if it has a default
            this.syncWallThicknessFromMaterial(newType);

            // Emit event for UI updates  
            if (typeof appEvents !== 'undefined') {
                appEvents.emit('materialTypeChanged', {
                    materialType: newType,
                    previousType: oldType
                });
            }
        }
    },

    setWallThickness(thickness, source = 'user') {
        if (this.generationConfig.wallThickness !== thickness) {
            const oldThickness = this.generationConfig.wallThickness;
            this.generationConfig.wallThickness = thickness;

            // Emit event for UI updates
            if (typeof appEvents !== 'undefined') {
                appEvents.emit('wallThicknessChanged', {
                    wallThickness: thickness,
                    previousThickness: oldThickness,
                    source
                });
            }
        }
    },

    getWallThickness() {
        return this.generationConfig.wallThickness || 0.25;
    },

    syncWallThicknessFromMaterial(materialType) {
        // Check if this material has a wall thickness setting
        if (typeof MATERIAL_CONFIGS !== 'undefined' && MATERIAL_CONFIGS[materialType]) {
            const materialConfig = MATERIAL_CONFIGS[materialType];
            const wallThicknessSetting = materialConfig.settings?.find(s => s.name === 'wallThickness');
            if (wallThicknessSetting && wallThicknessSetting.defaultValue) {
                this.setWallThickness(wallThicknessSetting.defaultValue, 'material');
            }
        }
    },

    setCustomBufferSize(size, source = 'user') {
        if (this.generationConfig.customBufferSize !== size) {
            const oldSize = this.generationConfig.customBufferSize;
            this.generationConfig.customBufferSize = size;

            // Emit event for UI updates
            if (typeof appEvents !== 'undefined') {
                appEvents.emit('customBufferSizeChanged', {
                    customBufferSize: size,
                    previousSize: oldSize,
                    source
                });
            }
        }
    },

    setCenterShape(enabled, source = 'user') {
        if (this.generationConfig.centerShape !== enabled) {
            const oldEnabled = this.generationConfig.centerShape;
            this.generationConfig.centerShape = enabled;

            // Emit event for UI updates
            if (typeof appEvents !== 'undefined') {
                appEvents.emit('centerShapeChanged', {
                    centerShape: enabled,
                    previousEnabled: oldEnabled,
                    source
                });
            }
        }
    },

    setMinWallLength(length, source = 'user') {
        // Validate input - reject undefined/null values
        if (length === undefined || length === null) {
            console.warn('[appState] setMinWallLength called with invalid value:', length, 'from source:', source);
            return;
        }
        
        if (this.generationConfig.minWallLength !== length) {
            const oldLength = this.generationConfig.minWallLength;
            this.generationConfig.minWallLength = length;

            // Emit event for UI updates
            if (typeof appEvents !== 'undefined') {
                appEvents.emit('minWallLengthChanged', {
                    minWallLength: length,
                    previousLength: oldLength,
                    source
                });
            }
        }
    },

    loadSolutionConfig(solution) {
        // Handle fabrication type override from solution
        if (solution.fabricationType) {
            this.setFabricationType(solution.fabricationType, 'solution');
        }

        // Note: materialType is not stored in solutions, it's an export preference
        // so we don't override it when loading solutions
    },

    setShapePreview(shapeId) {
        if (this.display.previewShapeId !== shapeId) {
            const oldPreviewId = this.display.previewShapeId;
            this.display.previewShapeId = shapeId;
            this.display.previewMode = (shapeId !== null);

            // Emit event for UI updates
            if (typeof appEvents !== 'undefined') {
                appEvents.emit('shapePreviewChanged', {
                    previewShapeId: shapeId,
                    previewMode: this.display.previewMode
                });
            }
        }
    },

    clearShapePreview() {
        this.setShapePreview(null);
    },

    // Unit conversion methods
    gridUnitsToInches(gridUnits, minWallLength = null) {
        // Convert grid units to physical inches based on minimum wall length setting
        // Each grid unit represents minWallLength inches
        const wallLength = minWallLength || this.generationConfig.minWallLength || 1.0;
        return gridUnits * wallLength;
    },

    inchesToGridUnits(inches, minWallLength = null) {
        // Convert physical inches to grid units based on minimum wall length setting
        const wallLength = minWallLength || this.generationConfig.minWallLength || 1.0;
        return inches / wallLength;
    }
};

// Only export appState when in a Node.js environment (e.g., during Jest tests)
// Ignored when the app is running in the browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = appState;
}