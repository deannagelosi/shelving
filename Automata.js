// Builds shelves using cellular automata rules to grow from a seed
class Automata {
    constructor(_solution) {
        this.solution = _solution;
        this.seedX = [];
        this.seedY = [];
        this.growMode = 0;
        this.firstShape = true;
    }

    plantSeed() {
        // drop seed in the bottom left corner of a shape within a solution
        this.seedX.push(this.solution.shapes[0].posX);
        this.seedY.push(this.solution.shapes[0].posY);
    }

    // UR = [currX, currY]
    // UL = [currX - 1, currY]
    // DR = [currX, currY - 1]
    // DL = [currX - 1, currY - 1]

    grow() {
        switch (this.growMode) {
            case 0:
                // draw along bottom of shape
                if (this.solution.layout[this.seedY[this.seedY.length - 1]][this.seedX[this.seedX.length - 1]].cellScore == 0) {
                    this.seedX.push(this.seedX[this.seedX.length - 1] + 1);
                    this.seedY.push(this.seedY[this.seedY.length - 1]);
                } else {
                    this.firstShape = false;
                    this.growMode = 1;
                }
                break;
            case 1:
                // cell with a shape
                console.log("case 1")
                break;
            // case 2:
            //     // cell with a shelf
            //     break;
            // case 3:
            //     // cell with a seed
            //     break;
        }
    }

    showResult() {
        let cellSizeHeight = canvasHeight / this.solution.layout.length;
        let cellSizeWidth = canvasWidth / this.solution.layout[0].length;
        let cellSize = Math.min(cellSizeHeight, cellSizeWidth);
        // show the seed placement
        fill("green"); // Black color for the dots
        noStroke(); // No border for the dots
        for (let i = 0; i < this.seedX.length; i++) {
            circle(this.seedX[i] * cellSize, canvasHeight - (this.seedY[i] * cellSize), 10);
        }
        // circle(this.seedX * cellSize, canvasHeight - (this.seedY * cellSize), 10);
    }

}