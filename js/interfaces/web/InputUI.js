class InputUI {
    constructor() {
        //== state variables
        this.inputGrid = [];
        this.imgData = {}; // (image, mask, brightness data, etc)
        // dom elements
        this.html = {};
        this.shapeTitleElements = [];
        // flags
        this.eraseMode = "first";

        //== setup
        // ui variables
        this.defaultBrightness = 1.2;
        this.imgBrightness = this.defaultBrightness;
        this.brightStepSize = 0.01;
        this.brightMin = 0.8;
        this.brightMax = 1.8;
        // input grid variables
        this.maxInputInches = 10; // default grid size in inches
        this.gridInchSize = SQUARE_SIZE; // inches per grid square
        this.inputRows;
        this.inputCols;
        // calc input grid size
        this.squareSize;
        this.inputGridHeight;
        this.inputGridWidth;
        this.sidePadding;

        //== mouse click delay (debounce)
        this.lastClickTime = 0;
        this.clickDelay = 200; // milliseconds

        //== initialize UI elements
        this.initHeaderUI();
        this.initBottomUI();
        this.initSidebarButtons();

        //== event listeners
        // listen for screen changes to manage visibility
        appEvents.on('screenChanged', ({ screen }) => {
            if (screen === ScreenState.INPUT) {
                this.show();
            } else {
                this.hide();
            }
        });
    }

    computeState() {
        // centralized UI button state logic
        return {
            canExport: appState.shapes.length >= 1,
            canNext: appState.shapes.length >= 2,
            hasShapes: appState.shapes.length > 0
        };
    }

    initSidebarButtons() {
        // create sidebar buttons (hidden until screen is shown)
        this.html.importButton = createButton('Import')
            .addClass('button secondary-button hidden')
            .parent(htmlRefs.right.buttons)
            .mousePressed(() => this.handleImport());

        this.html.exportButton = createButton('Export')
            .addClass('button primary-button hidden')
            .parent(htmlRefs.right.buttons)
            .mousePressed(() => this.handleExport());

        this.html.nextButton = createButton('Next')
            .addClass('button primary-button hidden')
            .parent(htmlRefs.right.buttons)
            .mousePressed(() => this.handleNext());
    }

    initHeaderUI() {
        // create header elements  (hidden until screen is shown)
        // setup image upload and slider
        this.html.imageControls = createDiv()
            .id('image-controls')
            .addClass('hidden')
            .parent(htmlRefs.headerControls);

        // grid size selector
        let gridSizeDiv = createDiv()
            .class('grid-size-control')
            .parent(this.html.imageControls);

        // label
        this.html.gridLabel = createSpan('Grid size (in): ')
            .parent(gridSizeDiv);
        // grid size input
        this.html.gridSizeInput = createInput(String(this.maxInputInches), 'number')
            .attribute('min', '1')
            .attribute('max', '12')
            .parent(gridSizeDiv)
            .input(() => this.adjustGridSize());

        // create a vertical divider
        this.html.dividerLeft = createDiv()
            .class('vertical-divider')
            .parent(this.html.imageControls);

        // create upload button
        this.html.headerUploadButton = createButton('Upload image')
            .addClass('button primary-button')
            .parent(this.html.imageControls)
            .mousePressed(() => this.handleImageUpload());

        // create a vertical divider
        this.html.dividerRight = createDiv()
            .class('vertical-divider')
            .parent(this.html.imageControls);

        // create brightness slider
        this.html.sliderDiv = createDiv()
            .class('slider-control')
            .parent(this.html.imageControls);
        this.html.fillBox = createDiv()
            .class('slider-icon filled')
            .parent(this.html.sliderDiv);
        this.html.headerSlider = createSlider(this.brightMin, this.brightMax, this.imgBrightness, this.brightStepSize)
            .addClass('slider')
            .parent(this.html.sliderDiv)
            .input(() => this.handleSliderChange());
        this.html.emptyBox = createDiv()
            .class('slider-icon empty')
            .parent(this.html.sliderDiv);

        // create and append the clear button
        this.html.headerClearButton = createButton('Clear')
            .addClass('button secondary-button')
            .parent(this.html.imageControls)
            .mousePressed(() => this.resetCanvas());
    }

    initBottomUI() {
        // create bottom elements (under canvas)
        // hidden until screen is shown
        this.html.inputDiv = createDiv()
            .id('input-div')
            .addClass('hidden')
            .parent(htmlRefs.bottomDiv);

        // create the shape title input field
        this.html.titleLabel = createP('Title:')
            .parent(this.html.inputDiv)
            .addClass('input-label');

        this.html.titleInput = createInput('')
            .parent(this.html.inputDiv)
            .addClass('input-field')
            .id('title-input') // form fields need unique ids
            .attribute('size', '20');

        // create the SAVE button
        this.html.saveButton = createButton('Save')
            .parent(this.html.inputDiv)
            .addClass('button primary-button')
            .mousePressed(() => this.handleSaveShape());
    }

    //== show/hide methods
    // manage visibility and screen-specific setup
    show() {
        // show all input screen elements
        Object.values(this.html).forEach(element => element.removeClass('hidden'));

        // reset the canvas
        clear();
        background(255);

        // setup and draw the blank input grid
        this.updateGridSize();
    }

    hide() {
        // hide all input screen elements
        Object.values(this.html).forEach(element => element.addClass('hidden'));
    }

    update() {
        // update button states based on current appState
        const state = this.computeState();
        updateButton(this.html.exportButton, state.canExport);
        updateButton(this.html.nextButton, state.canNext);

        // update dynamic lists
        this.displayShapeTitles();
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

    handleSaveShape() {
        // find the shape title
        let titleValue = this.html.titleInput.value().trim();
        if (titleValue === '') { // no title entered by user
            titleValue = `shape-${appState.shapes.length + 1}`;
        }

        // save the shape
        let newShape = new Shape();
        let gridCopy = this.inputGrid.map(colArray => [...colArray]);
        newShape.saveUserInput(titleValue, gridCopy); // save a copy of the input grid
        appState.shapes.push(newShape);

        // reset active shape and UI
        this.resetCanvas();

        // notify ui update manager
        appEvents.emit('stateChanged');
    }

    handleExport() {
        // trigger global export functionality
        appEvents.emit('exportRequested');
    }

    handleNext() {
        // change to design screen
        changeScreen(ScreenState.DESIGN);
    }

    handleImport() {
        // user selects a json file
        const input = createFileInput((file) => {
            if (file.type === 'application' && file.subtype === 'json') {
                const importedData = file.data;
                // read the shapes in
                this.loadJsonData(importedData);
            } else {
                alert('Select a .json file to upload');
            }
        });
        input.hide(); // hide default file input
        input.elt.click(); // open file dialog on click
    }
    //== end button handlers

    loadJsonData(_importedData) {
        // handles loading saved shapes from json file
        let shapeData = _importedData.allShapes;
        let annealData = _importedData.savedAnneals;

        // process shape data
        let loadedShapes = shapeData.map(shapeData => Shape.fromDataObject(shapeData));
        // add shapes
        appState.shapes.push(...loadedShapes);

        // process anneal data
        let maxSolutionNum = 0;
        let loadedAnneals = [];
        for (let anneal of annealData) {
            // find the largest anneal number (ex: 4 on 'solution-4')
            let titleNumber = parseInt(anneal.title.split('-')[1]);
            maxSolutionNum = Math.max(maxSolutionNum, titleNumber);
            // create new solution from saved data to restore class methods
            anneal.finalSolution = Solution.fromDataObject(anneal.finalSolution);

            loadedAnneals.push(anneal);
        }
        // add anneals and the highest solution number
        appState.savedAnneals.push(...loadedAnneals);
        appState.totalSavedAnneals = maxSolutionNum;

        // reset UI
        this.resetCanvas();
        // notify ui update manager
        appEvents.emit('stateChanged');
    }

    adjustGridSize() {
        // adjust the grid size in inches
        const newValue = parseInt(this.html.gridSizeInput.value());

        let newSize = constrain(newValue, 1, 12);
        this.html.gridSizeInput.value(newSize);
        this.maxInputInches = newSize;
        this.updateGridSize();
        this.resetCanvas();
    }

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

        const yOffset = canvasHeight - this.sidePadding - this.squareSize;
        const xOffset = this.sidePadding;

        // draw grid
        for (let y = 0; y < this.inputRows; y++) {
            for (let x = 0; x < this.inputCols; x++) {
                // draw input square
                const rectY = yOffset - (y * this.squareSize);
                const rectX = xOffset + (x * this.squareSize);

                // Fill selected squares
                if (this.inputGrid[y][x]) {
                    // semi-transparent color squares for selected
                    stroke("rgba(204,204,204, 0.25)");
                    fill("rgba(111, 0, 255, 0.5)"); // purple
                    rect(rectX, rectY, this.squareSize, this.squareSize);
                } else {
                    // transparent squares for unselected
                    stroke("rgb(204,204,204)");
                    noFill();
                    rect(rectX, rectY, this.squareSize, this.squareSize);
                }
            }
        }

        // draw inch marker lines
        stroke(0);
        for (let y = 0; y < this.inputRows + 1; y++) {
            // draw a line for every 4th y value
            if (y % 4 === 0) {
                line(
                    xOffset, // startX
                    yOffset - (y * this.squareSize) + this.squareSize,  // startY
                    xOffset + this.inputGridWidth, // endX
                    yOffset - (y * this.squareSize) + this.squareSize// endY
                );
            }

            for (let x = 0; x < this.inputCols + 1; x++) {
                // draw a line for every 4th x value
                if (x % 4 === 0) {
                    line(
                        xOffset + (x * this.squareSize), // startX
                        yOffset + this.squareSize,  // startY
                        xOffset + (x * this.squareSize), // endX
                        yOffset - this.inputGridHeight + this.squareSize// endY
                    );
                }
            }
        }
    }

    displayShapeTitles() {
        // show the list of added shapes
        if (!htmlRefs.right) return;
        if (appState.currentScreen !== ScreenState.INPUT) return;

        // clear the list
        htmlRefs.right.list.html(''); // Clear all content
        this.shapeTitleElements = [];

        // create the list
        for (let i = 0; i < appState.shapes.length; i++) {
            // create item row div
            let titleRow = createDiv().addClass('shape-title');
            titleRow.parent(htmlRefs.right.list);
            // create trash icon
            let trashIcon = createImg('img/trash.svg', '🗑️'); // emoji backup if svg issue
            trashIcon.size(24, 24);
            trashIcon.style('display', 'inline-block');
            trashIcon.style('cursor', 'pointer');
            trashIcon.style('margin-left', '5px');
            trashIcon.parent(titleRow);

            // create shape title
            let shapeTitle = createP(`${appState.shapes[i].data.title}`);
            shapeTitle.attribute('data-index', i);
            shapeTitle.parent(titleRow);
            // save row for removal later
            this.shapeTitleElements.push(titleRow);

            // add event listener to trash icon
            // removes a shape from the list
            trashIcon.mousePressed(() => {
                let index = shapeTitle.attribute('data-index');
                appState.shapes.splice(index, 1);

                // notify ui update manager
                appEvents.emit('stateChanged');
            });
        }
    }


    updateGridSize() {
        // recalculate grid-related variables
        this.inputRows = Math.floor(this.maxInputInches / this.gridInchSize);
        this.inputCols = this.inputRows;
        this.squareSize = Math.floor((Math.min(canvasWidth, canvasHeight) / (this.inputRows + 1)));
        this.inputGridHeight = (this.inputRows * this.squareSize);
        this.inputGridWidth = (this.inputCols * this.squareSize);

        this.xSidePadding = (canvasWidth - this.inputGridWidth) / 2;
        this.ySidePadding = (canvasHeight - this.inputGridHeight) / 2;
        this.sidePadding = Math.max(this.xSidePadding, this.ySidePadding);

        // reset and redraw the input grid
        this.resetInputGrid();
        this.drawInputGrid();
    }

    //== mouse event handler
    selectInputSquare(mouseX, mouseY, isDragging = false) {
        // check if mouse click is within input grid
        // factor in padding on all sides
        let xValid = mouseX >= this.sidePadding && mouseX <= this.inputGridWidth + this.sidePadding;
        let yValid = mouseY >= this.sidePadding && mouseY <= this.inputGridHeight + this.sidePadding;
        if (xValid && yValid) {
            let gridX = Math.floor((mouseX - this.sidePadding) / this.squareSize); // column
            let gridY = Math.floor((this.inputGridHeight + this.sidePadding - mouseY) / this.squareSize); // row

            if (gridX >= 0 && gridX < this.inputCols && gridY >= 0 && gridY < this.inputRows) {
                let currentTime = millis();
                if (isDragging || (currentTime - this.lastClickTime > this.clickDelay)) {
                    if (isDragging) {
                        // check if need to initialize erase mode
                        if (this.eraseMode === "first") {
                            this.eraseMode = !this.inputGrid[gridY][gridX];
                        }
                        // set the square based on the current erase mode
                        this.inputGrid[gridY][gridX] = !this.eraseMode;
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

// only export the class when in a Node.js environment (e.g., during Jest tests)
// ignored when the app is running in the browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = InputUI;
}
