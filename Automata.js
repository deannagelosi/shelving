// Builds shelves using cellular automata rules to grow from a seed
class Automata {
    constructor(_solution) {
        this.solution = _solution;
    }

    plantSeed() {
        // drop seed in the bottom left corner of a shape within a solution
        let seedX = this.solution.shapes[0].posX;
        let seedY = this.solution.shapes[0].posY;
    }

    grow() {}

    showResult() {
        // show the seed placement
        
    }

}