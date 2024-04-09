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

        // console.log('temp: ', this.tempCurr.toFixed(2));

        let delta = currScore - nextScore; // difference between scores
        // accept the new solution if it's better
        if (delta > 0) {
            this.currSolution = this.nextSolution;
        } else if (exp(delta / this.tempCurr) > Math.random(0, 1)) {
            // accept worse solutions with a probability that decreases as the temperature decreases
            this.currSolution = this.nextSolution;
        }

        if (this.tempCurr <= this.tempMin) {
            // re-anneal when final solution is greater than initial solution
            if (this.currSolution.score > 0) {
                // re-anneal at a lower maximum temperature
                this.tempCurr = this.lastTemp * 0.5;
                if (this.tempCurr < this.tempMin) {
                    this.tempCurr = this.tempMin * 1.2;
                }
                this.lastTemp = this.tempCurr;
                return true; // continue optimization
            } else {
                return false; // end condition met
            }
        } else {
            return true; // continue optimization
        }
    }

    // Function defining the cooling schedule
    coolingSchedule() {
        let coolingRate = 0.95;
        return this.tempCurr * coolingRate;
    }
}