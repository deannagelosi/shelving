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

        // Wall generation (user-selectable in UI)
        wallAlgorithm: 'cellular-organic',  // 'cellular-organic', 'cellular-rectilinear', 'curve'
        curveRadius: 1.0,
        maxBends: 4
    },

    // Display/rendering configuration
    display: {
        detailView: false,  // show detailed buffer zones and grid info
        devMode: false,     // show debug information and step-by-step controls
        numGrow: 0,         // current cellular growth step in dev mode
        curveStep: 0        // current curve growth step in dev mode
    }
};