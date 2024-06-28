let canvasWidth = 625;
let canvasHeight = 625;
let shapes = [];
let shapesPos = [];
let annealing;
let newCase;
let inputMode = true; // don't modify. used for screen switching
let annealingComplete = false;
let currentSolution;
let topLabel = "";

// diagnostic toggles
let useExampleSolution = false;
let enableCellular = false;
let devMode = true;
let numGrow = 0;

function preload() {
    // shapeData = loadJSON('data/cardboard.json');
    shapeData = loadJSON('data/sunny-shapes.json');
}

function setup() {
    createCanvas(canvasWidth, canvasHeight);

    if (inputMode == true) {
        shapeInput = new ShapeInput(); // setup buttons and input fields
    }
}

function draw() {
    if (inputMode) {
        // display the input grid
        shapeInput.drawInputGrid();
        noLoop(); // don't loop input screen

    } else if (!annealing) {
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
        }
    }
    // else if (!annealingComplete) {
    //     // annealing is in progress, update display if needed
    //     background(220);
    //     text("Annealing in progress...", width/2, height/2);
    // }
}

async function startAnnealing() {
    let options = {}; // blank uses default options
    annealing = new Anneal(updateDisplay, options);

    let solution = await annealing.run();
    currentSolution = solution; // save for displayResult
    displayResult();
    annealingComplete = true;

    console.log("Annealing complete. Score: ", solution.score);
    noLoop();
}

function updateDisplay(currentSolution, iteration, temperature) {
    // passed as a callback to the annealing process so it can update the display

    clear();
    background(255);
    // show shapes, grid, and annealing scores
    currentSolution.showLayout()
    currentSolution.showScores();

    textAlign(LEFT);
    text(topLabel, 10, 10);
}

function displayResult() {
    // show shapes and grid but not annealing scores
    if (currentSolution) {
        clear();
        background(255);
        currentSolution.showLayout();

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
            newCase.cellular.showCells();
        }
    }

}

function keyPressed() {
    if (!inputMode) {
        if (key === 's' || key === 'S') {
            // save current case as SVG
            newCase.buildLaserSVG();
            newCase.displaySVGExport();
            newCase.saveSVGExport();
        } else if (key === 'a') {
            // todo: remove this or move to dev mode
            // advance one growth at a time
            numGrow++
            displayResult();
        }
    }
}

function mousePressed() {
    if (inputMode) {
        shapeInput.selectInputSquare(mouseX, mouseY);
    }
}

function mouseDragged() {
    if (inputMode) {
        shapeInput.selectInputSquare(mouseX, mouseY);
    }
}