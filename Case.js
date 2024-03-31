class Case {
    constructor(_solution) {
        this.solution = _solution;
        this.automata = [];
    }

    createAutomata() {
        for (let i = 0; i < this.solution.shapes.length; i++) {
            let automaton = new Automaton(this.solution.layout, this.solution.shapes[i]);
            automaton.plantSeed();
            this.automata.push(automaton);
        }
    }

    growAutomata() {
        for (let i = 0; i < this.automata.length; i++) {
            let automaton = this.automata[i];
            while (automaton.grow() != false) { }
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