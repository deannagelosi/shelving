class Shape {
    constructor(_rows, _cols) {
      this.rows = _rows;
      this.cols = _cols;
      this.grid = [];
      this.title = "";
      // initialize as all false
      this.setGrid();
    }
    
    setGrid() {
      for (let i = 0; i < this.rows; i++) {
        this.grid[i] = [];
        for (let j = 0; j < this.cols; j++) {
          this.grid[i][j] = false;
        }
      }
    }
    
    drawGrid() {
      for (let i = 0; i < this.rows; i++) {
        for (let j = 0; j < this.cols; j++) {
          this.drawCell(j, i);
        }
      }
    }
    
    drawCell(x, y) {
      if (this.grid[y][x]) {
        fill(0); // Fill black if the rect is clicked
      } else {
        fill(255); // Fill white
      }
      rect(x * cellSize, y * cellSize, cellSize, cellSize);
    }
    
    selectCell(x, y) {
      let gridX = Math.floor(x / cellSize); // Column
      let gridY = Math.floor(y / cellSize); // Row
  
      if (gridX >= 0 && gridX < this.cols && gridY >= 0 && gridY < this.rows) {
        this.grid[gridY][gridX] = !this.grid[gridY][gridX]; // Toggle the state
        this.drawCell(gridX, gridY); // Redraw only the clicked rectangle
      }
    }
    
    isValid() {
      // criteria: not all cells false
      for (let i = 0; i < this.grid.length; i++) {
        if (this.grid[i].includes(true)) {
          return true;
        }
      }
      return false;
    }
    
    addTitle(titleValue) {
      // assign a title
      if (titleValue === 'name' || titleValue === '') { // 'name' is default placeholder
        this.title = `shape-${shapes.length + 1}`;
      } else {
        this.title = titleValue;
      }
      
      // todo: check if title already exists and append a number if so
    }
  }