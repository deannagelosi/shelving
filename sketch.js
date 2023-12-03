let canvasWidth = 700;
let canvasHeight = 625;

let shapes = [];
let shapeInput;
let shapeCase;

let inputView = false;

function preload() {
  shapeData = loadJSON('data/test-shapes.json');
}

function setup() {
  createCanvas(canvasWidth, canvasHeight);
  textSize(16);
  fill(0);

  if (inputView) {
    shapeInput = new ShapeInput(); // setup buttons and input fields
  } else {
    // case view
    loadShapeData();  
    shapeCase = new Case();
    shapeCase.sortShapes();
    shapeCase.buildCase();
  }

}

function draw() {
  if (inputView) {
    background(255);
    // display the input grid
    shapeInput.drawInputGrid();
  }

  noLoop();
}

function mousePressed() {
  if (inputView) {
    shapeInput.selectInputCell(mouseX, mouseY);
  }
}

function loadShapeData() {
  for (let key in shapeData) {
    if (shapeData.hasOwnProperty(key)) {
      let inputShape = shapeData[key];
      // create shape
      let newShape = new Shape(inputShape.title);
      newShape.saveUserInput(inputShape.inputGrid);
      shapes.push(newShape);
    }
  }
}