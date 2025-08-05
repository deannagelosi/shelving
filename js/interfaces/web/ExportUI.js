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
        // bind prepareExportData to this instance of the input values
        this.prepareExportData = this.prepareExportData.bind(this);

        // Material Type dropdown (full width) - always present
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

        // Number of Sheets (hidden - automatically managed by export system)
        this.html.numSheetsInput = createInput('1')
            .style('display', 'none')
            .attribute('type', 'hidden')
            .attribute('min', '1')
            .attribute('max', '50');

        // Buttons for settings - always present
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

        // Initialize with empty containers and element maps
        this.html.materialContainers = {};
        this.materialElementMaps = {};
    }

    buildUIForMaterial(materialType) {
        // Clear existing material-specific UI
        this.clearMaterialUI();

        if (!MATERIAL_CONFIGS || !MATERIAL_CONFIGS[materialType]) {
            console.error(`Material config not found for: ${materialType}`);
            return;
        }

        const materialConfig = MATERIAL_CONFIGS[materialType];
        this.materialElementMaps[materialType] = {};

        // Build containers first
        this.buildContainers(materialType, materialConfig.containers);

        // Build settings within containers
        this.buildSettings(materialType, materialConfig.settings);
    }

    buildContainers(materialType, containerDefinitions) {
        for (const [containerName, containerDef] of Object.entries(containerDefinitions)) {
            // Create container group
            const containerGroup = createDiv()
                .addClass(containerDef.cssClass + ' hidden');

            // Create container label
            createSpan(containerDef.label)
                .parent(containerGroup)
                .addClass('settings-label');

            // Create layout row for settings
            const layoutRow = createDiv()
                .addClass('dimensions-row')
                .parent(containerGroup);

            // Store references
            this.html.materialContainers[containerName] = {
                group: containerGroup,
                row: layoutRow
            };
        }
    }

    buildSettings(materialType, settingsDefinitions) {
        for (const setting of settingsDefinitions) {
            const container = this.html.materialContainers[setting.container];
            if (!container) {
                console.error(`Container not found: ${setting.container}`);
                continue;
            }

            // Create column for this setting
            const column = createDiv()
                .addClass('dimension-column')
                .parent(container.row);

            // Create label
            createSpan(setting.label)
                .addClass('dimension-label')
                .parent(column);

            // Create input element
            let inputElement;
            if (setting.inputType === 'select') {
                inputElement = createSelect()
                    .parent(column)
                    .addClass(setting.cssClass)
                    .changed(this.prepareExportData);

                // Add options for select
                if (setting.options) {
                    for (const option of setting.options) {
                        inputElement.option(option.text, option.value);
                    }
                }
                inputElement.value(setting.defaultValue);
            } else {
                inputElement = createInput(setting.defaultValue.toString())
                    .parent(column)
                    .addClass(setting.cssClass)
                    .attribute('type', setting.inputType)
                    .input(this.prepareExportData);

                // Add validation attributes
                if (setting.validation) {
                    for (const [attr, value] of Object.entries(setting.validation)) {
                        inputElement.attribute(attr, value);
                    }
                }
            }

            // Store element reference
            this.materialElementMaps[materialType][setting.name] = inputElement;
        }
    }

    clearMaterialUI() {
        // Remove all existing material containers
        for (const containerName of Object.keys(this.html.materialContainers)) {
            if (this.html.materialContainers[containerName].group) {
                this.html.materialContainers[containerName].group.remove();
            }
        }
        this.html.materialContainers = {};
    }

    //== show/hide functions
    // manage visibility and screen-specific setup
    show() {
        // show basic UI elements (material type dropdown and buttons)
        this.html.materialTypeGroup.removeClass('hidden');
        this.html.buttonList.removeClass('hidden');

        // initialize default material type selection and build UI
        this.html.materialTypeSelect.selected('acrylic-laser');
        this.handleMaterialTypeChange();

        // reset the canvas
        clear();
        background(255);

        // prepare active solution for export
        this.prepareExportData();
    }

    hide() {
        // hide basic UI elements
        this.html.materialTypeGroup.addClass('hidden');
        this.html.buttonList.addClass('hidden');

        // hide all material-specific containers
        for (const containerData of Object.values(this.html.materialContainers)) {
            if (containerData.group) {
                containerData.group.addClass('hidden');
            }
        }
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

        // add material type dropdown
        this.html.materialTypeGroup.parent(htmlRefs.right.list);

        // add all material-specific containers to the right sidebar
        for (const containerData of Object.values(this.html.materialContainers)) {
            if (containerData.group) {
                containerData.group.parent(htmlRefs.right.list);
                containerData.group.removeClass('hidden');
            }
        }

        // add buttons
        this.html.buttonList.parent(htmlRefs.right.list);
    }

    handleMaterialTypeChange() {
        const selectedMaterial = this.html.materialTypeSelect.value();

        console.log(`[ExportUI] Material type changed to: ${selectedMaterial}`);

        // Build UI for the selected material
        this.buildUIForMaterial(selectedMaterial);

        // Display the new settings in the sidebar
        this.displaySettings();

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

        const materialType = this.html.materialTypeSelect.value();
        const elementMap = this.materialElementMaps[materialType];

        if (!elementMap) {
            console.error(`No element map found for material: ${materialType}`);
            return;
        }

        // Get values from dynamic element map
        const thickness = elementMap['thickness'] ? parseFloat(elementMap['thickness'].value()) : 0.23;
        const kerf = elementMap['kerf'] ? parseFloat(elementMap['kerf'].value()) : 0;
        const caseDepth = elementMap['caseDepth'] ? parseFloat(elementMap['caseDepth'].value()) : 3;
        const sheetWidth = elementMap['sheetWidth'] ? parseFloat(elementMap['sheetWidth'].value()) : 30;
        const sheetHeight = elementMap['sheetHeight'] ? parseFloat(elementMap['sheetHeight'].value()) : 28;
        const numPinSlots = elementMap['pinSlots'] ? parseInt(elementMap['pinSlots'].value()) : 2;
        const numSheets = parseInt(this.html.numSheetsInput.value()); // Hidden but automatically managed

        // Validate inputs
        const invalidInputs = [thickness, kerf, caseDepth, sheetWidth, sheetHeight, numSheets].some(val => isNaN(val));
        const invalidPinSlots = elementMap['pinSlots'] && isNaN(numPinSlots);

        if (invalidInputs || invalidPinSlots) {
            alert("Invalid input for one or more fields");
            return;
        }
        // get laser config
        const config = {
            caseDepth,
            sheetThickness: thickness,
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

        // create new export with material type
        this.currExport = new Export(cellData, spacing, config, materialType);
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