class InputUI {
    constructor() {
        //== state variables
        this.inputGrid = [];
        this.imgData = {}; // (image, mask, brightness data, etc)
        this.shapes = []; // array of new Shape objects
        // dom elements and shape titles
        this.htmlRef = {};
        this.html = {};
        this.shapeTitleElements = [];

        //== setup
        // ui variables
        this.defaultBrightness = 1.2;
        this.imgBrightness = this.defaultBrightness;
        this.brightStepSize = 0.01;
        this.brightMin = 0.8;
        this.brightMax = 1.8;
        // input grid variables
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
        this.getHtmlRefs();
        this.initHeaderUI();
        this.initBodyUI();
        this.initRightSideUI();

        // initially hide the input elements
        this.hide();
    }

    //== dom element setup methods
    getHtmlRefs() {
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
        //== setup ui elements for header
        // Setup image upload and slider
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
        this.html.headerSlider = createSlider(this.brightMin, this.brightMax, this.imgBrightness, this.brightStepSize);
        this.html.headerSlider.addClass('slider');
        this.html.headerSlider.parent(this.html.imageControls);
        this.html.headerSlider.attribute('disabled', '');

        this.html.headerSlider.input(() => this.handleSliderChange());

        // Create and append the clear button
        this.html.headerClearButton = createButton('Clear');
        this.html.headerClearButton.addClass('button red-button');
        this.html.headerClearButton.parent(this.html.imageControls);
        this.html.headerClearButton.mousePressed(() => this.resetCanvas());
    }

    initBodyUI() {
        //== setup ui elements for body
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
        this.html.titleInput.id('title-input'); // form fields need unique ids
        this.html.titleInput.attribute('size', '20');

        // create the ADD button
        this.html.addButton = createButton('Add');
        this.html.addButton.parent(this.html.inputDiv);
        this.html.addButton.addClass('button green-button');
        this.html.addButton.mousePressed(() => this.addShape());
    }

    initRightSideUI() {
        //== setup ui elements for side bar
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
    }

    //== show/hide methods
    show() {
        // toggle on the input screen divs
        this.htmlRef.leftBar.addClass('hidden');
        this.htmlRef.rightBar.removeClass('hidden');
        this.htmlRef.bottomDiv.removeClass('hidden');

        // remove hidden class from each element in this.html
        Object.values(this.html).forEach(element => element.removeClass('hidden'));

        // temp for testing
        // loadJSON('/examples/sunny-shapes-0.25.json', (shapeData) => {
        //     this.loadShapesJson(shapeData);
        //     this.nextScreen();
        // });
    }

    hide() {
        // toggle off input screen divs
        this.htmlRef.leftBar.addClass('hidden');
        this.htmlRef.rightBar.addClass('hidden');
        this.htmlRef.bottomDiv.addClass('hidden');

        // add hidden class to each element in this.html
        Object.values(this.html).forEach(element => element.addClass('hidden'));
    }

    //== button handlers
    async handleSliderChange() {
        // get slider value
        this.imgBrightness = this.html.headerSlider.value();
        await this.adjustImgBrightness();

        // update the mask for the new brightness and redraw the display
        await this.createImageMask();
        this.drawInputGrid();
    }

    handleImageUpload() {
        const input = createFileInput((file) => {
            if (file.type === 'image') {
                loadImage(file.data, async (img) => {
                    // reset the canvas
                    this.resetCanvas();
                    // setup image
                    this.imgData.img = img;
                    await this.resizeImg();
                    await this.adjustImgBrightness();
                    await this.createImageMask();
                    // update the input grid display
                    this.html.headerSlider.attribute('disabled', '');
                    this.drawInputGrid();
                    // enable the brightness slider
                    this.html.headerSlider.removeAttribute('disabled');
                    // add file name as initial title
                    this.html.titleInput.value(file.name.split('.')[0]);
                });
            } else {
                alert('Select an image file to upload');
            }
        });
        input.hide(); // hide default file input
        input.elt.click(); // open  file dialog on click
    }

    addShape() {
        // find the shape title
        let titleValue = this.html.titleInput.value();
        if (titleValue === '') { // no title entered by user
            titleValue = `shape-${this.shapes.length + 1}`;
        }

        // save the shape
        let newShape = new Shape();
        let gridCopy = this.inputGrid.map(colArray => [...colArray]);
        newShape.saveUserInput(titleValue, gridCopy); // save a copy of the input grid
        this.shapes.push(newShape);

        // Reset active shape and UI
        this.resetCanvas();

        // disable next button (until the user saves the changes)
        this.html.nextButton.attribute('disabled', '');
        // enable save button if there is more than one shape
        if (this.shapes.length >= 1) {
            this.html.saveButton.removeAttribute('disabled');
        }
    }

    saveAllShapes() {
        // save all shapes to a json
        saveJSON(this.shapes, 'shapesData.json');

        // Enable next button once shapes are saved and there are at least 2 shapes
        if (this.shapes.length > 1) {
            this.html.nextButton.removeAttribute('disabled');
        }
    }

