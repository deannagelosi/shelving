class InputUI {
    constructor() {
        //== state variables
        this.inputGrid = [];
        this.objectImage = null;
        this.pixelBuffer = null;
        this.maskThreshold = 0.5;
        // dom elements and shape titles
        this.headerElements = {};
        this.bodyElements = {};
        this.shapeTitleElements = [];

        //== input grid variables
        this.maxInputInches = 10;
        this.gridInchSize = 0.25; // each square is 0.25 inches
        this.inputRows = Math.floor(this.maxInputInches / this.gridInchSize);
        this.inputCols = this.inputRows;

        // calc input grid size
        this.squareSize = Math.round((Math.min(canvasWidth, canvasHeight) / (this.inputRows + 1)));
        this.inputGridHeight = (this.inputRows * this.squareSize);
        this.inputGridWidth = (this.inputCols * this.squareSize);
        this.sidePadding = Math.max(canvasWidth - this.inputGridWidth, canvasHeight - this.inputGridHeight) / 2;

        //== mouse click delay (debounce)
        this.lastClickTime = 0;
        this.clickDelay = 200; // milliseconds

        //== setup input grid
        this.resetInputGrid()

        //== initialize UI elements
        this.initHeaderUI();
        this.initInputUI();
    }

    initHeaderUI() {
        // Select the existing header div
        const headerDiv = select('#header');

        // Create and append the h1 element
        this.headerElements.title = createElement('h1', 'Generative Shelving');
        this.headerElements.title.parent(headerDiv);

        // Create a new container for interactive elements
        const interactiveContainer = createDiv();
        interactiveContainer.id('interactive-container');
        interactiveContainer.parent(headerDiv);

        // Create and append the p element
        this.headerElements.instructions = createElement('p', 'Upload an image to begin');
        this.headerElements.instructions.parent(interactiveContainer);

        // Create and append the button element
        this.headerElements.uploadButton = createButton('Upload');
        this.headerElements.uploadButton.id('upload-button');
        this.headerElements.uploadButton.parent(interactiveContainer);
        this.headerElements.uploadButton.mousePressed(() => this.handleImageUpload());

        // Create a vertical divider
        const divider = createDiv();
        divider.class('vertical-divider');
        divider.parent(interactiveContainer);

        // Create and append the slider
        this.headerElements.thresholdSlider = createSlider(0, 1, this.maskThreshold, 0.01);
        this.headerElements.thresholdSlider.id('threshold-slider');
        this.headerElements.thresholdSlider.parent(interactiveContainer);
        this.headerElements.thresholdSlider.input(() => this.handleThresholdChange());

        // Create and append the clear button
        this.headerElements.clearButton = createButton('Clear');
        this.headerElements.clearButton.id('clear-button');
        this.headerElements.clearButton.parent(interactiveContainer);
        this.headerElements.clearButton.mousePressed(() => this.clearGrid());
    }

    initInputUI() {
        //== setup dom elements
        // retrieve reference to ui container div
        this.uiContainer = select('#ui-container');
        this.inputContainer = createDiv().parent(this.uiContainer).id('input-container');

        //== setup ui elements for input screen
        // create input fields and buttons row div
        this.bodyElements.inputButtonRow = createDiv();
        this.bodyElements.inputButtonRow.parent(this.inputContainer);
        this.bodyElements.inputButtonRow.addClass('input-button-row');

        // create the title input field
        this.bodyElements.titleLabel = createP('Title:');
        this.bodyElements.titleLabel.parent(this.bodyElements.inputButtonRow).addClass('input-label');
        this.bodyElements.titleInput = createInput('');
        this.bodyElements.titleInput.parent(this.bodyElements.inputButtonRow).addClass('input-field');
        this.bodyElements.titleInput.attribute('size', '20');

        // create the SAVE button
        this.bodyElements.saveButton = createButton('SAVE');
        this.bodyElements.saveButton.parent(this.bodyElements.inputButtonRow).addClass('button');
        this.bodyElements.saveButton.mousePressed(() => this.saveShape());

        // create the NEXT button
        this.bodyElements.nextButton = createButton('ANNEAL');
        this.bodyElements.nextButton.parent(this.bodyElements.inputButtonRow).addClass('button');
        this.bodyElements.nextButton.attribute('disabled', ''); // until 2 shapes are saved
        this.bodyElements.nextButton.mousePressed(() => this.nextScreen());

        // create the LOAD SAVED SHAPES button
        this.bodyElements.loadButton = createButton('LOAD SAVED SHAPES');
        this.bodyElements.loadButton.parent(this.bodyElements.inputButtonRow).addClass('button');
        this.bodyElements.loadButton.mousePressed(() => this.loadSavedShapes());

        // create a container for shape titles
        this.bodyElements.shapeTitleContainer = createDiv('');
        this.bodyElements.shapeTitleContainer.parent(this.inputContainer).id('shape-title-container');

        // initially hide the input container
        this.hide();
    }

    show() {
        this.inputContainer.removeClass('hidden');
    }

    hide() {
        this.inputContainer.addClass('hidden');
    }

    //== mouse event handler
    selectInputSquare(mouseX, mouseY, blockSelect = false) {
        // check if mouse click is within input grid
        // factor in padding on all sides
        let xValid = mouseX >= this.sidePadding && mouseX <= this.inputGridWidth + this.sidePadding;
        let yValid = mouseY >= this.sidePadding && mouseY <= this.inputGridHeight + this.sidePadding;
        if (xValid && yValid) {
            let gridX = Math.floor((mouseX - this.sidePadding) / this.squareSize); // column
            let gridY = Math.floor((mouseY - this.sidePadding) / this.squareSize); // row

            if (gridX >= 0 && gridX < this.inputCols && gridY >= 0 && gridY < this.inputRows) {
                let currentTime = millis();
                if (blockSelect || (currentTime - this.lastClickTime > this.clickDelay)) {
                    if (blockSelect) {
                        // used when dragging mouse
                        this.inputGrid[gridY][gridX] = true;
                    } else {
                        // used when clicking mouse
                        this.inputGrid[gridY][gridX] = !this.inputGrid[gridY][gridX];
                        this.lastClickTime = currentTime;
                    }
                    this.drawInputGrid();
                }
            }
        }
    }

    //== button handlers
    handleThresholdChange() {
        // set mask to slider value
        this.maskThreshold = this.headerElements.thresholdSlider.value();
        this.createImageMask();
        this.drawInputGrid();
    }

    clearGrid() {
        this.resetCanvas();
        this.objectImage = null;
        this.pixelBuffer = null;
        this.drawInputGrid();
    }

    handleImageUpload() {
        const input = createFileInput((file) => {
            if (file.type === 'image') {
                loadImage(file.data, (img) => {
                    // setup image
                    this.objectImage = img;
                    this.resizeBackgroundImage();
                    this.setPixelBuffer();
                    this.createImageMask();
                    // update the input grid display
                    this.drawInputGrid();
                });
            } else {
                console.error('Please upload an image file');
            }
        });
        input.hide(); // hide default file input
        input.elt.click(); // open  file dialog on click
    }


    saveShape() {
        // find the shape title
        let titleValue = this.bodyElements.titleInput.value();
        if (titleValue === '') { // no title entered by user
            titleValue = `shape-${shapes.length + 1}`;
        }

        // save the shape
        let newShape = new Shape();
        let gridCopy = this.inputGrid.map(colArray => [...colArray]);
        newShape.saveUserInput(titleValue, gridCopy); // save a copy of the input grid
        shapes.push(newShape);

        // Reset active shape and UI
        this.resetCanvas();

        // Enable the NEXT button if 2 shapes have been saved
        if (shapes.length > 1) {
            this.bodyElements.nextButton.removeAttribute('disabled');
        }

        isMousePressed = false;
    }

    nextScreen() {
        // note: saveJSON(shapes, 'shapesData.json');

        // 1. prep the inputted shapes for annealing the first solution
        // - wrap user inputted shapes with extra position
        // - gives each solution unique position data, while sharing the same shape data
        shapesPos = [];
        for (let i = 0; i < shapes.length; i++) {
            let shapeData = {
                data: shapes[i],
                // pos is bottom left corner of the shape, including overhangs
                posX: 0,
                posY: 0,
            };
            shapesPos.push(shapeData);
        }
        this.clearShapeTitles();

        // 2. change to the next user screen (annealing)
        // Switch away from the input screen
        isInputScreen = false;
        isMousePressed = false;
        loop();
    }

    loadSavedShapes() {
        // user selects a json file
        const input = createFileInput((file) => {
            if (file.type === 'application' && file.subtype === 'json') {
                const shapeData = file.data;
                console.log(shapeData);
                // read the shapes in
                shapes = [];
                for (let shape of shapeData) {
                    // create new shape from saved data
                    let newShape = new Shape();
                    newShape.saveUserInput(shape.title, shape.inputGrid);
                    shapes.push(newShape);
                }
                // update the UI
                this.resetCanvas();
                if (shapes.length > 1) {
                    this.bodyElements.nextButton.removeAttribute('disabled');

                }
            } else {
                alert('Please select a .json file');
            }
        });
        input.hide(); // hide default file input
        input.elt.click(); // open file dialog on click
    }

    //== input grid display methods
    resetInputGrid() {
        // reset the input grid to all false (no selected squares)
        for (let y = 0; y < this.inputRows; y++) {
            this.inputGrid[y] = [];
            for (let x = 0; x < this.inputCols; x++) {
                this.inputGrid[y][x] = false;
            }
        }
    }

    resetCanvas() {
        background(255);
        this.bodyElements.titleInput.value('');
        this.objectImage = null;

        this.resetInputGrid();
        this.drawInputGrid();
        this.displayShapeTitles();
    }

    setPixelBuffer() {
        if (this.objectImage) {
            // Create a mask for the input grid from the image
            // threshold is a value between 0 and 1

            // add image to the pixel buffer
            let centerImage = (this.inputGridWidth - this.objectImage.width) / 2;
            this.pixelBuffer = createGraphics(this.inputGridWidth, this.inputGridHeight);
            this.pixelBuffer.pixelDensity(1);
            this.pixelBuffer.background(255);

            this.pixelBuffer.image(this.objectImage, centerImage, 0);
            this.pixelBuffer.loadPixels();
        }
    }

    createImageMask() {
        if (this.objectImage && this.pixelBuffer.pixels) {
            // loop the gird and find the mask value for each square
            for (let y = 0; y < this.inputRows; y++) {
                this.inputGrid[y] = [];
                for (let x = 0; x < this.inputCols; x++) {
                    this.inputGrid[y][x] = this.getAverageSquareBW(y, x, this.maskThreshold);
                }
            }
        } else {
            console.error('No image or pixel buffer to create mask');
        }
    }

    drawInputGrid() {
        background(255);

        if (this.objectImage) {
            // add image to the canvas
            let topX = this.sidePadding + (this.inputGridWidth - this.objectImage.width) / 2;
            let topY = this.sidePadding;
            image(this.objectImage, topX, topY);
        }

        // draw grid
        for (let x = 0; x < this.inputRows; x++) {
            for (let y = 0; y < this.inputCols; y++) {
                // draw input square
                let rectX = x * this.squareSize;
                // let rectY = (this.inputGridHeight - this.squareSize) - (y * this.squareSize);
                let rectY = (y * this.squareSize);

                // Fill selected squares
                if (this.inputGrid[y][x]) {
                    // semi-transparent black squares for selected
                    fill(0, 128);
                    rect(this.sidePadding + rectX, this.sidePadding + rectY, this.squareSize, this.squareSize);
                } else {
                    // transparent squares for unselected
                    stroke(0);
                    noFill();
                    rect(this.sidePadding + rectX, this.sidePadding + rectY, this.squareSize, this.squareSize);
                }
            }
        }
    }

    displayShapeTitles() {
        this.clearShapeTitles();

        let titleContainer = this.bodyElements.shapeTitleContainer

        for (let i = shapes.length - 1; i >= 0; i--) {
            let shapeTitle = createP(`${shapes[i].title}`).addClass('shape-title');
            shapeTitle.parent(titleContainer);
            this.shapeTitleElements.push(shapeTitle);
        }
    }

    clearShapeTitles() {
        for (let element of this.shapeTitleElements) {
            element.remove();
        }
        this.shapeTitleElements = [];
    }

    //== image handling
    resizeBackgroundImage() {
        if (this.objectImage) {
            const aspectRatio = this.inputGridHeight / this.objectImage.height;
            const newHeight = this.inputGridHeight;
            const newWidth = this.objectImage.width * aspectRatio;
            // const newHeight = this.inputGridHeight;
            // const newWidth = this.inputGridWidth;
            this.objectImage.resize(newWidth, newHeight);
        }
    }

    getAverageSquareBW(_y, _x, _threshold) {
        const bufferWidth = this.pixelBuffer.width;
        const bufferHeight = this.pixelBuffer.height;

        // calculate the start and end corners of the square
        const startX = Math.floor((_x * this.squareSize / this.inputGridWidth) * bufferWidth);
        const startY = Math.floor((_y * this.squareSize / this.inputGridHeight) * bufferHeight);
        const endX = Math.min(startX + this.squareSize, bufferWidth);
        const endY = Math.min(startY + this.squareSize, bufferHeight);

        let minBrightness = 255;  // start with max possible brightness
        let pixelCount = 0;

        // loop through all pixels in the square
        // look for the darkest pixel (occupied)
        for (let y = startY; y < endY; y++) {
            for (let x = startX; x < endX; x++) {
                const index = (y * bufferWidth + x) * 4;

                if (index < 0 || index >= this.pixelBuffer.pixels.length - 3) {
                    continue;
                }

                const r = this.pixelBuffer.pixels[index];
                const g = this.pixelBuffer.pixels[index + 1];
                const b = this.pixelBuffer.pixels[index + 2];

                const brightness = (r + g + b) / 3;
                minBrightness = Math.min(minBrightness, brightness);  // update minimum brightness
                pixelCount++;
            }
        }

        if (pixelCount === 0) {
            return false;
        }

        // threshold determines how dark a pixel needs to be to be considered occupied
        // lower threshold makes it less sensitive to slight darkness, higher more sensitive
        const darknessThreshold = 255 * (_threshold);
        return minBrightness < darknessThreshold;
    }
}
