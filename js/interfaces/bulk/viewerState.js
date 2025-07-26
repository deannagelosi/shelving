// js/interfaces/bulk/viewerState.js

const viewerState = {
    // Database and data state
    database: null,
    jobs: [],
    solutions: [],
    selectedSolution: null,

    // UI and debug state
    devMode: false,
    numGrow: 0,

    // Statistics for the selected solution
    stats: {
        rRmse: null,
        rMae: null,
        emptySpaceGrid: null
    }
}; 