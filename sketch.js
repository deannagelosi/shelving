let canvasWidth = 700;
let canvasHeight = 650;

let shapes = [];
let shapeInput;
let shapeCase;

let inputView = false;

let buildIssue = false;

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
  }
}

function draw() {
  clear();
  background(255);
  
  buildIssue = false;
  
  if (inputView) {
    background(255);
    // display the input grid
    shapeInput.drawInputGrid();
  } else {
    // create the case. set buildIssue true if there's an issue
    shapeCase.buildCase();
    shapeCase.buildPerimeterBoards();
    shapeCase.buildHorizontalBoards();
    shapeCase.adjustBoards();
    shapeCase.buildVerticalBoards();

    if (buildIssue == false) {
      // display the case
      shapeCase.displayShapes(); // display the grid
      shapeCase.displayBoards();
    }
  }
  
  if (buildIssue == false) { //
    noLoop(); // no issue, stop looping
  }
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