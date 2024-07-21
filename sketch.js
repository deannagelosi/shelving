let canvasWidth = 700;
let canvasHeight = 700;
let shapes = [];
let shapesPos = [];
let annealing;
let newCase;
let inputUI;
let annealUI;
let isInputScreen; // controls active screen (inout or anneal)
let annealingComplete = false;
let currentSolution;
let isMousePressed = false;

// diagnostic toggles
let useExampleSolution = false;
let enableCellular = true;
let devMode = false;
let numGrow = 0;

function preload() {
    // load the example shape data
    loadData('data/sunny-shapes.json').then(json => {
        shapeData = json;
    });
}

async function loadData(url) {
    const response = await fetch(url);
    return await response.json();
}

function setup() {
    let canvasElement = createCanvas(canvasWidth, canvasHeight);
    canvasElement.parent('canvas-container');

    // setup ui elements for both screens
    inputUI = new InputUI();
    annealUI = new AnnealUI();

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
        annealUI.show();
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
    annealing = new Anneal(updateDisplay, annealUI);

    let solution = await annealing.run();
    currentSolution = solution; // save for displayResult
    annealingComplete = true;
    displayResult();

    // rebind re-anneal to restart annealing
    // ui.annealUIElements.reannealButton.mousePressed(() => this.startAnnealing());
    annealUI.bindReannealButton(() => startAnnealing());

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

        if (annealingComplete && devMode) {
            ui.annealUIElements.growthText.removeClass('hidden');
        }

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
    if (!inputScreen) {
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

            // update text
            ui.showAnnealUI();

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