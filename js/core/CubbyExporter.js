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
        
        // Calculate unified grid layout and scaling
        const maxCols = Math.ceil(Math.sqrt(this.cubbies.length));
        const maxRows = Math.ceil(this.cubbies.length / maxCols);
        const padding = 50;
        
        // Find the maximum dimensions across all cubbies
        let maxCubbyWidth = 0;
        let maxCubbyHeight = 0;
        const cubbyBounds = [];
        
        for (const cubby of this.cubbies) {
            const bounds = Cubby.getCubbyBounds(cubby);
            cubbyBounds.push(bounds);
            maxCubbyWidth = Math.max(maxCubbyWidth, bounds.width);
            maxCubbyHeight = Math.max(maxCubbyHeight, bounds.height);
        }
        
        // Calculate unified scale to fit all cubbies in canvas with padding
        const availableWidth = width - (padding * 2);
        const availableHeight = height - (padding * 2);
        const totalGridWidth = maxCols * maxCubbyWidth;
        const totalGridHeight = maxRows * maxCubbyHeight;
        const scale = Math.min(availableWidth / totalGridWidth, availableHeight / totalGridHeight);
        
        // Calculate spacing between cubbies
        const cubbySpacing = Math.max(maxCubbyWidth, maxCubbyHeight) * scale + 20;
        
        const colors = ['red', 'blue', 'green', 'orange', 'purple', 'brown', 'pink', 'gray'];
        
        for (let i = 0; i < this.cubbies.length; i++) {
            const cubby = this.cubbies[i];
            const color = colors[i % colors.length];
            const bounds = cubbyBounds[i];
            
            // Calculate position in unified grid layout
            const col = i % maxCols;
            const row = Math.floor(i / maxCols);
            const offsetX = padding + (col * cubbySpacing);
            const offsetY = padding + (row * cubbySpacing);
            
            // Draw perimeter walls instead of cells
            stroke(color);
            strokeWeight(2);
            noFill();
            
            // Export preview: only edge lines and interior lines (clean view)
            stroke('magenta');
            strokeWeight(2);
            drawingContext.setLineDash([]);
            if (cubby.edgeLines && cubby.edgeLines.length > 0) {
                this.renderCubbyPerimeter(cubby.edgeLines, bounds, offsetX, offsetY, scale);
            }
            
            stroke('#00CC66');
            strokeWeight(2);
            drawingContext.setLineDash([]);
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
            
            // Reset to solid lines
            drawingContext.setLineDash([]);
            
            // Visual indicator for cubbies that exceed print bed dimensions
            if (bounds.width > this.printBedWidth || bounds.height > this.printBedHeight) {
                fill('rgba(255, 0, 0, 0.3)'); // Transparent red
                noStroke();
                rect(offsetX, offsetY, bounds.width * scale, bounds.height * scale);
            }
            
            // Label cubby - find top-left most cell for consistent placement
            const topLeftCell = cubby.cells.reduce((topLeft, cell) => {
                if (cell.y < topLeft.y || (cell.y === topLeft.y && cell.x < topLeft.x)) {
                    return cell;
                }
                return topLeft;
            });
            
            // Place label at center of that cell
            const labelX = offsetX + ((topLeftCell.x + 0.5) - bounds.minX) * scale;
            const labelY = offsetY + (bounds.maxY - (topLeftCell.y + 0.5)) * scale;
            
            fill(color);
            noStroke();
            textAlign(CENTER, CENTER);
            textSize(12);
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

}

// Only export the class when in a Node.js environment (e.g., during Jest tests)
// Ignored when the app is running in the browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CubbyExporter;
}