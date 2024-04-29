let canvasWidth = 600;
let canvasHeight = 600;
let shapes = [];
let shapesPos = [];
let solutions = [];
let sa; // simulated annealing
let initialScore;
let loopCount;
let newCase;
let inputMode = true;

// diagnostic toggles
let useExample = true;

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
        if (!sa) {
            initialSolution();
        }

        if (useExample) {
            // use example solution on example shapes
            createCase();
            noLoop();
        } 
        else {
            // optimization loop to anneal the solution
            if (sa.epoch()) {
                // continue optimization
                sa.tempCurr = sa.coolingSchedule();
                loopCount++;
                if (loopCount % 10 == 0) {
                    clear();
                    background(255);
                    sa.currSolution.showLayout()
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
    // build case
    newCase = new Case(sa.currSolution);
    newCase.createAutomata();
    newCase.growAutomata();
    newCase.makeBoards();

    // show result
    sa.currSolution.showLayout();
    newCase.showResult();

    console.log(sa.currSolution);
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
        shapeInput.selectInputCell(mouseX, mouseY);
    }
}

function mouseDragged() {
    if (inputMode) {
        shapeInput.selectInputCell(mouseX, mouseY);
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
    if (useExample) {
        initialSolution.exampleSolution();
    } else {
        initialSolution.setInitialSolution();
    }
    initialSolution.makeLayout();
    initialSolution.calcScore();
    initialScore = initialSolution.score;

    let tempMax = 5000;
    let tempMin = 1;

    sa = new SimulatedAnnealing(
        tempMax,
        tempMin,
        initialSolution
    );

    loopCount = 0;
}