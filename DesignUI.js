class DesignUI {
    constructor() {
        //== setup dom elements
        // retrieve reference to ui container div
        this.uiContainer = select('#ui-container');
        // setup anneal ui element containers
        this.annealContainer = createDiv().parent(this.uiContainer).id('anneal-container');

        // initialize UI elements
        this.initDesignUI();
    }

    initDesignUI() {
        let reannealButton = createButton('RE-ANNEAL');
        reannealButton.parent(this.annealContainer).addClass('button');
        // re-anneal button gets it's handler function in Anneal.js

        // info text
        let diagnosticText = createP("(toggle 'd' key for diagnostics)");
        diagnosticText.parent(this.annealContainer).addClass('info-text');

        let growthText = createP("(press 'g' to grow cells)");
        growthText.parent(this.annealContainer).addClass('info-text');

        this.designUIElements = {
            reannealButton,
            diagnosticText,
            growthText
        };

        // initially hide the anneal container
        this.hide();
    }

    show() {
        this.annealContainer.removeClass('hidden');

        this.designUIElements.growthText.addClass('hidden');
        if (annealingComplete && devMode) {
            this.designUIElements.growthText.removeClass('hidden');
        }
    }

    hide() {
        this.annealContainer.addClass('hidden');
    }
}