    nextScreen() {
        // save the input shapes to the global shapes array
        // remove unnecessary data 
        this.shapes.forEach(shape => {
            delete shape.data.inputGrid;
        });

        allShapes = this.shapes;

        // delete shape list dom elements
        this.clearShapeTitles();

        // change to the next screen (design)
        isInputScreen = false;
        loop();
    }

    loadSavedShapes() {
        // user selects a json file
        const input = createFileInput((file) => {
            if (file.type === 'application' && file.subtype === 'json') {
                const shapeData = file.data;
                // read the shapes in
                this.loadShapesJson(shapeData);

            } else {
                alert('Select a .json file to upload');
            }

        });
        input.hide(); // hide default file input
        input.elt.click(); // open file dialog on click
    }

    loadShapesJson(shapeData) {

        let loadedShapes = [];
        for (let shape of shapeData) {
            // create new shape from saved data
            let newShape = new Shape();
            newShape.saveUserInput(shape.data.title, shape.data.inputGrid);
            loadedShapes.push(newShape);
        }

        this.shapes.push(...loadedShapes);
        // Reset active shape and UI
        this.resetCanvas();

        // enable next button if all shapes are from the load files
        if (this.shapes.length == loadedShapes.length) {
            this.html.nextButton.removeAttribute('disabled');
        } else {
            // user loaded on top of existing shapes, save needed
            this.html.nextButton.attribute('disabled', '');
        }

        // enable save button if there is more than one shape
        if (this.shapes.length >= 1) {
            this.html.saveButton.removeAttribute('disabled');
        }
    }

    //== input grid and display methods
    resetCanvas() {
        background(255);
        this.html.titleInput.value('');
        this.imgData = {};
        this.imgBrightness = this.defaultBrightness;
        this.html.headerSlider.value(this.imgBrightness); // update the slider position
        this.html.headerSlider.attribute('disabled', '');

        this.resetInputGrid();
        this.drawInputGrid();
        this.displayShapeTitles();
    }

    resetInputGrid() {
        // reset the input grid to all false (no selected squares)
        for (let y = 0; y < this.inputRows; y++) {
            this.inputGrid[y] = [];
            for (let x = 0; x < this.inputCols; x++) {
                this.inputGrid[y][x] = false;
            }
        }
    }

