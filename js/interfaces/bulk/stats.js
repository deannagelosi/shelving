// Statistical helper functions for the bulk analysis viewer.

const EPS = 1e-9;

const StatsHelper = {
    _calculateMean(dataArray) {
        if (!dataArray || dataArray.length === 0) return 0;
        return dataArray.reduce((sum, val) => sum + val, 0) / dataArray.length;
    },

    _calculateStdDev(dataArray) {
        if (!dataArray || dataArray.length < 2) return 0;

        const mean = this._calculateMean(dataArray);
        const sumSq = dataArray.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0);
        const variance = sumSq / (dataArray.length - 1);
        return Math.sqrt(variance);
    },

    calculateRrmseByPerimeter(shapeData, caseGeom) {
        // Calculate the perimeter-weighted relative root-mean-square error
        const nShapes = shapeData.length;
        if (nShapes === 0) return { rmse: 0, rRmse: 0, isNoSlack: true };

        const caseArea = caseGeom.caseWidth * caseGeom.caseHeight;
        const totalShapeArea = shapeData.reduce((sum, d) => sum + d.shapeArea, 0);
        const totalSlack = caseArea - totalShapeArea;

        if (totalSlack < EPS) {
            return { rmse: 0, rRmse: 0, isNoSlack: true };
        }

        const totalPerimeter = shapeData.reduce((sum, d) => sum + d.perimeter, 0);
        if (!Number.isFinite(totalPerimeter) || totalPerimeter === 0) {
            // Avoid division by zero if all perimeters are somehow zero
            return { rmse: NaN, rRmse: NaN, isNoSlack: true };
        }

        const avgIdealSlack = totalSlack / nShapes;
        let sumSquaredError = 0;

        for (const shape of shapeData) {
            const idealSlack = totalSlack * (shape.perimeter / totalPerimeter);
            const actualSlack = shape.cubbyArea - shape.shapeArea;
            const error = actualSlack - idealSlack;
            sumSquaredError += error * error;
        }

        const meanSquaredError = sumSquaredError / nShapes;
        const rmse = Math.sqrt(meanSquaredError);
        const rRmse = avgIdealSlack > EPS ? rmse / avgIdealSlack : 0;

        if (
            Number.isNaN(rRmse) ||
            Number.isNaN(rmse) ||
            Number.isNaN(meanSquaredError)
        ) {
            throw new Error("rRMSE, RMSE, or meanSquaredError calculation resulted in NaN");
        }

        return { rmse, rRmse, isNoSlack: false };
    },

    calculateRmaeByPerimeter(shapeData, caseGeom) {
        const nShapes = shapeData.length;
        if (nShapes === 0) return { mae: 0, rMae: 0, isNoSlack: true };

        const caseArea = caseGeom.caseWidth * caseGeom.caseHeight;
        const totalShapeArea = shapeData.reduce((sum, d) => sum + d.shapeArea, 0);
        const totalSlack = caseArea - totalShapeArea;

        if (totalSlack < EPS) {
            return { mae: 0, rMae: 0, isNoSlack: true };
        }

        const totalPerimeter = shapeData.reduce((s, d) => s + d.perimeter, 0);
        if (!Number.isFinite(totalPerimeter) || totalPerimeter === 0) {
            return { mae: NaN, rMae: NaN, isNoSlack: true };
        }

        const avgIdealSlack = totalSlack / nShapes;
        let absErrorSum = 0;

        for (const shape of shapeData) {
            const idealSlack = totalSlack * (shape.perimeter / totalPerimeter);
            const actualSlack = shape.cubbyArea - shape.shapeArea;
            const error = actualSlack - idealSlack;
            absErrorSum += Math.abs(error);
        }

        const mae = absErrorSum / nShapes;
        const rMae = avgIdealSlack > EPS ? mae / avgIdealSlack : 0;

        if (Number.isNaN(rMae) || Number.isNaN(mae)) {
            throw new Error("rMAE or MAE calculation resulted in NaN");
        }

        return { mae, rMae, isNoSlack: false };
    },

    summaryRrmse(rRMSEArray) {
        const n = rRMSEArray.length;
        if (n === 0) return { n: 0, mean: 0, sd: 0, ci95: [0, 0] };

        const mean = rRMSEArray.reduce((a, b) => a + b, 0) / n;
        const sd = n > 1 ? Math.sqrt(rRMSEArray.reduce((s, x) => s + (x - mean) ** 2, 0) / (n - 1)) : 0;
        const se = sd / Math.sqrt(n);
        const ci95 = [mean - 1.96 * se, mean + 1.96 * se];
        return { n, mean, sd, ci95 };
    },

    summaryRmae(rMaeArray) {
        const n = rMaeArray.length;
        if (n === 0) return { n: 0, mean: 0, sd: 0, ci95: [0, 0] };

        const mean = rMaeArray.reduce((a, b) => a + b, 0) / n;
        const sd = n > 1
            ? Math.sqrt(rMaeArray.reduce((s, x) => s + (x - mean) ** 2, 0) / (n - 1))
            : 0;
        const se = sd / Math.sqrt(n);
        const ci95 = [mean - 1.96 * se, mean + 1.96 * se];

        return { n, mean, sd, ci95 };
    },

    calculateQQData(dataArray) {
        // Calculate Q-Q plot data comparing sample quantile to theoretical normal quantile
        // Using a simplified approximation suitable for Q-Q plot visualization

        if (dataArray.length === 0) return [];

        // Sort the data
        const sortedData = [...dataArray].sort((a, b) => a - b);
        const n = sortedData.length;

        const qqPoints = [];

        for (let i = 0; i < n; i++) {
            // Calculate sample quantile (observed value)
            const sampleQuantile = sortedData[i];

            // Calculate theoretical quantile from standard normal distribution
            // Using the formula: (i + 0.5) / n to get the probability
            const p = (i + 0.5) / n;

            // Use jStat for accurate inverse normal calculation
            const theoreticalQuantile = jStat.normal.inv(p, 0, 1);

            qqPoints.push({
                x: theoreticalQuantile,
                y: sampleQuantile
            });
        }

        return qqPoints;
    }
}; 