// Exporter for 3D printed cubbies (clay, plastic)
class CubbyExporter {
    constructor(cellular, config) {
        // Core data
        this.cellular = cellular;
        this.cellLines = cellular.getCellRenderLines();
        this.solution = cellular.solution || cellular;

        // Material configuration
        this.materialType = config.materialType;
        this.materialConfig = MATERIAL_CONFIGS[config.materialType];
        if (!this.materialConfig) {
            console.error(`Unknown material type: ${config.materialType}. Using clay-plastic-3d.`);
            this.materialConfig = MATERIAL_CONFIGS['clay-plastic-3d'];
        }

        // 3D printing specific configuration
        this.cubbyCurveRadius = (typeof config.cubbyCurveRadius === 'number') ? config.cubbyCurveRadius : 0.5;
        this.wallThickness = config.wallThickness || 0.25;
        this.shrinkFactor = config.shrinkFactor || 0;
        this.printBedWidth = config.printBedWidth || 12;
        this.printBedHeight = config.printBedHeight || 12;

        // Layout configuration
        this.squareSize = config.spacing.squareSize;
        this.buffer = config.spacing.buffer;
        this.xPadding = config.spacing.xPadding;
        this.yPadding = config.spacing.yPadding;

        // Output data
        this.cubbies = [];

        // Prepared layout data (like BoardExporter pattern)
        this.cubbyOutlines = [];  // Edge lines in final physical coordinates
        this.cubbyInteriors = []; // Interior lines in final physical coordinates  
        this.cubbyLabels = [];    // Labels in final physical coordinates

        // Layout dimensions (like BoardExporter's sheetWidth/sheetHeight)
        this.layoutWidth = 0;     // Total physical width of the layout in inches
        this.layoutHeight = 0;    // Total physical height of the layout in inches

        // Print bed validation
        this.printBedWarnings = []; // Warnings for cubbies exceeding print bed dimensions

        // Constants
        this.fontSize = 0.10; // inch font size for labels
    }

    detectCubbies() {
        // Use Cellular's flood fill algorithm to detect cubbies
        this.cubbies = [];

        // Use the Cellular class's calculateAllCubbyAreas method 
        // This contains the proven flood fill algorithm used by the worker for statistics
        const cubbyAreas = this.cellular.calculateAllCubbyAreas();

        for (let i = 0; i < cubbyAreas.length; i++) {
            const cubbyData = cubbyAreas[i];

            if (cubbyData.visitedCells && cubbyData.visitedCells.length > 0) {
                // Create a Cubby instance 
                const cubby = new Cubby(
                    cubbyData.shape_id,
                    cubbyData.visitedCells,
                    this.wallThickness,
                    this.cubbyCurveRadius
                );

                this.cubbies.push(cubby);
            }
        }

        // Generate all polygon data with perimeter detection
        const caseBounds = Cubby.calculateCaseBounds(this.cubbies);
        for (const cubby of this.cubbies) {
            cubby.generateAllLines(caseBounds);
        }

        // Apply shrink factor if needed
        this.applyShrinkFactor();

        // Print bed validation 
        this.printBedWarnings = this.validatePrintBedDimensions();

        return this.cubbies;
    }

    // Note: simpleDetectCubbies() method removed - we now always use Cellular.calculateAllCubbyAreas()
    // which provides consistent, proven flood fill results

    // Note: getShapesFromSolution() method removed - we now get shape data via Cellular.calculateAllCubbyAreas()

    // Note: buildWallSet() and floodFill() methods removed - we now use Cellular.calculateAllCubbyAreas() 
    // which contains the proven implementation of these algorithms


    applyShrinkFactor() {
        // Apply shrink factor to compensate for material shrinkage
        if (this.shrinkFactor === 0) return;

        const scaleFactor = 1 + (this.shrinkFactor / 100);

        for (let cubby of this.cubbies) {
            // Scale perimeter points
            for (let segment of cubby.perimeter) {
                segment.x1 *= scaleFactor;
                segment.y1 *= scaleFactor;
                segment.x2 *= scaleFactor;
                segment.y2 *= scaleFactor;
            }
        }
    }

