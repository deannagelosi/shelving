class ExportUI {
    constructor() {
        //== state variables
        this.currExport;
        // dom elements
        this.html = {};
        this.savedAnnealElements = [];
        // flags
        this.showingLayout = true;

        //== renderer instances
        this.solutionRenderer = new SolutionRenderer();
        this.boardRenderer = new BoardRenderer();

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

        // listen for requests from Export.js to adjust sheet count
        // Updates the hidden numSheets input when export system calculates optimal count
        appEvents.on('adjustSheetsRequested', ({ optimalSheets }) => {
            this.html.numSheetsInput.value(optimalSheets);
        });

        // listen for requests from Export.js to refresh layout
        appEvents.on('layoutRefreshRequested', () => {
            this.prepareExportData();
        });

        // listen for material type changes to update UI
        appEvents.on('materialTypeChanged', ({ materialType }) => {
            this.updateMaterialTypeUI(materialType);
        });

        // listen for cubby mode changes to update UI
        appEvents.on('cubbyModeChanged', ({ cubbyMode }) => {
            this.updateCubbyModeUI(cubbyMode);
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

        // Create layout row for material type select
        const materialTypeRow = createDiv()
            .addClass('dimensions-row')
            .parent(this.html.materialTypeGroup);

        // Create column for the select
        const materialTypeColumn = createDiv()
            .addClass('dimension-column')
            .parent(materialTypeRow);

        this.html.materialTypeSelect = createSelect()
            .parent(materialTypeColumn)
            .addClass('settings-select')
            .changed(() => this.handleMaterialTypeChange());
        this.html.materialTypeSelect.option('Plywood (Laser)', 'plywood-laser');
        this.html.materialTypeSelect.option('Acrylic (Laser)', 'acrylic-laser');
        this.html.materialTypeSelect.option('Clay/Plastic (3D Printer)', 'clay-plastic-3d');


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

        this.html.downloadBoardDataButton = createButton('Download Board Data')
            .parent(this.html.buttonList)
            .addClass('button secondary-button')
            .attribute('disabled', '')
            .mousePressed(() => this.handleDownloadBoardData());

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

    getCurrentSettingValue(settingName, defaultValue) {
        // Get current value from appState, handling falsy values like 0 properly
        if (settingName === 'cubbyCurveRadius' && typeof appState.generationConfig.cubbyCurveRadius === 'number') {
            return appState.generationConfig.cubbyCurveRadius;
        }
        // Add other settings that need appState sync here as needed
        return defaultValue;
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
                // Use current appState value if available, otherwise use default
                const currentValue = this.getCurrentSettingValue(setting.name, setting.defaultValue);
                inputElement.value(currentValue);
            } else {
                // Use current appState value if available, otherwise use default
                const currentValue = this.getCurrentSettingValue(setting.name, setting.defaultValue);
                inputElement = createInput(currentValue.toString())
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
        // show sidebar buttons
        this.html.backButton.removeClass('hidden');
        this.html.exportButton.removeClass('hidden');

        // show basic UI elements (material type dropdown and buttons)
        this.html.materialTypeGroup.removeClass('hidden');
        this.html.buttonList.removeClass('hidden');


        // initialize material type selection from appState and build UI
        const currentMaterialType = appState.generationConfig.materialType;
        this.html.materialTypeSelect.selected(currentMaterialType);

        // build UI for current material type (setup phase, not triggered by user change)
        this.buildUIForMaterial(currentMaterialType);
        this.displaySettings();

        // reset the canvas
        clear();
        background(255);

        // create the saved solutions list in left sidebar
        this.createAnnealList();

        // Update highlights to show current selection
        this.updateSavedAnnealHighlight();

        // If there's a selected solution, prepare its export data
        if (appState.currentViewedAnnealIndex !== null) {
            // Use setTimeout to ensure UI is fully built
            setTimeout(() => {
                this.prepareExportData();
            }, 0);
        }
    }

    hide() {
        // hide sidebar buttons
        this.html.backButton.addClass('hidden');
        this.html.exportButton.addClass('hidden');

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
        updateButton(this.html.downloadBoardDataButton, state.canShowDownload);

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

        // Update appState using centralized method
        appState.setMaterialType(selectedMaterial);
    }


    updateMaterialTypeUI(materialType) {
        // Update dropdown to match state (in case changed from elsewhere)
        if (this.html.materialTypeSelect) {
            this.html.materialTypeSelect.selected(materialType);
        }

        // Build UI for the selected material
        this.buildUIForMaterial(materialType);

        // Display the new settings in the sidebar
        this.displaySettings();

        // Trigger export data preparation with new material settings
        this.prepareExportData();
    }

    updateCubbyModeUI(cubbyMode) {
        // Only update if we're on the export screen and material UI is built
        if (appState.currentScreen !== ScreenState.EXPORT) {
            return;
        }

        // Update cubby mode UI elements if they exist
        const currentMaterialType = this.html.materialTypeSelect.value();
        const elementMap = this.materialElementMaps[currentMaterialType];

        if (elementMap && elementMap['cubbyMode']) {
            elementMap['cubbyMode'].selected(cubbyMode);
        }

        // Only trigger export data preparation if we have export data ready
        if (elementMap) {
            this.prepareExportData();
        }
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
            // Ensure layout data is prepared
            if (this.currExport.sheetOutline.length === 0 || this.currExport.cutList.length === 0 || this.currExport.etchList.length === 0) {
                this.currExport.prepLayout();
            }
            // Render using BoardRenderer
            const renderConfig = this._buildBoardRenderConfig();
            this.boardRenderer.renderLayout(
                this.currExport.cutList,
                this.currExport.etchList,
                this.currExport.sheetOutline,
                renderConfig
            );
            this.html.showButton.html('Show Case');
        } else {
            // Render using BoardRenderer
            const renderConfig = this._buildBoardRenderConfig();
            this.boardRenderer.renderCase(
                this.currExport.boards,
                this.currExport.cellular,
                renderConfig
            );
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
        const renderConfig = this._buildBoardRenderConfig(imageBuffer);
        this.boardRenderer.renderCase(
            this.currExport.boards,
            this.currExport.cellular,
            renderConfig
        );

        // todo: file name based on solution name
        imageBuffer.save('case_preview.png');
    }

    handleDownloadBoardData() {
        // Extract board data with exact values used for DXF generation
        const boardData = this.currExport.boards.map(board => ({
            id: board.id,
            length: board.getLength(),
            orientation: board.orientation,
            poi: {
                start: board.poi.start,
                end: board.poi.end,
                tJoints: [...board.poi.tJoints], // Copy arrays to avoid references
                xJoints: [...board.poi.xJoints]
            },
            // Include original coordinates for verification
            coords: {
                start: { ...board.coords.start },
                end: { ...board.coords.end }
            }
        }));

        // Include material settings for context
        const debugData = {
            timestamp: new Date().toISOString(),
            materialType: this.currExport.materialType,
            config: {
                caseDepthIn: this.currExport.caseDepthIn,
                sheetThicknessIn: this.currExport.sheetThicknessIn,
                kerfIn: this.currExport.kerfIn,
                numPinSlots: this.currExport.numPinSlots
            },
            boards: boardData,
            // Include summary stats for quick verification
            summary: {
                totalBoards: boardData.length,
                horizontalBoards: boardData.filter(b => b.orientation === 'x').length,
                verticalBoards: boardData.filter(b => b.orientation === 'y').length,
                totalTJoints: boardData.reduce((sum, b) => sum + b.poi.tJoints.length, 0),
                totalXJoints: boardData.reduce((sum, b) => sum + b.poi.xJoints.length, 0)
            }
        };

        // Download as JSON
        const jsonString = JSON.stringify(debugData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'board_debug_data.json';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
    //== end button handlers

    showBoardTooLongError(longestBoard, sheetWidth) {
        clear();
        background(255);

        // Set text stroke and fill
        stroke(0);
        strokeWeight(1);
        fill('red');
        textAlign(CENTER, CENTER);
        textSize(16);

        // Show the error message
        const spaceNeeded = longestBoard.getLength() + (this.currExport.gap * 2); // board + gaps
        text(
            `Error: Board #${longestBoard.id} is too long for the current sheet.\n\n` +
            `Board Length: ${longestBoard.getLength().toFixed(2)} inches\n` +
            `Space Needed (including gaps): ${spaceNeeded.toFixed(2)} inches\n` +
            `Sheet Width: ${sheetWidth.toFixed(2)} inches\n\n` +
            `Please increase the sheet width to at least ${Math.ceil(spaceNeeded)} inches.`,
            width / 2,
            height / 2
        );
    }

    prepareExportData() {
        // Check if there are any saved anneals
        if (appState.savedAnneals.length === 0) {
            console.log("No saved solutions to export");
            return;
        }

        // Ensure we're using the currently viewed anneal if one is selected
        if (appState.currentViewedAnnealIndex !== null && appState.savedAnneals[appState.currentViewedAnnealIndex]) {
            appState.currentAnneal = appState.savedAnneals[appState.currentViewedAnnealIndex];
        } else if (!appState.currentAnneal) {
            // if no current anneal, set to first saved anneal
            let index = 0;
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
        const thicknessIn = elementMap['thicknessIn'] ? parseFloat(elementMap['thicknessIn'].value()) : 0.23;
        const kerfIn = elementMap['kerfIn'] ? parseFloat(elementMap['kerfIn'].value()) : 0;
        const caseDepthIn = elementMap['caseDepthIn'] ? parseFloat(elementMap['caseDepthIn'].value()) : 3;
        const sheetWidthIn = elementMap['sheetWidthIn'] ? parseFloat(elementMap['sheetWidthIn'].value()) : 30;
        const sheetHeightIn = elementMap['sheetHeightIn'] ? parseFloat(elementMap['sheetHeightIn'].value()) : 28;
        const numPinSlots = elementMap['pinSlots'] ? parseInt(elementMap['pinSlots'].value()) : 2;
        const numSheets = parseInt(this.html.numSheetsInput.value()); // Hidden but automatically managed

        // Validate inputs
        const invalidInputs = [thicknessIn, kerfIn, caseDepthIn, sheetWidthIn, sheetHeightIn, numSheets].some(val => isNaN(val));
        const invalidPinSlots = elementMap['pinSlots'] && isNaN(numPinSlots);

        if (invalidInputs || invalidPinSlots) {
            alert("Invalid input for one or more fields");
            return;
        }

        // get solution for accessing fabrication type and other properties
        const solution = appState.currentAnneal.finalSolution;

        // get export config (includes all parameters for different fabrication types)
        const cubbyCurveRadius = elementMap['cubbyCurveRadius'] ? parseFloat(elementMap['cubbyCurveRadius'].value()) : 0.5;
        const cubbyMode = elementMap['cubbyMode'] ? elementMap['cubbyMode'].value() : 'one';

        // Update appState for clay-plastic-3d materials (for consistent preview)
        if (materialType === 'clay-plastic-3d') {
            appState.generationConfig.cubbyCurveRadius = cubbyCurveRadius;
            appState.generationConfig.cubbyMode = cubbyMode;
        }

        const config = {
            caseDepthIn,
            sheetThicknessIn: thicknessIn,
            sheetWidthIn,
            sheetHeightIn,
            numSheets,
            numPinSlots,
            kerfIn,
            // 3D printing specific
            cubbyCurveRadius: cubbyCurveRadius,
            cubbyMode: cubbyMode,
            wallThickness: elementMap['wallThickness'] ? parseFloat(elementMap['wallThickness'].value()) : 0.25,
            shrinkFactor: elementMap['shrinkFactor'] ? parseFloat(elementMap['shrinkFactor'].value()) : 0,
            printBedWidth: elementMap['printBedWidth'] ? parseFloat(elementMap['printBedWidth'].value()) : 12,
            printBedHeight: elementMap['printBedHeight'] ? parseFloat(elementMap['printBedHeight'].value()) : 12,
            // Min wall length from generation config for unit conversion
            minWallLength: appState.generationConfig.minWallLength || 1.0
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

        // Export screen is independent - determine exporter type based on selected material, not solution's fabricationType
        // This allows viewing any solution in any export format
        const exporterType = this.getExporterTypeForMaterial(materialType);

        // Create appropriate exporter based on material type selection
        const exportConfig = {
            materialType: materialType,
            spacing: spacing,
            ...config // spread all config properties
        };

        if (exporterType === 'cubbies') {
            this.currExport = new CubbyExporter(cellData, exportConfig);
            this.currExport.detectCubbies();
            console.log(`📊 Export: ${this.currExport.cubbies.length} cubbies detected for solution "${appState.currentAnneal.title}"`);
        } else {
            // Use boards exporter for laser cut materials
            this.currExport = new BoardExporter(cellData, exportConfig);
            this.currExport.generateBoards();
            console.log(`📊 Export: ${this.currExport.boards.length} boards created for solution "${appState.currentAnneal.title}"`);

            // Check if any board is longer than the sheet width (accounting for gaps)
            const longestBoard = this.currExport.getLongestBoard();
            if (longestBoard && (longestBoard.getLength() + (this.currExport.gap * 2)) > sheetWidthIn) {
                this.showBoardTooLongError(longestBoard, sheetWidthIn);
                updateButton(this.html.showButton, false);
                updateButton(this.html.downloadDXFButton, false);
                updateButton(this.html.downloadCaseButton, false);
                return;
            }
        }

        // Setup layout if the exporter supports it
        if (typeof this.currExport.setupSheets === 'function') {
            this.currExport.setupSheets();
        }

        // preview the layout or case using BoardRenderer
        const renderConfig = this._buildBoardRenderConfig();
        if (this.showingLayout) {
            // Ensure layout data is prepared
            if (this.currExport.sheetOutline.length === 0 || this.currExport.cutList.length === 0 || this.currExport.etchList.length === 0) {
                this.currExport.prepLayout();
            }
            this.boardRenderer.renderLayout(
                this.currExport.cutList,
                this.currExport.etchList,
                this.currExport.sheetOutline,
                renderConfig
            );
        } else {
            this.boardRenderer.renderCase(
                this.currExport.boards,
                this.currExport.cellular,
                renderConfig
            );
        }

        // enable show and download buttons
        updateButton(this.html.showButton, true);
        updateButton(this.html.downloadDXFButton, true);
        updateButton(this.html.downloadCaseButton, true);
    }

    _buildBoardRenderConfig(renderer = null) {
        // Build configuration object for BoardRenderer
        // Check for dev mode
        const isDevMode = (typeof appState !== 'undefined' && appState.display) ? appState.display.devMode : false;

        return {
            // Canvas dimensions
            canvasWidth: canvasWidth,
            canvasHeight: canvasHeight,

            // Sheet dimensions (for layout preview)
            sheetWidthIn: this.currExport.sheetWidthIn,
            sheetHeightIn: this.currExport.sheetHeightIn,
            numSheets: this.currExport.numSheets,

            // Grid/pixel conversion (for case preview)
            squareSize: this.currExport.squareSize,
            buffer: this.currExport.buffer,
            xPadding: this.currExport.xPadding,
            yPadding: this.currExport.yPadding,
            minWallLength: this.currExport.minWallLength,

            // Debug/dev options
            showDevMarkers: isDevMode,

            // Optional offscreen renderer
            renderer: renderer
        };
    }

    //== Display functions
    createAnnealList() {
        // create list of solutions to select
        if (!htmlRefs.left) return;

        // clear the list and set up scrollable container structure
        htmlRefs.left.list.html('');
        htmlRefs.left.list.addClass('sidebar-with-controls');
        this.savedAnnealElements = [];

        // Create scrollable container for solutions
        this.html.leftScrollContainer = createDiv()
            .addClass('sidebar-scroll')
            .parent(htmlRefs.left.list);

        // Add the solutions label
        createSpan('Solutions')
            .addClass('settings-label')
            .style('padding', '0 10px')
            .parent(this.html.leftScrollContainer);

        // Create the solutions container
        this.html.solutionsContainer = createDiv()
            .addClass('solutions-container')
            .style('padding', '0 10px')
            .parent(this.html.leftScrollContainer);

        // create the list
        for (let i = 0; i < appState.savedAnneals.length; i++) {
            let savedAnnealItem = createDiv().addClass('saved-anneal-item');
            if (i === appState.currentViewedAnnealIndex) {
                savedAnnealItem.addClass('highlighted');
            }
            savedAnnealItem.parent(this.html.solutionsContainer);

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
            if (i === appState.currentViewedAnnealIndex) {
                this.savedAnnealElements[i].addClass('highlighted');
            } else {
                this.savedAnnealElements[i].removeClass('highlighted');
            }
        }
    }

    getExporterTypeForMaterial(materialType) {
        // Determine which exporter to use based on selected material type
        // Export screen is independent of design screen's fabrication type
        switch (materialType) {
            case 'plywood-laser':
            case 'acrylic-laser':
                return 'boards';  // Use BoardExporter for laser cut materials

            case 'clay-plastic-3d':
                return 'cubbies'; // Use CubbyExporter for 3D printed materials

            default:
                return 'boards';
        }
    }
}

// only export the class when in a Node.js environment (e.g., during Jest tests)
// ignored when the app is running in the browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ExportUI;
}