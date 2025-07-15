// Bulk Results Viewer. Main controller for:
// - viewer state (viewerState.js)
// - the data repository (repository.js)
// - renderer (viewerRenderer.js)

// Global instances
let viewerUI;
let viewerRenderer;

function setup() {
    viewerRenderer = new ViewerRenderer(viewerState);
    viewerUI = new ViewerUI(viewerState);
    viewerUI.init();
}

function draw() {
    if (viewerRenderer) {
        viewerRenderer.draw();
    }
}

function keyPressed() {
    if (viewerRenderer) {
        viewerRenderer.handleKeyPress(key);
    }
}

class ViewerUI {
    constructor(state) {
        this.state = state;
        this.repository = new BulkResultsRepository(this.state);
        this.renderer = null; // set by setRenderer

        // DOM elements
        this.fileInput = null;
        this.messageDiv = null;
        this.jobListDiv = null;

        // Analysis state
        this.lastEmptySpaceReductionValues = [];
    }

    setRenderer(renderer) {
        this.renderer = renderer;
    }

    async init() {
        this.setupUI();
        const sqlLoaded = await this.repository.initSqlJs();
        if (sqlLoaded) {
            this.showMessage('SQL.js loaded. Attempting to auto-load database...', 'info');
            this.autoLoadDatabase();
        } else {
            this.showMessage('Failed to load SQL.js. Please refresh.', 'error');
        }
    }

    setupUI() {
        // Create file input
        this.fileInput = createFileInput(this.handleDatabaseFile.bind(this));
        this.fileInput.parent('file-input-container');
        this.fileInput.attribute('accept', '.sqlite,.db');

        // Create message div
        this.messageDiv = createDiv('Select a SQLite database file to begin');
        this.messageDiv.parent('file-input-container');
        this.messageDiv.class('info-message');

        // Create job list container
        this.jobListDiv = createDiv('');
        this.jobListDiv.parent('job-list-container');
    }

    async autoLoadDatabase() {
        const defaultDbPath = '../../models/results.sqlite';
        try {
            const response = await fetch(defaultDbPath);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const arrayBuffer = await response.arrayBuffer();
            const dbLoaded = this.repository.loadDbFromBuffer(arrayBuffer);
            if (dbLoaded) {
                this.showMessage(`Auto-loaded database: ${defaultDbPath}`, 'info');
                this.displayJobs();
            } else {
                throw new Error('Failed to parse database buffer.');
            }
        } catch (error) {
            this.showMessage(`Auto-load failed: ${error.message}. Select a file manually.`, 'warning');
        }
    }

    handleDatabaseFile(file) {
        if (!file) {
            this.showMessage('No file selected', 'error');
            return;
        }
        this.showMessage('Loading database...', 'info');
        const reader = new FileReader();
        reader.onload = (event) => {
            const dbLoaded = this.repository.loadDbFromBuffer(event.target.result);
            if (dbLoaded) {
                this.showMessage(`Database loaded successfully: ${file.name}`, 'info');
                this.displayJobs();
            } else {
                this.showMessage(`Failed to load database: ${error.message}`, 'error');
            }
        };
        reader.onerror = () => this.showMessage('Failed to read file', 'error');
        reader.readAsArrayBuffer(file.file);
    }

    displayJobs() {
        const jobs = this.repository.getJobs();
        this.jobListDiv.html(''); // Clear existing
        if (jobs.length === 0) {
            this.jobListDiv.html('<p>No jobs found in database</p>');
            return;
        }
        const jobListTitle = createDiv('<strong>Available Jobs:</strong>');
        jobListTitle.parent(this.jobListDiv);
        for (let job of jobs) {
            const jobDiv = createDiv('');
            jobDiv.parent(this.jobListDiv);
            jobDiv.class('job-item');
            const jobInfo = `Job ${job.job_id.substring(0, 8)}... (${job.completed_workers}/${job.total_workers} completed)`;
            const analyzeButton = `<button onclick="viewerUI.showAnalysisDashboard('${job.job_id}')" style="margin-left: 10px; padding: 5px 10px; background: #3498db; color: white; border: none; border-radius: 3px; cursor: pointer;">Analyze Job</button>`;
            jobDiv.html(jobInfo + analyzeButton);
            jobDiv.mousePressed(() => this.displaySolutions(job.job_id));
        }
    }

