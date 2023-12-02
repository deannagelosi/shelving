let width = 500;
let height = 500;
let cellSize = 100;
let rows = width / cellSize;
let cols = height / cellSize;
let shapes = [];
let ui;

function preload() {
  shapeData = loadJSON('data/test-shapes.json');
}

function setup() {
  createCanvas(width, height + 200);
  textSize(16);
  fill(0);

  ui = new UI(); // setup buttons and input fields
  // ui.setupInputGrid(rows, cols); // setup input grid  

  loadShapeData();
}

function draw() {
  background(255);
  // display the input grid
  // ui.drawInputGrid();

  noLoop();
}

function mousePressed() {
  ui.selectInputCell(mouseX, mouseY);
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