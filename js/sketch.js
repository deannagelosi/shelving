//= constants
const canvasWidth = 650;
const canvasHeight = 650;
const SQUARE_SIZE = 0.25; // in inches

//= state variables
let numGrow = 0; // cell growth amount in dev mode

//= UI class instances
let inputUI;
let designUI;
let exportUI;

//= screens enum
const ScreenState = {
    INPUT: 'input',
    DESIGN: 'design',
    EXPORT: 'export'
};

//= flags
let detailView = false;
let devMode = false;
let aspectRatioPref = 0;

function setup() {
    let canvasElement = createCanvas(canvasWidth, canvasHeight);
    canvasElement.parent('canvas-div');

    // setup ui elements for both screens
    inputUI = new InputUI();
    designUI = new DesignUI();
    exportUI = new ExportUI();

    // start on input screen
    changeScreen(ScreenState.INPUT);
}

function draw() {
    // check which screen to display
    switch (currentScreen) {
        case ScreenState.INPUT:
            designUI.hide();
            exportUI.hide();
            inputUI.show();

            noLoop();
            break;
        case ScreenState.DESIGN:
            inputUI.hide();
            exportUI.hide();
            designUI.show();

            noLoop();
            break;
        case ScreenState.EXPORT:
            devMode = false;
            inputUI.hide();
            designUI.hide();
            exportUI.show();

            noLoop();
            break;
    }
}

function changeScreen(newScreen) {
    // Set the new screen and loop
    currentScreen = newScreen;
    loop();
}

function keyPressed() {
    // Input screen key commands
    if (currentScreen == ScreenState.INPUT) {
        if (key === '~') {
            // toggle export button visibility
            inputUI.html.exportButton.toggleClass('hidden');
        }
    }
    // Design screen key commands
    else if (currentScreen == ScreenState.DESIGN) {
        if (key === 'd') {
            // toggle dev mode on and off
            devMode = !devMode;
            numGrow = 0;
            if (designUI.currentAnneal && designUI.currentAnneal.finalSolution) {
                designUI.displayResult();
            }
        }
        else if (key === 'g' && devMode) {
            // advance one growth at a time in dev mode
            numGrow++
            designUI.displayResult();
        }
    }
    // Export screen key commands
    else if (currentScreen == ScreenState.EXPORT) {
        if (key === 'd') {
            // toggle dev mode on and off
            devMode = !devMode;
            exportUI.showingLayout = true;
            exportUI.handleShow();
        }
    }
}

function mousePressed() {
    if (currentScreen == ScreenState.INPUT) {
        inputUI.selectInputSquare(mouseX, mouseY);
    }
}

function mouseDragged() {
    if (currentScreen == ScreenState.INPUT) {
        inputUI.selectInputSquare(mouseX, mouseY, true);
    }
}

function mouseReleased() {
    if (currentScreen == ScreenState.INPUT) {
        inputUI.eraseMode = "first";
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