class Case {
    constructor(_solution) {
        this.solution = _solution;
        this.automata = [];
        this.allDots = [];
    }

    createAutomata() {
        for (let i = 0; i < this.solution.shapes.length; i++) {
            let automaton = new Automaton(this.solution.layout, this.solution.shapes[i]);
            automaton.plantSeed();
            this.automata.push(automaton);
        }
    }

    growAutomata() {
        // grow shelves in the right and up directions
        for (let i = 0; i < this.automata.length; i++) {
            let automaton = this.automata[i];
            while (automaton.grow() != false) { }
        }

        for (let i = 0; i < this.automata.length; i++) {
            // loop through every automaton, grabbing its dots array
            // combine all dots arrays into one array
            let automaton = this.automata[i];
            let dots = automaton.dots;
            this.allDots.push(...dots);
        }

        // grow shelves in the left direction
        for (let i = 0; i < this.automata.length; i++) {
            // loop through all automaton, check the first dot and grow in the left direction
            // stop when the next dot would be out of bounds
            // also when a dot is already present in the next position
            let automaton = this.automata[i];

            let growing = true;
            while (growing) {
                let currX = automaton.dots[0].x;
                let currY = automaton.dots[0].y;
                let newDot = {
                    x: currX - 1,
                    y: currY
                };

                // don't grow if the dot will be out of bounds
                if (currX <= 0) {
                    growing = false;
                    continue; // stop here
                }

                // check if the dot will be added to an already occupied spot (intersection)
                let isOccupied = this.allDots.some(dot => JSON.stringify(dot) === JSON.stringify(newDot));

                // add dot to automaton and allDots array
                automaton.dots.unshift(newDot);
                this.allDots.push(newDot);

                if (isOccupied) {
                    growing = false;
                    continue; // stop here
                }
            }
        }
    }

    showResult() {
        for (let i = 0; i < this.automata.length; i++) {
            let chooseColor = color(random(255), random(255), random(255));
            let automaton = this.automata[i];
            automaton.showResult(chooseColor);
        }
    }
}