    displaySolutions(jobId) {
        const solutions = this.repository.getSolutionsForJob(jobId);
        // Clear previous solution list from the DOM
        selectAll('.solutions-container').forEach(el => el.remove());
        selectAll('.solution-item').forEach(el => el.remove());

        if (solutions.length === 0) {
            this.jobListDiv.html(this.jobListDiv.html() + '<p>No solutions found for this job</p>');
            return;
        }
        const solutionsContainer = createDiv('');
        solutionsContainer.parent(this.jobListDiv);
        solutionsContainer.class('solutions-container');
        const solutionListTitle = createDiv(`<strong>Solutions (${solutions.length}):</strong>`);
        solutionListTitle.parent(solutionsContainer);
        for (let solution of solutions) {
            const solutionDiv = createDiv('');
            solutionDiv.parent(solutionsContainer);
            solutionDiv.class('solution-item');
            const hasBaselines = solution.baseline_grid_json;
            const baselineText = hasBaselines ? ' (with baselines)' : ' (no baselines)';
            solutionDiv.html(`Solution ${solution.start_id + 1} - Score: ${solution.score.toFixed(2)}${baselineText}`);
            if (hasBaselines) {
                solutionDiv.mousePressed(() => this.selectSolution(solution));
            } else {
                solutionDiv.style('opacity', '0.5').style('cursor', 'not-allowed');
            }
        }
    }

    selectSolution(solution) {
        this.state.selectedSolution = solution;
        this.updateSolutionStats();
        this.showMessage(`Loaded solution ${solution.start_id + 1}`, 'info');
    }

    updateSolutionStats() {
        if (!this.state.selectedSolution) return;

        const statsBreakdown = JSON.parse(this.state.selectedSolution.stats_breakdown_json || '{}');

        const caseGeom = { caseWidth: statsBreakdown.caseWidth, caseHeight: statsBreakdown.caseHeight };
        const rRmseResult = StatsHelper.calculateRrmseByPerimeter(statsBreakdown.cubby_areas_optimized, caseGeom);
        const rMaeResult = StatsHelper.calculateRmaeByPerimeter(statsBreakdown.cubby_areas_optimized, caseGeom);

        this.state.stats.rRmse = rRmseResult.rRmse;
        this.state.stats.rMae = rMaeResult.rMae;
        this.state.stats.emptySpaceGrid = statsBreakdown.empty_space_grid;
    }

    showMessage(message, type = 'info') {
        this.messageDiv.html(message);
        this.messageDiv.class(type + '-message');
    }

    // === Statistical Analysis Dashboard Methods ===
    showAnalysisDashboard(jobId) {
        // Hide individual solution view and show analysis dashboard
        document.getElementById('canvas-container').style.display = 'none';
        document.getElementById('analysis-dashboard').style.display = 'block';

        // Load and analyze all solutions for this job
        this.loadAndAnalyzeJobSolutions(jobId);
    }

    hideDashboard() {
        // Show individual solution view and hide analysis dashboard
        document.getElementById('canvas-container').style.display = 'block';
        document.getElementById('analysis-dashboard').style.display = 'none';
    }

