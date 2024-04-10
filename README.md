# todo

## Demo (Wednesday, 4/10): Full Slice

- improving dots, grow algorithm
- console.log solution
- steadily raise temperature if can't solve

## Demo Notes

- example boolean (sketch.js)
- show boards boolean (Case.js)
- example coords (Solution.js)

## Software Test (Thursday, 4/18): Advanced UI Features

- seed at each shape, one left and one right
- object input
- re-anneal button
- export button to JSON
- terminate when hitting an existing line (save to allDots each automaton's dots)

- outcast objects, but important!
- thought process of collecting objects, exploring combinations
- make 30 cases digital designs
- top 5, render in location
  
- UI improvements
- center of mass: another scoring mechanism
- load JSON
  - check solution.txt for bugs
- select from list of objects
- is counting 8's encouraging narrow solutions? (optional)
  - less cells added when growing narrow
- random 1/6th option is move a shape to a new random position?
- score on "spread out-ness" so it tends to move towards each other rather than away?
  - weight heavier when temp is high
- grid-based, non-rectangular perimeters
  - doesn't change in size (v1)

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