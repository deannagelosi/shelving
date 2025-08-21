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
        this.cornerRadius = config.cornerRadius || 0.5;
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
                const cubby = {
                    id: cubbyData.shape_id,
                    shapeId: cubbyData.shape_id,
                    cells: cubbyData.visitedCells,
                    area: cubbyData.cubbyArea,
                    perimeter: [],
                    corners: []
                };

                // Generate perimeter and corners for 3D printing
                cubby.perimeter = this.extractPerimeterFromCells(cubby.cells);
                cubby.corners = this.detectCorners(cubby.perimeter);

                this.cubbies.push(cubby);
            }
        }

        // Apply shrink factor if needed
        this.applyShrinkFactor();

        // Apply corner softening
        this.applySoftCorners();

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

    extractPerimeterFromCells(cells) {
        // Convert cubby cells to perimeter line segments
        const edges = new Set();
        
        // For each cell, add its edges if they're on the perimeter
        for (const cell of cells) {
            const { x, y } = cell;
            
            // Check each edge of the cell
            const neighbors = [
                { x: x + 1, y: y, edge: `v-${x + 1}-${y}` }, // Right edge
                { x: x - 1, y: y, edge: `v-${x}-${y}` },     // Left edge  
                { x: x, y: y + 1, edge: `h-${x}-${y + 1}` }, // Top edge
                { x: x, y: y - 1, edge: `h-${x}-${y}` }      // Bottom edge
            ];
            
            for (const neighbor of neighbors) {
                const neighborInCubby = cells.some(c => c.x === neighbor.x && c.y === neighbor.y);
                if (!neighborInCubby) {
                    // This edge is on the perimeter
                    edges.add(neighbor.edge);
                }
            }
        }
        
        return this.convertEdgesToLineSegments(edges);
    }

    convertEdgesToLineSegments(edges) {
        // Convert edge set to line segments
        const segments = [];
        
        for (const edge of edges) {
            const [type, x, y] = edge.split('-');
            const xNum = parseInt(x);
            const yNum = parseInt(y);
            
            if (type === 'h') {
                // Horizontal edge
                segments.push({
                    type: 'horizontal',
                    x1: xNum, y1: yNum,
                    x2: xNum + 1, y2: yNum
                });
            } else {
                // Vertical edge
                segments.push({
                    type: 'vertical',
                    x1: xNum, y1: yNum,
                    x2: xNum, y2: yNum + 1
                });
            }
        }
        
        return segments;
    }

    detectCorners(perimeter) {
        // Find corners where line segments meet at angles
        const corners = [];
        
        for (let i = 0; i < perimeter.length; i++) {
            const current = perimeter[i];
            
            // Find segments that share an endpoint with current segment
            for (let j = i + 1; j < perimeter.length; j++) {
                const other = perimeter[j];
                
                // Check if segments share an endpoint
                const sharedPoint = this.findSharedPoint(current, other);
                if (sharedPoint && current.type !== other.type) {
                    corners.push({
                        x: sharedPoint.x,
                        y: sharedPoint.y,
                        segments: [current, other],
                        angle: 90 // Assume 90-degree corners for now
                    });
                }
            }
        }
        
        return corners;
    }

    findSharedPoint(seg1, seg2) {
        // Find if two segments share an endpoint
        if (seg1.x1 === seg2.x1 && seg1.y1 === seg2.y1) return { x: seg1.x1, y: seg1.y1 };
        if (seg1.x1 === seg2.x2 && seg1.y1 === seg2.y2) return { x: seg1.x1, y: seg1.y1 };
        if (seg1.x2 === seg2.x1 && seg1.y2 === seg2.y1) return { x: seg1.x2, y: seg1.y2 };
        if (seg1.x2 === seg2.x2 && seg1.y2 === seg2.y2) return { x: seg1.x2, y: seg1.y2 };
        return null;
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

    applySoftCorners() {
        // Apply corner softening using bezier curves
        if (this.cornerRadius === 0) return;
        
        for (let cubby of this.cubbies) {
            cubby.softPerimeter = this.createSoftPerimeter(cubby.perimeter, this.cornerRadius);
        }
    }

    createSoftPerimeter(perimeter, radius) {
        if (perimeter.length === 0 || radius === 0) {
            return perimeter;
        }
        
        // Create a smoothed perimeter using bezier curves at corners
        const softSegments = [];
        
        // First, organize perimeter segments into a continuous path
        const orderedSegments = this.orderPerimeterSegments(perimeter);
        
        for (let i = 0; i < orderedSegments.length; i++) {
            const current = orderedSegments[i];
            const next = orderedSegments[(i + 1) % orderedSegments.length];
            
            // Find the connection point between current and next segment
            const connectionPoint = this.findConnectionPoint(current, next);
            
            if (connectionPoint && this.isRightAngleCorner(current, next)) {
                // Apply corner rounding
                const roundedCorner = this.createRoundedCorner(current, next, connectionPoint, radius);
                softSegments.push(...roundedCorner);
            } else {
                // Keep original segment
                softSegments.push({
                    type: 'line',
                    x1: current.x1, y1: current.y1,
                    x2: current.x2, y2: current.y2
                });
            }
        }
        
        return softSegments;
    }

    orderPerimeterSegments(segments) {
        // Order perimeter segments to form a continuous path
        if (segments.length === 0) return [];
        
        const ordered = [segments[0]];
        const remaining = [...segments.slice(1)];
        
        while (remaining.length > 0) {
            const last = ordered[ordered.length - 1];
            const lastPoint = { x: last.x2, y: last.y2 };
            
            // Find next segment that connects to the last point
            let nextIndex = -1;
            for (let i = 0; i < remaining.length; i++) {
                const seg = remaining[i];
                if ((seg.x1 === lastPoint.x && seg.y1 === lastPoint.y) ||
                    (seg.x2 === lastPoint.x && seg.y2 === lastPoint.y)) {
                    nextIndex = i;
                    break;
                }
            }
            
            if (nextIndex >= 0) {
                let nextSegment = remaining.splice(nextIndex, 1)[0];
                
                // Flip segment if needed to maintain direction
                if (nextSegment.x2 === lastPoint.x && nextSegment.y2 === lastPoint.y) {
                    const temp = { x: nextSegment.x1, y: nextSegment.y1 };
                    nextSegment.x1 = nextSegment.x2;
                    nextSegment.y1 = nextSegment.y2;
                    nextSegment.x2 = temp.x;
                    nextSegment.y2 = temp.y;
                }
                
                ordered.push(nextSegment);
            } else {
                // Can't connect remaining segments, add them as-is
                ordered.push(...remaining);
                break;
            }
        }
        
        return ordered;
    }

    findConnectionPoint(seg1, seg2) {
        // Find where two segments connect
        if (seg1.x2 === seg2.x1 && seg1.y2 === seg2.y1) {
            return { x: seg1.x2, y: seg1.y2 };
        }
        if (seg1.x1 === seg2.x2 && seg1.y1 === seg2.y2) {
            return { x: seg1.x1, y: seg1.y1 };
        }
        // Check other combinations
        if (seg1.x1 === seg2.x1 && seg1.y1 === seg2.y1) {
            return { x: seg1.x1, y: seg1.y1 };
        }
        if (seg1.x2 === seg2.x2 && seg1.y2 === seg2.y2) {
            return { x: seg1.x2, y: seg1.y2 };
        }
        return null;
    }

    isRightAngleCorner(seg1, seg2) {
        // Check if two segments form a right angle (90 degrees)
        const dx1 = seg1.x2 - seg1.x1;
        const dy1 = seg1.y2 - seg1.y1;
        const dx2 = seg2.x2 - seg2.x1;
        const dy2 = seg2.y2 - seg2.y1;
        
        // Vectors are perpendicular if dot product is 0
        const dotProduct = dx1 * dx2 + dy1 * dy2;
        return Math.abs(dotProduct) < 0.001; // Account for floating point precision
    }

    createRoundedCorner(seg1, seg2, corner, radius) {
        // Create bezier curve to round a corner
        const radiusInGrid = radius; // radius in grid units
        
        // Calculate direction vectors
        const dir1 = this.normalizeVector({
            x: seg1.x2 - seg1.x1,
            y: seg1.y2 - seg1.y1
        });
        const dir2 = this.normalizeVector({
            x: seg2.x2 - seg2.x1,
            y: seg2.y2 - seg2.y1
        });
        
        // Calculate start and end points of the curve
        const curveStart = {
            x: corner.x - dir1.x * radiusInGrid,
            y: corner.y - dir1.y * radiusInGrid
        };
        const curveEnd = {
            x: corner.x + dir2.x * radiusInGrid,
            y: corner.y + dir2.y * radiusInGrid
        };
        
        return [
            // Line from seg1 start to curve start
            {
                type: 'line',
                x1: seg1.x1, y1: seg1.y1,
                x2: curveStart.x, y2: curveStart.y
            },
            // Bezier curve at corner
            {
                type: 'bezier',
                x1: curveStart.x, y1: curveStart.y,
                cp1x: corner.x, cp1y: corner.y,
                cp2x: corner.x, cp2y: corner.y,
                x2: curveEnd.x, y2: curveEnd.y
            },
            // Line from curve end to seg2 end
            {
                type: 'line',
                x1: curveEnd.x, y1: curveEnd.y,
                x2: seg2.x2, y2: seg2.y2
            }
        ];
    }

    normalizeVector(vector) {
        const length = Math.sqrt(vector.x * vector.x + vector.y * vector.y);
        if (length === 0) return { x: 0, y: 0 };
        return {
            x: vector.x / length,
            y: vector.y / length
        };
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
        
        if (this.cubbies.length === 0) {
            fill('red');
            textAlign(CENTER, CENTER);
            text('No cubbies detected', width / 2, height / 2);
            return;
        }
        
        // Simple grid layout for individual cubbies
        const maxCols = Math.ceil(Math.sqrt(this.cubbies.length));
        const padding = 50;
        const cubbySpacing = 100; // Space between cubbies
        
        // Draw each cubby as an individual piece
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
            
            fill(color);
            stroke('black');
            strokeWeight(1);
            
            // Draw cells relative to their bounds
            for (const cell of cubby.cells) {
                const relativeX = (cell.x - bounds.minX) * scale;
                const relativeY = (cell.y - bounds.minY) * scale;
                const screenX = offsetX + relativeX;
                const screenY = offsetY + relativeY;
                rect(screenX, screenY, scale, scale);
            }
            
            // Label cubby
            fill('white');
            stroke('black');
            strokeWeight(1);
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