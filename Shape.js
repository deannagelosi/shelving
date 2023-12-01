class Shape {
  constructor(_title) {
    this.shape = [];
    this.shapeBoundary = [];
    this.title = _title;
  }

  saveUserInput(_inputGrid) {
    // to do: only save the shape, without the empty input space around it
    // - note: _inputGrid[0] is the top row, not bottom. flip it.
    this.shape = _inputGrid;
    this.shapeBoundary = _inputGrid;

  }
}