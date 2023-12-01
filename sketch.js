let width = 500;
let height = 500;
let cellSize = 100;
let rows = width / cellSize;
let cols = height / cellSize;
let displayCellSize = width / (rows * 3);
let activeShape;
let shapes = [];
let ui;

function setup() {
  createCanvas(width, height + 200);
  textSize(16);
  fill(0);
  
  activeShape = new Shape(rows, cols);
  ui = new UI(); // setup buttons and input fields
}

function draw() {
  background(255);
  activeShape.drawGrid();
  noLoop();
}

function mousePressed() {
  activeShape.selectCell(mouseX, mouseY);
}