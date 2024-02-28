class Solution {
    constructor(_shapes) {
        this.shapes = _shapes;
        this.designSpace = [];
        this.numOutBounds = 0;
    }

    setInitialSolution() {
        //== Create a Design Space ==//

        // this.shapes is an array of all shapes
        // the Shapes class has an attribute called rectArea
        // sum up all of the rectAreas for every shape
        // return the sum
        let totalArea = 0;
        for (let i = 0; i < this.shapes.length; i++) {
            totalArea += this.shapes[i].rectArea;
        }
        // add multiplier to give extra space to work with
        let designArea = totalArea * 4;
        // make a rectangular grid with equivalent area to designArea
        // find the closest rectangle to the designArea
        let width = Math.floor(Math.sqrt(designArea));
        let height = Math.floor(designArea / width);
        // create a 2D array of the same width and height
        this.designSpace = new Array(height);
        for (let i = 0; i < height; i++) {
            this.designSpace[i] = new Array(width);
        }
        // console.log(this.designSpace);

        //== Place the shapes ==//
        // loop shapes and randomly place in the designSpace
        for (let i = 0; i < this.shapes.length; i++) {
            let currShape = this.shapes[i];
            currShape.posX = Math.floor(Math.random() * width);
            currShape.posY = Math.floor(Math.random() * height);
        }
    }

    placeShapes() {
        this.numOutBounds = 0;

        // initialize grid cell values as all empty (0 is empty)
        let designHeight = this.designSpace.length;
        let designWidth = this.designSpace[0].length;
        for (let i = 0; i < designHeight; i++) {
            this.designSpace[i] = [];
            for (let j = 0; j < designWidth; j++) {
                this.designSpace[i][j] = 0;
            }
        }

        // place shape boundaries in the grid
        for (let i = 0; i < this.shapes.length; i++) {
            let shape = this.shapes[i];
            // place shape boundary
            for (let y = 0; y < shape.boundaryHeight; y++) { // loop the boundary shape height and width
                for (let x = 0; x < shape.boundaryWidth; x++) {
                    if (shape.boundaryShape[y][x]) {
                        let yInBounds = shape.posY + y >= 0 && shape.posY + y < designHeight;
                        let xInBounds = shape.posX + x >= 0 && shape.posX + x < designWidth;
                        if (yInBounds && xInBounds) {
                            this.designSpace[shape.posY + y][shape.posX + x] += 1;
                        } else {
                            this.numOutBounds++;
                        }
                    }
                }
            }
        }
    }

}