    loadAndAnalyzeJobSolutions(jobId) {
        if (!this.state.database) return;

        try {
            const solutions = this.repository.getSolutionsForJob(jobId);
            const allStatsData = solutions
                .map(s => JSON.parse(s.stats_breakdown_json || '{}'))
                .filter(s => s && s.cubby_areas_optimized);

            if (allStatsData.length === 0) {
                this.showMessage('No valid statistical data found for this job', 'warning');
                return;
            }

            // Create primary data arrays for analysis
            const rRmseValues = [];
            const rMaeValues = [];
            const emptySpaceReductionValues = [];

            // Process each solution's statistics
            for (const stats of allStatsData) {
                // Calculate rRMSE for the optimized layout
                const caseGeom = {
                    caseWidth: stats.caseWidth,
                    caseHeight: stats.caseHeight
                };

                const rRmseResult = StatsHelper.calculateRrmseByPerimeter(stats.cubby_areas_optimized, caseGeom);
                if (!rRmseResult.isNoSlack) {
                    rRmseValues.push(rRmseResult.rRmse);
                }

                const rMaeResult = StatsHelper.calculateRmaeByPerimeter(stats.cubby_areas_optimized, caseGeom);
                if (!rMaeResult.isNoSlack) {
                    rMaeValues.push(rMaeResult.rMae);
                }

                // Calculate empty space reduction (annealing vs grid packing)
                if (stats.empty_space_grid !== undefined && stats.empty_space_optimized !== undefined) {
                    const emptySpaceReduction = stats.empty_space_grid - stats.empty_space_optimized;
                    emptySpaceReductionValues.push(emptySpaceReduction);
                }
            }

            // Calculate statistics for both metrics
            const idealFitStatsRmse = StatsHelper.summaryRrmse(rRmseValues);
            const idealFitStatsRmae = StatsHelper.summaryRmae(rMaeValues);
            const spaceEfficiencyStats = this.calculateSpaceEfficiency(emptySpaceReductionValues);

            // --- Construct and log summary JSON object
            const analysisSummary = {
                rRMSE: {
                    sampleSize: idealFitStatsRmse.n,
                    mean: idealFitStatsRmse.mean,
                    stdDev: idealFitStatsRmse.sd,
                    ci95: {
                        lower: idealFitStatsRmse.ci95[0],
                        upper: idealFitStatsRmse.ci95[1]
                    },
                    successRate_le_0_10: idealFitStatsRmse.n > 0 ? (rRmseValues.filter(x => x <= 0.10).length / idealFitStatsRmse.n * 100) : 0,
                    cumulativeSuccessRate: this._calculateCumulativeSuccessRateData(rRmseValues)
                },
                rMAE: {
                    sampleSize: idealFitStatsRmae.n,
                    mean: idealFitStatsRmae.mean,
                    stdDev: idealFitStatsRmae.sd,
                    ci95: {
                        lower: idealFitStatsRmae.ci95[0],
                        upper: idealFitStatsRmae.ci95[1]
                    },
                    successRate_le_0_10: idealFitStatsRmae.n > 0 ? (rMaeValues.filter(x => x <= 0.10).length / idealFitStatsRmae.n * 100) : 0,
                    cumulativeSuccessRate: this._calculateCumulativeSuccessRateData(rMaeValues)
                }
            };
            console.log("Bulk Analysis Summary:", JSON.stringify(analysisSummary, null, 2));
            // ---

            // Store raw data for chart rendering
            this.lastEmptySpaceReductionValues = emptySpaceReductionValues;

            // Generate analysis dashboard
            this.renderAnalysisDashboard(idealFitStatsRmse, spaceEfficiencyStats, rRmseValues, idealFitStatsRmae, rMaeValues);

            this.showMessage(`Analyzed ${allStatsData.length} solutions for job ${jobId.substring(0, 8)}...`, 'info');

        } catch (error) {
            this.showMessage(`Failed to load job solutions: ${error.message}`, 'error');
        }
    }

    calculateSpaceEfficiency(dataArray) {
        if (dataArray.length < 2) return null;

        const mean = StatsHelper._calculateMean(dataArray);
        const stdDev = StatsHelper._calculateStdDev(dataArray);
        const successCount = dataArray.filter(val => val > 0).length;
        const successRate = (successCount / dataArray.length) * 100;

        const n = dataArray.length;
        const standardError = stdDev / Math.sqrt(n);
        const tValue = 1.96; // Large-sample approximation
        const marginOfError = tValue * standardError;
        const confidenceInterval = {
            lower: mean - marginOfError,
            upper: mean + marginOfError
        };

        const sorted = [...dataArray].sort((a, b) => a - b);
        const median = sorted.length % 2 === 0
            ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
            : sorted[Math.floor(sorted.length / 2)];

        return {
            mean,
            median,
            stdDev,
            successRate,
            count: dataArray.length,
            ci95: confidenceInterval
        };
    }

    _calculateCumulativeSuccessRateData(values) {
        const sortedValues = [...values].sort((a, b) => a - b);
        const n = sortedValues.length;
        if (n === 0) return [];

        const successRateData = [];
        const maxTau = 0.50;
        const step = 0.05;

        for (let tau = 0; tau <= maxTau; tau += step) {
            const successCount = sortedValues.filter(val => val <= tau).length;
            successRateData.push({
                tau: parseFloat(tau.toFixed(2)),
                successRate: (successCount / n) * 100
            });
        }
        return successRateData;
    }