    prepLayout() {
        // Prepare layout data once (like BoardExporter pattern) - single source of truth
        // Clear existing prepared data
        this.cubbyOutlines = [];
        this.cubbyInteriors = [];
        this.cubbyLabels = [];

        if (this.cubbies.length === 0) {
            this.layoutWidth = 1;
            this.layoutHeight = 1;
            return;
        }

        // STEP 1: Calculate layout dimensions first (like BoardExporter knows sheet dimensions upfront)
        const maxCols = Math.ceil(Math.sqrt(this.cubbies.length));
        const maxRows = Math.ceil(this.cubbies.length / maxCols);
        const gridPadding = 0.5; // inches of padding around grid
        const cubbySpacing = 0.25; // inches between cubbies

        // Find maximum dimensions across all cubbies (in grid units like BoardExporter)
        let maxCubbyWidth = 0;
        let maxCubbyHeight = 0;
        const cubbyBounds = [];

        for (const cubby of this.cubbies) {
            const bounds = Cubby.getCubbyBounds(cubby);
            cubbyBounds.push(bounds);
            // Keep in grid units (like BoardExporter keeps board lengths in grid units)
            maxCubbyWidth = Math.max(maxCubbyWidth, bounds.width);
            maxCubbyHeight = Math.max(maxCubbyHeight, bounds.height);
        }

        // Calculate total layout dimensions in grid units (like BoardExporter)
        this.layoutWidth = (maxCols * (maxCubbyWidth + cubbySpacing)) - cubbySpacing + (2 * gridPadding);
        this.layoutHeight = (maxRows * (maxCubbyHeight + cubbySpacing)) - cubbySpacing + (2 * gridPadding);

        // STEP 2: Now store coordinates in grid units (like BoardExporter)
        for (let i = 0; i < this.cubbies.length; i++) {
            const cubby = this.cubbies[i];
            const bounds = cubbyBounds[i];

            // Calculate position in grid layout (in grid units like BoardExporter)
            const col = i % maxCols;
            const row = Math.floor(i / maxCols);
            const cubbyStartX = gridPadding + (col * (maxCubbyWidth + cubbySpacing));
            const cubbyStartY = gridPadding + (row * (maxCubbyHeight + cubbySpacing));

            // Transform and store edge lines (magenta in preview)
            if (cubby.edgeLines && cubby.edgeLines.length > 0) {
                const transformedEdgeLines = this.transformPerimeterToPhysical(cubby.edgeLines, bounds, cubbyStartX, cubbyStartY);
                this.cubbyOutlines.push({
                    cubbyId: cubby.id,
                    lines: transformedEdgeLines
                });
            }

            // Transform and store interior lines (green in preview)  
            if (cubby.interiorLines && cubby.interiorLines.length > 0) {
                const transformedInteriorLines = this.transformPerimeterToPhysical(cubby.interiorLines, bounds, cubbyStartX, cubbyStartY);
                this.cubbyInteriors.push({
                    cubbyId: cubby.id,
                    lines: transformedInteriorLines
                });
            }

            // Transform and store labels (blue in preview) - use grid coordinates like CubbyRenderer
            if (cubby.cells.length > 0) {
                const centerCell = cubby.cells[0];
                const labelX = cubbyStartX + (centerCell.x + 0.5 - bounds.minX);
                const labelY = cubbyStartY + (centerCell.y + 0.5 - bounds.minY);
                this.cubbyLabels.push({
                    cubbyId: cubby.id,
                    x: labelX,
                    y: labelY,
                    text: `${cubby.id}`
                });
            }
        }
    }

    transformPerimeterToPhysical(perimeter, bounds, offsetX, offsetY) {
        // Transform cubby perimeter to physical coordinates - no coordinate system conversion here
        // CubbyRenderer already handles coordinate system conversion in gridToCanvas()
        const transformedLines = [];

        for (const segment of perimeter) {
            if (segment.type === 'bezier') {
                // Transform bezier curve coordinates to layout space
                transformedLines.push({
                    type: 'bezier',
                    x1: offsetX + (segment.x1 - bounds.minX),
                    y1: offsetY + (segment.y1 - bounds.minY),
                    cp1x: offsetX + (segment.cp1x - bounds.minX),
                    cp1y: offsetY + (segment.cp1y - bounds.minY),
                    cp2x: offsetX + (segment.cp2x - bounds.minX),
                    cp2y: offsetY + (segment.cp2y - bounds.minY),
                    x2: offsetX + (segment.x2 - bounds.minX),
                    y2: offsetY + (segment.y2 - bounds.minY),
                });
            } else {
                // Transform regular line segment coordinates to layout space
                transformedLines.push({
                    type: 'line',
                    x1: offsetX + (segment.x1 - bounds.minX),
                    y1: offsetY + (segment.y1 - bounds.minY),
                    x2: offsetX + (segment.x2 - bounds.minX),
                    y2: offsetY + (segment.y2 - bounds.minY),
                });
            }
        }

        return transformedLines;
    }

