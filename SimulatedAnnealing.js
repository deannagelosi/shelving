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
        
        this.nextSolution = this.currSolution.makeNeighbor(); // generate the next (neighbor) solution
        this.nextSolution.makeLayout(); // generate the layout of the next solution
        this.nextSolution.calcScore(); // next score (energy) of the system
        let nextScore = this.nextSolution.score; // next score
        
        let delta = currScore - nextScore; // difference between scores
        console.log('delta: ', delta, 'currScore: ', currScore, 'nextScore: ', nextScore);

        // accept the new solution if it's better
        // if (delta > 0 || exp(delta / this.tempCurr) > Math.random(0, 1)) {
        // todo: test the exp part works
        if (delta > 0) {
            this.currSolution = this.nextSolution;
        }

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