class Solution {
    constructor(_shapes) {
        this.shapes = _shapes;
        this.designSpace = [];
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
        console.log(this.designSpace);

        //== Place the shapes ==//
        // loop shapes and randomly place in the designSpace
        for (let i = 0; i < this.shapes.length; i++) {
            let currShape = this.shapes[i];
            currShape.posX = Math.floor(Math.random() * width);
            currShape.posY = Math.floor(Math.random() * height);
        }
    }

}