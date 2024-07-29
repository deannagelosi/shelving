//= setup variables
const canvasWidth = 650;
const canvasHeight = 650;

//= state variables
let numGrow = 0; // cell growth amount in dev mode

//= class instances
let inputUI;
let designUI;
let newCase;

//= flags
let isInputScreen; // switches screen (inout/design)
// diagnostic toggles
let devMode = false;
let editMode = false;

function setup() {
    let canvasElement = createCanvas(canvasWidth, canvasHeight);
    canvasElement.parent('canvas-div');

    // setup ui elements for both screens
    inputUI = new InputUI();
    designUI = new DesignUI();

    // start on input screen
    isInputScreen = true;
}

function draw() {
    if (isInputScreen) {
        // display the input screen 
        inputUI.show();

        noLoop();
    } else {
        // switch to annealing screen
        inputUI.hide();
        designUI.show();

        // setup the design grid
        designUI.drawBlankGrid();

        noLoop();
    }
}

function keyPressed() {
    if (!isInputScreen) {
        if (key === 'g') {
            // advance one growth at a time in dev mode
            if (devMode) {
                numGrow++
                designUI.displayResult();
            }
        } else if (key === 'd') {
            // toggle dev mode on and off
            devMode = !devMode;
            numGrow = 0;
            if (designUI.currentAnneal && designUI.currentAnneal.finalSolution) {
                designUI.displayResult();
            }
        }
    }
}

function mousePressed() {
    if (isInputScreen) {
        inputUI.selectInputSquare(mouseX, mouseY);
    }
    // else {
    //     designUI.selectCellLine(mouseX, mouseY);
    // }
}

function mouseDragged() {
    if (isInputScreen) {
        inputUI.selectInputSquare(mouseX, mouseY, true);
    }
}

function mouseReleased() {
    if (isInputScreen) {
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