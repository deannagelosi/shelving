class DesignUI {
    constructor() {
        // dom elements object
        this.html = {};
        
        // initialize UI elements
        this.initDesignUI();
    }
    
    initDesignUI() {
        //== setup dom elements
        // retrieve reference to divs in index.html
        this.bottomUI = select('#bottom-div');
        // setup anneal ui element containers
        this.html.annealContainer = createDiv().id('anneal-div');
        this.html.annealContainer.parent(this.bottomUI);

        this.html.reannealButton = createButton('RE-ANNEAL');
        this.html.reannealButton.parent(this.html.annealContainer).addClass('button');
        // re-anneal button gets it's handler function in Anneal.js

        // info text
        this.html.diagnosticText = createP("(toggle 'd' key for diagnostics)");
        this.html.diagnosticText.parent(this.html.annealContainer).addClass('info-text');

        this.html.growthText = createP("(press 'g' to grow cells)");
        this.html.growthText.parent(this.html.annealContainer).addClass('info-text');

        // initially hide the anneal container
        this.hide();
    }

    show() {
        this.html.annealContainer.removeClass('hidden');

        this.html.growthText.addClass('hidden');
        if (annealingComplete && devMode) {
            this.html.growthText.removeClass('hidden');
        }
    }

    hide() {
        this.html.annealContainer.addClass('hidden');
    }
}