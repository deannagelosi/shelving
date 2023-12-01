class UI {
    constructor() {
        // Create the title input field
        this.titleLabel = createP('Title:');
        this.titleLabel.position(10, height + 5);
        this.titleInput = createInput('');
        this.titleInput.position(50, height + 20);
        this.titleInput.attribute('maxlength', '25');

        // Create the SAVE button
        this.saveButton = createButton('SAVE');
        this.saveButton.position(
            this.titleInput.x + this.titleInput.width + 10, height + 20
        );
        this.saveButton.mousePressed(() => this.saveShape());

        // Create the NEXT button
        this.nextButton = createButton('NEXT');
        this.nextButton.position(
            this.saveButton.x + this.saveButton.width + 10, height + 20
        );
        this.nextButton.mousePressed(() => this.displayAllShapes());
    }

    displayAllShapes() {
        // Clear the canvas
        console.log("test");
    }
  
    saveShape() {
        if (activeShape.isValid()) {
            // shape is valid, add new shape
            let newShape = new Shape(rows, cols);
            newShape.addTitle(this.titleInput.value());
            newShape.grid = activeShape.grid;

            shapes.push(newShape);
            console.log(shapes);

            // Reset active shape and UI
            activeShape = new Shape(rows, cols);
            this.resetCanvas();
        }
    }

    resetCanvas() {
      background(255);
      this.titleInput.value('');
      activeShape.drawGrid();
      this.displayShapeTitles();
    }
  
    displayShapeTitles() {
        // Start below the title input box
        let startY = this.titleInput.y + 25;
        // Display each shape's title
        for (let i = 0; i < shapes.length; i++) {
            let shapeTitle = createP(`${shapes[i].title}`);
            shapeTitle.position(10, startY + (i * 25));
        }
    }
}