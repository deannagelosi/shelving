// tests/CurveWall.test.js

const Solution = require('../js/core/Solution');
const Shape = require('../js/core/Shape');
const CurveWall = require('../js/core/CurveWall');
const fs = require('fs');
const path = require('path');

function loadTestData(fileName) {
    const fixturePath = path.resolve(__dirname, '../examples', fileName);
    const fileContents = fs.readFileSync(fixturePath, 'utf8');
    return JSON.parse(fileContents);
}

function loadGoldenPath(fileName) {
    const fixturePath = path.resolve(__dirname, './fixtures', fileName);
    const fileContents = fs.readFileSync(fixturePath, 'utf8');
    return JSON.parse(fileContents);
}


describe('CurveWall Algorithm', () => {
    let testSolution;
    let goldenPath;

    beforeAll(() => {
        const testData = loadTestData('curve_test_both.json');
        goldenPath = loadGoldenPath('curved_walls_check.json');

        const solutionData = testData.savedAnneals.find(s => s.title === 'solution-3');
        if (!solutionData) {
            throw new Error("Could not find 'solution-3' in the test data.");
        }

        // Re-create the solution object from the fixture data
        const shapes = solutionData.finalSolution.shapes.map(sData => Shape.fromDataObject(sData));
        testSolution = Solution.fromDataObject(solutionData.finalSolution);
        testSolution.shapes = shapes; // Ensure shapes are proper class instances
    });

    it('should generate line and arc segments that match the golden path', () => {
        const curveWall = new CurveWall(testSolution);
        const generatedPath = curveWall.generate(
            testSolution.maxBends,
            testSolution.curveRadius
        );

        const generatedLines = generatedPath.filter(s => s.type === 'line');
        const generatedArcs = generatedPath.filter(s => s.type === 'arc');
        const goldenLines = goldenPath.filter(s => s.type === 'line');
        const goldenArcs = goldenPath.filter(s => s.type === 'arc');

        console.log("--- COMPREHENSIVE SEGMENT COMPARISON ---");
        console.log(`Generated: ${generatedLines.length} lines, ${generatedArcs.length} arcs`);
        console.log(`Expected:  ${goldenLines.length} lines, ${goldenArcs.length} arcs`);

        // Validate segment counts first
        expect(generatedLines.length).toEqual(goldenLines.length);
        expect(generatedArcs.length).toEqual(goldenArcs.length);

        // Create comprehensive matching for lines
        const unmatchedGoldenLines = [...goldenLines];
        const unmatchedGeneratedLines = [...generatedLines];

        console.log("\n--- LINE MATCHING ---");
        goldenLines.forEach((goldenLine, index) => {
            const matchIndex = unmatchedGeneratedLines.findIndex(gl =>
                Math.abs(gl.startX - goldenLine.startX) < 0.01 &&
                Math.abs(gl.startY - goldenLine.startY) < 0.01 &&
                Math.abs(gl.endX - goldenLine.endX) < 0.01 &&
                Math.abs(gl.endY - goldenLine.endY) < 0.01
            );

            if (matchIndex >= 0) {
                const match = unmatchedGeneratedLines[matchIndex];
                console.log(`✅ Golden Line ${goldenLine.id}: (${goldenLine.startX},${goldenLine.startY})→(${goldenLine.endX},${goldenLine.endY}) matches Generated Line ${match.id}`);
                unmatchedGeneratedLines.splice(matchIndex, 1);
                unmatchedGoldenLines.splice(unmatchedGoldenLines.findIndex(l => l.id === goldenLine.id), 1);
            } else {
                console.log(`❌ Golden Line ${goldenLine.id}: (${goldenLine.startX},${goldenLine.startY})→(${goldenLine.endX},${goldenLine.endY}) - NO MATCH FOUND`);
            }
        });

        if (unmatchedGeneratedLines.length > 0) {
            console.log("❌ Extra generated lines:");
            unmatchedGeneratedLines.forEach(line => {
                console.log(`   Generated Line ${line.id}: (${line.startX},${line.startY})→(${line.endX},${line.endY})`);
            });
        }

        // Create comprehensive matching for arcs  
        const unmatchedGoldenArcs = [...goldenArcs];
        const unmatchedGeneratedArcs = [...generatedArcs];

        console.log("\n--- ARC MATCHING ---");
        goldenArcs.forEach((goldenArc, index) => {
            const matchIndex = unmatchedGeneratedArcs.findIndex(ga =>
                Math.abs(ga.centerX - goldenArc.centerX) < 0.01 &&
                Math.abs(ga.centerY - goldenArc.centerY) < 0.01 &&
                Math.abs(ga.radius - goldenArc.radius) < 0.01 &&
                Math.abs(ga.startDeg - goldenArc.startAngle) < 0.01 &&
                Math.abs(ga.endDeg - goldenArc.endAngle) < 0.01
            );

            if (matchIndex >= 0) {
                const match = unmatchedGeneratedArcs[matchIndex];
                console.log(`✅ Golden Arc ${goldenArc.id}: center(${goldenArc.centerX},${goldenArc.centerY}) ${goldenArc.startAngle}°→${goldenArc.endAngle}° matches Generated Arc ${match.id}`);
                unmatchedGeneratedArcs.splice(matchIndex, 1);
                unmatchedGoldenArcs.splice(unmatchedGoldenArcs.findIndex(a => a.id === goldenArc.id), 1);
            } else {
                console.log(`❌ Golden Arc ${goldenArc.id}: center(${goldenArc.centerX},${goldenArc.centerY}) ${goldenArc.startAngle}°→${goldenArc.endAngle}° - NO MATCH FOUND`);
                // Find closest generated arc for debugging
                const closest = generatedArcs.reduce((best, ga) => {
                    const dist = Math.sqrt(
                        Math.pow(ga.centerX - goldenArc.centerX, 2) +
                        Math.pow(ga.centerY - goldenArc.centerY, 2)
                    );
                    return (!best || dist < best.distance) ? { arc: ga, distance: dist } : best;
                }, null);
                if (closest) {
                    console.log(`   Closest: Generated Arc ${closest.arc.id}: center(${closest.arc.centerX},${closest.arc.centerY}) ${closest.arc.startDeg}°→${closest.arc.endDeg}°`);
                }
            }
        });

        if (unmatchedGeneratedArcs.length > 0) {
            console.log("❌ Extra generated arcs:");
            unmatchedGeneratedArcs.forEach(arc => {
                console.log(`   Generated Arc ${arc.id}: center(${arc.centerX},${arc.centerY}) ${arc.startDeg}°→${arc.endDeg}°`);
            });
        }

        // Final assertions - all segments must match exactly
        expect(unmatchedGoldenLines.length).toBe(0);
        expect(unmatchedGoldenArcs.length).toBe(0);
        expect(unmatchedGeneratedLines.length).toBe(0);
        expect(unmatchedGeneratedArcs.length).toBe(0);
    });
});
