let canvasWidth = 600;
let canvasHeight = 600;
let shapes = [];

function preload() {
  shapeData = loadJSON('data/sunny-shapes.json');
}

function setup() {
  createCanvas(canvasWidth, canvasHeight);
  textSize(16);
  fill(0);
  loadShapeData();
  console.log(shapes);
}

function draw() {
  clear();
  background(255);

  let solution = new Solution(shapes);
  solution.setInitialSolution();
  solution.makeDesignSpace();
  solution.calcScore();
  solution.showLayout();

  // let newSolution = solution.makeNeighbor();
  // newSolution.makeDesignSpace();
  // newSolution.calcScore();
  // newSolution.showLayout();
  
  // console.log(solution.designSpace);

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