let canvasWidth = 600;
let canvasHeight = 600;
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

function preload() {
    shapeData = loadJSON('data/cardboard.json');
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
    console.log(annealing.currSolution);

    // build case
    newCase = new Case(annealing.currSolution);
    newCase.cellular.createTerrain();
    newCase.cellular.calcPathValues();
    newCase.cellular.showTerrain(devMode);
}

function keyPressed() {
    if (!inputMode) {
        if (key === 's' || key === 'S') {
            // save current case as SVG
            newCase.buildLaserSVG();
            newCase.displaySVGExport();
            newCase.saveSVGExport();
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