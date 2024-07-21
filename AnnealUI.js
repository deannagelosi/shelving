class AnnealUI {
    constructor() {
        //== setup dom elements
        // retrieve reference to ui container div
        this.uiContainer = select('#ui-container');
        // setup anneal ui element containers
        this.annealContainer = createDiv().parent(this.uiContainer).id('anneal-container');

        // initialize UI elements
        this.initAnnealUI();
    }

    initAnnealUI() {
        let reannealButton = createButton('RE-ANNEAL');
        reannealButton.parent(this.annealContainer).addClass('button');
        // re-anneal button gets it's handler function in Anneal.js

        // info text
        let diagnosticText = createP("(toggle 'd' key for diagnostics)");
        diagnosticText.parent(this.annealContainer).addClass('info-text');

        let growthText = createP("(press 'g' to grow cells)");
        growthText.parent(this.annealContainer).addClass('info-text');

        this.annealUIElements = {
            reannealButton,
            diagnosticText,
            growthText
        };

        // initially hide the anneal container
        this.hide();
    }

    show() {
        this.annealContainer.removeClass('hidden');

        this.annealUIElements.growthText.addClass('hidden');
        if (annealingComplete && devMode) {
            this.annealUIElements.growthText.removeClass('hidden');
        }
    }

    hide() {
        this.annealContainer.addClass('hidden');
    }
}