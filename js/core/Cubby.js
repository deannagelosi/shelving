class Cubby {
    constructor(id, cells, wallThickness = 0.25, cubbyCurveRadius = 0.5) {
        // Core properties
        this.id = id;
        this.cells = cells || [];  // Array of {x, y} cell positions
        this.wallThickness = wallThickness;
        this.cubbyCurveRadius = cubbyCurveRadius;
        
        
        // Line data (calculated on demand and cached)
        this.centerLines = null;    // Merged cellular lines (no curves, no inset)
        this.interiorLines = null;  // Inset by wallThickness/2 + curved
        this.exteriorLines = null;  // Extended by wallThickness/2 + curved
        
        // Metadata
        this.area = cells ? cells.length : 0;
        this.bounds = null;          // Cached bounding box
        
        // Cache keys for regeneration detection
        this._lastWallThickness = wallThickness;
        this._lastCurveRadius = cubbyCurveRadius;
    }
    
    // Generate center lines from cells (merge segments into full lines)
    generateCenterLines() {
        if (this.centerLines && this.centerLines.length > 0) {
            return this.centerLines;
        }
        
        // Extract perimeter segments from cells
        const segments = this.extractPerimeterSegments();
        
        // Merge connected segments into full lines
        const mergedLines = this.mergeSegments(segments);
        
        // Order lines into CCW polygon sequence
        this.centerLines = this.orderLinesQuietly(mergedLines);
        
        return this.centerLines;
    }
    
    // Generate all three line types in consistent order
    generateAllLines() {
        this.generateCenterLines();
        this.generateInteriorLines();
        this.generateExteriorLines();
        return {
            center: this.centerLines,
            interior: this.interiorLines,
            exterior: this.exteriorLines
        };
    }
    
    // Generate interior lines (inset + curves)
    generateInteriorLines() {
        const offsetDistance = this.wallThickness / 2;
        return this._generateOffsetLines(offsetDistance, 'inset', 'interiorLines');
    }
    
    // Generate exterior lines (outset + curves)
    generateExteriorLines() {
        const offsetDistance = this.wallThickness / 2;
        return this._generateOffsetLines(offsetDistance, 'outset', 'exteriorLines');
    }
    
    // Shared helper for generating offset lines (interior or exterior)
    _generateOffsetLines(distance, direction, targetProperty) {
        // Check if we need to regenerate based on parameter changes
        if (this[targetProperty] && 
            this._lastWallThickness === this.wallThickness &&
            this._lastCurveRadius === this.cubbyCurveRadius) {
            return this[targetProperty];
        }
        
        // Ensure center lines are generated
        if (!this.centerLines) {
            this.generateCenterLines();
        }
        
        // Apply offset based on direction
        const offsetLines = this.offsetLines(this.centerLines, distance, direction);
        
        // Apply corner curves if radius > 0
        if (this.cubbyCurveRadius > 0) {
            this[targetProperty] = this.applyCurves(offsetLines, this.cubbyCurveRadius);
        } else {
            this[targetProperty] = offsetLines;
        }
        
        // Update cache keys
        this._lastWallThickness = this.wallThickness;
        this._lastCurveRadius = this.cubbyCurveRadius;
        
        return this[targetProperty];
    }
    
    // Extract perimeter segments from cells
    extractPerimeterSegments() {
        
        const edges = new Set();
        
        // For each cell, add its edges if they're on the perimeter
        for (const cell of this.cells) {
            const { x, y } = cell;
            
            // Check each edge of the cell
            const neighbors = [
                { x: x + 1, y: y, edge: `v-${x + 1}-${y}` }, // Right edge
                { x: x - 1, y: y, edge: `v-${x}-${y}` },     // Left edge  
                { x: x, y: y + 1, edge: `h-${x}-${y + 1}` }, // Top edge
                { x: x, y: y - 1, edge: `h-${x}-${y}` }      // Bottom edge
            ];
            
            for (const neighbor of neighbors) {
                const neighborInCubby = this.cells.some(c => c.x === neighbor.x && c.y === neighbor.y);
                if (!neighborInCubby) {
                    // This edge is on the perimeter
                    edges.add(neighbor.edge);
                }
            }
        }
        
        
        // Convert edges to line segments
        const segments = [];
        for (const edge of edges) {
            const [type, x, y] = edge.split('-');
            const xNum = parseInt(x);
            const yNum = parseInt(y);
            
            let segment;
            if (type === 'h') {
                // Horizontal edge
                segment = {
                    type: 'line',
                    x1: xNum, y1: yNum,
                    x2: xNum + 1, y2: yNum
                };
            } else {
                // Vertical edge
                segment = {
                    type: 'line',
                    x1: xNum, y1: yNum,
                    x2: xNum, y2: yNum + 1
                };
            }
            
            segments.push(segment);
        }
        
        return segments;
    }
    
    // Merge connected segments into longer lines
    mergeSegments(segments) {
        if (segments.length === 0) return [];
        
        
        // Group segments by direction and alignment
        const horizontalGroups = new Map(); // key: y-coord, value: array of segments
        const verticalGroups = new Map();   // key: x-coord, value: array of segments
        
        for (const seg of segments) {
            if (seg.y1 === seg.y2) {
                // Horizontal segment
                const y = seg.y1;
                if (!horizontalGroups.has(y)) {
                    horizontalGroups.set(y, []);
                }
                horizontalGroups.get(y).push(seg);
            } else if (seg.x1 === seg.x2) {
                // Vertical segment
                const x = seg.x1;
                if (!verticalGroups.has(x)) {
                    verticalGroups.set(x, []);
                }
                verticalGroups.get(x).push(seg);
            }
        }
        
        
        const mergedLines = [];
        
        // Merge horizontal segments
        for (const [y, segs] of horizontalGroups) {
            const sorted = segs.sort((a, b) => Math.min(a.x1, a.x2) - Math.min(b.x1, b.x2));
            const merged = this.mergeAlignedSegments(sorted, 'horizontal');
            mergedLines.push(...merged);
        }
        
        // Merge vertical segments
        for (const [x, segs] of verticalGroups) {
            const sorted = segs.sort((a, b) => Math.min(a.y1, a.y2) - Math.min(b.y1, b.y2));
            const merged = this.mergeAlignedSegments(sorted, 'vertical');
            mergedLines.push(...merged);
        }
        
        
        return mergedLines;
    }
    
    // Merge aligned segments that are connected
    mergeAlignedSegments(sortedSegments, direction) {
        if (sortedSegments.length === 0) return [];
        
        
        const merged = [];
        let current = { ...sortedSegments[0] };
        
        for (let i = 1; i < sortedSegments.length; i++) {
            const next = sortedSegments[i];
            
            // Check if segments connect
            let connects = false;
            if (direction === 'horizontal') {
                const currentMax = Math.max(current.x1, current.x2);
                const nextMin = Math.min(next.x1, next.x2);
                connects = (currentMax === nextMin);
            } else {
                const currentMax = Math.max(current.y1, current.y2);
                const nextMin = Math.min(next.y1, next.y2);
                connects = (currentMax === nextMin);
            }
            
            if (connects) {
                // Extend current segment
                if (direction === 'horizontal') {
                    const newX2 = Math.max(next.x1, next.x2);
                    current.x2 = newX2;
                } else {
                    const newY2 = Math.max(next.y1, next.y2);
                    current.y2 = newY2;
                }
            } else {
                // Save current and start new
                merged.push(current);
                current = { ...next };
            }
        }
        
        // Don't forget the last segment
        merged.push(current);
        
        return merged;
    }
    
    // Offset lines by a given distance (inset for interior, outset for exterior)
    offsetLines(lines, distance, direction = 'inset') {
        if (distance === 0) return [...lines];
        
        // Convert lines to vertices for proper corner handling
        const vertices = this.extractVertices(lines);
        
        // Calculate offset vertices based on direction
        const offsetVertices = direction === 'inset'
            ? this.calculateInsetVertices(vertices, distance)
            : this.calculateOutsetVertices(vertices, distance);
        
        // Convert back to lines
        return this.verticesToLines(offsetVertices);
    }
    
    // Extract ordered vertices from ordered lines
    extractVertices(lines) {
        const vertices = [];
        
        for (let i = 0; i < lines.length; i++) {
            const curr = lines[i];
            const prev = lines[(i - 1 + lines.length) % lines.length];
            
            // Verify that lines actually connect
            const tolerance = 0.001;
            
            // Each vertex is the start point of current line
            // Store the vertex with its incident edges
            vertices.push({
                x: curr.x1,
                y: curr.y1,
                edgeIn: prev,   // Edge coming into this vertex
                edgeOut: curr   // Edge going out of this vertex
            });
        }
        
        return vertices;
    }
    
    // Calculate inset vertices using intersection-based approach (eliminates diagonal lines)
    calculateInsetVertices(vertices, distance) {
        const insetVertices = [];
        
        for (const vertex of vertices) {
            // Get edge directions (should be axis-aligned unit vectors)
            const dirIn = this.getEdgeDirection(vertex.edgeIn);
            const dirOut = this.getEdgeDirection(vertex.edgeOut);
            
            // Use intersection-based approach for ALL corners (eliminates diagonals)
            const insetVertex = this.calculateLineIntersection(vertex, dirIn, dirOut, distance);
            insetVertices.push(insetVertex);
        }
        
        return insetVertices;
    }
    
    // Get outward normal for CCW polygon (per shrink-algo.md: n = (u_y, -u_x))
    getOutwardNormal(dir) {
        return { x: dir.y, y: -dir.x };
    }
    
    // Calculate intersection of two offset lines (for axis-aligned fabrication)
    calculateLineIntersection(vertex, dirIn, dirOut, distance) {
        const normIn = this.getOutwardNormal(dirIn);
        const normOut = this.getOutwardNormal(dirOut);
        
        // Create offset lines by moving each adjacent line inward
        const offsetLine1 = {
            // Line going INTO this vertex, offset inward
            x1: vertex.x - distance * normIn.x - dirIn.x,
            y1: vertex.y - distance * normIn.y - dirIn.y,
            x2: vertex.x - distance * normIn.x,
            y2: vertex.y - distance * normIn.y
        };
        
        const offsetLine2 = {
            // Line going OUT of this vertex, offset inward  
            x1: vertex.x - distance * normOut.x,
            y1: vertex.y - distance * normOut.y,
            x2: vertex.x - distance * normOut.x + dirOut.x,
            y2: vertex.y - distance * normOut.y + dirOut.y
        };
        
        // Find intersection of these two offset lines
        return this.findLineIntersection(offsetLine1, offsetLine2);
    }
    
    // Find intersection point of two lines (axis-aligned)
    findLineIntersection(line1, line2) {
        // For axis-aligned lines, intersection is straightforward
        const dx1 = line1.x2 - line1.x1;
        const dy1 = line1.y2 - line1.y1;
        const dx2 = line2.x2 - line2.x1;
        const dy2 = line2.y2 - line2.y1;
        
        // One line is horizontal, other is vertical
        if (Math.abs(dx1) < 1e-10 && Math.abs(dy2) < 1e-10) {
            // line1 is vertical, line2 is horizontal
            return { x: line1.x1, y: line2.y1 };
        } else if (Math.abs(dy1) < 1e-10 && Math.abs(dx2) < 1e-10) {
            // line1 is horizontal, line2 is vertical
            return { x: line2.x1, y: line1.y1 };
        }
        
        // General case (though shouldn't be needed for axis-aligned)
        const denominator = dx1 * dy2 - dy1 * dx2;
        if (Math.abs(denominator) < 1e-10) {
            // Lines are parallel - shouldn't happen for adjacent polygon edges
            return { x: line1.x2, y: line1.y2 };
        }
        
        const t = ((line2.x1 - line1.x1) * dy2 - (line2.y1 - line1.y1) * dx2) / denominator;
        return {
            x: line1.x1 + t * dx1,
            y: line1.y1 + t * dy1
        };
    }
    
    
    // Get unit direction vector for an edge
    getEdgeDirection(edge) {
        const dx = edge.x2 - edge.x1;
        const dy = edge.y2 - edge.y1;
        const len = Math.sqrt(dx * dx + dy * dy);
        return { x: dx / len, y: dy / len };
    }
    
    
    // Convert vertices back to lines
    verticesToLines(vertices) {
        const lines = [];
        
        for (let i = 0; i < vertices.length; i++) {
            const curr = vertices[i];
            const next = vertices[(i + 1) % vertices.length];
            
            lines.push({
                type: 'line',
                x1: curr.x,
                y1: curr.y,
                x2: next.x,
                y2: next.y
            });
        }
        
        return lines;
    }
    
    
    // Calculate outset vertices using intersection-based approach (expands polygon)
    calculateOutsetVertices(vertices, distance) {
        const outsetVertices = [];
        
        for (const vertex of vertices) {
            // Get edge directions (should be axis-aligned unit vectors)
            const dirIn = this.getEdgeDirection(vertex.edgeIn);
            const dirOut = this.getEdgeDirection(vertex.edgeOut);
            
            // Use intersection-based approach for ALL corners (eliminates diagonals)
            const outsetVertex = this.calculateLineIntersectionOutward(vertex, dirIn, dirOut, distance);
            outsetVertices.push(outsetVertex);
        }
        
        return outsetVertices;
    }
    
    // Calculate intersection of two outward-offset lines (for axis-aligned fabrication)
    calculateLineIntersectionOutward(vertex, dirIn, dirOut, distance) {
        const normIn = this.getOutwardNormal(dirIn);
        const normOut = this.getOutwardNormal(dirOut);
        
        // Create offset lines by moving each adjacent line outward
        const offsetLine1 = {
            // Line going INTO this vertex, offset outward
            x1: vertex.x + distance * normIn.x - dirIn.x,
            y1: vertex.y + distance * normIn.y - dirIn.y,
            x2: vertex.x + distance * normIn.x,
            y2: vertex.y + distance * normIn.y
        };
        
        const offsetLine2 = {
            // Line going OUT of this vertex, offset outward  
            x1: vertex.x + distance * normOut.x,
            y1: vertex.y + distance * normOut.y,
            x2: vertex.x + distance * normOut.x + dirOut.x,
            y2: vertex.y + distance * normOut.y + dirOut.y
        };
        
        // Find intersection of these two offset lines
        return this.findLineIntersection(offsetLine1, offsetLine2);
    }
    
    // Order lines without throwing errors (for internal use)
    orderLinesQuietly(lines) {
        if (lines.length === 0) return [];
        
        const remaining = [...lines];
        const ordered = [];
        
        // Start with any line
        ordered.push(remaining.shift());
        
        // Keep connecting lines until we can't find more connections
        while (remaining.length > 0) {
            const lastLine = ordered[ordered.length - 1];
            let found = false;
            
            // Find a line that connects to the end of the last line
            for (let i = 0; i < remaining.length; i++) {
                const candidate = remaining[i];
                
                // Check if candidate connects to end of last line
                const tolerance = 0.001;
                if (Math.abs(lastLine.x2 - candidate.x1) < tolerance && 
                    Math.abs(lastLine.y2 - candidate.y1) < tolerance) {
                    // Direct connection
                    ordered.push(remaining.splice(i, 1)[0]);
                    found = true;
                    break;
                } else if (Math.abs(lastLine.x2 - candidate.x2) < tolerance && 
                           Math.abs(lastLine.y2 - candidate.y2) < tolerance) {
                    // Need to reverse candidate
                    const reversed = {
                        ...candidate,
                        x1: candidate.x2,
                        y1: candidate.y2,
                        x2: candidate.x1,
                        y2: candidate.y1
                    };
                    ordered.push(reversed);
                    remaining.splice(i, 1);
                    found = true;
                    break;
                }
            }
            
            if (!found) {
                break;
            }
        }
        
        
        // Standardize to counter-clockwise winding order (matches shrink-algo.md)
        if (this.isClockwise(ordered)) {
            // Reverse the array AND reverse each line's direction
            ordered.reverse();
            for (let i = 0; i < ordered.length; i++) {
                const line = ordered[i];
                ordered[i] = {
                    ...line,
                    x1: line.x2,
                    y1: line.y2,
                    x2: line.x1,
                    y2: line.y1
                };
            }
        }
        
        return ordered;
    }
    
    // Calculate if polygon has clockwise winding using signed area
    isClockwise(lines) {
        let signedArea = 0;
        
        for (const line of lines) {
            // Use the shoelace formula on each edge
            signedArea += (line.x2 - line.x1) * (line.y2 + line.y1);
        }
        
        // Positive area means clockwise in screen coordinates (Y increases downward)
        return signedArea > 0;
    }
    
    
    // Apply corner curves to lines
    applyCurves(lines, radius) {
        if (radius === 0 || lines.length === 0) return [...lines];
        
        // First, organize lines into a continuous path
        const orderedLines = this.orderLines(lines);
        const curvedLines = [];
        
        for (let i = 0; i < orderedLines.length; i++) {
            const current = orderedLines[i];
            const next = orderedLines[(i + 1) % orderedLines.length];
            
            // Find the connection point between current and next line
            const connectionPoint = this.findConnectionPoint(current, next);
            const isRightAngle = this.isRightAngleCorner(current, next);
            
            if (connectionPoint && isRightAngle) {
                // Apply corner rounding
                const roundedCorner = this.createRoundedCorner(current, next, connectionPoint, radius);
                curvedLines.push(...roundedCorner);
            } else {
                // Fail fast - all corners must connect at right angles for curves
                throw new Error(`Cannot apply curve - no connection point or not a right angle corner`);
            }
        }
        return curvedLines;
    }
    
    // Order lines to form a continuous path
    orderLines(lines) {
        if (lines.length === 0) return [];
        
        
        const ordered = [lines[0]];
        const remaining = [...lines.slice(1)];
        
        while (remaining.length > 0) {
            const last = ordered[ordered.length - 1];
            const lastPoint = { x: last.x2, y: last.y2 };
            
            // Find next line that connects to the last point
            let nextIndex = -1;
            for (let i = 0; i < remaining.length; i++) {
                const line = remaining[i];
                if ((line.x1 === lastPoint.x && line.y1 === lastPoint.y) ||
                    (line.x2 === lastPoint.x && line.y2 === lastPoint.y)) {
                    nextIndex = i;
                    break;
                }
            }
            
            if (nextIndex >= 0) {
                let nextLine = remaining.splice(nextIndex, 1)[0];
                
                // Flip line if needed to maintain direction
                if (nextLine.x2 === lastPoint.x && nextLine.y2 === lastPoint.y) {
                    const temp = { x: nextLine.x1, y: nextLine.y1 };
                    nextLine.x1 = nextLine.x2;
                    nextLine.y1 = nextLine.y2;
                    nextLine.x2 = temp.x;
                    nextLine.y2 = temp.y;
                }
                
                ordered.push(nextLine);
            } else {
                // Fail fast - all lines must connect in a continuous path
                throw new Error(`Cannot connect remaining ${remaining.length} lines to form continuous path`);
            }
        }
        
        return ordered;
    }
    
    // Find where two lines connect (for ordered lines, should be end-to-start)
    findConnectionPoint(line1, line2) {
        const tolerance = 0.001;
        
        // Standard case: end of line1 connects to start of line2
        if (Math.abs(line1.x2 - line2.x1) < tolerance && 
            Math.abs(line1.y2 - line2.y1) < tolerance) {
            return { x: line1.x2, y: line1.y2 };
        }
        
        // Check other possible connections (for robustness)
        if (Math.abs(line1.x1 - line2.x2) < tolerance && 
            Math.abs(line1.y1 - line2.y2) < tolerance) {
            return { x: line1.x1, y: line1.y1 };
        }
        if (Math.abs(line1.x1 - line2.x1) < tolerance && 
            Math.abs(line1.y1 - line2.y1) < tolerance) {
            return { x: line1.x1, y: line1.y1 };
        }
        if (Math.abs(line1.x2 - line2.x2) < tolerance && 
            Math.abs(line1.y2 - line2.y2) < tolerance) {
            return { x: line1.x2, y: line1.y2 };
        }
        
        return null;
    }
    
    // Check if two lines form a right angle corner
    isRightAngleCorner(line1, line2) {
        const dx1 = line1.x2 - line1.x1;
        const dy1 = line1.y2 - line1.y1;
        const dx2 = line2.x2 - line2.x1;
        const dy2 = line2.y2 - line2.y1;
        
        // For grid-based lines, right angles occur when one is horizontal and other is vertical
        const isHorizontal1 = dy1 === 0 && dx1 !== 0;
        const isVertical1 = dx1 === 0 && dy1 !== 0;
        const isHorizontal2 = dy2 === 0 && dx2 !== 0;
        const isVertical2 = dx2 === 0 && dy2 !== 0;
        
        return (isHorizontal1 && isVertical2) || (isVertical1 && isHorizontal2);
    }
    
    // Create bezier curve for rounded corner between two lines
    createRoundedCorner(line1, line2, corner, radius) {
        const direction1 = this.normalizeVector({
            x: line1.x2 - line1.x1,
            y: line1.y2 - line1.y1
        });
        
        const direction2 = this.normalizeVector({
            x: line2.x2 - line2.x1,
            y: line2.y2 - line2.y1
        });
        
        // Calculate curve start and end points
        const curveStart = {
            x: corner.x - direction1.x * radius,
            y: corner.y - direction1.y * radius
        };
        
        const curveEnd = {
            x: corner.x + direction2.x * radius,
            y: corner.y + direction2.y * radius
        };
        
        // Calculate control points for smooth bezier curve
        // For a right-angle corner, the control points should be at the corner
        // This creates a smooth quadratic-like curve
        const cp1 = {
            x: corner.x,
            y: corner.y
        };
        
        const cp2 = {
            x: corner.x,
            y: corner.y
        };
        
        return [
            // Line from line1 start to curve start
            {
                type: 'line',
                x1: line1.x1, y1: line1.y1,
                x2: curveStart.x, y2: curveStart.y
            },
            // Bezier curve at corner
            {
                type: 'bezier',
                x1: curveStart.x, y1: curveStart.y,
                cp1x: cp1.x, cp1y: cp1.y,
                cp2x: cp2.x, cp2y: cp2.y,
                x2: curveEnd.x, y2: curveEnd.y
            },
            // Line from curve end to line2 end
            {
                type: 'line',
                x1: curveEnd.x, y1: curveEnd.y,
                x2: line2.x2, y2: line2.y2
            }
        ];
    }
    
    // Normalize a vector to unit length
    normalizeVector(vector) {
        const length = Math.sqrt(vector.x * vector.x + vector.y * vector.y);
        if (length === 0) return { x: 0, y: 0 };
        return {
            x: vector.x / length,
            y: vector.y / length
        };
    }

    
    // Get bounding box for the cubby
    getBounds() {
        if (this.bounds) return this.bounds;
        
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;
        
        for (const cell of this.cells) {
            minX = Math.min(minX, cell.x);
            minY = Math.min(minY, cell.y);
            maxX = Math.max(maxX, cell.x + 1);
            maxY = Math.max(maxY, cell.y + 1);
        }
        
        this.bounds = { minX, minY, maxX, maxY };
        return this.bounds;
    }
    
    
    // Update wall thickness and clear relevant caches
    setWallThickness(thickness) {
        if (this.wallThickness !== thickness) {
            this.wallThickness = thickness;
            this.interiorLines = null;
            this.exteriorLines = null;
        }
    }
    
    // Update curve radius and clear relevant caches
    setCurveRadius(radius) {
        if (this.cubbyCurveRadius !== radius) {
            this.cubbyCurveRadius = radius;
            this.interiorLines = null;
            this.exteriorLines = null;
        }
    }
}

// Only export the class when in a Node.js environment (e.g., during Jest tests)
// Ignored when the app is running in the browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Cubby;
}