    drawInputGrid() {
        background(255);

        if (this.imgData.img) {
            // add image to the canvas
            let topX = this.sidePadding + (this.inputGridWidth - this.imgData.img.width) / 2;
            let topY = this.sidePadding;
            image(this.imgData.img, topX, topY);
        }

        // draw grid
        for (let x = 0; x < this.inputRows; x++) {
            for (let y = 0; y < this.inputCols; y++) {
                // draw input square
                let rectX = x * this.squareSize;
                let rectY = (this.inputGridHeight - this.squareSize) - (y * this.squareSize);

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

        for (let i = 0; i < this.shapes.length; i++) {
            // create item row div
            let titleRow = createDiv().addClass('shape-title');
            titleRow.parent(this.htmlRef.rightSideList);
            // create trash icon
            let trashIcon = createImg('/img/trash.svg', '🗑️'); // emoji backup if svg issue
            trashIcon.size(24, 24);
            trashIcon.style('display', 'inline-block');
            trashIcon.style('cursor', 'pointer');
            trashIcon.style('margin-left', '5px');
            trashIcon.parent(titleRow);

            // create shape title
            let shapeTitle = createP(`${this.shapes[i].data.title}`);
            shapeTitle.attribute('data-index', i);
            shapeTitle.parent(titleRow);
            // save row for removal later
            this.shapeTitleElements.push(titleRow);

            // add event listener to trash icon
            // removes a shape from the list
            trashIcon.mousePressed(() => {
                let index = shapeTitle.attribute('data-index');
                this.shapes.splice(index, 1);

                //update displayed list
                this.displayShapeTitles();

                // disable next button (until the user saves the changes)
                this.html.nextButton.attribute('disabled', '');

                // toggle save button if there are any shapes to save
                if (this.shapes.length >= 1) {
                    this.html.saveButton.removeAttribute('disabled');
                } else {
                    this.html.saveButton.attribute('disabled', '');
                }
            });
        }
    }

    clearShapeTitles() {
        for (let element of this.shapeTitleElements) {
            element.remove();
        }
        this.shapeTitleElements = [];
    }

    //== mouse event handler
    selectInputSquare(mouseX, mouseY, blockSelect = false) {
        // check if mouse click is within input grid
        // factor in padding on all sides
        let xValid = mouseX >= this.sidePadding && mouseX <= this.inputGridWidth + this.sidePadding;
        let yValid = mouseY >= this.sidePadding && mouseY <= this.inputGridHeight + this.sidePadding;
        if (xValid && yValid) {
            let gridX = Math.floor((mouseX - this.sidePadding) / this.squareSize); // column
            let gridY = Math.floor((this.inputGridHeight + this.sidePadding - mouseY) / this.squareSize); // row

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

    //== image handling methods
    async resizeImg() {
        if (this.imgData.img) {
            const aspectRatio = this.inputGridHeight / this.imgData.img.height;
            const newHeight = this.inputGridHeight;
            const newWidth = this.imgData.img.width * aspectRatio;
            // const newHeight = this.inputGridHeight;
            // const newWidth = this.inputGridWidth;
            await this.imgData.img.resize(newWidth, newHeight);
            this.imgData.original = await this.imgData.img.get();
            await this.imgData.original.loadPixels();
        }
    }

    async adjustImgBrightness() {
        if (this.imgData.img && this.imgData.original) {
            // load image pixels if not already loaded
            if (!this.imgData.img.pixels || this.imgData.img.pixels.length === 0) {
                await this.imgData.img.loadPixels();
            }
            if (!this.imgData.original.pixels || this.imgData.original.pixels.length === 0) {
                await this.imgData.original.loadPixels();
            }

            if (this.imgData.brightData && this.imgData.brightData[this.imgBrightness]) {
                // reuse stored image if brightness has been adjusted before
                this.imgData['img'] = this.imgData.brightData[this.imgBrightness].objectImage;
            } else {
                // Create a new version of the image with adjusted brightness
                let newImg = await this.imgData.img.get();
                await newImg.loadPixels();

                for (let y = 0; y < newImg.height; y++) {
                    for (let x = 0; x < newImg.width; x++) {
                        let index = (x + y * newImg.width) * 4;
                        newImg.pixels[index] = min(255, this.imgData.original.pixels[index] * this.imgBrightness); // Red
                        newImg.pixels[index + 1] = min(255, this.imgData.original.pixels[index + 1] * this.imgBrightness); // Green
                        newImg.pixels[index + 2] = min(255, this.imgData.original.pixels[index + 2] * this.imgBrightness); // Blue
                        // alpha channel unchanged
                    }
                }
                await newImg.updatePixels();
                this.imgData.img = newImg;

                await this.setPixelBuffer();

                // save adjusted results for future use
                if (!this.imgData.brightData) this.imgData.brightData = {};
                if (!this.imgData.brightData[this.imgBrightness]) this.imgData.brightData[this.imgBrightness] = {};
                this.imgData.brightData[this.imgBrightness].objectImage = newImg;
            }
        }
    }

    async createImageMask() {
        if (this.imgData.img) {
            // check if an image mask for this brightness has already been created
            if (this.imgData.brightData && this.imgData.brightData[this.imgBrightness] && this.imgData.brightData[this.imgBrightness].inputGrid) {
                // reuse stored mask if it exists
                this.inputGrid = this.imgData.brightData[this.imgBrightness].inputGrid;
                return;
            }

            // ensure pixel buffer is setup (an offscreen rendering of just the image)
            if (!this.imgData.maskBuffer) await this.setPixelBuffer();

            // loop the gird and find the mask value for each square
            let tempGrid = [];
            for (let y = 0; y < this.inputRows; y++) {
                tempGrid.push([]);
                for (let x = 0; x < this.inputCols; x++) {
                    tempGrid[y].push(this.getAverageSquareBW(y, x));
                }
            }
            // flip the grid vertically (make 0,0 be bottom left. default is top left)
            tempGrid.reverse();

            // save the image mask for future use
            if (!this.imgData.brightData) this.imgData.brightData = {};
            if (!this.imgData.brightData[this.imgBrightness]) this.imgData.brightData[this.imgBrightness] = {};
            this.imgData.brightData[this.imgBrightness].inputGrid = tempGrid;

            // update the input grid
            this.inputGrid = tempGrid.map(colArray => [...colArray]);
        } else {
            console.error('No image or pixel buffer to create mask');
        }
    }

    async setPixelBuffer() {
        if (this.imgData.img) {
            // Create a mask for the input grid from the image

            // setup offscreen buffer if not already created
            if (!this.imgData.maskBuffer) {
                this.imgData['maskBuffer'] = createGraphics(this.inputGridWidth, this.inputGridHeight);
                await this.imgData.maskBuffer.pixelDensity(1);
            }
            // clear the buffer canvas
            await this.imgData.maskBuffer.background(255);

            // add image to the pixel buffer
            let xBuffer = (this.inputGridWidth - this.imgData.img.width) / 2; // centers the image
            await this.imgData.maskBuffer.image(this.imgData.img, xBuffer, 0);
            await this.imgData.maskBuffer.loadPixels();
        }
    }

    getAverageSquareBW(_y, _x) {
        const bufferWidth = this.imgData.maskBuffer.width;
        const bufferHeight = this.imgData.maskBuffer.height;

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

                if (index < 0 || index >= this.imgData.maskBuffer.pixels.length - 3) {
                    continue;
                }

                const r = this.imgData.maskBuffer.pixels[index];
                const g = this.imgData.maskBuffer.pixels[index + 1];
                const b = this.imgData.maskBuffer.pixels[index + 2];

                const brightness = (r + g + b) / 3;
                minBrightness = Math.min(minBrightness, brightness);  // update minimum brightness
                pixelCount++;
            }
        }

        if (pixelCount === 0) {
            return false;
        }

        return minBrightness < (255 * 0.5); // 50% threshold
    }
}
