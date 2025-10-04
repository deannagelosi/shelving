// Centralized location for unit conversions, spatial calculations, padding logic, and other math utilities

class MathUtils {
    /**
     * Convert grid units to physical inches based on minimum wall length
     * @param {number} gridUnits - Value in grid units
     * @param {number} minWallLength - Minimum wall length setting (inches per grid unit)
     * @returns {number} Value in inches
     */
    static gridUnitsToInches(gridUnits, minWallLength) {
        const wallLength = minWallLength || 1.0;
        return gridUnits * wallLength;
    }

    /**
     * Convert physical inches to grid units based on minimum wall length
     * @param {number} inches - Value in inches
     * @param {number} minWallLength - Minimum wall length setting (inches per grid unit)
     * @returns {number} Value in grid units
     */
    static inchesToGridUnits(inches, minWallLength) {
        const wallLength = minWallLength || 1.0;
        return inches / wallLength;
    }

    /**
     * Convert coordinates from grid units to inches
     * Useful for bulk DXF export operations
     * Note: h (height) is NOT converted as it represents caseDepth which is always in inches
     * @param {Object} coords - Coordinate object with x, y, w, h properties
     * @param {number} minWallLength - Minimum wall length setting
     * @returns {Object} Coordinates in inches
     */
    static convertCoordsToInches(coords, minWallLength) {
        return {
            x: this.gridUnitsToInches(coords.x, minWallLength),
            y: this.gridUnitsToInches(coords.y, minWallLength),
            ...(coords.w !== undefined && { w: this.gridUnitsToInches(coords.w, minWallLength) }),
            ...(coords.h !== undefined && { h: coords.h }) // h is always inches (caseDepth)
        };
    }

    /**
     * Calculate bounding box for any 2D array
     * @param {Array} array - 2D array to analyze
     * @param {Function} cellAccessor - Function to determine if cell is occupied
     *                                   Default: handles both boolean and {occupied} object cells
     * @returns {Object} { minX, maxX, minY, maxY } or null if no occupied cells
     */
    static calculateBounds(array, cellAccessor = null) {
        if (!array || array.length === 0) return null;

        const height = array.length;
        const width = array[0] ? array[0].length : 0;
        if (width === 0) return null;

        // Default accessor handles both boolean and object cells
        const isOccupied = cellAccessor || ((cell) => {
            return typeof cell === 'boolean' ? cell : (cell && cell.occupied);
        });

        const bounds = {
            minX: width,
            maxX: -1,
            minY: height,
            maxY: -1
        };

        let foundOccupied = false;

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                if (isOccupied(array[y][x])) {
                    foundOccupied = true;
                    bounds.minX = Math.min(bounds.minX, x);
                    bounds.maxX = Math.max(bounds.maxX, x);
                    bounds.minY = Math.min(bounds.minY, y);
                    bounds.maxY = Math.max(bounds.maxY, y);
                }
            }
        }

        return foundOccupied ? bounds : null;
    }

    /**
     * Convert physical inches to highres units (quarter-inch squares)
     *
     * IMPORTANT: Highres is ALWAYS 0.25" per square, regardless of minWallLength setting.
     * This is different from grid units, which vary based on minWallLength.
     *
     * Use this for:
     * - Buffer size conversion (inches -> highres steps)
     * - Any conversion to the highres coordinate system
     *
     * DO NOT use scaleFactor for this conversion - scaleFactor relates grid to highres,
     * not inches to highres.
     *
     * @param {number} inches - Value in inches
     * @returns {number} Value in highres units (rounded to nearest unit)
     */
    static inchesToHighres(inches) {
        const HIGHRES_UNIT = 0.25; // 1 highres square = 0.25 inches (constant)
        return Math.round(inches / HIGHRES_UNIT);
    }

    /**
     * Convert highres units (quarter-inch squares) to physical inches
     *
     * Highres is always 0.25" per square, regardless of minWallLength setting.
     *
     * @param {number} highresUnits - Value in highres units
     * @returns {number} Value in inches
     */
    static highresToInches(highresUnits) {
        const HIGHRES_UNIT = 0.25; // 1 highres square = 0.25 inches (constant)
        return highresUnits * HIGHRES_UNIT;
    }

    /**
     * Calculate padding distribution for centering content
     * @param {number} totalPadding - Total padding to distribute
     * @param {boolean} centerAlign - If true, center the content; if false, align to start
     * @returns {Object} { start, end } padding values
     */
    static distributePadding(totalPadding, centerAlign) {
        if (centerAlign) {
            const half = Math.floor(totalPadding / 2);
            return {
                start: half,
                end: totalPadding - half
            };
        } else {
            return {
                start: totalPadding,
                end: 0
            };
        }
    }
}

// Export for Node.js environments (tests, CLI)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MathUtils;
}
