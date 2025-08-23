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

        // Wall generation (user-selectable in UI)
        wallAlgorithm: 'cellular-organic',  // 'cellular-organic', 'cellular-rectilinear', 'bend'
        cubbyCurveRadius: 0.5,         // For cubbies: 0-1.0, radius for rounded corners
        wallThickness: 0.25,           // For cubbies: wall thickness in inches
        bendRadius: 1.0,               // For bent wood walls
        maxBends: 4
    },

    // Display/rendering configuration
    display: {
        detailView: false,  // show detailed buffer zones and grid info
        devMode: false,     // show debug information and step-by-step controls
        numGrow: 0,         // current cellular growth step in dev mode
        curveStep: 0        // current curve growth step in dev mode
    },

    // Configuration management methods
    setFabricationType(newType, source = 'user') {
        if (this.generationConfig.fabricationType !== newType) {
            const oldType = this.generationConfig.fabricationType;
            this.generationConfig.fabricationType = newType;
            console.log(`[appState] Fabrication type changed: ${oldType} → ${newType} (${source})`);
            
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

    setMaterialType(newType) {
        if (this.generationConfig.materialType !== newType) {
            const oldType = this.generationConfig.materialType;
            this.generationConfig.materialType = newType;
            console.log(`[appState] Material type changed: ${oldType} → ${newType}`);
            
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
            console.log(`[appState] Wall thickness changed: ${oldThickness} → ${thickness} (${source})`);
            
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

    loadSolutionConfig(solution) {
        console.log(`[appState] Loading configuration from solution`);
        
        // Handle fabrication type override from solution
        if (solution.fabricationType) {
            this.setFabricationType(solution.fabricationType, 'solution');
        }
        
        // Note: materialType is not stored in solutions, it's an export preference
        // so we don't override it when loading solutions
    }
};