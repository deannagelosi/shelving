let canvasWidth = 700;
let canvasHeight = 700;
let shapes = [];
let shapesPos = [];
let annealing;
let newCase;
let inputUI;
let designUI;
let isInputScreen; // controls active screen (inout or anneal)
let annealingComplete = false;
let currentSolution;
let isMousePressed = false;

// diagnostic toggles
let useExampleSolution = false;
let enableCellular = true;
let devMode = false;
let numGrow = 0;

function setup() {
    let canvasElement = createCanvas(canvasWidth, canvasHeight);
    canvasElement.parent('canvas-container');

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
        // setup the input grid
        inputUI.drawInputGrid();
        noLoop();

    } else {
        // switch to annealing screen
        inputUI.hide();
        designUI.show();
        if (!annealing) {
            // annealing has not started yet
            // display example solution or start annealing
            if (useExampleSolution) {
                // load the example solution and don't anneal
                let solution = new Solution(shapesPos);
                solution.exampleSolution();
                currentSolution = solution; // save for displayResult
                displayResult();
                noLoop();
            } else {
                // run the annealing process
                startAnnealing();
                noLoop();
            }
        }
    }

    noLoop();
}

async function startAnnealing() {
    annealingComplete = false;
    annealing = new Anneal(updateDisplay, designUI);

    let solution = await annealing.run();
    currentSolution = solution; // save for displayResult
    annealingComplete = true;
    displayResult();

    // rebind re-anneal to restart annealing
    designUI.designUIElements.reannealButton.mousePressed(() => this.startAnnealing());

    console.log("Annealing complete. Score: ", solution.score);
}

function updateDisplay(currentSolution) {
    // passed as a callback to the annealing process so it can update the display

    clear();
    background(255);
    // show shapes, grid, and annealing scores
    currentSolution.showLayout()
    currentSolution.showScores();
}

function displayResult() {
    // show shapes and grid but not annealing scores
    if (currentSolution) {
        clear();
        background(255);
        currentSolution.showLayout();

        // update growth text if dev mode on and annealing complete
        designUI.show();

        if (!enableCellular) {
            // display annealing scores if not showing cellular scores
            currentSolution.showScores();
        }
        else if (enableCellular) {
            // setup case for cellular and boards
            newCase = new Case(currentSolution);
            newCase.cellular.createTerrain();
            newCase.cellular.calcPathValues();
            newCase.cellular.makeInitialCells();
            newCase.cellular.growCells(numGrow);

            // display cells and terrain (cellular scores)
            newCase.cellular.showTerrain();
            newCase.cellular.showCellLines();
            newCase.cellular.showCells();
        }
    }

}

function keyPressed() {
    if (!isInputScreen) {
        // if (key === 's' || key === 'S') {
        //     // save current case as SVG
        //     newCase.buildLaserSVG();
        //     newCase.displaySVGExport();
        //     newCase.saveSVGExport();
        // } else 
        if (key === 'g') {
            // advance one growth at a time in dev mode
            if (devMode) {
                numGrow++
                displayResult();
            }
        } else if (key === 'd') {
            // toggle dev mode on and off
            devMode = !devMode;

            // update growth text if dev mode on and annealing complete
            designUI.show();

            if (devMode == true) {
                numGrow = 0;
            }

            if (annealingComplete) {
                displayResult();
            }
        }
    }
}

function mousePressed() {
    isMousePressed = true;
    if (isInputScreen) {
        inputUI.selectInputSquare(mouseX, mouseY);
    }
}

function mouseReleased() {
    isMousePressed = false;
}

function mouseDragged() {
    if (isInputScreen && isMousePressed) {
        inputUI.selectInputSquare(mouseX, mouseY, true);
    }
}