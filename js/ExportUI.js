class ExportUI {
    constructor() {
        //== state variables
        this.currExport;
        // dom elements
        this.htmlRef = {};
        this.html = {};
        // flags

        //== initialize UI elements
        this.getHtmlRef();
        this.initHeaderUI();
        this.initLeftSideUI();
        this.initBodyUI();
        this.initRightSideUI();

        // initially hide the export elements
        this.hide();
    }

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

        this.html.createButton = createButton('Create')
            .parent(this.htmlRef.leftSideButtons)
            .addClass('button primary-button')
            .mousePressed(() => this.handleCreate());

        // todo: add solution name

        // Material Thickness Input
        this.html.sheetThicknessGroup = createDiv()
            .parent(this.htmlRef.leftSideList)
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
            .attribute('step', '0.01');

        // Case Depth Input
        this.html.caseDepthGroup = createDiv()
            .parent(this.htmlRef.leftSideList)
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
            .attribute('step', '0.5');
    }

    initBodyUI() {
        // Setup body UI elements for export screen
        this.html.exportDiv = createDiv()
            .parent(this.htmlRef.bottomDiv)
            .id('export-div');

    }

    initRightSideUI() {
        //== setup ui elements for left side bar
        this.html.buttonList = createDiv()
            .parent(this.htmlRef.rightSideList)
            .addClass('export-list');

        this.html.dxfButton = createButton('Download DXF')
            .parent(this.html.buttonList)
            .addClass('button primary-button')
            .attribute('disabled', '')
            .mousePressed(() => this.handleDXFDownload());

        this.html.layoutButton = createButton('Display Layout')
            .parent(this.html.buttonList)
            .addClass('button primary-button')
            .attribute('disabled', '')
            .mousePressed(() => this.handleLayoutDownload());

        this.html.jsonButton = createButton('Download JSON')
            .parent(this.html.buttonList)
            .addClass('button secondary-button')
            .attribute('disabled', '')
            .mousePressed(() => this.handleJSONDownload());
    }

    show() {
        // Show export screen elements
        this.htmlRef.leftBar.removeClass('hidden');
        this.htmlRef.rightBar.removeClass('hidden');
        this.htmlRef.bottomDiv.removeClass('hidden');
        // set titles
        this.htmlRef.leftSideTop.html('Settings');
        this.htmlRef.rightSideTop.html('Files');
        // Set subheading
        this.htmlRef.subheading.html("Export Design");

        Object.values(this.html).forEach(element => element.removeClass('hidden'));
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
        const sheetThickness = parseFloat(this.html.sheetThicknessInput.value());
        const caseDepth = parseFloat(this.html.caseDepthInput.value());

        if (isNaN(sheetThickness) || isNaN(caseDepth)) {
            console.error("Invalid input for material thickness or case depth");
            return;
        }

        clear();
        background(255);

        const buffer = designUI.currentAnneal.finalSolution.buffer;
        const yPadding = designUI.currentAnneal.finalSolution.yPadding;
        const xPadding = designUI.currentAnneal.finalSolution.xPadding;
        const spacing = { buffer, yPadding, xPadding }
        const cellData = designUI.currCellular;

        this.currExport = new Export(cellData, spacing);
        this.currExport.setSheetThickness(sheetThickness);
        this.currExport.setCaseDepth(caseDepth);
        this.currExport.makeBoards();

        this.currExport.previewCutLayout();

        // // Enable download buttons
        // this.html.dxfButton.removeAttribute('disabled');
        this.html.layoutButton.removeAttribute('disabled');
        // this.html.jsonButton.removeAttribute('disabled');
    }

    handleLayoutDownload() {
        clear();
        background(255);
        this.currExport.previewCaseLayout();
    }
}