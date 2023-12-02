class Shape {
  constructor(_title) {
    this.shape = [];
    this.shapeBoundary = [];
    this.inputGrid = [];
    this.title = _title;
    // bottom left corner of the shape, including overhangs
    this.posX;
    this.posY;
  }

  saveUserInput(_inputGrid) {
    // to do: only save the shape, without the empty input space around it
    // - note: _inputGrid[0] is the top row, not bottom. flip it.

    // create a new array to loop inputGrid
    let trimShape = [];
    let leftIndex = _inputGrid[0].length - 1;
    let rightIndex = 0;
    // find left and right indices for the shape
    for (let i = 0; i < _inputGrid.length; i++) {
      if (_inputGrid[i].includes(true)) {
        let currLeft = _inputGrid[i].indexOf(true);
        let currRight = _inputGrid[i].lastIndexOf(true);
        if (currLeft < leftIndex) {
          leftIndex = currLeft;
        }
        if (currRight > rightIndex) {
          rightIndex = currRight;
        }
      }
    }

    for (let i = 0; i < _inputGrid.length; i++) {
      if (_inputGrid[i].includes(true)) {
        let rowSlice = _inputGrid[i].slice(leftIndex, rightIndex + 1);
        trimShape.push(rowSlice);
      }
    }

    this.shape = trimShape;
    this.inputGrid = _inputGrid;
  }
}