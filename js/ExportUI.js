class ExportUI {
    constructor() {
        //== state variables
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
            .parent(this.htmlRef.rightSideButtons)
            .addClass('button secondary-button')
            .mousePressed(() => this.handleBack());

        this.html.createButton = createButton('Create')
            .parent(this.htmlRef.rightSideButtons)
            .addClass('button primary-button')
            .attribute('disabled', '')
            .mousePressed(() => this.handleCreate());

        // todo: add solution name
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

        this.html.layoutButton = createButton('Download Layout')
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
}