class Anneal {
    constructor(_shapes, _devMode = false, _aspectRatioPref = 0) {
        //== anneal strategy variables
        // annealing strategy:
        // 1. multi-start: several initial anneals run concurrently, then pick the best to refine
        // 2. adaptive cooling: if improving rapidly, cool faster. if stuck, heat up
        // default values
        this.numStarts = 10; // number of multi-starts
        this.maxIterations = 1000; // max iterations per each anneal
        this.reheatCounter = 100; // max failed to improve iterations before reheating
        this.initialTemp = 10000;
        this.minTemp = 0.1; // temperature to stop annealing at
        this.initialCoolingRate = 0.95; // initial cooling rate (higher = cools slower. range: 0-1)
        this.reheatingBoost = 1.6; // temperature increases ratio when stuck (higher = more reheat. range: 1-2)
        this.displayInterval = 10; // how often to update the display with a new solution

        //== configuration
        this.devMode = _devMode; // enable debug logging
        this.aspectRatioPref = _aspectRatioPref; // aspect ratio preference

        //== state variables
        this.shapes = _shapes;
        this.multiStartSolutions = []; // step 1 (initial anneal promises)
        this.multiStartsHistory = {};
        this.solutionHistory = []; // stores final solution history (...multi-starts, refinement)
        this.finalSolution = null;
        this.stopAnneal = false;
        this.restartAnneal = false;
    }

    async run(progressCallback = null) {
        // == Start Annealing Process == //
        // - multi-start phase: run several quick anneals concurrently, then pick the best
        // - refinement phase: long anneal the best solution to improve it further
        let bestStartSolution = await this.multiStartPhase(progressCallback);
        if (this.stopAnneal && !bestStartSolution) return; // re-anneal clicked

        let refinedSolution = await this.refinePhase(bestStartSolution, progressCallback);
        if (this.stopAnneal && !refinedSolution) return; // re-anneal clicked

        // == Annealing Complete == //
        // anneal completed with out being stopped
        this.finalSolution = refinedSolution;

        if (this.devMode) {
            console.log("Refine complete. Score:", this.finalSolution.score);
        }

        // update final solution history with it's initial start history
        let winningStartHistory = [...this.multiStartsHistory[bestStartSolution.startID]];
        this.solutionHistory = [...winningStartHistory, ...this.solutionHistory];
        this.multiStartsHistory = {}; // clear the multi-start history
    }

    async multiStartPhase(progressCallback = null) {
        //  multi-start phase
        // - run several quick anneals concurrently, return best one to refine
        this.multiStartSolutions = [];
        for (let startID = 0; startID < this.numStarts; startID++) {
            // -- configure the annealing process for multi-starts -- //
            // give each start lower initial temperature and faster cooling
            const multiConfig = {
                multiStart: true,
                initialTemp: this.initialTemp * (1 - (startID / this.numStarts)),
                initialCoolingRate: this.initialCoolingRate * 0.75,
                progressCallback: progressCallback
            };

            // create new solution with random layout.
            let initialSolution = new Solution(this.shapes, startID, this.aspectRatioPref);
            initialSolution.randomLayout();

            // start concurrent anneals (pass which iteration number for multi-start)
            this.multiStartSolutions.push(this.anneal(initialSolution, multiConfig));
        }
        // wait for all multi-starts to complete (anneal concurrently)
        let results = await Promise.all(this.multiStartSolutions);

        if (this.stopAnneal) return null; // re-anneal clicked

        // find the best solution from all multi-starts
        let bestStartSolution = results.reduce((best, current) => current.score < best.score ? current : best);
        if (this.devMode) {
            console.log("Multi-start results: ", results.map(s => s.score).join(', '));
            console.log("Best solution:", bestStartSolution.score);
        }

        return bestStartSolution;
    }

    async refinePhase(_bestStartSolution, progressCallback = null) {
        // == refinement phase == //
        // -- configure the annealing process for refinement -- //
        const refineConfig = {
            initialTemp: this.initialTemp * 0.1, // lower starting temp for refinement
            initialCoolingRate: 0.99, // slower cooling
            progressCallback: progressCallback
        };

        let bestSolution = await this.anneal(_bestStartSolution, refineConfig);
        if (this.stopAnneal) return null; // re-anneal clicked


        // if solution is not valid (overlapping or floating shapes), continue to refine
        while (bestSolution.valid == false) {
            // stop refining if re-anneal button clicked

            const refineConfig = {
                initialTemp: this.initialTemp / (this.numStarts), // lower starting temp for refinement
                initialCoolingRate: 0.99, // slower cooling
                progressCallback: progressCallback
            };
            if (this.devMode) console.log("additional refining...");

            bestSolution = await this.anneal(bestSolution, refineConfig);
            if (this.stopAnneal) return null; // re-anneal clicked
        }

        return bestSolution;
    }

