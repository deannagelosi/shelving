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
            console.error(`Unknown material type: ${config.materialType}. Using clay-plastic-3d as fallback.`);
            this.materialConfig = MATERIAL_CONFIGS['clay-plastic-3d'];
        }

        // 3D printing specific configuration
        this.cubbyCurveRadius = config.cubbyCurveRadius || 0.5;
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

        // Constants
        this.fontSize = 0.10; // inch font size for labels
    }

    detectCubbies() {
        // Use Cellular's proven flood fill algorithm to detect cubbies
        console.log('[CubbyExporter] Detecting cubbies using Cellular.calculateAllCubbyAreas()');
        
        this.cubbies = [];
        
        // Use the Cellular class's calculateAllCubbyAreas method 
        // This contains the proven flood fill algorithm used by the worker for statistics
        const cubbyAreas = this.cellular.calculateAllCubbyAreas();
        
        for (let i = 0; i < cubbyAreas.length; i++) {
            const cubbyData = cubbyAreas[i];
            
            if (cubbyData.visitedCells && cubbyData.visitedCells.length > 0) {
                // Create a Cubby instance with all line data
                const cubby = new Cubby(
                    cubbyData.shape_id,
                    cubbyData.visitedCells,
                    this.wallThickness,
                    this.cubbyCurveRadius
                );
                
                // Generate all three line types
                cubby.generateAllLines();
                
                this.cubbies.push(cubby);
            }
        }

        // Apply shrink factor if needed
        this.applyShrinkFactor();

        // TODO: Re-enable print bed validation later
        // const warnings = this.validatePrintBedDimensions();
        // if (warnings.length > 0) {
        //     this.splitOversizedCubbies();
        // }

        console.log(`[CubbyExporter] Detected ${this.cubbies.length} cubbies`);
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


    validatePrintBedDimensions() {
        // Check if cubbies fit within print bed dimensions
        const warnings = [];
        
        for (const cubby of this.cubbies) {
            const bounds = this.getCubbyBounds(cubby);
            
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

    splitOversizedCubbies() {
        // Split cubbies that exceed print bed dimensions
        const newCubbies = [];
        const oversizedCubbies = [];
        
        for (const cubby of this.cubbies) {
            const bounds = this.getCubbyBounds(cubby);
            
            if (bounds.width > this.printBedWidth || bounds.height > this.printBedHeight) {
                oversizedCubbies.push(cubby);
                // Split this cubby into smaller pieces
                const splitCubbies = this.splitCubby(cubby);
                newCubbies.push(...splitCubbies);
            } else {
                newCubbies.push(cubby);
            }
        }
        
        if (oversizedCubbies.length > 0) {
            console.log(`[CubbyExporter] Split ${oversizedCubbies.length} oversized cubbies into ${newCubbies.length - (this.cubbies.length - oversizedCubbies.length)} pieces`);
            this.cubbies = newCubbies;
        }
        
        return oversizedCubbies;
    }

    splitCubby(cubby) {
        // Split a cubby into smaller pieces that fit within print bed
        const bounds = this.getCubbyBounds(cubby);
        const splitCubbies = [];
        
        // Calculate how many pieces we need in each dimension
        const xSplits = Math.ceil(bounds.width / this.printBedWidth);
        const ySplits = Math.ceil(bounds.height / this.printBedHeight);
        
        const pieceWidth = bounds.width / xSplits;
        const pieceHeight = bounds.height / ySplits;
        
        for (let x = 0; x < xSplits; x++) {
            for (let y = 0; y < ySplits; y++) {
                const pieceMinX = bounds.minX + (x * pieceWidth);
                const pieceMaxX = bounds.minX + ((x + 1) * pieceWidth);
                const pieceMinY = bounds.minY + (y * pieceHeight);
                const pieceMaxY = bounds.minY + ((y + 1) * pieceHeight);
                
                // Filter cells that fall within this piece
                const pieceCells = cubby.cells.filter(cell => {
                    const cellX = cell.x * this.squareSize;
                    const cellY = cell.y * this.squareSize;
                    return cellX >= pieceMinX && cellX < pieceMaxX && 
                           cellY >= pieceMinY && cellY < pieceMaxY;
                });
                
                if (pieceCells.length > 0) {
                    const pieceCubby = {
                        id: `${cubby.id}-${x}-${y}`,
                        shapeId: cubby.shapeId,
                        cells: pieceCells,
                        area: pieceCells.length,
                        perimeter: this.extractPerimeterFromCells(pieceCells),
                        corners: [],
                        isPiece: true,
                        originalId: cubby.id
                    };
                    
                    pieceCubby.corners = this.detectCorners(pieceCubby.perimeter);
                    splitCubbies.push(pieceCubby);
                }
            }
        }
        
        return splitCubbies;
    }

    previewLayout() {
        clear();
        background(255);
        
        console.log(`[CubbyExporter] Drawing ${this.cubbies.length} cubbies`);
        
        // Use push/pop to isolate rendering state changes
        push();
        
        if (this.cubbies.length === 0) {
            fill('red');
            textAlign(CENTER, CENTER);
            text('No cubbies detected', width / 2, height / 2);
            pop();
            return;
        }
        
        // Simple grid layout for individual cubbies
        const maxCols = Math.ceil(Math.sqrt(this.cubbies.length));
        const padding = 50;
        const cubbySpacing = 100; // Space between cubbies
        
        // Draw each cubby as perimeter walls instead of cells
        const colors = ['red', 'blue', 'green', 'orange', 'purple', 'brown', 'pink', 'gray'];
        
        for (let i = 0; i < this.cubbies.length; i++) {
            const cubby = this.cubbies[i];
            const color = colors[i % colors.length];
            
            // Calculate position in grid layout
            const col = i % maxCols;
            const row = Math.floor(i / maxCols);
            const offsetX = padding + (col * cubbySpacing);
            const offsetY = padding + (row * cubbySpacing);
            
            // Get cubby bounds for scaling
            const bounds = this.getCubbyBounds(cubby);
            const scale = Math.min(80 / bounds.width, 80 / bounds.height); // Fit in 80px square
            
            // Draw perimeter walls instead of cells
            stroke(color);
            strokeWeight(2);
            noFill();
            
            // Render all three line types for the cubby (all 1px with distinct colors)
            // Exterior lines
            stroke('#FF8C00');  // Bright Orange
            strokeWeight(1);
            if (cubby.exteriorLines && cubby.exteriorLines.length > 0) {
                this.renderCubbyPerimeter(cubby.exteriorLines, bounds, offsetX, offsetY, scale);
            }
            
            // Center lines
            stroke('#333333');  // Dark Gray
            strokeWeight(1);
            if (cubby.centerLines && cubby.centerLines.length > 0) {
                this.renderCubbyPerimeter(cubby.centerLines, bounds, offsetX, offsetY, scale);
            }
            
            // Interior lines
            stroke('#00CC66');  // Bright Green
            strokeWeight(1);
            if (cubby.interiorLines && cubby.interiorLines.length > 0) {
                this.renderCubbyPerimeter(cubby.interiorLines, bounds, offsetX, offsetY, scale);
            } else {
                // Fallback: draw simple bounding box if no perimeter data
                const rectX = offsetX;
                const rectY = offsetY;
                const rectW = bounds.width * scale;
                const rectH = bounds.height * scale;
                rect(rectX, rectY, rectW, rectH);
            }
            
            // Label cubby
            fill(color);
            noStroke();
            textAlign(CENTER, CENTER);
            textSize(12);
            const labelX = offsetX + (bounds.width * scale) / 2;
            const labelY = offsetY + (bounds.height * scale) / 2;
            text(`${cubby.id}`, labelX, labelY);
        }
        
        // Show summary
        fill('black');
        textAlign(LEFT, TOP);
        textSize(14);
        text(`Detected ${this.cubbies.length} cubbies`, 10, 10);
        
        pop(); // Restore original rendering state
    }

    previewCase() {
        // For cubbies, case view is the same as layout view
        this.previewLayout();
    }

    generateDXF() {
        // Generate DXF for 3D printer cubbies with soft corners
        const dxf = new DXFWriter();
        dxf.setUnits('Inches');

        // Create layers based on material configuration
        for (const layerDef of this.materialConfig.dxfLayers || []) {
            const colorConstant = DXFWriter.ACI[layerDef.color] || DXFWriter.ACI.WHITE;
            dxf.addLayer(layerDef.name, colorConstant, 'CONTINUOUS');
        }

        // Add default layers if material config doesn't define them
        if (!this.materialConfig.dxfLayers) {
            dxf.addLayer('Cubby Outlines', DXFWriter.ACI.RED, 'CONTINUOUS');
            dxf.addLayer('Labels', DXFWriter.ACI.BLUE, 'CONTINUOUS');
        }

        // Export each cubby with soft corners if available
        const outlineLayerName = this.materialConfig.dxfLayers ? 
            this.materialConfig.dxfLayers.find(l => l.content === 'cuts')?.name || 'Cubby Outlines' : 
            'Cubby Outlines';
            
        dxf.setActiveLayer(outlineLayerName);
        
        for (const cubby of this.cubbies) {
            const perimeterToExport = cubby.softPerimeter || cubby.perimeter;
            
            if (perimeterToExport.length > 0) {
                // Export as polyline with curves
                this.exportCubbyToPolyline(dxf, perimeterToExport);
            }
        }

        // Add labels
        const labelLayerName = this.materialConfig.dxfLayers ? 
            this.materialConfig.dxfLayers.find(l => l.content === 'etches')?.name || 'Labels' : 
            'Labels';
            
        dxf.setActiveLayer(labelLayerName);
        for (const cubby of this.cubbies) {
            if (cubby.cells.length > 0) {
                const centerCell = cubby.cells[0];
                const centerX = centerCell.x * this.squareSize + this.squareSize/2;
                const centerY = centerCell.y * this.squareSize + this.squareSize/2;
                dxf.drawText(centerX, centerY, this.fontSize, 0, `Cubby-${cubby.id}`);
            }
        }

        return dxf.toDxfString();
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
                Math.abs(points[i][0] - points[i-1][0]) > 0.001 || 
                Math.abs(points[i][1] - points[i-1][1]) > 0.001) {
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

    getCubbyBounds(cubby) {
        // Calculate bounding box for a cubby in grid units
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;
        
        for (const cell of cubby.cells) {
            minX = Math.min(minX, cell.x);
            minY = Math.min(minY, cell.y);
            maxX = Math.max(maxX, cell.x + 1);
            maxY = Math.max(maxY, cell.y + 1);
        }
        
        return {
            minX, minY, maxX, maxY,
            width: maxX - minX,
            height: maxY - minY
        };
    }
}

// Only export the class when in a Node.js environment (e.g., during Jest tests)
// Ignored when the app is running in the browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CubbyExporter;
}