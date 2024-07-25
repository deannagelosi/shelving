class Anneal {
    constructor(_shapes, _ui) {
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

        //== ui
        this.ui = _ui;

        this.saveButton = this.ui.html.saveButton;
        this.saveButton.attribute('disabled', ''); // until 2 shapes are saved
        this.saveButton.removeAttribute('disabled'); // until 2 shapes are saved
        this.statusTest = this.ui.html.statusText;

        //== state variables
        this.shapes = _shapes;
        this.multiStartSolutions = []; // step 1 (initial anneal promises)
        this.multiStartsHistory = {};
        this.solutionHistory = []; // stores final solution history (...multi-starts, refinement)
        this.finalSolution = null;
        this.abortAnnealing = false;
    }

    async run() {
        // reset state in case it's a re-run (re-anneal clicked)
        this.multiStartsHistory = {};
        this.solutionHistory = []; // stores final solution history (...multi-starts, refinement)
        this.finalSolution = null;
        this.abortAnnealing = false;

        // while anneal is running reset button to "regenerate" mode
        this.ui.html.annealButton.html('Regenerate');
        this.ui.html.annealButton.mousePressed(() => this.reAnneal());

        // run the annealing process
        // - multi-start phase: run several quick anneals concurrently, then pick the best
        // - refinement phase: long anneal the best solution to improve it further
        let bestStartSolution = await this.multiStartPhase();

        console.log("Multi best solution:", bestStartSolution);

        // save annealing history so far
        // - set bestStart's solution history as start of the final solution history
        this.solutionHistory = [...this.multiStartsHistory[bestStartSolution.startID]];
        this.multiStartsHistory = {}; // clear the multi-start history

        let refinedSolution = await this.refinePhase(bestStartSolution);

        if (this.abortAnnealing) {
            // re-anneal was clicked, previous anneal was aborted
            // restart the anneal process
            this.run();
        }

        this.finalSolution = refinedSolution;

        // if (devMode) 
        console.log("refine solution:", refinedSolution);
        console.log("Refine complete. Score:", this.finalSolution.score);
    }

    async multiStartPhase() {
        //  multi-start phase
        // - run several quick anneals concurrently, return best one to refine
        this.multiStartSolutions = [];
        for (let startID = 0; startID < this.numStarts; startID++) {
            // -- configure the annealing process for multi-starts -- //
            // give each start lower initial temperature and faster cooling
            const multiConfig = {
                multiStart: true,
                initialTemp: this.initialTemp * (1 - startID / this.numStarts),
                initialCoolingRate: this.initialCoolingRate * 0.75
            };

            // create new solution with random layout.
            let initialSolution = new Solution(this.shapes);
            initialSolution.randomLayout();
            initialSolution.startID = startID;

            // start concurrent anneals (pass which iteration number for multi-start)
            this.multiStartSolutions.push(this.anneal(initialSolution, multiConfig));
        }
        // wait for all multi-starts to complete (anneal concurrently)
        let results = await Promise.all(this.multiStartSolutions);

        if (this.abortAnnealing) return null; // re-anneal clicked

        // find the best solution from all multi-starts
        let bestStartSolution = results.reduce((best, current) => current.score < best.score ? current : best);
        console.log("Best start solution: ", bestStartSolution.startID, bestStartSolution);
        if (devMode) {
            console.log("Multi-start results: ", results.map(s => s.score).join(', '));
            console.log("Best solution:", bestStartSolution.score);
        }

        return bestStartSolution;
    }

    async refinePhase(_bestStartSolution) {
        // == refinement phase == //
        // -- configure the annealing process for refinement -- //
        const refineConfig = {
            initialTemp: this.initialTemp * 0.1, // lower starting temp for refinement
            initialCoolingRate: 0.99, // slower cooling
        }

        let bestSolution = await this.anneal(_bestStartSolution, refineConfig);
        if (this.abortAnnealing) return null // re-anneal clicked


        // if solution is not valid (overlapping or floating shapes), continue to refine
        while (bestSolution.valid == false) {
            // stop refining if re-anneal button clicked

            const refineConfig = {
                initialTemp: this.initialTemp / (this.numStarts), // lower starting temp for refinement
                initialCoolingRate: 0.99, // slower cooling
            }
            if (devMode) console.log("additional refining...")

            bestSolution = await this.anneal(bestSolution, refineConfig);
            if (this.abortAnnealing) return null // re-anneal clicked
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
            ..._config // override defaults with any provided values
        }
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
            if (this.abortAnnealing) return null;

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
                    this.saveSolutionHistory(bestSolution, config.multiStart);
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
                if (devMode) console.log("Reheating...");
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
                // only show the first (longest running) multi-start, then all refinements
                if ((!config.multiStart) || (config.multiStart && config.startID === 0)) {
                    this.ui.updateDisplayCallback(currentSolution);
                }
            }

            // stop early if the temperature drops below the minimum 
            if (temperature < this.minTemp) break;

            // add a small delay to prevent blocking the main thread
            await new Promise(resolve => setTimeout(resolve, 0));
            totalIterations++;
        }

        if (devMode) {
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
        // save the best solution to the solution history  
        if (_multiStart) {
            if (!this.multiStartsHistory[_bestSolution.startID]) {
                this.multiStartsHistory[_bestSolution.startID] = [];
            }
            this.multiStartsHistory[_bestSolution.startID].push(_bestSolution);
        }
        else {
            this.solutionHistory.push(_bestSolution);
        }
    }

    // handler for button that controls restart
    async reAnneal() {
        console.log("abort clicked")
        // set abort flag for anneal()
        this.abortAnnealing = true;
        // run() waits for async jobs to cancel then restarts
    }
}
