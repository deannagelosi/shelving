// Builds shelves using cellular automata rules to grow from a seed
class Automata {
    constructor(_solution) {
        this.solution = _solution;
        this.seedX;
        this.seedY;
    }

    plantSeed() {
        let cellSizeHeight = canvasHeight / this.solution.layout.length;
        let cellSizeWidth = canvasWidth / this.solution.layout[0].length;
        let cellSize = Math.min(cellSizeHeight, cellSizeWidth);
        // drop seed in the bottom left corner of a shape within a solution
        this.seedX = this.solution.shapes[0].posX * cellSize;
        this.seedY = this.solution.shapes[0].posY * cellSize;
        console.log('shape: ', this.solution.shapes[0]);
    }

    grow() { }

    showResult() {
        // show the seed placement
        fill("green"); // Black color for the dots
        noStroke(); // No border for the dots
        circle(this.seedX, this.seedY, 10);
        console.log('Seed planted at: ', this.seedX, this.seedY);
    }

}