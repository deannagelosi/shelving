class InputUI {
    constructor() {
        //== state variables
        this.inputGrid = [];
        this.imgData = {}; // (image, mask, brightness data, etc)
        this.shapes = []; // array of Shape objects [{data (reference), posX (int), posY (int)}]
        // dom elements and shape titles
        this.htmlRef = {};
        this.html = {};
        this.shapeTitleElements = [];
        // flags
        this.isExporting = false;
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
        this.gridInchSize = 0.25; // each square is 0.25 inches
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
        this.html.imageControls = createDiv()
            .id('image-controls')
            .parent(this.htmlRef.header);

        // Grid size selector
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

        // Create a vertical divider
        this.html.dividerLeft = createDiv()
            .class('vertical-divider')
            .parent(this.html.imageControls);

        // Create upload button
        this.html.headerUploadButton = createButton('Upload image')
            .addClass('button primary-button')
            .parent(this.html.imageControls)
            .mousePressed(() => this.handleImageUpload());

        // Create a vertical divider
        this.html.dividerRight = createDiv()
            .class('vertical-divider')
            .parent(this.html.imageControls);

        // Create brightness slider
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

        // Create and append the clear button
        this.html.headerClearButton = createButton('Clear')
            .addClass('button secondary-button')
            .parent(this.html.imageControls)
            .mousePressed(() => this.resetCanvas());
    }

    initBodyUI() {
        //== setup ui elements for body
        // create input fields and buttons row div
        this.html.inputDiv = createDiv()
            .parent(this.htmlRef.bottomDiv)
            .id('input-div');

        // create the title input field
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
            .mousePressed(() => this.saveShape());
    }

    initRightSideUI() {
        //== setup ui elements for side bar
        // create the IMPORT SHAPES button
        this.html.importButton = createButton('Import')
            .parent(this.htmlRef.rightSideButtons)
            .addClass('button primary-button')
            .mousePressed(() => this.handleImport());

        // create the EXPORT SHAPES button
        this.html.exportButton = createButton('Export')
            .parent(this.htmlRef.rightSideButtons)
            .addClass('button primary-button')
            .attribute('disabled', '') // until 2 shapes are saved
            .mousePressed(() => this.exportShapes());

        // create the NEXT button
        this.html.nextButton = createButton('Next')
            .parent(this.htmlRef.rightSideButtons)
            .addClass('button primary-button')
            .attribute('disabled', '') // until 2 shapes are saved
            .mousePressed(() => this.nextScreen());
    }

    //== show/hide methods
    show() {
        // toggle on the input screen divs
        this.htmlRef.leftBar.addClass('hidden');
        this.htmlRef.rightBar.removeClass('hidden');
        this.htmlRef.bottomDiv.removeClass('hidden');
        // set titles
        this.htmlRef.rightSideTop.html('Shapes');

        // remove hidden class from each element in this.html
        Object.values(this.html).forEach(element => element.removeClass('hidden'));

        // setup and draw the input grid
        this.updateGridSize();

        // temp for testing
        // loadJSON('/examples/ladder-bug.json', (importedData) => {
        //     this.loadJsonData(importedData);
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

    saveShape() {
        // find the shape title
        let titleValue = this.html.titleInput.value().trim();
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
        // enable export button if there is more than one shape
        if (this.shapes.length >= 1) {
            this.html.exportButton.removeAttribute('disabled');
        }
    }

    exportShapes() {
        // add full shapes array to saved anneals
        if (this.isExporting) return; // block multiple clicks during export

        this.isExporting = true;
        this.html.exportButton.html('Saving...');
        this.html.exportButton.attribute('disabled', '');

        // get a copy of shapes that only includes the data needed
        let shapesCopy = this.shapes.map(shape => shape.exportShape());

        let exportData = {
            savedAnneals: [],
            allShapes: shapesCopy
        }

        try {
            saveJSONFile(exportData);

        } catch (error) {
            console.error('Export failed:', error);
        } finally {
            this.isExporting = false;
            this.html.exportButton.html('Export');
            // Enable next button once shapes are saved and there are at least 2 shapes
            if (this.shapes.length > 1) {
                this.html.nextButton.removeAttribute('disabled');
            }
        }
    }

    nextScreen() {
        // delete shape list dom elements
        this.clearShapeTitles();

        // change to the next screen (design)
        isInputScreen = false;

        // setup the list of shapes
        this.shapes.forEach((shape, index) => {
            // start with all enabled
            this.shapes[index].enabled = true;
        });

        // setup list of solutions if loaded
        if (designUI.savedAnneals.length > 0) {
            // loop saved anneals once so they render correctly
            for (let i = 0; i < designUI.savedAnneals.length; i++) {
                designUI.viewSavedAnneal(i);
            }
            designUI.viewSavedAnneal(0);
        }

        loop();
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

    loadJsonData(_importedData) {
        // handles loading saved shapes from json file
        let shapeData = _importedData.allShapes;
        let annealData = _importedData.savedAnneals;

        //== process shape data
        let loadedShapes = [];
        for (let shape of shapeData) {
            // create new shape from saved data
            let newShape = new Shape();
            newShape.saveUserInput(shape.data.title, shape.data.highResShape);
            loadedShapes.push(newShape);
        }
        // add shapes
        this.shapes.push(...loadedShapes);

        //== process anneal data
        let maxSolutionNum = 0
        let loadedAnneals = [];
        for (let anneal of annealData) {
            // find the largest anneal number (ex: 4 on 'solution-4')
            let titleNumber = parseInt(anneal.title.split('-')[1]);
            maxSolutionNum = Math.max(maxSolutionNum, titleNumber);
            // create new shape from saved data to add solution methods back
            // initialize solution's shapes
            let initShapes = []
            for (let shape of anneal.finalSolution.shapes) {
                let newShape = new Shape();
                newShape.saveUserInput(shape.data.title, shape.data.highResShape);
                newShape.posX = shape.posX;
                newShape.posY = shape.posY;
                newShape.enabled = shape.enabled;
                initShapes.push(newShape);
            }
            // initialize solution
            anneal.finalSolution = new Solution(initShapes);
            
            loadedAnneals.push(anneal);
        }
        // add anneals and the highest solution number
        designUI.savedAnneals.push(...loadedAnneals);
        designUI.totalSavedAnneals = maxSolutionNum;

        //== update UI
        this.resetCanvas();
        // enable next button if all shapes are from the load files
        if (this.shapes.length == loadedShapes.length) {
            this.html.nextButton.removeAttribute('disabled');
        } else {
            // user loaded on top of existing shapes, save needed
            this.html.nextButton.attribute('disabled', '');
        }

        // enable export button if there is more than one shape
        if (this.shapes.length != loadedShapes.length) {
            this.html.exportButton.removeAttribute('disabled');
        }
    }

    adjustGridSize() {
        // adjust the grid size in inches
        const newValue = parseInt(this.html.gridSizeInput.value())

        let newSize = constrain(newValue, 1, 12);
        this.html.gridSizeInput.value(newSize);
        this.maxInputInches = newSize;
        this.updateGridSize();
        this.resetCanvas();
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
        this.clearShapeTitles();

        for (let i = 0; i < this.shapes.length; i++) {
            // create item row div
            let titleRow = createDiv().addClass('shape-title');
            titleRow.parent(this.htmlRef.rightSideList);
            // create trash icon
            let trashIcon = createImg('img/trash.svg', '🗑️'); // emoji backup if svg issue
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
                    this.html.exportButton.removeAttribute('disabled');
                } else {
                    this.html.exportButton.attribute('disabled', '');
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

    updateGridSize() {
        // Recalculate grid-related variables
        this.inputRows = Math.floor(this.maxInputInches / this.gridInchSize);
        this.inputCols = this.inputRows;
        this.squareSize = Math.floor((Math.min(canvasWidth, canvasHeight) / (this.inputRows + 1)));
        this.inputGridHeight = (this.inputRows * this.squareSize);
        this.inputGridWidth = (this.inputCols * this.squareSize);

        this.xSidePadding = (canvasWidth - this.inputGridWidth) / 2;
        this.ySidePadding = (canvasHeight - this.inputGridHeight) / 2;
        this.sidePadding = Math.max(this.xSidePadding, this.ySidePadding);

        // Reset and redraw the input grid
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
