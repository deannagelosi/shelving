class ExportUI {
    constructor() {
        //== state variables
        this.currExport;
        this.savedAnnealElements = []
        // dom elements
        this.htmlRef = {};
        this.html = {};
        // flags
        this.showingLayout = true;
        this.isExporting = false;

        //== initialize UI elements
        this.getHtmlRef();
        this.initHeaderUI();
        this.initLeftSideUI();
        this.initBodyUI();
        this.initRightSideUI();

        // initially hide the export elements
        this.hide();
    }

    //== UI init functions
    getHtmlRef() {
        // get references to parent dom elements
        this.htmlRef.header = select('#header');
        this.htmlRef.subheading = select('#subheading');
        this.htmlRef.leftBar = select('#left-side-bar');
        this.htmlRef.rightBar = select('#right-side-bar');
        this.htmlRef.bottomDiv = select('#bottom-div');
        this.htmlRef.leftSideTop = select('#left-side-bar .sidebar-top');
        this.htmlRef.leftSideList = select('#left-side-bar .sidebar-list');
        this.htmlRef.leftSideButtons = select('#left-side-bar .sidebar-buttons');
        this.htmlRef.rightSideTop = select('#right-side-bar .sidebar-top');
        this.htmlRef.rightSideList = select('#right-side-bar .sidebar-list');
        this.htmlRef.rightSideButtons = select('#right-side-bar .sidebar-buttons');
    }

    initHeaderUI() {
        // Setup header UI elements specific to export screen
    }

    initLeftSideUI() {
        //== setup ui elements for left side bar
        this.html.backButton = createButton('Back')
            .parent(this.htmlRef.leftSideButtons)
            .addClass('button secondary-button')
            .attribute('disabled', '')
            .mousePressed(() => this.handleBack());

        // Export button
        this.html.exportButton = createButton('Export')
            .parent(this.htmlRef.leftSideButtons)
            .addClass('button primary-button')
            .mousePressed(() => this.handleExport());
    }

    initBodyUI() {
        // Setup body UI elements for export screen
        this.html.exportDiv = createDiv()
            .parent(this.htmlRef.bottomDiv)
            .id('export-div');
    }

    initRightSideUI() {
        //== setup ui elements for left side bar
        // settings
        // todo: add solution name

        // bind handleCreate to this instance of the input values
        this.handleCreate = this.handleCreate.bind(this);
        // Material Thickness Input
        this.html.sheetThicknessGroup = createDiv()
            .parent(this.htmlRef.rightSideList)
            .addClass('export-selector');
        this.html.sheetThicknessLabel = createSpan('Material Thickness (in)')
            .parent(this.html.sheetThicknessGroup)
            .addClass('input-label');
        this.html.sheetThicknessInput = createInput('0.25')
            .parent(this.html.sheetThicknessGroup)
            .addClass('input-field')
            .attribute('type', 'number')
            .attribute('min', '0.13')
            .attribute('max', '0.5')
            .attribute('step', '0.01')
            .input(this.handleCreate);

        // Case Depth Input
        this.html.caseDepthGroup = createDiv()
            .parent(this.htmlRef.rightSideList)
            .addClass('export-selector');
        this.html.caseDepthLabel = createSpan('Case Depth (in)')
            .parent(this.html.caseDepthGroup)
            .addClass('input-label');
        this.html.caseDepthInput = createInput('5')
            .parent(this.html.caseDepthGroup)
            .addClass('input-field')
            .attribute('type', 'number')
            .attribute('min', '1')
            .attribute('max', '10')
            .attribute('step', '0.5')
            .input(this.handleCreate);

        // Kerf Input
        this.html.kerfGroup = createDiv()
            .parent(this.htmlRef.rightSideList)
            .addClass('export-selector');
        this.html.kerfLabel = createSpan('Kerf Width')
            .parent(this.html.kerfGroup)
            .addClass('input-label');
        this.html.kerfInput = createInput('0.02')
            .parent(this.html.kerfGroup)
            .addClass('input-field')
            .attribute('type', 'number')
            .attribute('min', '0')
            .attribute('max', '.03')
            .attribute('step', '0.01')
            .input(this.handleCreate);

        // Number of Pin/Slots Selector
        this.html.pinSlotGroup = createDiv()
            .parent(this.htmlRef.rightSideList)
            .addClass('export-selector');
        this.html.pinSlotLabel = createSpan('# of pin/slots')
            .parent(this.html.pinSlotGroup)
            .addClass('input-label');
        this.html.pinSlotSelect = createSelect()
            .parent(this.html.pinSlotGroup)
            .addClass('input-field')
            .changed(this.handleCreate);
        this.html.pinSlotSelect.option('2', '2');
        this.html.pinSlotSelect.option('1', '1');

        // Sheet Dimensions Input
        this.html.sheetDimensionsGroup = createDiv()
            .parent(this.htmlRef.rightSideList)
            .addClass('export-selector');
        this.html.sheetDimensionsLabel = createSpan('Sheet Dimensions (width x height)')
            .parent(this.html.sheetDimensionsGroup)
            .addClass('input-label');
        this.html.sheetWidthInput = createInput('40')
            .parent(this.html.sheetDimensionsGroup)
            .addClass('input-field')
            .attribute('type', 'number')
            .attribute('min', '1')
            .attribute('step', '1')
            .input(this.handleCreate);
        this.html.sheetHeightInput = createInput('28')
            .parent(this.html.sheetDimensionsGroup)
            .addClass('input-field')
            .attribute('type', 'number')
            .attribute('min', '1')
            .attribute('step', '1')
            .input(this.handleCreate);

        // Number of Sheets Input
        this.html.numSheetsGroup = createDiv()
            .parent(this.htmlRef.rightSideList)
            .addClass('export-selector');
        this.html.numSheetsLabel = createSpan('Number of Sheets')
            .parent(this.html.numSheetsGroup)
            .addClass('input-label');
        this.html.numSheetsInput = createInput('1')
            .parent(this.html.numSheetsGroup)
            .addClass('input-field')
            .attribute('type', 'number')
            .attribute('min', '1')
            .attribute('max', '10')
            .attribute('step', '1')
            .input(this.handleCreate);

        // Buttons
        this.html.buttonList = createDiv()
            .parent(this.htmlRef.rightSideList)
            .addClass('export-button-list');

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

    //== Show/Hide functions
    show() {
        // Show export screen elements
        this.htmlRef.leftBar.removeClass('hidden');
        this.htmlRef.rightBar.removeClass('hidden');
        this.htmlRef.bottomDiv.removeClass('hidden');
        // set titles
        this.htmlRef.leftSideTop.html('Solutions');
        this.htmlRef.rightSideTop.html('Settings');
        // Set subheading
        this.htmlRef.subheading.html("Export Design");

        Object.values(this.html).forEach(element => element.removeClass('hidden'));

        this.displaySavedAnneals();
        this.handleCreate();
    }

    hide() {
        // Hide export screen elements
        this.htmlRef.leftBar.addClass('hidden');
        this.htmlRef.rightBar.addClass('hidden');
        this.htmlRef.bottomDiv.addClass('hidden');

        Object.values(this.html).forEach(element => element.addClass('hidden'));
    }

    //== Button handlers
    handleCreate() {
        const caseDepth = parseFloat(this.html.caseDepthInput.value());
        const sheetThickness = parseFloat(this.html.sheetThicknessInput.value());
        const sheetWidth = parseFloat(this.html.sheetWidthInput.value());
        const sheetHeight = parseFloat(this.html.sheetHeightInput.value());
        const numSheets = parseInt(this.html.numSheetsInput.value());
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
        const cellData = designUI.currCellular;
        // get spacing data
        const buffer = designUI.currentAnneal.finalSolution.buffer;
        const yPadding = designUI.currentAnneal.finalSolution.yPadding;
        const xPadding = designUI.currentAnneal.finalSolution.xPadding;
        const spacing = { buffer, yPadding, xPadding }

        // create new export
        this.currExport = new Export(cellData, spacing, config);
        this.currExport.makeBoards();
        this.currExport.prepLayout();

        // preview the layout or chase
        if (this.showingLayout) {
            this.currExport.previewLayout();
        } else {
            this.currExport.previewCase();
        }

        // Enable show and download buttons
        this.html.showButton.removeAttribute('disabled');
        this.html.downloadDXFButton.removeAttribute('disabled');
        this.html.downloadCaseButton.removeAttribute('disabled');
    }

    handleShow() {
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

    handleExport() {
        if (this.isExporting) return; // block multiple clicks during export

        this.isExporting = true;
        this.html.exportButton.attribute('disabled', '');

        // get a copy of shapes with only the data needed
        let shapesCopy = inputUI.shapes.map(shape => shape.exportShape());
        // make a copy of saved anneals with only the data needed
        let annealsCopy = designUI.savedAnneals.map(anneal => {
            return { ...anneal, finalSolution: anneal.finalSolution.exportSolution() }
        });
        // create export object
        let exportData = {
            savedAnneals: annealsCopy,
            allShapes: shapesCopy
        }

        try {
            saveJSONFile(exportData);
        } catch (error) {
            console.error('Export failed:', error);
        } finally {
            this.isExporting = false;
            this.html.exportButton.removeAttribute('disabled');
        }
    }

    //== Display functions
    displaySavedAnneals() {
        this.clearSavedAnneals();

        for (let i = 0; i < designUI.savedAnneals.length; i++) {
            let savedAnnealItem = createDiv().addClass('saved-anneal-item');
            if (designUI.currentAnneal === designUI.savedAnneals[i]) {
                savedAnnealItem.addClass('highlighted');
            }
            savedAnnealItem.parent(this.htmlRef.leftSideList);

            let viewIcon = createImg('img/view.svg', 'View')
                .addClass('icon-button')
                .size(24, 24)
                .parent(savedAnnealItem)
                .mousePressed(() => this.viewSavedAnneal(i));

            let titleSpan = createSpan(designUI.savedAnneals[i].title)
                .addClass('anneal-title')
                .parent(savedAnnealItem);

            this.savedAnnealElements.push(savedAnnealItem);
        }
    }

    viewSavedAnneal(_index) {
        // change selected anneal
        designUI.currentViewedAnnealIndex = _index;
        designUI.currentAnneal = designUI.savedAnneals[_index];
        // update cellular (boards) layout
        designUI.currCellular = new Cellular(designUI.currentAnneal.finalSolution);
        designUI.currCellular.growCells();

        designUI.displayResult(); // todo: this is needed for changes to work. why?
        clear();
        background(255);

        // update UI
        this.updateSavedAnnealHighlight();
        this.handleCreate();
    }

    updateSavedAnnealHighlight() {
        for (let i = 0; i < this.savedAnnealElements.length; i++) {
            if (designUI.currentAnneal === designUI.savedAnneals[i]) {
                this.savedAnnealElements[i].addClass('highlighted');
            } else {
                this.savedAnnealElements[i].removeClass('highlighted');
            }
        }
    }

    clearSavedAnneals() {
        for (let element of this.savedAnnealElements) {
            element.remove();
        }
        this.savedAnnealElements = [];
    }
}