    renderVerdictPanel(stats, metricName, metricDescription) {
        // Render the Statistical Verdict panel
        const { N, mean, stdDev, ci95, successRate } = stats;

        // Create verdict panel container
        const verdictPanel = document.createElement('div');
        verdictPanel.className = 'analysis-block verdict-panel';
        verdictPanel.style.marginTop = '2rem';
        verdictPanel.style.border = '2px solid #2c3e50';
        verdictPanel.style.borderRadius = '8px';
        verdictPanel.style.padding = '1rem';
        verdictPanel.style.backgroundColor = '#f8f9fa';

        // Title
        const title = document.createElement('h3');
        title.textContent = `Statistical Verdict (${metricName})`;
        title.style.marginTop = '0';
        title.style.color = '#2c3e50';
        verdictPanel.appendChild(title);

        // Results table
        const table = document.createElement('table');
        table.className = 'kpi-table';
        table.style.width = '100%';

        // Helper functions for formatting
        const formatNumber = (val, decimals = 3) => {
            if (val === null || val === undefined) return 'N/A';
            return val.toFixed(decimals);
        };

        // Build table content
        let tableContent = `
            <tr>
                <th style="text-align: left; padding: 8px;">Metric</th>
                <th style="text-align: right; padding: 8px;">Value</th>
            </tr>
            <tr>
                <td>Sample Size</td>
                <td>${N}</td>
            </tr>
            <tr>
                <td>Mean ${metricName}</td>
                <td>${formatNumber(mean, 3)}</td>
            </tr>
            <tr>
                <td>95% CI</td>
                <td>${formatNumber(ci95.lower, 3)} – ${formatNumber(ci95.upper, 3)}</td>
            </tr>
            <tr>
                <td>Std Dev</td>
                <td>${formatNumber(stdDev, 3)}</td>
            </tr>
            <tr>
                <td>Success Rate (${metricName} ≤ 0.10)</td>
                <td>${formatNumber(successRate, 1)}%</td>
            </tr>
        `;

        table.innerHTML = tableContent;
        verdictPanel.appendChild(table);

        // Interpretation string
        const interpretation = document.createElement('div');
        interpretation.style.marginTop = '1rem';
        interpretation.style.padding = '1rem';
        interpretation.style.backgroundColor = '#ffffff';
        interpretation.style.border = '1px solid #dee2e6';
        interpretation.style.borderRadius = '4px';
        interpretation.style.fontWeight = 'bold';

        interpretation.innerHTML = `Across <strong>${N}</strong> layouts the cellular-automata walls deviated from the ${metricDescription} ideal by a mean relative ${metricName.toUpperCase()} of <strong>${formatNumber(mean, 3)} (95% CI ${formatNumber(ci95.lower, 3)}–${formatNumber(ci95.upper, 3)})</strong>. Only <strong>${formatNumber(successRate, 1)}%</strong> of layouts met the 10% tolerance criterion.`;
        verdictPanel.appendChild(interpretation);

        // Footnote
        const footnote = document.createElement('div');
        footnote.style.marginTop = '0.5rem';
        footnote.style.fontSize = '0.85rem';
        footnote.style.color = '#6c757d';
        footnote.style.fontStyle = 'italic';
        footnote.textContent = `Note: ${metricName} is a unit-less measure of deviation from an ideal slack distribution. Lower is better.`;
        verdictPanel.appendChild(footnote);

        return verdictPanel;
    }

