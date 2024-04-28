# todo

## This Week's Deliverables

- Sunday Morning
  - laser cutting boards
    - joint position
    - joint types
  - most basic UI improvements
    - diagnostic off
    - side bar: added shapes
    - toggle to generate layouts
    - export laser cut SVG button
  - continue 3D printing shapes
    - make a couple OOFs for laser cutting

### Import and Export

- **turn on input objects**
- **export and import solution**
- click a cell a second time to deselect it
- save objects for future use

### Generation

#### Automata

- when growing vertically, find the center of zero-scores like in case 1
- detect and fix "C" paths, ie when 3 walls on a cell (at least partially parallel with yourself)

#### Annealing

- **center of mass: another scoring mechanism**
  - add weight to Shape class
- score for clusters of numbers, not just 8s
- steadily raise temperature if can't solve
- random 1/6th option is move a shape to a new random position?
- score on "spread out-ness" so it tends to move towards each other rather than away, weight heavier when temp is high
- grid-based, non-rectangular perimeters
  - doesn't change in size (v1)

### UI Design

- **expand canvas for entire UI**
- toggles
  - **turn off numbers**
  - turn off boarders
  - all black boards, merged / segmented boards
- grid paper colors
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

- unnecessary turns
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