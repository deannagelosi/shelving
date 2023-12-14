let canvasWidth = 600;
let canvasHeight = 600;

let shapes = [];
let shapeInput;
let shapeCase;

let inputView = true;

let buildIssue = false;
let buildAttempts = 0;
let maxBuildAttempts = 400;

// waiting screen
let dotCount = 0;
let lastUpdateTime = 0;
let updateInterval = 500; // Update every 500 milliseconds

function preload() {
  shapeData = loadJSON('data/sunny-shapes.json');
}

function setup() {
  createCanvas(canvasWidth, canvasHeight);
  textSize(16);
  fill(0);

  if (inputView) {
    shapeInput = new ShapeInput(); // setup buttons and input fields
  }
}

function draw() {
  clear();
  background(255);

  if (inputView) {
    // display the input grid
    shapeInput.drawInputGrid();

    noLoop(); // don't loop input screen
  } else {
    // reset buildIssue for this new loop
    buildIssue = false;
    // if first time, setup case
    if (shapeCase == undefined) {
      // // clears any user input and load pre-created shapes instead
      // shapes = [];
      // loadShapeData();

      shapeCase = new Case();
      shapeCase.sortShapes('random'); // 'height' or 'random'
    }

    // create the case, setting buildIssue true if there's an issue
    shapeCase.layoutShapes();
    shapeCase.buildPerimeterBoards();
    shapeCase.buildHorizontalBoards();
    shapeCase.buildVerticalBoards();
    shapeCase.mergeHVBoards();
    shapeCase.labelBoards();

    if (buildIssue == false) {
      buildAttempts = 0; // reset build attempts
      // display the case
      shapeCase.displayShapes(); // display the grid
      shapeCase.displayBoards(); // display the boards

      // no issue, stop looping
      noLoop();
    } else {
      // display "Generating..." with animation
      showGenerating();
      console.log('build issues - regenerating');

      if (buildAttempts > maxBuildAttempts) {
        // to many tries, new sort
        buildAttempts = 0;
        shapeCase.sortShapes('random');
        console.log('max build attempts reached - new sort');
      }
      buildAttempts++;
      loop(); // issue, keep looping
    }
  }
}

function mousePressed() {
  if (inputView) {
    shapeInput.selectInputCell(mouseX, mouseY);
  }
}

function mouseDragged() {
  if (inputView) {
    shapeInput.selectInputCell(mouseX, mouseY);
  }
}

function keyPressed() {
  if (key === 's' || key === 'S') {
    // build the joints
    shapeCase.addJoints();

    // export case as svg
    let caseExport = new CaseExport();
    caseExport.calcDepth();
    caseExport.layoutRects();
    caseExport.printBed();
    // caseExport.displayExport()
    caseExport.graphic.save("caseBoards.svg")
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

function showGenerating() {
  // display "Generating..." with animation
  background(220);
  fill(0);
  textSize(32);
  textAlign(LEFT, CENTER);

  let currentTime = millis();
  if (currentTime - lastUpdateTime > updateInterval) {
    dotCount = (dotCount + 1) % 4; // Cycle dotCount between 0 and 3
    lastUpdateTime = currentTime;
  }

  let textDisplay = "Generating" + ".".repeat(dotCount);
  text(textDisplay, width / 3, height / 2);
}
