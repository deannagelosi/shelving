// Builds shelves using cellular automata rules to grow from a seed
class Automata {
    constructor(_solution) {
        this.solution = _solution;
        this.seedX = [];
        this.seedY = [];
        this.growMode = 0;
        this.firstShape = true;
        this.moveUp = true;
        this.moveRight = true;
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
        let currX = this.seedX[this.seedX.length - 1];
        let currY = this.seedY[this.seedY.length - 1];
        switch (this.growMode) {
            case 0:
                // draw along bottom of shape
                if (this.solution.layout[currY][currX].cellScore == 0) {
                    this.seedX.push(currX + 1);
                    this.seedY.push(currY);
                } else {
                    this.firstShape = false;
                    this.growMode = 1;
                }
                break;
            case 1:
                // move horizontally
                // posA is the absolute value of the difference between my current position and the next position
                // pos B is the absolute value of the difference between the next position and the position after that
                // if posA is greater than posB, then move forward one
                // if posA is less than or equal to posB, stay in current position and set case = 2
                let posA = Math.abs(this.solution.layout[currY][currX].cellScore - this.solution.layout[currY][currX - 1].cellScore);
                let posB = Math.abs(this.solution.layout[currY][currX + 1].cellScore - this.solution.layout[currY][currX].cellScore);
                if (posA > posB) {
                    this.seedX.push(currX + 1);
                    this.seedY.push(currY);
                } else {
                    this.growMode = 2;
                }
                break;
            case 2:
                // move vertically
                // calc the absolute value of the difference between (my current position y+1) and (my current position x - 1, y + 1)
                // if this value is zero, increase y by 1
                // if this value is not zero, set case = 3
                let posC = Math.abs(this.solution.layout[currY + 1][currX].cellScore - this.solution.layout[currY + 1][currX - 1].cellScore);
                if (posC == 0) {
                    this.seedX.push(currX);
                    this.seedY.push(currY + 1);
                } else {
                    // still go up, but pick the best of the 3 options
                    // get the score for all 3 options, disqualifying an option if they are both 0 inside
                    // pick the lowest score, "up and over" method to get to it
                    // if two scores are tied for lowest, keep looking at options directly above those two till you find one lower, pick that option
                    // note: make a function that returns a dot/intersections score for u,d,l, or r
                }
                break;
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