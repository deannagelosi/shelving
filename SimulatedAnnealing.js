class SimulatedAnnealing {
    constructor(tempMax, tempMin, initSolution) {
        this.tempMax = tempMax;  // maximum system temperature
        this.tempMin = tempMin; // minimum system temperature

        this.tempCurr = tempMax; // current system temperature     
        this.lastTemp = tempMax; // last system temperature   
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

        console.log('temp: ', this.tempCurr.toFixed(2), 'overlap: ', this.nextSolution.overlappingCells, 'num cells w/ score 8: ', this.nextSolution.numCells8);

        let delta = currScore - nextScore; // difference between scores
        // accept the new solution if it's better
        if (delta > 0) {
            this.currSolution = this.nextSolution;
        } else if (exp(delta / this.tempCurr) > Math.random(0, 1)) {
            // accept worse solutions with a probability that decreases as the temperature decreases
            this.currSolution = this.nextSolution;
        }

        // calculate the number of cells in the solution
        let numCells = 0;
        for (let i = 0; i < this.currSolution.layout.length; i++) {
            for (let j = 0; j < this.currSolution.layout[i].length; j++) {
                numCells++;
            }
        }
        // calculate a ratio of acceptable cells with a score of 8 to the total number of cells
        let numCells8Ratio = this.currSolution.numCells8 / numCells;

        if (this.tempCurr <= this.tempMin) {
            // re-anneal when final solution is greater than initial solution
            if (this.nextSolution.overlappingCells > 0 || numCells8Ratio > 0.05) {
                this.tempCurr = this.lastTemp * 0.75;
                this.lastTemp = this.tempCurr;
                return true; // continue optimization
            } else {
                return false; // end condition met
            }
        }
        return true; // continue optimization
    }

    // Function defining the cooling schedule
    coolingSchedule() {
        let coolingRate = 0.95;
        return this.tempCurr * coolingRate;
    }
}