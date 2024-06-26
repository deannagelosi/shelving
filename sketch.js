let canvasWidth = 625;
let canvasHeight = 625;
let shapes = [];
let shapesPos = [];
let solutions = [];
let annealing; // simulated annealing
let initialScore;
let loopCount;
let newCase;
let inputMode = true;

// diagnostic toggles
let useExampleSolution = true;
let devMode = true;
let numGrow = 0;

function preload() {
    // shapeData = loadJSON('data/cardboard.json');
    shapeData = loadJSON('data/sunny-shapes.json');
}

function setup() {
    createCanvas(canvasWidth, canvasHeight);
    textSize(16);
    fill(0);

    if (inputMode == true) {
        shapeInput = new ShapeInput(); // setup buttons and input fields
    }
}

function draw() {
    if (inputMode) {
        // display the input grid
        shapeInput.drawInputGrid();
        noLoop(); // don't loop input screen

    } else {
        if (!annealing) {
            initialSolution();
        }

        if (useExampleSolution) {
            // use example solution on example shapes
            console.log(annealing.currSolution);
            createCase();
            noLoop();
        }
        else {
            // optimization loop for annealing the solution
            if (annealing.epoch()) {
                // continue optimization
                annealing.tempCurr = annealing.coolingSchedule();
                loopCount++;
                if (loopCount % 10 == 0) {
                    clear();
                    background(255);
                    annealing.currSolution.showLayout(devMode)
                    annealing.currSolution.showScores(devMode);
                }
            } else {
                // optimization complete
                console.log(annealing.currSolution);
                createCase();
                noLoop(); // stop draw loop
            }
        }
    }
}

function createCase() {
    clear();
    background(255);
    // show shapes and grid
    annealing.currSolution.showLayout(devMode);

    // build case
    newCase = new Case(annealing.currSolution);
    newCase.cellular.createTerrain();
    newCase.cellular.calcPathValues();
    newCase.cellular.makeInitialCells();
    newCase.cellular.growCells(numGrow);

    // display cells and terrain
    newCase.cellular.showTerrain(devMode);
    newCase.cellular.showCells();
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
            createCase();
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

function initialSolution() {
    // populate the user input shapes into shapesPos
    shapesPos = []; // shape data plus positions
    for (let i = 0; i < shapes.length; i++) {
        let shapeData = {
            data: shapes[i],
            // pos is bottom left corner of the shape, including overhangs
            posX: 0,
            posY: 0,
        };
        shapesPos.push(shapeData);
    }

    // generate the initial solution
    let initialSolution = new Solution(shapesPos);
    if (useExampleSolution) {
        initialSolution.exampleSolution();
    } else {
        initialSolution.setInitialSolution();
    }
    initialSolution.makeLayout();
    initialSolution.calcScore();
    initialScore = initialSolution.score;

    let tempMax = 5000;
    let tempMin = 1;

    annealing = new Anneal(
        tempMax,
        tempMin,
        initialSolution
    );

    loopCount = 0;
}