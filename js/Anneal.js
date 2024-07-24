class Anneal {
    constructor(_updateDisplayCallback, _ui) {
        this.updateDisplayCallback = _updateDisplayCallback;
        this.ui = _ui; // ui manager
        this.bestSolution = null;
        this.bestScore = Infinity;
        this.multiStartSolutions = []; // stores running async anneals
        this.refinedSolution = null; // stores running async anneals
        this.abortAnnealing = false;
        // bind reanneal function to reanneal button
        this.ui.html.regenButton.mousePressed(() => this.reAnneal());

        // annealing uses these strategies:
        // 1. multi-start: several initial anneals run concurrently, then pick the best to refine
        // 2. adaptive cooling: if improving rapidly, cool faster. if stuck, heat up
        // annealing default values
        this.numStarts = 10; // number of multi-starts
        this.maxIterations = 1000; // max iterations per each anneal
        this.reheatCounter = 100; // max failed to improve iterations before reheating
        this.initialTemp = 10000;
        this.minTemp = 0.1; // temperature to stop annealing at
        this.initialCoolingRate = 0.95; // initial cooling rate (higher = cools slower. range: 0-1)
        this.reheatingBoost = 1.6; // temperature increases ratio when stuck (higher = more reheat. range: 1-2)
        this.displayInterval = 50; // how often to update the display with a new solution
    }

    async run() {
        // run the annealing process
        // - multi-start phase: run several quick anneals concurrently, then pick the best
        // - refinement phase: long anneal the best solution to improve it further
        this.abortAnnealing = false;

        // == multi-start phase == //
        this.multiStartSolutions = [];
        this.refinedSolution = null;
        for (let start = 0; start < this.numStarts; start++) {
            // -- configure the annealing process for multi-starts -- //
            // give each start lower initial temperature and faster cooling
            let multiConfig = {
                initialTemp: this.initialTemp * (1 - start / this.numStarts),
                initialCoolingRate: this.initialCoolingRate * 0.75
            };

            // create new solution with random layout. shallow copy allows unique positions for the same shapes
            let initialSolution = new Solution(shapesPos.map(shape => ({ ...shape })));
            initialSolution.randomLayout()
            // start concurrent anneals
            this.multiStartSolutions.push(this.anneal(initialSolution, multiConfig));
        }

        // wait for all multi-starts to complete (anneal concurrently)
        const results = await Promise.all(this.multiStartSolutions);
        if (this.abortAnnealing) {
            return await annealing.run();
        }

        // find the best solution from all multi-starts
        let bestStartSolution = results.reduce((best, current) => current.score < best.score ? current : best);
        if (devMode) {
            console.log("Multi-start results: ", results.map(s => s.score).join(', '));
            console.log("Best solution:", bestStartSolution.score);
        }

        // == refinement phase == //
        // -- configure the annealing process for refinement -- //
        let refineConfig = {
            initialTemp: this.initialTemp * 0.1, // lower starting temp for refinement
            initialCoolingRate: 0.99, // slower cooling
        }

        this.refinedSolution = await this.anneal(bestStartSolution, refineConfig);
        if (this.abortAnnealing) {
            return await annealing.run();
        }
        if (devMode) console.log("Refine complete. Score:", this.refinedSolution.score);

        // if solution is not valid (overlapping or floating shapes), continue to refine
        while (this.refinedSolution.valid == false) {
            if (devMode) console.log("additional refining...")
            let refineConfig = {
                initialTemp: this.initialTemp / (this.numStarts), // lower starting temp for refinement
                initialCoolingRate: 0.99, // slower cooling
            }
            this.refinedSolution = await this.anneal(bestStartSolution, refineConfig);
            if (this.abortAnnealing) {
                return await annealing.run();
            }
        }

        return this.refinedSolution;
    }

    async anneal(_initialSolution, _config = {}) {
        // set default config values
        let config = {
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

        let iterationsSinceImprovement = 0;
        const coolingRateAdjustment = 0.01; // small adjustment to cooling rate on improvement

        // main annealing loop
        let totalIterations = 0;
        for (let iteration = 0; iteration < maxIterations; iteration++) {
            if (this.abortAnnealing) { return null; }
            // generate a neighboring solution
            const movementRange = this.calcMovementRange(temperature, config.initialTemp);
            const neighbor = currentSolution.createNeighbor(movementRange);

            // calculate the energy difference between current and neighbor solutions
            const energyDelta = neighbor.score - currentSolution.score;

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
                if (devMode ) console.log("Reheating...");
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
                this.updateDisplayCallback(currentSolution, iteration, temperature);
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

    // handler for button that controls restart
    async reAnneal() {
        console.log("abort clicked")
        // set abort flag for anneal()
        this.abortAnnealing = true;
        // run() waits for async jobs to cancel then restarts
    }
}