    renderAnalysisDashboard(idealFitStatsRmse, spaceEfficiencyStats, rRmseValues, idealFitStatsRmae, rMaeValues) {
        const analysisContent = document.getElementById('analysis-content');
        analysisContent.innerHTML = ''; // Clear existing content

        // Back button
        const backButton = document.createElement('div');
        backButton.innerHTML = '<button onclick="viewerUI.hideDashboard()" style="margin-bottom: 20px; padding: 10px 20px; background: #95a5a6; color: white; border: none; border-radius: 5px; cursor: pointer;">← Back to Solutions</button>';
        analysisContent.appendChild(backButton);

        // Create the two main analysis blocks
        if (idealFitStatsRmse && rRmseValues.length > 0) {
            this.createIdealFitAnalysisBlock(analysisContent, idealFitStatsRmse, rRmseValues, 'rRMSE', 'perimeter-weighted');

            // Add statistical verdict panel for rRMSE analysis
            try {
                // Prepare comprehensive stats object from summaryRrmse result
                const stats = {
                    N: idealFitStatsRmse.n,
                    mean: idealFitStatsRmse.mean,
                    stdDev: idealFitStatsRmse.sd,
                    ci95: { lower: idealFitStatsRmse.ci95[0], upper: idealFitStatsRmse.ci95[1] },
                    successRate: (rRmseValues.filter(x => x <= 0.10).length / idealFitStatsRmse.n * 100)
                };

                // Render verdict panel
                const verdictPanel = this.renderVerdictPanel(stats, 'rRMSE', 'perimeter-weighted');
                analysisContent.appendChild(verdictPanel);

            } catch (error) {
                console.error('Error in statistical analysis:', error);
                const errorPanel = document.createElement('div');
                errorPanel.className = 'analysis-block';
                errorPanel.style.backgroundColor = '#f8d7da';
                errorPanel.style.color = '#721c24';
                errorPanel.style.border = '1px solid #f5c6cb';
                errorPanel.innerHTML = `<h3>Statistical Analysis Error</h3><p>Unable to complete statistical tests: ${error.message}</p>`;
                analysisContent.appendChild(errorPanel);
            }
        }

        if (idealFitStatsRmae && rMaeValues.length > 0) {
            this.createIdealFitAnalysisBlock(analysisContent, idealFitStatsRmae, rMaeValues, 'rMAE', 'perimeter-weighted');

            // Add statistical verdict panel for rRMSE analysis
            try {
                // Prepare comprehensive stats object from summaryRrmse result
                const stats = {
                    N: idealFitStatsRmae.n,
                    mean: idealFitStatsRmae.mean,
                    stdDev: idealFitStatsRmae.sd,
                    ci95: { lower: idealFitStatsRmae.ci95[0], upper: idealFitStatsRmae.ci95[1] },
                    successRate: (rMaeValues.filter(x => x <= 0.10).length / idealFitStatsRmae.n * 100)
                };

                // Render verdict panel
                const verdictPanel = this.renderVerdictPanel(stats, 'rMAE', 'perimeter-weighted');
                analysisContent.appendChild(verdictPanel);

            } catch (error) {
                console.error('Error in statistical analysis:', error);
                const errorPanel = document.createElement('div');
                errorPanel.className = 'analysis-block';
                errorPanel.style.backgroundColor = '#f8d7da';
                errorPanel.style.color = '#721c24';
                errorPanel.style.border = '1px solid #f5c6cb';
                errorPanel.innerHTML = `<h3>Statistical Analysis Error</h3><p>Unable to complete statistical tests: ${error.message}</p>`;
                analysisContent.appendChild(errorPanel);
            }
        }

        if (spaceEfficiencyStats) {
            this.createSpaceEfficiencyBlock(analysisContent, spaceEfficiencyStats, this.lastEmptySpaceReductionValues);
        }
    }