    validatePrintBedDimensions() {
        // Check if cubbies fit within print bed dimensions
        const warnings = [];

        for (const cubby of this.cubbies) {
            const bounds = Cubby.getCubbyBounds(cubby);

            // Convert to physical dimensions (inches)
            const physicalWidth = bounds.width;
            const physicalHeight = bounds.height;

            if (physicalWidth > this.printBedWidth) {
                warnings.push({
                    type: 'width',
                    cubbyId: cubby.id,
                    required: physicalWidth,
                    available: this.printBedWidth,
                    message: `Cubby ${cubby.id} width (${physicalWidth.toFixed(2)}") exceeds print bed width (${this.printBedWidth}")`
                });
            }

            if (physicalHeight > this.printBedHeight) {
                warnings.push({
                    type: 'height',
                    cubbyId: cubby.id,
                    required: physicalHeight,
                    available: this.printBedHeight,
                    message: `Cubby ${cubby.id} height (${physicalHeight.toFixed(2)}") exceeds print bed height (${this.printBedHeight}")`
                });
            }
        }

        if (warnings.length > 0) {
            console.warn('[CubbyExporter] Print bed dimension warnings:', warnings);

            // Emit warning event if appEvents is available
            if (typeof appEvents !== 'undefined') {
                appEvents.emit('printBedWarnings', { warnings });
            }
        }

        return warnings;
    }


    previewLayout() {
        // Prepare layout data if not already done (like BoardExporter pattern)
        if (this.cubbyOutlines.length === 0 || this.cubbyInteriors.length === 0 || this.cubbyLabels.length === 0) {
            this.prepLayout();
        }

        clear();
        background(255);

        if (this.cubbies.length === 0) {
            fill('red');
            textAlign(CENTER, CENTER);
            text('No cubbies detected', width / 2, height / 2);
            return;
        }

        // Calculate scaling factor to fit preview in canvas (like BoardExporter)
        const scaleX = canvasWidth / this.layoutWidth;
        const scaleY = canvasHeight / this.layoutHeight;
        const scaleValue = min(scaleX, scaleY) * 0.9; // 90% of available space for margins

        // Set up the drawing environment (like BoardExporter)
        push();
        translate(canvasWidth / 2, canvasHeight / 2);
        scale(scaleValue);
        translate(-this.layoutWidth / 2, -this.layoutHeight / 2);
        // Draw edge lines (magenta) from prepared data
        stroke('magenta');
        strokeWeight(2 / scaleValue);
        noFill();
        for (const outlineData of this.cubbyOutlines) {
            this.renderPreparedPerimeter(outlineData.lines);
        }

        // Draw interior lines (green) from prepared data  
        stroke('#00CC66');
        strokeWeight(2 / scaleValue);
        for (const interiorData of this.cubbyInteriors) {
            this.renderPreparedPerimeter(interiorData.lines);
        }

        // Draw labels (blue) from prepared data
        fill('blue');
        noStroke();
        textAlign(CENTER, CENTER);
        textSize(12 / scaleValue);
        for (const labelData of this.cubbyLabels) {
            text(labelData.text, labelData.x, this.layoutHeight - labelData.y);
        }

        // Draw print bed validation visual indicators (red overlay for oversized cubbies)
        if (this.printBedWarnings && this.printBedWarnings.length > 0) {
            fill(255, 0, 0, 80); // Transparent red overlay
            noStroke();

            // Get list of cubby IDs that have warnings
            const oversizedCubbyIds = new Set(this.printBedWarnings.map(warning => warning.cubbyId));

            // Draw red overlay on oversized cubbies
            for (const outlineData of this.cubbyOutlines) {
                if (oversizedCubbyIds.has(outlineData.cubbyId)) {
                    // Draw filled polygon over the cubby outline
                    beginShape();
                    for (const lineData of outlineData.lines) {
                        if (lineData.type === 'bezier') {
                            // For bezier curves, use the endpoints (simplified)
                            vertex(lineData.x1, this.layoutHeight - lineData.y1);
                            vertex(lineData.x2, this.layoutHeight - lineData.y2);
                        } else {
                            vertex(lineData.x1, this.layoutHeight - lineData.y1);
                            vertex(lineData.x2, this.layoutHeight - lineData.y2);
                        }
                    }
                    endShape(CLOSE);
                }
            }
        }

        pop(); // Restore original rendering state
    }


