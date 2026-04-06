// centralized state object for app data across screens
const appState = {
    // Display/rendering configuration
    display: {
        detailView: false,  // show detailed buffer zones and grid info
        devMode: false,     // show debug information and step-by-step controls
        numGrow: 0,         // current cellular growth step in dev mode
        previewShapeId: null, // ID of shape being previewed (null = no preview)
        previewMode: false,  // whether in shape preview mode

        // UI state flags
        shapesDisabled: false,  // DesignUI: whether shape interaction is disabled during generation

        // Development flags
        fastReloadDev: false,  // loads a test file and solution on start for faster development
        fastReloadScreen: ScreenState.DESIGN,  // which screen to load in fast reload mode
        testFileName: "cubbies_1.json",
        autoLoadSolution: false,
        testSolutionName: "solution-1",
    },

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
        perimeterWidthInches: 20,
        perimeterHeightInches: 20,

        // Fabrication type (always boards for v1.5)
        fabricationType: 'boards',

        // Material type for export (user-selectable in Export UI)
        materialType: 'plywood-laser', // 'plywood-laser', 'acrylic-laser'

        // Shape processing (user-selectable in UI)
        customBufferSize: 0.25,        // inches, 0-1 in 0.25 increments, default 0.25
        centerShape: false,            // boolean, default false (false = drop to bottom, true = center vertically)
        minWallLength: 1.0,            // inches per low-res grid square, options: 2.0, 1.5, 1.0, 0.5, 0.25
    },

    // Configuration management methods
    setMaterialType(newType) {
        if (this.generationConfig.materialType !== newType) {
            const oldType = this.generationConfig.materialType;
            this.generationConfig.materialType = newType;

            // Emit event for UI updates
            if (typeof appEvents !== 'undefined') {
                appEvents.emit('materialTypeChanged', {
                    materialType: newType,
                    previousType: oldType
                });
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

        // Normalize to numeric value for consistency (converts "1" or 1 to 1.0)
        const normalizedLength = parseFloat(length);

        if (this.generationConfig.minWallLength !== normalizedLength) {
            const oldLength = this.generationConfig.minWallLength;
            this.generationConfig.minWallLength = normalizedLength;

            // Emit event for UI updates
            if (typeof appEvents !== 'undefined') {
                appEvents.emit('minWallLengthChanged', {
                    minWallLength: normalizedLength,
                    previousLength: oldLength,
                    source
                });
            }
        }
    },

    setAspectRatioPref(pref) {
        if (this.generationConfig.aspectRatioPref !== pref) {
            const oldPref = this.generationConfig.aspectRatioPref;
            this.generationConfig.aspectRatioPref = pref;

            if (typeof appEvents !== 'undefined') {
                appEvents.emit('aspectRatioPrefChanged', {
                    aspectRatioPref: pref,
                    previousPref: oldPref
                });
            }
        }
    },

    setUseCustomPerimeter(enabled) {
        if (this.generationConfig.useCustomPerimeter !== enabled) {
            const oldEnabled = this.generationConfig.useCustomPerimeter;
            this.generationConfig.useCustomPerimeter = enabled;

            if (typeof appEvents !== 'undefined') {
                appEvents.emit('useCustomPerimeterChanged', {
                    useCustomPerimeter: enabled,
                    previousEnabled: oldEnabled
                });
            }
        }
    },

    setPerimeterWidth(widthInches) {
        if (this.generationConfig.perimeterWidthInches !== widthInches) {
            const oldWidth = this.generationConfig.perimeterWidthInches;
            this.generationConfig.perimeterWidthInches = widthInches;

            if (typeof appEvents !== 'undefined') {
                appEvents.emit('perimeterDimensionsChanged', {
                    perimeterWidthInches: widthInches,
                    previousWidth: oldWidth
                });
            }
        }
    },

    setPerimeterHeight(heightInches) {
        if (this.generationConfig.perimeterHeightInches !== heightInches) {
            const oldHeight = this.generationConfig.perimeterHeightInches;
            this.generationConfig.perimeterHeightInches = heightInches;

            if (typeof appEvents !== 'undefined') {
                appEvents.emit('perimeterDimensionsChanged', {
                    perimeterHeightInches: heightInches,
                    previousHeight: oldHeight
                });
            }
        }
    },

    loadSolutionConfig(solution) {
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
    }
};

// Only export appState when in a Node.js environment (e.g., during Jest tests)
// Ignored when the app is running in the browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = appState;
}