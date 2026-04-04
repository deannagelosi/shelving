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

        // Min wall length for unit conversion (1 grid unit = minWallLength inches)
        this.minWallLength = config.minWallLength || 1.0;

        // 3D printing specific configuration
        this.cubbyCurveRadius = (typeof config.cubbyCurveRadius === 'number') ? config.cubbyCurveRadius : 0.5;
        this.wallThickness = config.wallThickness || 0.25;
        this.shrinkFactor = config.shrinkFactor || 0;
        this.printBedWidth = config.printBedWidth || 12;
        this.printBedHeight = config.printBedHeight || 12;



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
                // Create a Cubby instance (Cubby works in grid units, so convert from inches)
                const wallThicknessGrid = MathUtils.inchesToGridUnits(this.wallThickness, this.minWallLength);
                const cubbyCurveRadiusGrid = MathUtils.inchesToGridUnits(this.cubbyCurveRadius, this.minWallLength);

                const cubby = new Cubby(
                    cubbyData.shape_id,
                    cubbyData.visitedCells,
                    wallThicknessGrid,
                    cubbyCurveRadiusGrid
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

        // STEP 1: Calculate layout dimensions in inches (fabrication units)
        const maxCols = Math.ceil(Math.sqrt(this.cubbies.length));
        const maxRows = Math.ceil(this.cubbies.length / maxCols);
        const gridPadding = 0.5; // inches of padding around grid
        const cubbySpacing = 0.25; // inches between cubbies

        // find maximum cubby dimensions in inches
        let maxCubbyWidth = 0;
        let maxCubbyHeight = 0;
        const cubbyBounds = [];

        for (const cubby of this.cubbies) {
            const bounds = Cubby.getCubbyBounds(cubby); // returns bounds in grid units
            cubbyBounds.push(bounds);

            // convert cubby dimensions from grid units to inches
            const cubbyWidthInches = MathUtils.gridUnitsToInches(bounds.width, this.minWallLength);
            const cubbyHeightInches = MathUtils.gridUnitsToInches(bounds.height, this.minWallLength);

            maxCubbyWidth = Math.max(maxCubbyWidth, cubbyWidthInches);
            maxCubbyHeight = Math.max(maxCubbyHeight, cubbyHeightInches);
        }

        // Calculate total layout dimensions in inches for fabrication
        this.layoutWidth = (maxCols * (maxCubbyWidth + cubbySpacing)) - cubbySpacing + (2 * gridPadding);
        this.layoutHeight = (maxRows * (maxCubbyHeight + cubbySpacing)) - cubbySpacing + (2 * gridPadding);

        // === CONVERSION BOUNDARY: Grid Units -> Inches ===
        // STEP 2: Transform cubbies to layout positions (calculate in inches for fabrication)
        for (let i = 0; i < this.cubbies.length; i++) {
            const cubby = this.cubbies[i];
            const bounds = cubbyBounds[i];

            // calculate layout position in inches (fabrication units)
            const col = i % maxCols;
            const row = Math.floor(i / maxCols);
            const cubbyStartX = gridPadding + (col * (maxCubbyWidth + cubbySpacing));
            const cubbyStartY = gridPadding + (row * (maxCubbyHeight + cubbySpacing));

            // Convert cubby bounds from grid units to inches
            const boundsMinX = MathUtils.gridUnitsToInches(bounds.minX, this.minWallLength);
            const boundsMinY = MathUtils.gridUnitsToInches(bounds.minY, this.minWallLength);

            // Transform and store edge lines (all in inches for DXF)
            if (cubby.edgeLines && cubby.edgeLines.length > 0) {
                const transformedEdgeLines = this.transformPerimeterToInches(cubby.edgeLines, boundsMinX, boundsMinY, cubbyStartX, cubbyStartY);
                this.cubbyOutlines.push({
                    cubbyId: cubby.id,
                    lines: transformedEdgeLines
                });
            }

            // Transform and store interior lines (all in inches for DXF)
            if (cubby.interiorLines && cubby.interiorLines.length > 0) {
                const transformedInteriorLines = this.transformPerimeterToInches(cubby.interiorLines, boundsMinX, boundsMinY, cubbyStartX, cubbyStartY);
                this.cubbyInteriors.push({
                    cubbyId: cubby.id,
                    lines: transformedInteriorLines
                });
            }

            // Transform and store labels (position in inches for DXF)
            if (cubby.cells.length > 0) {
                const centerCell = cubby.cells[0];
                const centerCellX = MathUtils.gridUnitsToInches(centerCell.x + 0.5, this.minWallLength);
                const centerCellY = MathUtils.gridUnitsToInches(centerCell.y + 0.5, this.minWallLength);
                this.cubbyLabels.push({
                    cubbyId: cubby.id,
                    x: cubbyStartX + (centerCellX - boundsMinX),
                    y: cubbyStartY + (centerCellY - boundsMinY),
                    text: `${cubby.id}`
                });
            }
        }
    }

    transformPerimeterToInches(perimeter, boundsMinXIn, boundsMinYIn, offsetXIn, offsetYIn) {
        // Transform cubby perimeter from grid units to inches and apply layout offset
        // perimeter: array of line/bezier segments in grid units
        // boundsMinXIn/boundsMinYIn: cubby bounds minimum coordinates in inches
        // offsetXIn/offsetYIn: layout position offset in inches
        const transformedLines = [];

        for (const segment of perimeter) {
            if (segment.type === 'bezier') {
                // convert all bezier curve coordinates from grid units to inches, then apply offset
                const x1In = MathUtils.gridUnitsToInches(segment.x1, this.minWallLength);
                const y1In = MathUtils.gridUnitsToInches(segment.y1, this.minWallLength);
                const cp1xIn = MathUtils.gridUnitsToInches(segment.cp1x, this.minWallLength);
                const cp1yIn = MathUtils.gridUnitsToInches(segment.cp1y, this.minWallLength);
                const cp2xIn = MathUtils.gridUnitsToInches(segment.cp2x, this.minWallLength);
                const cp2yIn = MathUtils.gridUnitsToInches(segment.cp2y, this.minWallLength);
                const x2In = MathUtils.gridUnitsToInches(segment.x2, this.minWallLength);
                const y2In = MathUtils.gridUnitsToInches(segment.y2, this.minWallLength);

                transformedLines.push({
                    type: 'bezier',
                    x1: offsetXIn + (x1In - boundsMinXIn),
                    y1: offsetYIn + (y1In - boundsMinYIn),
                    cp1x: offsetXIn + (cp1xIn - boundsMinXIn),
                    cp1y: offsetYIn + (cp1yIn - boundsMinYIn),
                    cp2x: offsetXIn + (cp2xIn - boundsMinXIn),
                    cp2y: offsetYIn + (cp2yIn - boundsMinYIn),
                    x2: offsetXIn + (x2In - boundsMinXIn),
                    y2: offsetYIn + (y2In - boundsMinYIn),
                });
            } else {
                // convert regular line segment coordinates from grid units to inches, then apply offset
                const x1In = MathUtils.gridUnitsToInches(segment.x1, this.minWallLength);
                const y1In = MathUtils.gridUnitsToInches(segment.y1, this.minWallLength);
                const x2In = MathUtils.gridUnitsToInches(segment.x2, this.minWallLength);
                const y2In = MathUtils.gridUnitsToInches(segment.y2, this.minWallLength);

                transformedLines.push({
                    type: 'line',
                    x1: offsetXIn + (x1In - boundsMinXIn),
                    y1: offsetYIn + (y1In - boundsMinYIn),
                    x2: offsetXIn + (x2In - boundsMinXIn),
                    y2: offsetYIn + (y2In - boundsMinYIn),
                });
            }
        }

        return transformedLines;
    }

    validatePrintBedDimensions() {
        // check if cubbies fit within print bed dimensions (fabrication in inches)
        const warnings = [];

        for (const cubby of this.cubbies) {
            const bounds = Cubby.getCubbyBounds(cubby); // returns bounds in grid units

            // convert cubby dimensions from grid units to inches for comparison with print bed
            const cubbyWidthInches = MathUtils.gridUnitsToInches(bounds.width, this.minWallLength);
            const cubbyHeightInches = MathUtils.gridUnitsToInches(bounds.height, this.minWallLength);

            if (cubbyWidthInches > this.printBedWidth) {
                warnings.push({
                    type: 'width',
                    cubbyId: cubby.id,
                    required: cubbyWidthInches,
                    available: this.printBedWidth,
                    message: `Cubby ${cubby.id} width (${cubbyWidthInches.toFixed(2)}") exceeds print bed width (${this.printBedWidth}")`
                });
            }

            if (cubbyHeightInches > this.printBedHeight) {
                warnings.push({
                    type: 'height',
                    cubbyId: cubby.id,
                    required: cubbyHeightInches,
                    available: this.printBedHeight,
                    message: `Cubby ${cubby.id} height (${cubbyHeightInches.toFixed(2)}") exceeds print bed height (${this.printBedHeight}")`
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
                        // Use grid units directly with Y-flip for display consistency
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
        // Export labels from prepared data (already in inches, no conversion needed)
        const labelLayer = this.materialConfig.dxfLayers.find(layer => layer.content === 'labels');
        if (labelLayer) {
            dxf.setActiveLayer(labelLayer.name);
            for (const labelData of this.cubbyLabels) {
                // (p5.js uses a a-flipped coordinate system, flip y back for DXF
                const yDXF = this.layoutHeight - labelData.y;
                dxf.drawText(labelData.x, yDXF, this.fontSize, 0, labelData.text);
            }
        }
    }

    exportPreparedPerimeterToDXF(dxf, lines) {
        // export prepared perimeter lines to DXF (already in inches, apply Y-flip for DXF)
        const points = [];

        for (const line of lines) {
            if (line.type === 'bezier') {
                // For bezier curves, approximate with line segments for DXF
                // apply y-flip to all coordinates to unto p5.js y-flip
                const curvePoints = this.approximateBezierCurve(
                    line.x1, this.layoutHeight - line.y1,
                    line.cp1x, this.layoutHeight - line.cp1y,
                    line.cp2x, this.layoutHeight - line.cp2y,
                    line.x2, this.layoutHeight - line.y2,
                    10 // number of approximation segments
                );
                points.push(...curvePoints);
            } else {
                // regular line segment with Y-flip for DXF coordinate system
                points.push([line.x1, this.layoutHeight - line.y1]);
                points.push([line.x2, this.layoutHeight - line.y2]);
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