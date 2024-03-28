class SimulatedAnnealing {
    constructor(tempMax, tempMin, initSolution) {
        this.tempMax = tempMax;  // maximum system temperature
        this.tempMin = tempMin; // minimum system temperature

        this.tempCurr = tempMax; // current system temperature
        this.currSolution = initSolution; // initial solution
        this.nextSolution = null; // next solution
    }

    epoch() {
        // returns next solution or stops the optimization

        this.currSolution.makeLayout(); // generate the layout of the current solution
        this.currSolution.calcScore(); // current score (energy) of the system
        let currScore = this.currSolution.score;

        this.nextSolution = this.currSolution.makeNeighbor(this.tempCurr, this.tempMax, this.tempMin); // generate the next (neighbor) solution
        this.nextSolution.makeLayout(); // generate the layout of the next solution
        this.nextSolution.calcScore(); // next score (energy) of the system
        let nextScore = this.nextSolution.score; // next score

        let delta = currScore - nextScore; // difference between scores

        // don't let solutions with overlap or to much empty space fully cool
        if ( this.tempCurr <= this.tempMin) {
            if (this.nextSolution.overlappingCells > 0 || this.nextSolution.emptyCells > this.nextSolution.minEmptyCells) {
                this.tempCurr = this.tempMin * 1.2;
            }
        }

        // accept the new solution if it's better
        if (delta > 0) {
            // if there's overlap between shapes, then increase the temperature of the system
            this.currSolution = this.nextSolution;

        } else if (exp(delta / this.tempCurr) > Math.random(0, 1)) {
            this.currSolution = this.nextSolution;
        }

        // console.log('temp: ', this.tempCurr);

        if (this.tempCurr <= this.tempMin) {
            return false; // end condition met
        }
        return true; // continue optimization
    }

    // Function defining the cooling schedule
    coolingSchedule() {
        let coolingRate = 0.95;
        return this.tempCurr * coolingRate;
    }
}