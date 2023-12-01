let width = 500;
let height = 500;
let cellSize = 100;
let rows = width / cellSize;
let cols = height / cellSize;
let shapes = [];
let ui;

function setup() {
  createCanvas(width, height + 200);
  textSize(16);
  fill(0);

  ui = new UI(); // setup buttons and input fields
  ui.setupInputGrid(rows, cols); // setup input grid
}

function draw() {
  background(255);
  // display the input grid
  ui.drawInputGrid();

  noLoop();
}

function mousePressed() {
  ui.selectInputCell(mouseX, mouseY);
}