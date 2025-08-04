class ExportUI {
    constructor() {
        //== state variables
        this.currExport;
        // dom elements
        this.html = {};
        this.savedAnnealElements = [];
        // flags
        this.showingLayout = true;

        //== renderer instance
        this.solutionRenderer = new SolutionRenderer();

        //== initialize UI elements
        this.initSidebarButtons();
        this.initExportSettings();

        //== event listeners
        // listen for screen changes to manage visibility
        appEvents.on('screenChanged', ({ screen }) => {
            if (screen === ScreenState.EXPORT) {
                this.show();
            } else {
                this.hide();
            }
        });

        // listen for requests from Export.js for additional sheets
        // Updates the hidden numSheets input when export system needs more sheets
        appEvents.on('addSheetRequested', () => {
            let numSheets = parseInt(this.html.numSheetsInput.value());
            this.html.numSheetsInput.value(numSheets + 1);
        });

        // listen for requests from Export.js to refresh layout
        appEvents.on('layoutRefreshRequested', () => {
            this.prepareExportData();
        });

        // listen for requests to reset to layout view (dev mode toggle)
        appEvents.on('resetToLayoutView', () => {
            this.showingLayout = true;
            this.handleShow();
        });
    }

    computeState() {
        // centralized UI button state logic
        return {
            canExport: appState.savedAnneals.length >= 1,
            canShowDownload: appState.currentViewedAnnealIndex !== null && appState.currentAnneal !== null && this.currExport,
            hasSavedAnneals: appState.savedAnneals.length > 0
        };
    }

    initSidebarButtons() {
        // create sidebar buttons (hidden until screen is shown)
        this.html.backButton = createButton('Back')
            .addClass('button secondary-button hidden')
            .parent(htmlRefs.left.buttons)
            .mousePressed(() => this.handleBack());

        this.html.exportButton = createButton('Export')
            .addClass('button primary-button hidden')
            .parent(htmlRefs.left.buttons)
            .mousePressed(() => this.handleExport());
    }

    initExportSettings() {
        // create settings elements (hidden until screen is shown)

        // bind prepareExportData to this instance of the input values
        this.prepareExportData = this.prepareExportData.bind(this);

        // Material Type dropdown (full width)
        this.html.materialTypeGroup = createDiv()
            .addClass('settings-group hidden');
        this.html.materialTypeLabel = createSpan('Material Type')
            .parent(this.html.materialTypeGroup)
            .addClass('settings-label');
        this.html.materialTypeSelect = createSelect()
            .parent(this.html.materialTypeGroup)
            .addClass('settings-select')
            .changed(() => this.handleMaterialTypeChange());
        this.html.materialTypeSelect.option('Plywood (Laser)', 'plywood-laser');
        this.html.materialTypeSelect.option('Acrylic (Laser)', 'acrylic-laser');

        // Material Properties (grouped)
        this.html.materialPropsGroup = createDiv()
            .addClass('settings-group hidden');
        this.html.materialPropsLabel = createSpan('Material Properties')
            .parent(this.html.materialPropsGroup)
            .addClass('settings-label');

        // Two-column container for thickness and kerf
        const materialRow = createDiv()
            .addClass('dimensions-row')
            .parent(this.html.materialPropsGroup);

        // Material Thickness column
        const thicknessColumn = createDiv()
            .addClass('dimension-column')
            .parent(materialRow);
        createSpan('Thickness (in)')
            .addClass('dimension-label')
            .parent(thicknessColumn);
        this.html.sheetThicknessInput = createInput('0.23')
            .addClass('dimension-input')
            .parent(thicknessColumn)
            .attribute('type', 'number')
            .attribute('min', '0.13')
            .attribute('max', '0.5')
            .attribute('step', '0.01')
            .input(this.prepareExportData);

        // Kerf Width column
        const kerfColumn = createDiv()
            .addClass('dimension-column')
            .parent(materialRow);
        createSpan('Kerf Width (in)')
            .addClass('dimension-label')
            .parent(kerfColumn);
        this.html.kerfInput = createInput('0')
            .addClass('dimension-input')
            .parent(kerfColumn)
            .attribute('type', 'number')
            .attribute('min', '0')
            .attribute('max', '.04')
            .attribute('step', '0.01')
            .input(this.prepareExportData);

        // Case Properties (grouped)
        this.html.casePropsGroup = createDiv()
            .addClass('settings-group hidden');
        this.html.casePropsLabel = createSpan('Case Properties')
            .parent(this.html.casePropsGroup)
            .addClass('settings-label');

        // Two-column container for case depth and pin slots
        const caseRow = createDiv()
            .addClass('dimensions-row')
            .parent(this.html.casePropsGroup);

        // Case Depth column
        const depthColumn = createDiv()
            .addClass('dimension-column')
            .parent(caseRow);
        createSpan('Depth (in)')
            .addClass('dimension-label')
            .parent(depthColumn);
        this.html.caseDepthInput = createInput('3')
            .addClass('dimension-input')
            .parent(depthColumn)
            .attribute('type', 'number')
            .attribute('min', '1')
            .attribute('max', '10')
            .attribute('step', '0.5')
            .input(this.prepareExportData);

        // Pin/Slots column
        const pinSlotColumn = createDiv()
            .addClass('dimension-column')
            .parent(caseRow);
        createSpan('# Pin/Slots')
            .addClass('dimension-label')
            .parent(pinSlotColumn);
        this.html.pinSlotSelect = createSelect()
            .parent(pinSlotColumn)
            .addClass('dimension-input')
            .changed(this.prepareExportData);
        this.html.pinSlotSelect.option('2', '2');
        this.html.pinSlotSelect.option('1', '1');

        // Sheet Dimensions (grouped)
        this.html.sheetGroup = createDiv()
            .addClass('settings-group hidden');
        this.html.sheetLabel = createSpan('Sheet Dimensions')
            .parent(this.html.sheetGroup)
            .addClass('settings-label');

        // Two-column container for width and height
        const dimensionsRow = createDiv()
            .addClass('dimensions-row')
            .parent(this.html.sheetGroup);

        // Width input column
        const widthColumn = createDiv()
            .addClass('dimension-column')
            .parent(dimensionsRow);
        createSpan('Width')
            .addClass('dimension-label')
            .parent(widthColumn);
        this.html.sheetWidthInput = createInput('30')
            .addClass('dimension-input')
            .parent(widthColumn)
            .attribute('type', 'number')
            .attribute('min', '1')
            .attribute('step', '1')
            .input(this.prepareExportData);

        // Height input column
        const heightColumn = createDiv()
            .addClass('dimension-column')
            .parent(dimensionsRow);
        createSpan('Height')
            .addClass('dimension-label')
            .parent(heightColumn);
        this.html.sheetHeightInput = createInput('28')
            .addClass('dimension-input')
            .parent(heightColumn)
            .attribute('type', 'number')
            .attribute('min', '1')
            .attribute('step', '1')
            .input(this.prepareExportData);

        // Number of Sheets (hidden - automatically managed by export system)
        this.html.numSheetsInput = createInput('1')
            .style('display', 'none') // Completely hidden from user but accessible to automatic system
            .attribute('type', 'hidden') // Change to hidden input type
            .attribute('min', '1')
            .attribute('max', '50');

        // buttons for settings
        this.html.buttonList = createDiv()
            .addClass('export-button-list hidden');

        this.html.showButton = createButton('Show Case')
            .parent(this.html.buttonList)
            .addClass('button primary-button')
            .attribute('disabled', '')
            .mousePressed(() => this.handleShow());

        this.html.downloadDXFButton = createButton('Download DXF')
            .parent(this.html.buttonList)
            .addClass('button secondary-button')
            .attribute('disabled', '')
            .mousePressed(() => this.handleDownloadDXF());

        this.html.downloadCaseButton = createButton('Download Case Plan')
            .parent(this.html.buttonList)
            .addClass('button secondary-button')
            .attribute('disabled', '')
            .mousePressed(() => this.handleDownloadCase());
    }

    //== show/hide functions
    // manage visibility and screen-specific setup
    show() {
        // show all export screen elements
        Object.values(this.html).forEach(element => element.removeClass('hidden'));

        // initialize default material type selection
        this.html.materialTypeSelect.selected('acrylic-laser');
        this.handleMaterialTypeChange();

        // reset the canvas
        clear();
        background(255);

        // prepare active solution for export
        this.prepareExportData();
    }

    hide() {
        // hide all export screen elements
        Object.values(this.html).forEach(element => element.addClass('hidden'));
    }

    update() {
        // update button states based on current appState
        const state = this.computeState();
        updateButton(this.html.exportButton, state.canExport);
        updateButton(this.html.showButton, state.canShowDownload);
        updateButton(this.html.downloadDXFButton, state.canShowDownload);
        updateButton(this.html.downloadCaseButton, state.canShowDownload);

        // update dynamic lists
        this.createAnnealList();

        // displayed settings in right sidebar
        this.displaySettings();
    }

    displaySettings() {
        // add the settings to the right sidebar (other screens clear the sidebars)
        if (!htmlRefs.right) return;
        if (appState.currentScreen !== ScreenState.EXPORT) return;

        // clear the list to ensure clean state
        htmlRefs.right.list.html('');

        // add all settings elements to the right sidebar list section
        this.html.materialTypeGroup.parent(htmlRefs.right.list);
        this.html.materialPropsGroup.parent(htmlRefs.right.list);
        this.html.casePropsGroup.parent(htmlRefs.right.list);
        this.html.sheetGroup.parent(htmlRefs.right.list);
        this.html.buttonList.parent(htmlRefs.right.list);
    }

    handleMaterialTypeChange() {
        const selectedMaterial = this.html.materialTypeSelect.value();

        console.log(`[ExportUI] Material type changed to: ${selectedMaterial}`);

        // Update default values based on material type
        if (selectedMaterial === 'plywood-laser') {
            this.html.sheetThicknessInput.value('0.23');
            this.html.kerfInput.value('0');
        } else if (selectedMaterial === 'acrylic-laser') {
            this.html.sheetThicknessInput.value('0.375');
            this.html.kerfInput.value('0.01');
        }

        // Trigger export data preparation with new material settings
        this.prepareExportData();
    }

    //== button handlers
    handleBack() {
        // change to design screen
        changeScreen(ScreenState.DESIGN);
    }

    handleExport() {
        // trigger global export functionality
        appEvents.emit('exportRequested');
    }

    handleShow() {
        // show the layout or case plan
        clear();
        background(255);
        this.showingLayout = !this.showingLayout;

        if (this.showingLayout) {
            this.currExport.previewLayout();
            this.html.showButton.html('Show Case');
        } else {
            this.currExport.previewCase();
            this.html.showButton.html('Show Layout');
        }
    }

    handleDownloadDXF() {
        const dxfString = this.currExport.generateDXF();
        // save string to file
        const blob = new Blob([dxfString], { type: 'application/dxf' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'shelving_design.dxf';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    handleDownloadCase() {
        // draw case plan in an offscreen buffer and save it
        const imageBuffer = createGraphics(canvasWidth, canvasHeight);
        this.currExport.previewCase(imageBuffer);

        // todo: file name  based on solution name
        imageBuffer.save('case_preview.png');
    }
    //== end button handlers

    showBoardTooLongError(longestBoard, sheetWidth) {
        clear();
        background(255);
        fill('red');
        textAlign(CENTER, CENTER);
        textSize(16);
        text(
            `Error: Board #${longestBoard.id} is too long for the current sheet.\n\n` +
            `Board Length: ${longestBoard.len.toFixed(2)} inches\n` +
            `Sheet Width: ${sheetWidth.toFixed(2)} inches\n\n` +
            `Please increase the sheet width in the settings to continue.`,
            width / 2,
            height / 2
        );
    }

    prepareExportData() {
        // if no current anneal, set to first saved anneal
        if (!appState.currentAnneal) {
            let validIndex = appState.currentViewedAnnealIndex != null;
            let index = validIndex ? appState.currentViewedAnnealIndex : 0;

            appState.currentViewedAnnealIndex = index;
            appState.currentAnneal = appState.savedAnneals[index];
        }

        // prepare cellular data from current anneal to get up-to-date board data
        let cellularInstance;
        if (!appState.currentAnneal.cellular) {
            // no cellular data exists, create new instance
            cellularInstance = new Cellular(appState.currentAnneal.finalSolution, false, 1);
            cellularInstance.growCells();
        } else if (typeof appState.currentAnneal.cellular.getCellRenderLines === 'function') {
            // already a proper Cellular instance
            cellularInstance = appState.currentAnneal.cellular;
        } else {
            // plain data object from worker or storage, reconstruct instance
            cellularInstance = Cellular.fromDataObject(appState.currentAnneal.cellular, appState.currentAnneal.finalSolution);
        }

        const caseDepth = parseFloat(this.html.caseDepthInput.value());
        const sheetThickness = parseFloat(this.html.sheetThicknessInput.value());
        const sheetWidth = parseFloat(this.html.sheetWidthInput.value());
        const sheetHeight = parseFloat(this.html.sheetHeightInput.value());
        const numSheets = parseInt(this.html.numSheetsInput.value()); // Hidden but automatically managed
        const numPinSlots = parseInt(this.html.pinSlotSelect.value());
        const kerf = parseFloat(this.html.kerfInput.value());

        if (isNaN(sheetThickness) || isNaN(caseDepth) || isNaN(sheetWidth) || isNaN(sheetHeight) || isNaN(numSheets) || isNaN(numPinSlots) || isNaN(kerf)) {
            alert("Invalid input for one or more fields");
            return;
        }
        // get laser config
        const config = {
            caseDepth,
            sheetThickness,
            sheetWidth,
            sheetHeight,
            numSheets,
            numPinSlots,
            kerf
        };
        // get cellular layout data (case lines)
        const cellData = cellularInstance;
        // calculate layout properties using SolutionRenderer
        const layoutProps = this.solutionRenderer.calculateLayoutProperties(appState.currentAnneal.finalSolution, canvasWidth, canvasHeight);
        const spacing = {
            buffer: layoutProps.buffer,
            yPadding: layoutProps.yPadding,
            xPadding: layoutProps.xPadding,
            squareSize: layoutProps.squareSize
        };

        // create new export
        this.currExport = new Export(cellData, spacing, config);
        this.currExport.makeBoards();

        // log the number of boards created
        console.log(`📊 Export: ${this.currExport.boards.length} boards created for solution "${appState.currentAnneal.title}"`);

        // Check if any board is longer than the sheet width
        const longestBoard = this.currExport.getLongestBoard();
        if (longestBoard && longestBoard.len > sheetWidth) {
            this.showBoardTooLongError(longestBoard, sheetWidth);
            updateButton(this.html.showButton, false);
            updateButton(this.html.downloadDXFButton, false);
            updateButton(this.html.downloadCaseButton, false);
            return;
        }

        this.currExport.prepLayout();

        // preview the layout or chase
        if (this.showingLayout) {
            this.currExport.previewLayout();
        } else {
            this.currExport.previewCase();
        }

        // enable show and download buttons
        updateButton(this.html.showButton, true);
        updateButton(this.html.downloadDXFButton, true);
        updateButton(this.html.downloadCaseButton, true);
    }

    //== Display functions
    createAnnealList() {
        // create list of solutions to select
        if (!htmlRefs.left) return;

        // clear the list
        htmlRefs.left.list.html('');
        this.savedAnnealElements = [];

        // create the list
        for (let i = 0; i < appState.savedAnneals.length; i++) {
            let savedAnnealItem = createDiv().addClass('saved-anneal-item');
            if (appState.currentAnneal === appState.savedAnneals[i]) {
                savedAnnealItem.addClass('highlighted');
            }
            savedAnnealItem.parent(htmlRefs.left.list);

            let viewIcon = createImg('img/view.svg', 'View')
                .addClass('icon-button')
                .size(24, 24)
                .parent(savedAnnealItem)
                .mousePressed(() => this.viewSavedAnneal(i));

            let titleSpan = createSpan(appState.savedAnneals[i].title)
                .addClass('anneal-title')
                .parent(savedAnnealItem);

            this.savedAnnealElements.push(savedAnnealItem);
        }
    }

    viewSavedAnneal(_index) {
        // change selected anneal
        appState.currentViewedAnnealIndex = _index;
        appState.currentAnneal = appState.savedAnneals[_index];

        // update UI
        this.updateSavedAnnealHighlight();
        this.prepareExportData();

        // notify ui update manager
        appEvents.emit('stateChanged');
    }

    updateSavedAnnealHighlight() {
        for (let i = 0; i < this.savedAnnealElements.length; i++) {
            if (appState.currentAnneal === appState.savedAnneals[i]) {
                this.savedAnnealElements[i].addClass('highlighted');
            } else {
                this.savedAnnealElements[i].removeClass('highlighted');
            }
        }
    }
}

// only export the class when in a Node.js environment (e.g., during Jest tests)
// ignored when the app is running in the browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ExportUI;
}