    renderPreparedPerimeter(lines) {
        // Render prepared perimeter lines (convert from grid coordinates to display coordinates)
        for (const lineData of lines) {
            if (lineData.type === 'bezier') {
                // Render bezier curve with Y-flip for display
                const y1 = this.layoutHeight - lineData.y1;
                const y2 = this.layoutHeight - lineData.y2;
                const cp1y = this.layoutHeight - lineData.cp1y;
                const cp2y = this.layoutHeight - lineData.cp2y;
                bezier(lineData.x1, y1, lineData.cp1x, cp1y, lineData.cp2x, cp2y, lineData.x2, y2);
            } else {
                // Render regular line segment with Y-flip for display
                const y1 = this.layoutHeight - lineData.y1;
                const y2 = this.layoutHeight - lineData.y2;
                line(lineData.x1, y1, lineData.x2, y2);
            }
        }
    }

    previewCase() {
        // For cubbies, case view is the same as layout view
        this.previewLayout();
    }

    generateDXF() {
        // Prepare layout data if not already done (like BoardExporter pattern)
        if (this.cubbyOutlines.length === 0 || this.cubbyInteriors.length === 0 || this.cubbyLabels.length === 0) {
            this.prepLayout();
        }

        // Generate DXF for 3D printer cubbies following BoardExporter pattern
        const dxf = new DXFWriter();
        dxf.setUnits('Inches');

        // Create layers based on material configuration
        for (const layerDef of this.materialConfig.dxfLayers || []) {
            const colorConstant = DXFWriter.ACI[layerDef.color] || DXFWriter.ACI.WHITE;
            dxf.addLayer(layerDef.name, colorConstant, 'CONTINUOUS');
        }

        // Add default layers if material config doesn't define them
        if (!this.materialConfig.dxfLayers) {
            dxf.addLayer('Edge Lines', DXFWriter.ACI.MAGENTA, 'CONTINUOUS');
            dxf.addLayer('Interior Lines', DXFWriter.ACI.GREEN, 'CONTINUOUS');
            dxf.addLayer('Labels', DXFWriter.ACI.BLUE, 'CONTINUOUS');
        }

        // Add elements to appropriate layers from prepared data (like BoardExporter)
        this.populateEdgeLayer(dxf);
        this.populateInteriorLayer(dxf);
        this.populateLabelLayer(dxf);

        return dxf.toDxfString();
    }

    populateEdgeLayer(dxf) {
        // Export edge lines from prepared data (like BoardExporter pattern)
        const edgeLayer = this.materialConfig.dxfLayers.find(layer => layer.content === 'edges');
        if (edgeLayer) {
            dxf.setActiveLayer(edgeLayer.name);
            for (const outlineData of this.cubbyOutlines) {
                this.exportPreparedPerimeterToDXF(dxf, outlineData.lines);
            }
        }
    }

    populateInteriorLayer(dxf) {
        // Export interior lines from prepared data (like BoardExporter pattern)
        const interiorLayer = this.materialConfig.dxfLayers.find(layer => layer.content === 'interior');
        if (interiorLayer) {
            dxf.setActiveLayer(interiorLayer.name);
            for (const interiorData of this.cubbyInteriors) {
                this.exportPreparedPerimeterToDXF(dxf, interiorData.lines);
            }
        }
    }

    populateLabelLayer(dxf) {
        // Export labels from prepared data (coordinates already in DXF-compatible format)
        const labelLayer = this.materialConfig.dxfLayers.find(layer => layer.content === 'labels');
        if (labelLayer) {
            dxf.setActiveLayer(labelLayer.name);
            for (const labelData of this.cubbyLabels) {
                dxf.drawText(labelData.x, labelData.y, this.fontSize, 0, labelData.text);
            }
        }
    }

    exportPreparedPerimeterToDXF(dxf, lines) {
        // Export prepared perimeter lines to DXF (coordinates already in DXF-compatible format)
        const points = [];

        for (const line of lines) {
            if (line.type === 'bezier') {
                // For bezier curves, approximate with line segments for DXF
                const curvePoints = this.approximateBezierCurve(
                    line.x1, line.y1,
                    line.cp1x, line.cp1y,
                    line.cp2x, line.cp2y,
                    line.x2, line.y2,
                    10 // number of approximation segments
                );
                points.push(...curvePoints);
            } else {
                // Regular line segment (no coordinate conversion needed)
                points.push([line.x1, line.y1]);
                points.push([line.x2, line.y2]);
            }
        }

        // Remove duplicate consecutive points
        const uniquePoints = [];
        for (let i = 0; i < points.length; i++) {
            if (i === 0 ||
                Math.abs(points[i][0] - points[i - 1][0]) > 0.001 ||
                Math.abs(points[i][1] - points[i - 1][1]) > 0.001) {
                uniquePoints.push(points[i]);
            }
        }

        // Draw as connected line segments
        for (let i = 0; i < uniquePoints.length - 1; i++) {
            const [x1, y1] = uniquePoints[i];
            const [x2, y2] = uniquePoints[i + 1];
            dxf.drawLine(x1, y1, x2, y2);
        }

        // Close the shape if needed
        if (uniquePoints.length > 2) {
            const first = uniquePoints[0];
            const last = uniquePoints[uniquePoints.length - 1];
            if (Math.abs(first[0] - last[0]) > 0.001 || Math.abs(first[1] - last[1]) > 0.001) {
                dxf.drawLine(last[0], last[1], first[0], first[1]);
            }
        }
    }


