let canvasWidth = 600;
let canvasHeight = 600;
let shapes = [];
let solutions = [];

function preload() {
  shapeData = loadJSON('data/sunny-shapes.json');
}

function setup() {
  createCanvas(canvasWidth, canvasHeight);
  textSize(16);
  fill(0);
  loadShapeData();
}

function draw() {
  clear();
  background(255);
  solutions = [];

  let solution = new Solution(shapes);
  solution.setInitialSolution();
  solution.makeLayout();
  solution.calcScore();
  solutions.push(solution);

  for (let i = 0; i < 10; i++) {
    let nextSolution = solutions[i].makeNeighbor();
    nextSolution.makeLayout();
    nextSolution.calcScore();
    solutions.push(nextSolution);
  }
  let lastSolution = solutions[solutions.length - 1];  
  lastSolution.showLayout();
  console.log(solutions);

  noLoop();
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