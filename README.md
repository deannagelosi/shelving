# todo

## Known Bugs

- adjust shape coordinates when trimming

## Object Placement

- gravity - bottom "row" shapes drop to ground
- change min white space minesweeper number to ratio
- change overlap penalty to ratio (greater than adding enough white space to fix it)
- end when there are no more 8s
- add center of gravity into scoring
- multiple anneal passes
- score penalty when out of bounds

## Build Shelves

- 

## UI

- print boundary colors and shapes
- freeze shapes in layout
- stop button: good initial state, or stuck
- re-anneal button
- add option for empty spaces to fill later
- hang on wall (center of gravity is ignored) vs flat on table (requires flat bottoms)

```js
 displayBoards() {
        // draw the horizontal boards
        for (let i = 0; i < this.horizontalBoards.length; i++) {
            let board = this.horizontalBoards[i];
            stroke("red");
            strokeWeight(3);

            // translate to the case's position and cell size
            let startX = this.lrPadding + (board.startCoords[1] * this.caseCellSize);
            let startY = this.tbPadding + (this.caseHeight * this.caseCellSize) - (board.startCoords[0] * this.caseCellSize); // draw from bottom up
            let endX = this.lrPadding + (board.endCoords[1] * this.caseCellSize);
            let endY = this.tbPadding + (this.caseHeight * this.caseCellSize) - (board.endCoords[0] * this.caseCellSize); // draw from bottom up

            line(startX, startY, endX, endY);

            // draw dots at the start and end coords
            fill("orange"); // Black color for the dots
            noStroke(); // No border for the dots
            // Draw a dot at the startCoords and endCoords
            circle(startX, startY, 15); // x, y, size
            circle(endX, endY, 15); // x, y, size
        }

        // draw the vertical boards
        for (let i = 0; i < this.verticalBoards.length; i++) {
            let board = this.verticalBoards[i];
            stroke("red");
            strokeWeight(3);

            // translate to the case's position and cell size
            let startX = this.lrPadding + (board.startCoords[1] * this.caseCellSize);
            let startY = this.tbPadding + (this.caseHeight * this.caseCellSize) - (board.startCoords[0] * this.caseCellSize); // draw from bottom up
            let endX = this.lrPadding + (board.endCoords[1] * this.caseCellSize);
            let endY = this.tbPadding + (this.caseHeight * this.caseCellSize) - (board.endCoords[0] * this.caseCellSize); // draw from bottom up

            line(startX, startY, endX, endY);

            // draw dots at the start and end coords
            fill("green"); // Black color for the dots
            noStroke(); // No border for the dots
            // Draw a dot at the startCoords and endCoords
            circle(startX, startY, 8); // x, y, size
            circle(endX, endY, 8); // x, y, size
        }
    }
```
