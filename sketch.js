let canvasWidth = 625;
let canvasHeight = 625;
let shapes = [];
let shapesPos = [];
let annealing;
let newCase;
let inputMode = true; // don't modify. used for screen switching

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
        // run the annealing process
        // (note: if useExampleSolution is true, run() skips annealing and returns example solution)

        let options = {}; // blank uses default options
        annealing = new Anneal(updateDisplay, options);
        let solution = annealing.run();

        noLoop();
    } 
}

function updateDisplay(currentSolution, iteration, temperature) {
    // passed as a callback to the annealing process so it can update the display
    console.log("updateDisplay called");

    clear();
    background(255);
    // show shapes, grid, and annealing scores
    currentSolution.showLayout()
    currentSolution.showScores();

    text(`Iteration: ${iteration}, Temperature: ${temperature.toFixed(2)}`, 10, height - 20);
}

function displayResult(_solution) {
    clear();
    background(255);
    // show shapes and grid but not annealing scores
    _solution.showLayout();

    if (!enableCellular) {
        // display annealing scores if not showing cellular scores
        _solution.showScores();
    }
    else if (enableCellular) {
        // setup case for cellular and boards
        newCase = new Case(_solution);
        newCase.cellular.createTerrain();
        newCase.cellular.calcPathValues();
        newCase.cellular.makeInitialCells();
        newCase.cellular.growCells(numGrow);

        // display cells and terrain (cellular scores)
        newCase.cellular.showTerrain();
        newCase.cellular.showCells();
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
