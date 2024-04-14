let canvasWidth = 600;
let canvasHeight = 600;
let shapes = [];
let solutions = [];
let sa; // simulated annealing
let initialScore;
let loopCount;

let useExample = true;

function preload() {
    shapeData = loadJSON('data/sunny-shapes.json');
}

function setup() {
    createCanvas(canvasWidth, canvasHeight);
    textSize(16);
    fill(0);
    loadShapeData();

    let shapesPos = []; // shape data plus positions
    for (let i = 0; i < shapes.length; i++) {
        let shapeData = {
            data: shapes[i],
            // pos is bottom left corner of the shape, including overhangs
            posX: 0,
            posY: 0,
        };
        shapesPos.push(shapeData);
    }

    let initialSolution = new Solution(shapesPos);
    if (useExample) {
        initialSolution.exampleSolution();
    } else {
        initialSolution.setInitialSolution();
    }
    initialSolution.makeLayout();
    initialSolution.calcScore();
    initialSolution.showLayout();
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

function draw() {
    if (useExample) {
        createCase();
        noLoop(); // stop draw loop

    } else {
        // run simulated annealing
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

function loadShapeData() {
    // loop preloaded data and populate shapes array
    for (let key in shapeData) {
        if (shapeData.hasOwnProperty(key)) {
            let inputShape = shapeData[key];
            // create shape
            let newShape = new Shape(inputShape.title);
            newShape.saveUserInput(inputShape.inputGrid, parseInt(inputShape.shapeDepth));
            shapes.push(newShape);
        }
    }
}

function createCase() {
    clear();
    background(255);
    // build case
    let newCase = new Case(sa.currSolution);
    newCase.createAutomata();
    newCase.growAutomata();
    newCase.makeBoards();

    // show result
    console.log(sa.currSolution);
    sa.currSolution.showLayout();
    newCase.showResult();
}