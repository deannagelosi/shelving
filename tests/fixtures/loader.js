const fs = require('fs');
const path = require('path');
const Shape = require('../../js/core/Shape');

function loadShapesFromFixture() {
    // Construct the full path to the fixture file
    const fixturePath = path.resolve(__dirname, './sample_shapes.json');

    // Read the file's contents
    const fileContents = fs.readFileSync(fixturePath, 'utf8');

    // Parse the JSON data
    const fixtureData = JSON.parse(fileContents);

    // Process the raw data into Shape objects, mimicking InputUI.js
    const shapes = fixtureData.allShapes.map(shapeData => {
        const newShape = new Shape();
        // Use the same method as the application to populate the instance
        newShape.saveUserInput(shapeData.data.title, shapeData.data.highResShape);
        return newShape;
    });

    return shapes;
}

module.exports = { loadShapesFromFixture }; 