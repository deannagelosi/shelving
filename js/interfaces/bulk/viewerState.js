// js/interfaces/bulk/viewerState.js

const viewerState = {
    // Database and data state
    database: null,
    jobs: [],
    solutions: [],
    selectedSolution: null,

    // Statistics for the selected solution
    stats: {
        rRmse: null,
        rMae: null,
        emptySpaceGrid: null
    }
}; 