class CubbyRenderer {
    constructor() {
        // Renderer class for Cubby visualization        
        // All render methods use only parameters, no global state
    }

    // Render all three line types for each cubby in different colors
    renderAllLineTypes(cubbies, canvas, config, options = {}) {
        noFill();
        
        for (const cubby of cubbies) {
            // 1. Render exterior lines (thickest, bottom layer)
            stroke(options.exteriorColor || 'blue');
            strokeWeight(options.exteriorWeight || 4);
            this.renderLineSet(cubby.exteriorLines, canvas, config);
            
            // 2. Render center lines (middle layer)
            stroke(options.centerColor || 'black');
            strokeWeight(options.centerWeight || 2);
            this.renderLineSet(cubby.centerLines, canvas, config);
            
            // 3. Render interior lines (thinnest, top layer)
            stroke(options.interiorColor || 'red');
            strokeWeight(options.interiorWeight || 1);
            this.renderLineSet(cubby.interiorLines, canvas, config);
        }
    }

    // Generic line rendering for any line set
    renderLineSet(lines, canvas, config) {
        if (!lines || lines.length === 0) return;
        
        for (const lineSegment of lines) {
            if (lineSegment.type === 'bezier') {
                // Render bezier curve
                const coords1 = this.gridToCanvas(lineSegment.x1, lineSegment.y1, canvas, config);
                const coordsCP1 = this.gridToCanvas(lineSegment.cp1x, lineSegment.cp1y, canvas, config);
                const coordsCP2 = this.gridToCanvas(lineSegment.cp2x, lineSegment.cp2y, canvas, config);
                const coords2 = this.gridToCanvas(lineSegment.x2, lineSegment.y2, canvas, config);
                
                bezier(coords1.x, coords1.y, coordsCP1.x, coordsCP1.y,
                       coordsCP2.x, coordsCP2.y, coords2.x, coords2.y);
            } else {
                // Render regular line
                const coords1 = this.gridToCanvas(lineSegment.x1, lineSegment.y1, canvas, config);
                const coords2 = this.gridToCanvas(lineSegment.x2, lineSegment.y2, canvas, config);
                
                line(coords1.x, coords1.y, coords2.x, coords2.y);
            }
        }
    }

    gridToCanvas(gridX, gridY, canvas, config) {
        // Convert grid coordinates to canvas coordinates (consistent p5.js coordinate system)
        const canvasX = (gridX * config.squareSize) + config.buffer + config.xPadding;
        const canvasY = ((canvas.height - config.yPadding) - config.buffer) - (gridY * config.squareSize);
        
        return { x: canvasX, y: canvasY };
    }

    getCubbyColors() {
        // Color palette for different cubbies (matches CubbyExporter colors)
        return ['red', 'blue', 'green', 'orange', 'purple', 'brown', 'pink', 'gray'];
    }

    renderCubbyLabels(cubbies, canvas, config, options = {}) {
        // Render labels for each cubby at their center points
        const colors = this.getCubbyColors();
        
        fill(options.labelColor || 'white');
        stroke('black');
        strokeWeight(1);
        textAlign(CENTER, CENTER);
        textSize(options.textSize || 12);
        
        for (let i = 0; i < cubbies.length; i++) {
            const cubby = cubbies[i];
            const color = colors[i % colors.length];
            
            if (cubby.cells && cubby.cells.length > 0) {
                // Find center of cubby
                const centerCell = this.findCubbyCenter(cubby.cells);
                const centerCoords = this.gridToCanvas(centerCell.x, centerCell.y, canvas, config);
                
                // Draw label with cubby color
                fill(color);
                text(`${cubby.id}`, centerCoords.x, centerCoords.y);
            }
        }
    }

    findCubbyCenter(cells) {
        // Find approximate center cell of a cubby
        if (cells.length === 0) return { x: 0, y: 0 };
        
        let sumX = 0, sumY = 0;
        for (const cell of cells) {
            sumX += cell.x;
            sumY += cell.y;
        }
        
        return {
            x: sumX / cells.length,
            y: sumY / cells.length
        };
    }

    renderCubbyOutlines(cubbies, canvas, config, options = {}) {
        // Render simple rectangular outlines for cubbies (fallback rendering)
        const colors = this.getCubbyColors();
        
        stroke(options.outlineColor || 'black');
        strokeWeight(options.strokeWeight || 2);
        noFill();
        
        for (let i = 0; i < cubbies.length; i++) {
            const cubby = cubbies[i];
            const color = colors[i % colors.length];
            
            if (cubby.cells && cubby.cells.length > 0) {
                stroke(color);
                const bounds = this.getCubbyBounds(cubby.cells);
                
                const topLeft = this.gridToCanvas(bounds.minX, bounds.maxY, canvas, config);
                const bottomRight = this.gridToCanvas(bounds.maxX, bounds.minY, canvas, config);
                
                const rectWidth = bottomRight.x - topLeft.x;
                const rectHeight = bottomRight.y - topLeft.y;
                
                rect(topLeft.x, topLeft.y, rectWidth, rectHeight);
            }
        }
    }

    // Note: extractPerimeter and convertEdgesToLineSegments have been moved to Cubby class

    getCubbyBounds(cells) {
        // Calculate bounding box for cubby cells
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;
        
        for (const cell of cells) {
            minX = Math.min(minX, cell.x);
            minY = Math.min(minY, cell.y);
            maxX = Math.max(maxX, cell.x + 1);
            maxY = Math.max(maxY, cell.y + 1);
        }
        
        return { minX, minY, maxX, maxY };
    }

    // Note: All curve generation methods have been moved to Cubby class
}

// Only export the class when in a Node.js environment (e.g., during Jest tests)
// Ignored when the app is running in the browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CubbyRenderer;
}