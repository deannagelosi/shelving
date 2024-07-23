class InputUI {
    constructor() {
        //== state variables
        this.inputGrid = [];
        this.objectImage = null;
        this.pixelBuffer = null;
        this.maskThreshold = 0.4;
        // dom elements and shape titles
        this.htmlRef = {};
        this.html = {};
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
        this.initRefs();
        this.initHeaderUI();
        this.initInputUI();
    }

    initRefs() {
        // get references to parent dom elements
        this.htmlRef.header = select('#header');
        this.htmlRef.leftBar = select('#left-side-bar');
        this.htmlRef.rightBar = select('#right-side-bar');
        this.htmlRef.bottomDiv = select('#bottom-div');
        this.htmlRef.rightSideTop = select('#right-side-bar .sidebar-top');
        this.htmlRef.rightSideList = select('#right-side-bar .sidebar-list');
        this.htmlRef.rightSideButtons = select('#right-side-bar .sidebar-buttons');
    }

    initHeaderUI() {
        // Setup image upload and threshold slider
        this.html.imageControls = createDiv();
        this.html.imageControls.id('image-controls');
        this.html.imageControls.parent(this.htmlRef.header);

        // Create and append the p element
        this.html.headerInstruct = createElement('p', 'Upload an image to begin');
        this.html.headerInstruct.style('margin', '5px');
        this.html.headerInstruct.parent(this.html.imageControls);

        // Create and append the button element
        this.html.headerUploadButton = createButton('Upload');
        this.html.headerUploadButton.addClass('button green-button');
        this.html.headerUploadButton.parent(this.html.imageControls);
        this.html.headerUploadButton.mousePressed(() => this.handleImageUpload());

        // Create a vertical divider
        const divider = createDiv();
        divider.class('vertical-divider');
        divider.parent(this.html.imageControls);

        // Create and append the slider
        this.html.headerThresholdSlider = createSlider(0.15, 0.6, this.maskThreshold, 0.005);
        this.html.headerThresholdSlider.id('threshold-slider');
        this.html.headerThresholdSlider.parent(this.html.imageControls);
        this.html.headerThresholdSlider.input(() => this.handleThresholdChange());

        // Create and append the clear button
        this.html.headerClearButton = createButton('Clear');
        this.html.headerClearButton.addClass('button red-button');
        this.html.headerClearButton.parent(this.html.imageControls);
        this.html.headerClearButton.mousePressed(() => this.clearGrid());
    }

    initInputUI() {
        //== setup ui elements for input screen
        // create input fields and buttons row div
        this.html.inputDiv = createDiv();
        this.html.inputDiv.parent(this.htmlRef.bottomDiv);
        this.html.inputDiv.id('input-div');

        // create the title input field
        this.html.titleLabel = createP('Title:');
        this.html.titleLabel.parent(this.html.inputDiv);
        this.html.titleLabel.addClass('input-label');
        this.html.titleInput = createInput('');
        this.html.titleInput.parent(this.html.inputDiv);
        this.html.titleInput.addClass('input-field');
        this.html.titleInput.attribute('size', '20');

        // create the ADD button
        this.html.addButton = createButton('Add');
        this.html.addButton.parent(this.html.inputDiv);
        this.html.addButton.addClass('button green-button');
        this.html.addButton.mousePressed(() => this.addShape());

        // create the SAVE SHAPES button
        this.html.saveButton = createButton('Save');
        this.html.saveButton.parent(this.htmlRef.rightSideButtons);
        this.html.saveButton.addClass('button green-button');
        this.html.saveButton.attribute('disabled', ''); // until 2 shapes are saved
        this.html.saveButton.mousePressed(() => this.saveAllShapes());

        // create the LOAD SHAPES button
        this.html.loadButton = createButton('Load');
        this.html.loadButton.parent(this.htmlRef.rightSideButtons);
        this.html.loadButton.addClass('button green-button');
        this.html.loadButton.mousePressed(() => this.loadSavedShapes());

        // create the NEXT button
        this.html.nextButton = createButton('Next');
        this.html.nextButton.parent(this.htmlRef.rightSideButtons);
        this.html.nextButton.addClass('button green-button');
        this.html.nextButton.attribute('disabled', ''); // until 2 shapes are saved
        this.html.nextButton.mousePressed(() => this.nextScreen());

        // initially hide the input elements
        this.hide();
    }

    show() {
        // toggle on the input screen divs
        this.htmlRef.leftBar.addClass('hidden');
        this.htmlRef.rightBar.removeClass('hidden');
        this.htmlRef.bottomDiv.removeClass('hidden');

        // remove hidden class from each element in this.html
        Object.values(this.html).forEach(element => element.removeClass('hidden'));

    }

    hide() {
        // toggle off input screen divs
        this.htmlRef.leftBar.addClass('hidden');
        this.htmlRef.rightBar.addClass('hidden');
        this.htmlRef.bottomDiv.addClass('hidden');

        // add hidden class to each element in this.html
        Object.values(this.html).forEach(element => element.addClass('hidden'));
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
        this.maskThreshold = this.html.headerThresholdSlider.value();
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

    addShape() {
        // find the shape title
        let titleValue = this.html.titleInput.value();
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
            this.html.nextButton.removeAttribute('disabled');
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
                    this.html.nextButton.removeAttribute('disabled');

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
        this.html.titleInput.value('');
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

        for (let i = 0; i < shapes.length; i++) {
            // create item row div
            let titleRow = createDiv().addClass('shape-title');
            titleRow.parent(this.htmlRef.rightSideList);
            // create trash icon
            let trashIcon = createImg('/img/trash.svg');
            trashIcon.size(24, 24);
            trashIcon.style('display', 'inline-block');
            trashIcon.style('cursor', 'pointer');
            trashIcon.style('margin-left', '5px');
            trashIcon.parent(titleRow);

            // create shape title
            let shapeTitle = createP(`${shapes[i].title}`);
            shapeTitle.attribute('data-index', i);
            shapeTitle.parent(titleRow);
            // save row for removal later
            this.shapeTitleElements.push(titleRow);

            // Add event listener to trash icon
            trashIcon.mousePressed(() => {
                let index = shapeTitle.attribute('data-index');
                shapes.splice(index, 1);
                //update displayed list
                this.displayShapeTitles();
            });
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

    //== helper functions
    clearDiv(selector) {
        select(selector).html('');
    }
}
