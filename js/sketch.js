//== constants
const canvasWidth = 650;
const canvasHeight = 650;
const SQUARE_SIZE = 0.25; // in inches

//== state variables
let numGrow = 0; // cell growth amount in dev mode

//== UI class instances
let inputUI;
let designUI;
let exportUI;

//== event management
let appEvents;
let updateScheduled = false;
let isExporting = false;

//== static DOM element references
let htmlRefs = {};

//== screens enum
const ScreenState = {
    INPUT: 'input',
    DESIGN: 'design',
    EXPORT: 'export'
};

//== flags
let detailView = false;
let devMode = false;
let aspectRatioPref = 0;

function setup() {
    let canvasElement = createCanvas(canvasWidth, canvasHeight);
    canvasElement.parent('canvas-div');

    // select all DOM containers
    htmlRefs = {
        left: {
            top: select('#left-side-bar .sidebar-top'),
            list: select('#left-side-bar .sidebar-list'),
            buttons: select('#left-side-bar .sidebar-buttons')
        },
        right: {
            top: select('#right-side-bar .sidebar-top'),
            list: select('#right-side-bar .sidebar-list'),
            buttons: select('#right-side-bar .sidebar-buttons')
        },
        leftSidebar: select('#left-side-bar'),
        rightSidebar: select('#right-side-bar'),
        headerControls: select('#header-controls'),
        bottomDiv: select('#bottom-div'),
        subheading: select('#subheading')
    };

    // initialize event system
    appEvents = new EventEmitter();

    // ui update manager for state change events
    appEvents.on('stateChanged', () => {
        if (!updateScheduled) {
            // debounce multiple state change events into a single ui update call
            updateScheduled = true;
            // setTimeout delays ui updates until after state changes complete
            setTimeout(() => {
                updateScheduled = false;
                // call ui update on the active screen
                switch (appState.currentScreen) {
                    case ScreenState.INPUT:
                        inputUI.update();
                        break;
                    case ScreenState.DESIGN:
                        designUI.update();
                        break;
                    case ScreenState.EXPORT:
                        exportUI.update();
                        break;
                }
            }, 0);
        }
    });

    // setup global export functionality
    appEvents.on('exportRequested', () => {
        handleFileExport();
    });

    // setup ui elements for both screens
    inputUI = new InputUI();
    designUI = new DesignUI();
    exportUI = new ExportUI();

    // start on input screen
    changeScreen(ScreenState.INPUT);
}

function draw() {
    // setup canvas. UI managed by view manager and UI classes
    noLoop();
}

function keyPressed() {
    // Input screen key commands
    if (appState.currentScreen == ScreenState.INPUT) {
        if (key === '~') {
            // toggle export button visibility
            inputUI.html.exportButton.toggleClass('hidden');
        }
    }
    // Design screen key commands
    else if (appState.currentScreen == ScreenState.DESIGN) {
        if (key === 'd') {
            // toggle dev mode on and off
            devMode = !devMode;
            numGrow = 0;
            if (appState.currentAnneal && appState.currentAnneal.finalSolution) {
                designUI.displayResult();
            }
        }
        else if (key === 'g' && devMode) {
            // advance one growth at a time in dev mode
            numGrow++;
            designUI.displayResult();
        }
    }
    // Export screen key commands
    else if (appState.currentScreen == ScreenState.EXPORT) {
        if (key === 'd') {
            // toggle dev mode on and off
            devMode = !devMode;
            appEvents.emit('resetToLayoutView');
        }
    }
}

function mousePressed() {
    if (appState.currentScreen == ScreenState.INPUT) {
        inputUI.selectInputSquare(mouseX, mouseY);
    }
}

function mouseDragged() {
    if (appState.currentScreen == ScreenState.INPUT) {
        inputUI.selectInputSquare(mouseX, mouseY, true);
    }
}

function mouseReleased() {
    if (appState.currentScreen == ScreenState.INPUT) {
        inputUI.eraseMode = "first";
    }
}

//== helper functions
function changeScreen(newScreen) {
    // setup view for the new screen
    switch (newScreen) {
        case ScreenState.INPUT:
            htmlRefs.subheading.html("Object Input");
            htmlRefs.right.top.html('Shapes');
            htmlRefs.leftSidebar.addClass('hidden');
            htmlRefs.rightSidebar.removeClass('hidden');
            break;
        case ScreenState.DESIGN:
            htmlRefs.subheading.html("Generate Layout");
            htmlRefs.left.top.html('Shapes');
            htmlRefs.right.top.html('Results');
            htmlRefs.leftSidebar.removeClass('hidden');
            htmlRefs.rightSidebar.removeClass('hidden');
            break;
        case ScreenState.EXPORT:
            htmlRefs.subheading.html("Export Design");
            htmlRefs.left.top.html('Solutions');
            htmlRefs.right.top.html('Settings');
            htmlRefs.leftSidebar.removeClass('hidden');
            htmlRefs.rightSidebar.removeClass('hidden');
            break;
    }

    // update app screen state
    appState.currentScreen = newScreen;

    // triggers ui .show()/.hide() methods
    appEvents.emit('screenChanged', { screen: newScreen });
    // trigger ui .update() method
    appEvents.emit('stateChanged');
}

function updateButton(button, enabled) {
    // enable/disable button based on boolean flag
    if (enabled) {
        button.removeAttribute('disabled');
    } else {
        button.attribute('disabled', '');
    }
}

function handleFileExport() {
    // export saved shapes and solutions
    if (isExporting) return; // debounce
    isExporting = true;

    try {
        // get an export friendly copy of the shapes
        let shapesCopy = appState.shapes.map(shape => shape.exportShape());
        // get an export friendly copy of the saved anneals
        let annealsCopy = appState.savedAnneals.map(anneal => {
            return {
                ...anneal,
                solutionHistory: [], // temporarily set to empty to reduce file size
                finalSolution: anneal.finalSolution.exportSolution()
            };
        });
        // create export object
        let exportData = {
            savedAnneals: annealsCopy,
            allShapes: shapesCopy
        };

        saveJSONFile(exportData);
    } catch (error) {
        console.error('Export failed:', error);
    } finally {
        isExporting = false;
    }
}

function saveJSONFile(_exportData) {
    // used by InputUI and DesignUI to save export data
    const jsonData = JSON.stringify(_exportData, null);
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    // create temporary link element
    const link = document.createElement('a');
    link.href = url;
    link.download = 'shelving_data.json';

    // append to body, click, and remove
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    // clean up the URL
    URL.revokeObjectURL(url);
}

// prevent page reloads unless confirmed
window.onbeforeunload = function (e) {
    e.preventDefault();
    e.returnValue = '';
  };