    createIdealFitAnalysisBlock(container, stats, rawValues, metricName, metricDescription) {
        // Compute success rate
        const tau = 0.10;
        const successRate = (rawValues.filter(x => x <= tau).length / rawValues.length) * 100;

        // Create block container
        const block = document.createElement('div');
        block.className = 'analysis-block';

        // Title and description
        const title = document.createElement('h3');
        title.textContent = `Ideal-Fit Error Analysis (${metricName}, ${metricDescription})`;
        block.appendChild(title);

        const description = document.createElement('p');
        description.textContent = `Measures deviation from a theoretical ideal where slack space is proportional to shape perimeter. Lower is better.`;
        description.style.fontSize = '0.9rem';
        description.style.color = '#6c757d';
        description.style.marginBottom = '1rem';
        block.appendChild(description);

        // KPI Table
        const table = document.createElement('table');
        table.className = 'kpi-table';

        const formatValue = (value, precision = 4) => {
            if (typeof value === 'number') {
                return value.toFixed(precision);
            }
            return value;
        };

        table.innerHTML = `
            <tr><th>Metric</th><th>Value</th></tr>
            <tr><td>Mean ${metricName}</td><td>${formatValue(stats.mean)}</td></tr>
            <tr><td>Std Dev of ${metricName}</td><td>${formatValue(stats.sd)}</td></tr>
            <tr><td>Success Rate (${metricName} ≤ 0.10)</td><td>${formatValue(successRate, 1)}%</td></tr>
        `;
        block.appendChild(table);

        // Charts container - side by side
        const chartsContainer = document.createElement('div');
        chartsContainer.style.display = 'grid';
        chartsContainer.style.gridTemplateColumns = '1fr 1fr';
        chartsContainer.style.gap = '1rem';
        chartsContainer.style.margin = '1rem 0';

        // Histogram container
        const histogramContainer = document.createElement('div');
        histogramContainer.className = 'chart-container';
        const histogramCanvas = document.createElement('canvas');
        histogramCanvas.id = `chart-${metricName.toLowerCase()}-histogram`;
        histogramContainer.appendChild(histogramCanvas);
        chartsContainer.appendChild(histogramContainer);

        // Q-Q plot container
        const qqContainer = document.createElement('div');
        qqContainer.className = 'chart-container';
        const qqCanvas = document.createElement('canvas');
        qqCanvas.id = `chart-${metricName.toLowerCase()}-qq`;
        qqContainer.appendChild(qqCanvas);
        chartsContainer.appendChild(qqContainer);

        block.appendChild(chartsContainer);

        // Cumulative success rate chart container
        const successChartContainer = document.createElement('div');
        successChartContainer.className = 'chart-container';
        successChartContainer.style.gridColumn = '1 / -1'; // Span both columns
        successChartContainer.style.marginTop = '1rem';
        const successCanvas = document.createElement('canvas');
        successCanvas.id = `chart-${metricName.toLowerCase()}-success-rate`;
        successChartContainer.appendChild(successCanvas);
        block.appendChild(successChartContainer);


        // Confidence interval
        const ciDiv = document.createElement('div');
        ciDiv.className = 'confidence-interval';
        ciDiv.innerHTML = `
            <strong>95% Confidence Interval for Mean ${metricName}:</strong> 
            ${formatValue(stats.ci95[0])} to ${formatValue(stats.ci95[1])}
        `;
        block.appendChild(ciDiv);

        container.appendChild(block);

        // Create charts
        this.createHistogramChart(histogramCanvas.id, `${metricName} Distribution`, rawValues, `${metricName} (${metricDescription})`);
        this.createQQPlotChart(qqCanvas.id, StatsHelper.calculateQQData(rawValues), metricName);
        this.createSuccessRateChart(successCanvas.id, rawValues, metricName);
    }

