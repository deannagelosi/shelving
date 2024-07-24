class DesignUI {
    constructor() {
        //== state variables
        // dom elements
        this.htmlRef = {};
        this.html = {};

        //== initialize UI elements
        this.getHtmlRef();
        this.initBodyUI();

        // initially hide the input elements
        this.hide();
    }

    getHtmlRef() {
        // get references to parent dom elements
        this.htmlRef.header = select('#header');
        this.htmlRef.leftBar = select('#left-side-bar');
        this.htmlRef.rightBar = select('#right-side-bar');
        this.htmlRef.bottomDiv = select('#bottom-div');
        this.htmlRef.rightSideTop = select('#right-side-bar .sidebar-top');
        this.htmlRef.rightSideList = select('#right-side-bar .sidebar-list');
        this.htmlRef.rightSideButtons = select('#right-side-bar .sidebar-buttons');
    }

    initBodyUI() {
        //== setup dom elements
        // setup anneal ui element containers
        this.html.designDiv = createDiv();
        this.html.designDiv.parent(this.htmlRef.bottomDiv);
        this.html.designDiv.id('design-div');

        this.html.regenButton = createButton('Regenerate');
        this.html.regenButton.parent(this.html.designDiv).addClass('button');

        // info text
        this.html.diagnosticText = createP("(toggle 'd' key for diagnostics)");
        this.html.diagnosticText.parent(this.html.designDiv).addClass('info-text');

        this.html.growthText = createP("(press 'g' to grow cells)");
        this.html.growthText.parent(this.html.designDiv).addClass('info-text');
    }

    show() {
        // toggle on the input screen divs
        // this.htmlRef.leftBar.removeClass('hidden');
        // this.htmlRef.rightBar.removeClass('hidden');
        this.htmlRef.bottomDiv.removeClass('hidden');


        // remove hidden class from each element in this.html
        Object.values(this.html).forEach(element => element.removeClass('hidden'));

        this.html.growthText.addClass('hidden');
        if (annealingComplete && devMode) {
            this.html.growthText.removeClass('hidden');
        }
    }

    hide() {
        // toggle off input screen divs
        this.htmlRef.leftBar.addClass('hidden');
        this.htmlRef.rightBar.addClass('hidden');
        this.htmlRef.bottomDiv.addClass('hidden');

        // add hidden class to each element in this.html
        Object.values(this.html).forEach(element => element.addClass('hidden'));
    }
}