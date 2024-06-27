class Anneal {
    // constructor(tempMax, tempMin, initSolution) {

    // this.tempMax = tempMax;  // maximum system temperature
    // this.tempMin = tempMin; // minimum system temperature

    // this.tempCurr = tempMax; // current system temperature     
    // this.lastTemp = tempMax; // last system temperature
    // this.currSolution = initSolution; // initial solution
    // this.nextSolution = null; // next solution

    // this.annealCounter = 0;
    // this.scoreThresholdMod = 0;
    // }
    constructor(_updateDisplayCallback, options = {}) {
        // Annealing uses these strategies:
        // 1. Multi-start: several initial anneals, then pick the best to refine again
        // 2. Adaptive cooling: if improving rapidly, cool faster. If stuck, heat up

        this.options = {
            numInitialStarts: 5, // number of multi-starts
            maxIterations: 1000, // max iterations per each anneal (example 10,000)
            initialTemp: 5000,
            minTemp: 0.1, // temperature to stop annealing at
            initialCoolingRate: 0.95, // initial cooling rate (higher = cools slower. range: 0-1)
            reheatingBoost: 1.5, // temperature increases ratio when stuck (higher = more reheat. range: 1-2)
            useExampleSolution: false, // use the example solution or anneal a new one
            displayInterval: 10, // how often to update the display with a new solution
            ...options // spread operator (...) overrides default keys with any user-provided options
        };

        this.updateDisplayCallback = _updateDisplayCallback
    }

    run() {
        // runs the multi-step annealing process

        if (useExampleSolution) {
            // load the example solution and don't anneal
            let initialSolution = new Solution(shapesPos);
            initialSolution.exampleSolution();

            return initialSolution;
        } else {
            // use random initial layout and anneal a solution

            // 1. Multi-start phase - create several quick anneals to find the best starting point
            let bestStartSolution = null;
            let bestScore = Infinity;

            for (let start = 0; start < this.options.numInitialStarts; start++) {
                console.log("start: ", start);
                // generate a random initial solution with a shallow copy of the shapes
                // - shallow copy creates new position data, but same keeps same original shape data
                const initialSolution = new Solution(shapesPos.map(shape => ({ ...shape })));
                initialSolution.randomLayout();

                // give each start a different initial temperature (lower with each loop)
                const initialTemp = this.options.initialTemp * (1 - start / this.options.numInitialStarts);
                // set a faster cooling rate than normal (lower value = faster cooling) for quick starts
                const initialCoolingRate = this.options.initialCoolingRate / 2;
                // anneal an initial solution
                const startSolution = this.anneal(initialSolution, initialTemp, initialCoolingRate);
                // find the best initial solution
                if (startSolution.score < bestScore) {
                    bestStartSolution = startSolution;
                    bestScore = startSolution.score;
                }
            }

            // 2. Refine phase - full anneal run with the best start solution
            console.log("bestStartSolution: ", bestStartSolution);
            console.log("refine phase");
            // // set a lower initial temp for smaller changes during refinement
            // const initialTemp = this.options.initialTemp * 0.1;
            let finalSolution = this.anneal(bestStartSolution, this.options.initialTemp, this.options.initialCoolingRate);
            return finalSolution;
        }

    }

    anneal(initialSolution, startTemp, initialCoolingRate) {
        // Initialize the annealing process with the given solution and parameters
        let currentSolution = initialSolution;
        let bestSolution = initialSolution;
        let temperature = startTemp;
        let coolingRate = initialCoolingRate;
        let iterationsSinceImprovement = 0;
        const maxIterationsWithoutImprovement = 100; // Threshold for reheating
        const coolingRateAdjustment = 0.01; // Small adjustment to cooling rate on improvement

        // Main annealing loop
        for (let i = 0; i < this.options.maxIterations; i++) {
            // Generate a neighboring solution
            const movementRange = this.calcMovementRange(temperature);
            const neighbor = currentSolution.createNeighbor(movementRange);
            // makeNeighbor(_tempCurr, _tempMax, _t1empMin)

            // Calculate the energy difference between current and neighbor solutions
            const energyDelta = neighbor.score - currentSolution.score;

            // Decide to accept the new solution or not
            if (this.acceptSolution(energyDelta, temperature)) {
                currentSolution = neighbor;

                if (currentSolution.score < bestSolution.score) {
                    // better solution found, save
                    bestSolution = currentSolution;
                    iterationsSinceImprovement = 0;

                    // adaptive cooling: sightly increase cooling rate when a better solution is found.
                    // - increasing cooling rate slows down temperature decrease, causing more exploration
                    // - Math.min() ensures coolingRate doesn't exceed 0.99, the maximum (slowest) value
                    coolingRate = Math.min(coolingRate + coolingRateAdjustment, 0.99);
                }
            }

            iterationsSinceImprovement++;

            // Cool down the temperature
            temperature *= coolingRate;

            if (iterationsSinceImprovement > maxIterationsWithoutImprovement) {
                // adaptive cooling: if stuck, reheat the system
                // - increasing the temperature causes more exploration, helping to escape a local minima
                temperature *= this.options.reheatingBoost; // Increase temperature
                // reset cooling rate and counter
                coolingRate = initialCoolingRate;
                iterationsSinceImprovement = 0;
            }

            // update display at specified intervals
            if (i % this.options.displayInterval === 0) {
                this.updateDisplayCallback(currentSolution, i, temperature);
            }

            // stop early if the temperature drops below the minimum 
            if (temperature < this.options.minTemp) { break; }
        }

        // return the best solution found during the annealing process
        return bestSolution;
    }

    acceptSolution(energyDelta, temperature) {
        // returns true if the new solution should be accepted, false if not
        // - always accept better solutions
        // - sometimes accept worse solutions (to escape local minima)
        // - more likely to accept worse solutions when temperature is higher or the decrease is smaller
        if (energyDelta < 0) {
            return true; // always accept better solutions
        }
        return Math.exp(-energyDelta / temperature) > Math.random(); // sometimes accept worse solutions
    }

    calcMovementRange(temp) {
        // how far a shape can move based on the current temperature
        // - higher temperature allows more max movement
        // - lower temperature allows less max movement
        const maxRange = 10;
        const minRange = 1;
        const normalizedTemp = (temp - this.options.minTemp) / (this.options.initialTemp - this.options.minTemp);
        return Math.floor(normalizedTemp * (maxRange - minRange) + minRange);
    }


    // epoch() {
    //     // returns next solution or stops the optimization
    //     if (this.annealCounter > 150) {
    //         this.tempCurr = this.tempMax;
    //         this.scoreThresholdMod += 0.01;
    //         this.annealCounter = 0;
    //     }

    //     this.currSolution.eightThreshold += this.scoreThresholdMod;
    //     this.currSolution.makeLayout(); // generate the layout of the current solution
    //     this.currSolution.calcScore(); // current score (energy) of the system
    //     let currScore = this.currSolution.score;

    //     this.nextSolution = this.currSolution.makeNeighbor(this.tempCurr, this.tempMax, this.tempMin); // generate the next (neighbor) solution
    //     this.nextSolution.eightThreshold += this.scoreThresholdMod;
    //     this.nextSolution.makeLayout(); // generate the layout of the next solution
    //     this.nextSolution.calcScore(); // next score (energy) of the system
    //     let nextScore = this.nextSolution.score; // next score

    //     // console.log('temp: ', this.tempCurr.toFixed(2));

    //     let delta = currScore - nextScore; // difference between scores
    //     // accept the new solution if it's better
    //     if (delta > 0) {
    //         this.currSolution = this.nextSolution;
    //     } else if (exp(delta / this.tempCurr) > Math.random(0, 1)) {
    //         // accept worse solutions with a probability that decreases as the temp decreases
    //         this.currSolution = this.nextSolution;
    //     }

    //     if (this.tempCurr <= this.tempMin) {
    //         // re-anneal when final solution is greater than initial solution
    //         if (this.currSolution.score > 0) {
    //             // re-anneal at a lower maximum temperature
    //             this.annealCounter++;
    //             this.tempCurr = this.lastTemp * 0.5;
    //             if (this.tempCurr < this.tempMin) {
    //                 this.tempCurr = this.tempMin * 1.2;
    //             }
    //             this.lastTemp = this.tempCurr;
    //             return true; // continue optimization
    //         } else {
    //             return false; // end condition met
    //         }
    //     } else {
    //         return true; // continue optimization
    //     }
    // }

    // // Function defining the cooling schedule
    // coolingSchedule() {
    //     let coolingRate = 0.95;
    //     return this.tempCurr * coolingRate;
    // }
}