    async anneal(_initialSolution, _config = {}) {
        // set default config values
        const config = {
            multiStart: false,
            initialTemp: this.initialTemp,
            initialCoolingRate: this.initialCoolingRate,
            maxIterations: this.maxIterations,
            reheatCounter: this.reheatCounter,
            progressCallback: null,
            ..._config // override defaults with any provided values
        };
        let temperature = config.initialTemp;
        let coolingRate = config.initialCoolingRate;
        let maxIterations = config.maxIterations;
        // console.log("cooling:", coolingRate, "initTemp: ", config.initialTemp, "max:", maxIterations, "reheat count:", config.reheatCounter);

        // initialize the annealing process with the given solution and parameters
        let currentSolution = _initialSolution;
        let bestSolution = _initialSolution;
        this.saveSolutionHistory(bestSolution, config.multiStart);

        let iterationsSinceImprovement = 0;
        const coolingRateAdjustment = 0.01; // small adjustment to cooling rate on improvement

        // main annealing loop
        let totalIterations = 0;
        for (let iteration = 0; iteration < maxIterations; iteration++) {
            // if re-anneal button clicked, stop anneal so run() can restart outside of this function
            if (this.stopAnneal) return null;

            // generate a neighboring solution
            let movementRange = this.calcMovementRange(temperature, config.initialTemp);
            let neighbor = currentSolution.createNeighbor(movementRange);

            // calculate the energy difference between current and neighbor solutions
            let energyDelta = neighbor.score - currentSolution.score;

            // decide to accept the new solution or not
            if (this.acceptSolution(energyDelta, temperature)) {
                currentSolution = neighbor;

                if (currentSolution.score < bestSolution.score) {
                    // better solution found, save
                    bestSolution = currentSolution;
                    iterationsSinceImprovement = 0;

                    // adaptive cooling: slightly increase cooling rate when a better solution is found
                    // - increasing cooling rate slows down temperature decrease, causing more exploration
                    // - Math.min() ensures coolingRate doesn't exceed 1
                    coolingRate = Math.min(coolingRate + coolingRateAdjustment, 0.99);
                }
            }

            iterationsSinceImprovement++;

            // cool down the temperature
            temperature *= coolingRate;

            if (iterationsSinceImprovement > config.reheatCounter) {
                if (this.devMode) console.log("Reheating...");
                // adaptive cooling: if stuck, reheat the system
                // - increasing the temperature causes more exploration, helping to escape a local minima
                // increase temperature, but don't exceed initial temp
                temperature = Math.min(temperature * this.reheatingBoost, config.initialTemp);
                // reset cooling rate and counter
                coolingRate = config.initialCoolingRate;
                iterationsSinceImprovement = 0;
            }

            // update display at specified intervals
            if (iteration % this.displayInterval === 0) {
                this.saveSolutionHistory(currentSolution, config.multiStart);
                // only show the first (longest running) multi-start, then all refinements
                if ((!config.multiStart) || (config.multiStart && currentSolution.startID === 0)) {
                    // send solution to web worker progress callback
                    if (config.progressCallback) {
                        config.progressCallback(currentSolution);
                    }
                }
            }

            // stop early if the temperature drops below the minimum 
            if (temperature < this.minTemp) break;

            // add a small delay to prevent blocking the main thread
            await new Promise(resolve => setTimeout(resolve, 0));
            totalIterations++;
        }

        if (this.devMode) {
            console.log("iterations completed:", Math.round((totalIterations / maxIterations) * 10000) / 100, "%");
        }

        // return the best solution found during this annealing process
        return bestSolution;
    }

    acceptSolution(energyDelta, temperature) {
        // used to evaluate neighbor solution versus current solution
        // returns true if the new solution should be accepted, false if not
        // - always accept better solutions
        // - sometimes accept worse solutions (to escape local minima)
        // - more likely to accept worse solutions when temperature is higher or the decrease is smaller
        if (energyDelta < 0) {
            return true; // always accept better solutions
        }
        return Math.exp(-energyDelta / temperature) > Math.random(); // sometimes accept worse solutions
    }

    calcMovementRange(currentTemp, initialTemp) {
        // how far a shape can move based on the current temperature
        // - higher temperature allows more max movement
        // - lower temperature allows less max movement
        const maxRange = 5;
        const minRange = 1;
        const normalizedTemp = (currentTemp - this.minTemp) / (initialTemp - this.minTemp);
        return Math.floor(normalizedTemp * (maxRange - minRange) + minRange);
    }

    saveSolutionHistory(_bestSolution, _multiStart) {
        // only save the necessary data for the solution history
        let solutionData = _bestSolution.toDataObject();

        if (_multiStart) {
            if (!this.multiStartsHistory[_bestSolution.startID]) {
                this.multiStartsHistory[_bestSolution.startID] = [];
            }
            this.multiStartsHistory[_bestSolution.startID].push(solutionData);
        }
        else {
            this.solutionHistory.push(solutionData);
        }
    }

    // handler for button that controls restart
    reAnneal() {
        // console.log("restart clicked");
        // stop flag noticed by async anneals, which terminate
        this.stopAnneal = true;
        // restart flag noticed by handleStartAnneal(), which calls new anneal
        this.restartAnneal = true;
    }

    endAnneal() {
        // console.log("clear (stop) clicked");
        // stop flag noticed by async anneals, which terminate
        this.stopAnneal = true;
    }
}

// Only export the class when in a Node.js environment (e.g., during Jest tests)
// Ignored when the app is running in the browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Anneal;
}