class Case {
    constructor() {
        this.shortShapes = [];
        this.tallShapes = [];
    }

    sortShapes() {
        shapes.sort(function (a, b) {
            return a.shape.length - b.shape.length;
        });
        // four shortest shapes for middle column
        for (let i = 0; i < shapes.length; i++) {
            if (i < 4) {
                this.shortShapes.push(shapes[i]);
            } else {
                this.tallShapes.push(shapes[i]);
            }
        }
    }
}