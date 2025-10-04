class InputUI {
    constructor() {
        //== state variables
        this.inputGrid = [];
        this.imgData = {}; // (image, mask, brightness data, etc)
        // dom elements
        this.html = {};
        this.shapeTitleElements = [];

        //== brush settings
        this.brushSize = 1; // size in grid squares (1 = 1x1, 2 = 2x2, etc)
        this.drawMode = true; // true = draw/fill, false = erase
        this.mouseGridX = -1; // current mouse position in grid coordinates
        this.mouseGridY = -1;

        //== setup
        // image mask brightness range
        this.imgBrightness = 1.0; // initial value
        this.imgBrightnessMin = 0.0;
        this.imgBrightnessMax = 5.0;
        this.maskThreshold = 0.25; // cutoff percentage

        // ui variables
        this.sliderStepSize = 0.01;
        this.sliderDefault = 0.5;
        this.sliderMin = 0;
        this.sliderMax = 1;
        // input grid variables
        this.maxInputInches = 10; // default grid size in inches
        this.gridInchSize = SQUARE_SIZE; // inches per grid square
        this.inputRows;
        this.inputCols;
        // calc input grid size
        this.squareSize;
        this.inputGridHeight;
        this.inputGridWidth;

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
        this.html.gridLabel = createSpan('Image Height (in): ')
            .parent(gridSizeDiv);
        // grid size input
        this.html.gridSizeInput = createInput(String(this.maxInputInches), 'number')
            .attribute('min', '1')
            .attribute('max', '40')
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
        this.html.emptyBox = createDiv()
            .class('slider-icon empty')
            .parent(this.html.sliderDiv);
        this.html.headerSlider = createSlider(
            this.sliderMin,
            this.sliderMax,
            this.sliderDefault,
            this.sliderStepSize
        )
            .addClass('slider')
            .parent(this.html.sliderDiv)
            .input(() => this.handleSliderChange());
        this.html.fillBox = createDiv()
            .class('slider-icon filled')
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

    //== helper methods
    mapSliderToBrightness(sliderValue) {
        // Map slider range to brightness range (inverted)
        // slider min -> brightness max = no mask
        // slider max -> brightness min = max mask
        const sliderRange = this.sliderMax - this.sliderMin;
        const brightnessRange = this.imgBrightnessMax - this.imgBrightnessMin;
        const normalizedSlider = (sliderValue - this.sliderMin) / sliderRange; // 0 to 1
        const invertedNormalized = 1 - normalizedSlider; // flip it
        const brightness = this.imgBrightnessMin + (invertedNormalized * brightnessRange);

        // Round to slider step precision for consistent cache keys
        const precision = 1 / this.sliderStepSize; // 0.01 -> 100
        return Math.round(brightness * precision) / precision;
    }

    //== button handlers
    async handleSliderChange() {
        // get slider value (represents "mask amount")
        const sliderValue = this.html.headerSlider.value();

        // map slider value to inverted brightness value
        this.imgBrightness = this.mapSliderToBrightness(sliderValue);

        // check if we have a cached mask for this brightness value
        if (this.imgData.maskCache && this.imgData.maskCache[this.imgBrightness]) {
            // use cached mask directly
            this.inputGrid = this.imgData.maskCache[this.imgBrightness];
        } else {
            // no cached mask - need to adjust brightness and create mask
            await this.adjustImgBrightness();
            await this.createImageMask();
        }

        // redraw the display
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

                    // Set initial mask and display (show image immediately)
                    await this.adjustImgBrightness();
                    await this.createImageMask();
                    this.drawInputGrid();

                    // Disable slider during mask pre-calculation
                    this.html.headerSlider.attribute('disabled', '');

                    // Pre-calculate all mask levels in background
                    await this.precalculateMasks();

                    // Enable the brightness slider
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
        // Create explicit configuration for shape processing
        const config = {
            customBufferSize: appState.generationConfig.customBufferSize,
            centerShape: appState.generationConfig.centerShape,
            minWallLength: appState.generationConfig.minWallLength
        };
        newShape.saveUserInput(titleValue, gridCopy, config); // save a copy of the input grid
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
        const shapeData = _importedData.allShapes || [];
        const annealData = _importedData.savedAnneals || [];

        // process shape data
        const loadedShapes = shapeData.map(shapeData => Shape.fromDataObject(shapeData));
        appState.shapes.push(...loadedShapes);

        // process anneal data
        let maxSolutionNum = 0;
        const loadedAnneals = annealData.map(anneal => {
            let titleNumber = 0;
            if (anneal.title) {
                const parts = anneal.title.split('-');
                if (parts.length > 1) {
                    titleNumber = parseInt(parts[1], 10);
                }
            }

            if (!isNaN(titleNumber)) {
                maxSolutionNum = Math.max(maxSolutionNum, titleNumber);
            }

            // create new solution from saved data to restore class methods
            anneal.finalSolution = Solution.fromDataObject(anneal.finalSolution);
            return anneal;
        });

        // add anneals and the highest solution number
        appState.savedAnneals.push(...loadedAnneals);
        appState.totalSavedAnneals = Math.max(appState.totalSavedAnneals || 0, maxSolutionNum);

        // notify ui update manager
        appEvents.emit('stateChanged');
    }

    adjustGridSize() {
        // adjust the grid size in inches
        const newSize = parseInt(this.html.gridSizeInput.value());

        this.html.gridSizeInput.value(newSize);
        this.maxInputInches = newSize;
        this.updateGridSize();
        this.resetCanvas();
    }

    resetCanvas() {
        background(255);
        this.html.titleInput.value('');
        this.imgData = {};
        this.html.headerSlider.value(this.sliderDefault); // reset slider to default position
        this.html.headerSlider.attribute('disabled', '');

        // Reset grid to square dimensions when clearing
        this.updateGridSize();
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

        if (this.imgData.original) {
            // display original image (unchanged brightness) while mask uses brightness-adjusted version
            let topX = this.xSidePadding + (this.inputGridWidth - this.imgData.original.width) / 2;
            let topY = this.ySidePadding;
            image(this.imgData.original, topX, topY);
        }

        const colors = RenderConfig.getColors();
        const strokeWeights = RenderConfig.getStrokeWeights();
        const yOffset = canvasHeight - this.ySidePadding - this.squareSize;
        const xOffset = this.xSidePadding;

        // draw grid
        strokeWeight(strokeWeights.gridLine);
        for (let y = 0; y < this.inputRows; y++) {
            for (let x = 0; x < this.inputCols; x++) {
                // draw input square
                const rectY = yOffset - (y * this.squareSize);
                const rectX = xOffset + (x * this.squareSize);

                // Fill selected squares
                if (this.inputGrid[y][x]) {
                    // semi-transparent color squares for selected
                    stroke(colors.inputSelectedStroke);
                    fill(colors.inputSelectedColor);
                    rect(rectX, rectY, this.squareSize, this.squareSize);
                } else {
                    // transparent squares for unselected
                    stroke(colors.lineColor);
                    noFill();
                    rect(rectX, rectY, this.squareSize, this.squareSize);
                }
            }
        }

        // draw inch marker lines
        stroke(colors.numColor);
        strokeWeight(strokeWeights.boundingBox);
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

        // Draw brush preview overlay
        if (this.mouseGridX >= 0 && this.mouseGridY >= 0) {
            this.drawBrushPreview(xOffset, yOffset);
        }
    }

    drawBrushPreview(xOffset, yOffset) {
        // Draw brush preview at current mouse position
        const bounds = this.getBrushBounds(this.mouseGridX, this.mouseGridY);

        // Convert to screen coordinates
        const brushX = xOffset + (bounds.minX * this.squareSize);
        const brushY = yOffset - (bounds.maxY * this.squareSize);
        const brushWidth = this.brushSize * this.squareSize;
        const brushHeight = this.brushSize * this.squareSize;

        // Get colors from config
        const brushColors = RenderConfig.getBrushColors();
        const colors = this.drawMode ? brushColors.draw : brushColors.erase;

        // Draw single rectangle for entire brush area
        fill(colors.fill);
        stroke(colors.stroke);
        strokeWeight(2);
        rect(brushX, brushY, brushWidth, brushHeight);

        // Draw brush info text
        fill(0);
        noStroke();
        textSize(12);
        textAlign(LEFT, TOP);
        text(`Brush: ${this.brushSize}x${this.brushSize} | Mode: ${this.drawMode ? 'Draw (D)' : 'Erase (E)'} | Size: [ ]`, 10, 10);
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

            // create view icon
            let viewIcon = createImg('img/view.svg', 'View');
            viewIcon.size(24, 24);
            viewIcon.style('display', 'inline-block');
            viewIcon.style('cursor', 'pointer');
            viewIcon.style('margin-left', '5px');
            viewIcon.addClass('icon-button');
            viewIcon.parent(titleRow);
            viewIcon.mousePressed(() => this.loadShape(i));

            // create shape title
            let shapeTitle = createP(`${appState.shapes[i].data.title}`);
            shapeTitle.attribute('data-index', i);
            shapeTitle.parent(titleRow);

            // create trash icon
            let trashIcon = createImg('img/trash.svg', '🗑️'); // emoji backup if svg issue
            trashIcon.size(24, 24);
            trashIcon.style('display', 'inline-block');
            trashIcon.style('cursor', 'pointer');
            trashIcon.style('margin-left', '5px');
            trashIcon.addClass('icon-button');
            trashIcon.parent(titleRow);

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

    loadShape(index) {
        // load a saved shape into the input grid for editing
        const shape = appState.shapes[index];
        const shapeGrid = shape.data.highResShape;

        // set grid to shape's actual dimensions (for preview display)
        this.inputRows = shapeGrid.length;
        this.inputCols = shapeGrid[0].length;

        // recalculate grid sizing to fit canvas
        this.calcGridSizing();

        // clear current state with new grid dimensions
        this.resetInputGrid();
        this.imgData = {};

        // load shape into grid with bottom-left + horizontal center positioning
        this.loadShapeIntoGrid(shape);

        // update UI
        this.html.titleInput.value(shape.data.title);
        this.drawInputGrid();
    }

    loadShapeIntoGrid(shape) {
        // load shape data into input grid with bottom-left + horizontal center positioning
        const shapeGrid = shape.data.highResShape;
        const shapeHeight = shapeGrid.length;
        const shapeWidth = shapeGrid[0].length;

        // calculate positioning:
        // - horizontal: center in available width
        // - vertical: align to bottom (row 0 of input grid)
        const offsetX = Math.floor((this.inputCols - shapeWidth) / 2);
        const offsetY = 0; // bottom alignment - start at row 0

        // copy shape data to input grid (with bounds checking)
        for (let y = 0; y < shapeHeight && (offsetY + y) < this.inputRows; y++) {
            for (let x = 0; x < shapeWidth && (offsetX + x) < this.inputCols; x++) {
                if (offsetX + x >= 0) { // safety check for negative offset
                    this.inputGrid[offsetY + y][offsetX + x] = shapeGrid[y][x];
                }
            }
        }
    }

    calcGridSizing() {
        // Calculate square size based on both width and height constraints
        const heightConstraint = canvasHeight / (this.inputRows + 1);
        const widthConstraint = canvasWidth / (this.inputCols + 1);
        this.squareSize = Math.floor(Math.min(heightConstraint, widthConstraint));

        this.inputGridHeight = this.inputRows * this.squareSize;
        this.inputGridWidth = this.inputCols * this.squareSize;

        this.xSidePadding = (canvasWidth - this.inputGridWidth) / 2;
        this.ySidePadding = (canvasHeight - this.inputGridHeight) / 2;
    }

    updateGridSize() {
        // Set up square grid based on height
        this.inputRows = Math.floor(this.maxInputInches / this.gridInchSize);
        this.inputCols = this.inputRows;
        this.calcGridSizing();

        // reset and redraw the input grid
        this.resetInputGrid();
        this.drawInputGrid();
    }

    //== mouse event handler
    screenToGrid(mouseX, mouseY) {
        // Convert screen coordinates to grid coordinates
        // Returns {x, y} or null if out of bounds
        const xValid = mouseX >= this.xSidePadding && mouseX <= this.inputGridWidth + this.xSidePadding;
        const yValid = mouseY >= this.ySidePadding && mouseY <= this.inputGridHeight + this.ySidePadding;

        if (!xValid || !yValid) {
            return null;
        }

        const gridX = Math.floor((mouseX - this.xSidePadding) / this.squareSize);
        const gridY = Math.floor((this.inputGridHeight + this.ySidePadding - mouseY) / this.squareSize);

        // Bounds check
        if (gridX >= 0 && gridX < this.inputCols && gridY >= 0 && gridY < this.inputRows) {
            return { x: gridX, y: gridY };
        }

        return null;
    }

    updateMouseGridPosition(mouseX, mouseY) {
        // Update current mouse position in grid coordinates for brush preview
        const gridPos = this.screenToGrid(mouseX, mouseY);
        if (gridPos) {
            this.mouseGridX = gridPos.x;
            this.mouseGridY = gridPos.y;
        } else {
            this.mouseGridX = -1;
            this.mouseGridY = -1;
        }
    }

    getBrushBounds(centerX, centerY) {
        // Calculate brush area bounds in grid coordinates
        const offset = Math.floor(this.brushSize / 2);
        return {
            minX: centerX - offset,
            maxX: centerX + (this.brushSize - offset - 1),
            minY: centerY - (this.brushSize - offset - 1),
            maxY: centerY + offset
        };
    }

    applyBrush(centerX, centerY) {
        // Apply brush centered on cursor (odd sizes) or offset up-left in screen space (even sizes)
        const bounds = this.getBrushBounds(centerX, centerY);

        for (let dy = bounds.minY; dy <= bounds.maxY; dy++) {
            for (let dx = bounds.minX; dx <= bounds.maxX; dx++) {
                // Check bounds
                if (dx >= 0 && dx < this.inputCols && dy >= 0 && dy < this.inputRows) {
                    this.inputGrid[dy][dx] = this.drawMode;
                }
            }
        }
    }

    paintAtPosition(mouseX, mouseY, isDragging = false) {
        // Apply brush at the given screen position
        const gridPos = this.screenToGrid(mouseX, mouseY);
        if (gridPos) {
            this.applyBrush(gridPos.x, gridPos.y);
            this.drawInputGrid();
        }
    }

    handleKeyPress(key) {
        // Handle keyboard shortcuts for brush controls
        if (key === '[') {
            // Decrease brush size
            this.brushSize = Math.max(1, this.brushSize - 1);
            this.drawInputGrid();
        } else if (key === ']') {
            // Increase brush size
            this.brushSize = Math.min(9, this.brushSize + 1);
            this.drawInputGrid();
        } else if (key === 'd' || key === 'D') {
            // Draw mode
            this.drawMode = true;
            this.drawInputGrid();
        } else if (key === 'e' || key === 'E') {
            // Erase mode
            this.drawMode = false;
            this.drawInputGrid();
        }
    }

    //== image handling methods
    async precalculateMasks() {
        // Pre-calculate all possible mask levels for smooth slider interaction
        if (!this.imgData.img) return;

        // Initialize mask cache
        this.imgData.maskCache = {};

        // Calculate all brightness values from slider range
        const sliderValues = [];
        for (let sliderValue = this.sliderMin; sliderValue <= this.sliderMax; sliderValue += this.sliderStepSize) {
            sliderValues.push(sliderValue);
        }

        // Process in chunks to avoid blocking UI
        for (let i = 0; i < sliderValues.length; i++) {
            const brightness = this.mapSliderToBrightness(sliderValues[i]);

            // Adjust brightness and create mask for this level
            await this.adjustImgBrightness(brightness);
            await this.createImageMask(brightness);

            // Yield to UI thread every 5 iterations
            if (i % 5 === 0) {
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }
    }

    async resizeImg() {
        if (this.imgData.img) {
            // First, calculate how many columns we need based on image aspect ratio
            // Use current squareSize as initial estimate
            const imageAspectRatio = this.imgData.img.width / this.imgData.img.height;
            const estimatedCols = Math.ceil(this.inputRows * imageAspectRatio);
            this.inputCols = estimatedCols;

            // Recalculate all grid dimensions with both width and height constraints
            // This may adjust squareSize to fit the grid in the canvas
            this.calcGridSizing();

            // Now scale the image to the final grid dimensions
            const aspectRatio = this.inputGridHeight / this.imgData.img.height;
            const newHeight = this.inputGridHeight;
            const newWidth = this.imgData.img.width * aspectRatio;

            await this.imgData.img.resize(newWidth, newHeight);
            this.imgData.original = await this.imgData.img.get();
            await this.imgData.original.loadPixels();

            // Resize the input grid array to match new dimensions
            this.resetInputGrid();
        }
    }

    async adjustImgBrightness(brightness = null) {
        const brightnessValue = brightness !== null ? brightness : this.imgBrightness;

        if (this.imgData.original) {
            // load original image pixels if not already loaded
            if (!this.imgData.original.pixels || this.imgData.original.pixels.length === 0) {
                await this.imgData.original.loadPixels();
            }

            // Create a brightness-adjusted version for masking (not cached, not displayed)
            let newImg = await this.imgData.original.get();
            await newImg.loadPixels();

            for (let y = 0; y < newImg.height; y++) {
                for (let x = 0; x < newImg.width; x++) {
                    let index = (x + y * newImg.width) * 4;
                    newImg.pixels[index] = min(255, this.imgData.original.pixels[index] * brightnessValue); // Red
                    newImg.pixels[index + 1] = min(255, this.imgData.original.pixels[index + 1] * brightnessValue); // Green
                    newImg.pixels[index + 2] = min(255, this.imgData.original.pixels[index + 2] * brightnessValue); // Blue
                    // alpha channel unchanged
                }
            }
            await newImg.updatePixels();
            this.imgData.img = newImg;

            await this.setPixelBuffer();
        }
    }

    async createImageMask(brightness = null) {
        const brightnessValue = brightness !== null ? brightness : this.imgBrightness;

        if (this.imgData.img) {
            // if brightness is at max (slider at min), clear the mask (but keep the image visible)
            if (brightnessValue === this.imgBrightnessMax) {
                // create empty grid (no purple mask)
                let emptyGrid = [];
                for (let y = 0; y < this.inputRows; y++) {
                    emptyGrid.push([]);
                    for (let x = 0; x < this.inputCols; x++) {
                        emptyGrid[y].push(false);
                    }
                }
                if (brightness === null) {
                    this.inputGrid = emptyGrid;
                }
                // Cache this empty grid
                if (!this.imgData.maskCache) this.imgData.maskCache = {};
                this.imgData.maskCache[brightnessValue] = emptyGrid;
                return;
            }

            // check if mask for this brightness value has already been cached
            if (this.imgData.maskCache && this.imgData.maskCache[brightnessValue]) {
                // reuse cached mask
                if (brightness === null) {
                    this.inputGrid = this.imgData.maskCache[brightnessValue];
                }
                return;
            }

            // ensure pixel buffer is setup (an offscreen rendering of just the image)
            if (!this.imgData.maskBuffer) await this.setPixelBuffer();

            // loop the grid and find the mask value for each square
            let tempGrid = [];
            for (let y = 0; y < this.inputRows; y++) {
                tempGrid.push([]);
                for (let x = 0; x < this.inputCols; x++) {
                    tempGrid[y].push(this.getAverageSquareBW(y, x));
                }
            }
            // flip the grid vertically (make 0,0 be bottom left. default is top left)
            tempGrid.reverse();

            // cache the mask for this brightness value
            if (!this.imgData.maskCache) this.imgData.maskCache = {};
            this.imgData.maskCache[brightnessValue] = tempGrid;

            // update the input grid only if this is for current brightness
            if (brightness === null) {
                this.inputGrid = tempGrid.map(colArray => [...colArray]);
            }
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

        return minBrightness < (255 * this.maskThreshold);
    }
}

// only export the class when in a Node.js environment (e.g., during Jest tests)
// ignored when the app is running in the browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = InputUI;
}