    exportCubbyToPolyline(dxf, perimeter) {
        // Export cubby perimeter as a polyline with bezier curves
        if (perimeter.length === 0) return;

        // Start polyline
        const points = [];

        for (const segment of perimeter) {
            if (segment.type === 'bezier') {
                // For bezier curves, we need to approximate with line segments
                // since DXF doesn't directly support bezier curves in polylines
                const curvePoints = this.approximateBezierCurve(
                    segment.x1, segment.y1,
                    segment.cp1x, segment.cp1y,
                    segment.cp2x, segment.cp2y,
                    segment.x2, segment.y2,
                    10 // number of approximation segments
                );
                points.push(...curvePoints);
            } else {
                // Regular line segment
                points.push([segment.x1, segment.y1]);
                points.push([segment.x2, segment.y2]);
            }
        }

        // Remove duplicate consecutive points
        const uniquePoints = [];
        for (let i = 0; i < points.length; i++) {
            if (i === 0 ||
                Math.abs(points[i][0] - points[i - 1][0]) > 0.001 ||
                Math.abs(points[i][1] - points[i - 1][1]) > 0.001) {
                uniquePoints.push(points[i]);
            }
        }

        // Draw as connected line segments
        for (let i = 0; i < uniquePoints.length - 1; i++) {
            const [x1, y1] = uniquePoints[i];
            const [x2, y2] = uniquePoints[i + 1];
            dxf.drawLine(x1, y1, x2, y2);
        }

        // Close the shape if needed
        if (uniquePoints.length > 2) {
            const first = uniquePoints[0];
            const last = uniquePoints[uniquePoints.length - 1];
            if (Math.abs(first[0] - last[0]) > 0.001 || Math.abs(first[1] - last[1]) > 0.001) {
                dxf.drawLine(last[0], last[1], first[0], first[1]);
            }
        }
    }

    approximateBezierCurve(x1, y1, cx1, cy1, cx2, cy2, x2, y2, segments) {
        // Approximate a bezier curve with line segments
        const points = [];

        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const nt = 1 - t;

            // Cubic bezier formula
            const x = nt * nt * nt * x1 +
                3 * nt * nt * t * cx1 +
                3 * nt * t * t * cx2 +
                t * t * t * x2;

            const y = nt * nt * nt * y1 +
                3 * nt * nt * t * cy1 +
                3 * nt * t * t * cy2 +
                t * t * t * y2;

            points.push([x, y]);
        }

        return points;
    }


    renderCubbyPerimeter(perimeter, bounds, offsetX, offsetY, scale) {
        // Render cubby perimeter with Y-flip to match CubbyRenderer coordinate system
        for (const segment of perimeter) {
            if (segment.type === 'bezier') {
                // Render bezier curve for rounded corners - flip Y coordinates
                const x1 = offsetX + (segment.x1 - bounds.minX) * scale;
                const y1 = offsetY + (bounds.maxY - segment.y1) * scale;  // Y-flip
                const cp1x = offsetX + (segment.cp1x - bounds.minX) * scale;
                const cp1y = offsetY + (bounds.maxY - segment.cp1y) * scale;  // Y-flip
                const cp2x = offsetX + (segment.cp2x - bounds.minX) * scale;
                const cp2y = offsetY + (bounds.maxY - segment.cp2y) * scale;  // Y-flip
                const x2 = offsetX + (segment.x2 - bounds.minX) * scale;
                const y2 = offsetY + (bounds.maxY - segment.y2) * scale;  // Y-flip

                bezier(x1, y1, cp1x, cp1y, cp2x, cp2y, x2, y2);
            } else {
                // Render regular line segment - flip Y coordinates
                const x1 = offsetX + (segment.x1 - bounds.minX) * scale;
                const y1 = offsetY + (bounds.maxY - segment.y1) * scale;  // Y-flip
                const x2 = offsetX + (segment.x2 - bounds.minX) * scale;
                const y2 = offsetY + (bounds.maxY - segment.y2) * scale;  // Y-flip

                line(x1, y1, x2, y2);
            }
        }
    }

}

// Only export the class when in a Node.js environment (e.g., during Jest tests)
// Ignored when the app is running in the browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CubbyExporter;
}