    createSuccessRateChart(canvasId, values, metricName) {
        const ctx = document.getElementById(canvasId).getContext('2d');
        const cumulativeSuccessData = this._calculateCumulativeSuccessRateData(values);
        const labels = cumulativeSuccessData.map(d => d.tau.toFixed(2));
        const data = cumulativeSuccessData.map(d => d.successRate);

        new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Success Rate',
                    data: data,
                    borderColor: 'rgba(46, 204, 113, 1)',
                    backgroundColor: 'rgba(46, 204, 113, 0.2)',
                    fill: true,
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: { display: true, text: `Cumulative Success Rate vs. ${metricName} Tolerance (τ)` },
                    legend: { display: false }
                },
                scales: {
                    x: { title: { display: true, text: `${metricName} Tolerance (τ)` } },
                    y: { title: { display: true, text: 'Success Rate (%)' }, min: 0, max: 100 }
                }
            }
        });
    }

    createSpaceEfficiencyBlock(container, stats, rawData = []) {
        // Create block container
        const block = document.createElement('div');
        block.className = 'analysis-block';

        // Title and description
        const title = document.createElement('h3');
        title.textContent = 'Space Efficiency Analysis';
        block.appendChild(title);

        const description = document.createElement('p');
        description.textContent = 'Comparison of space efficiency between annealing optimization and grid packing baseline. Positive values indicate space saved by the annealing algorithm.';
        description.style.fontSize = '0.9rem';
        description.style.color = '#6c757d';
        description.style.marginBottom = '1rem';
        block.appendChild(description);

        // KPI Table
        const table = document.createElement('table');
        table.className = 'kpi-table';

        const formatValue = (value) => {
            if (typeof value === 'number') {
                return value.toFixed(2);
            }
            return value;
        };

        const getImprovementClass = (value) => {
            if (value > 0) return 'improvement-positive';
            if (value < 0) return 'improvement-negative';
            return 'improvement-neutral';
        };

        table.innerHTML = `
            <tr>
                <th>Metric</th>
                <th>Value</th>
            </tr>
            <tr>
                <td>Average Space Saved</td>
                <td class="${getImprovementClass(stats.mean)}">${formatValue(stats.mean)} units</td>
            </tr>
            <tr>
                <td>Median Space Saved</td>
                <td class="${getImprovementClass(stats.median)}">${formatValue(stats.median)} units</td>
            </tr>
            <tr>
                <td>Standard Deviation</td>
                <td>${formatValue(stats.stdDev)} units</td>
            </tr>
            <tr>
                <td>Success Rate</td>
                <td class="${getImprovementClass(stats.successRate - 50)}">${formatValue(stats.successRate)}%</td>
            </tr>
        `;
        block.appendChild(table);

        // Chart container
        const chartContainer = document.createElement('div');
        chartContainer.className = 'chart-container';
        const canvas = document.createElement('canvas');
        canvas.id = 'chart-space-efficiency';
        chartContainer.appendChild(canvas);
        block.appendChild(chartContainer);

        container.appendChild(block);

        // Create histogram chart
        if (rawData.length > 0) {
            this.createHistogramChart(canvas.id, 'Space Efficiency Distribution', rawData, 'units');
        }
    }

    createHistogramChart(canvasId, title, data, unit) {
        const ctx = document.getElementById(canvasId).getContext('2d');

        // Calculate histogram bins
        const min = Math.min(...data);
        const max = Math.max(...data);
        const binCount = Math.min(20, Math.max(5, Math.ceil(Math.sqrt(data.length))));
        const binWidth = (max - min) / binCount;

        const bins = Array(binCount).fill(0);
        const binLabels = [];

        for (let i = 0; i < binCount; i++) {
            const binStart = min + (i * binWidth);
            const binEnd = binStart + binWidth;
            binLabels.push(`${binStart.toFixed(1)}`);
        }

        // Fill bins
        for (const value of data) {
            const binIndex = Math.min(binCount - 1, Math.floor((value - min) / binWidth));
            bins[binIndex]++;
        }

        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: binLabels,
                datasets: [{
                    label: 'Frequency',
                    data: bins,
                    backgroundColor: 'rgba(52, 152, 219, 0.6)',
                    borderColor: 'rgba(52, 152, 219, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: `${title} Distribution`
                    },
                    legend: {
                        display: false
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: unit ? `Improvement (${unit})` : 'Value'
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Frequency'
                        }
                    }
                }
            }
        });
    }

    createQQPlotChart(canvasId, qqData, metricName) {
        const ctx = document.getElementById(canvasId).getContext('2d');

        // Extract x and y values for plotting
        const xyData = qqData.map(point => ({
            x: point.x,
            y: point.y
        }));

        // Calculate reference line (y = x) data points
        const xValues = qqData.map(point => point.x);
        const minX = Math.min(...xValues);
        const maxX = Math.max(...xValues);
        const referenceLineData = [
            { x: minX, y: minX },
            { x: maxX, y: maxX }
        ];

        new Chart(ctx, {
            type: 'scatter',
            data: {
                datasets: [
                    {
                        label: 'Sample vs Theoretical Quantiles',
                        data: xyData,
                        backgroundColor: 'rgba(52, 152, 219, 0.6)',
                        borderColor: 'rgba(52, 152, 219, 1)',
                        pointRadius: 3,
                        showLine: false
                    },
                    {
                        label: 'Reference Line (y = x)',
                        data: referenceLineData,
                        backgroundColor: 'rgba(231, 76, 60, 0.8)',
                        borderColor: 'rgba(231, 76, 60, 1)',
                        borderWidth: 2,
                        pointRadius: 0,
                        showLine: true,
                        fill: false,
                        type: 'line'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: `Q-Q Plot: Testing Normality of ${metricName} Values`
                    },
                    legend: {
                        display: true
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Theoretical Quantiles (Standard Normal)'
                        },
                        type: 'linear'
                    },
                    y: {
                        title: {
                            display: true,
                            text: `Sample Quantiles (${metricName})`
                        },
                        type: 'linear'
                    }
                }
            }
        });
    }
} 