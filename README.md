# todo

## Software Test (Thursday, 4/18): Advanced UI Features

### Import and Export

- **turn on input objects**
- **export and import solution**
- save objects for future use

### Generation

#### Automata

- **dots along border first**
- **terminate when hitting an existing line (save to allDots each automaton's dots)**
- **merge parallel lines**
  - when using this.addDot, ask "is this new dot that was just added 1 away from an existing dot?"
  - Solution Method 1: if it is, add that neighboring dot to the automaton dots array as well, return false
  - Solution Method 2: if that is to simple and doesn't work, we can look for "running parallel", ie next to a dot 2 in a row, etc"
- sometimes objects bisected
- unnecessary turns
- shelf merge

#### Annealing

- steadily raise temperature if can't solve
- center of mass: another scoring mechanism
- score for clusters of numbers, not just 8s
- random 1/6th option is move a shape to a new random position?
- score on "spread out-ness" so it tends to move towards each other rather than away?
  - weight heavier when temp is high
- grid-based, non-rectangular perimeters
  - doesn't change in size (v1)

### UI Design

- **expand canvas for entire UI**
- **turn off numbers**
- **grid paper colors**
- select from list of objects
- overall design
- buttons
  - reanneal
  - **import solution**
  - **export solution**
  - export SVG of grid

### README

- outcast objects, but important!
- thought process of collecting objects, exploring combinations
- make 30 cases digital designs
- top 5, render in location

## Fabrication Test (Thursday, 4/25): Fabrication Features

- detect joints (L, X, T)
- export to SVG

## Early Summer Stretch Features

- organic shaped perimeters
  - how to create? in p5? or in a library?
- perimeters that scale
- freeze shapes in layout
- add option for empty spaces to fill later
- hang on wall (center of gravity is ignored) vs flat on table (requires flat bottoms)

## Runtime Notes

- example boolean (sketch.js)
- show boards boolean (Case.js)
- example coords (Solution.js)
