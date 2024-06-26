# todo

## This Week's Deliverables

- Sunday Morning
  - laser cutting boards
    - joint position
    - joint types


  - most basic UI improvements
    - diagnostic off
    - side bar: added shapes
      - change ShapeInput to class that manages all shapes
      - create Shape data objects with shape positions
    - toggle to generate layouts
    - export laser cut SVG button
  - continue 3D printing shapes
    - make a couple OOFs for laser cutting

### Import and Export

- **turn on input objects**
- **export and import solution**
- click a input square a second time to deselect it
- save objects for future use

### Generation

#### Automata

- when growing vertically, find the center of zero-scores like in case 1
- detect and fix "C" paths, ie when 3 walls in a square (at least partially parallel with yourself)

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

## Cellular Automata Rules

- Precalculate all path scores, store in an array

Cells have 3 options for growth: Left, Up, or Right

Setup Phase:

- Start with left, up, and right set to True
- Cell retrieve score of path for left, up, and right

Step 1: Merge and Die Rules

- If two alive cells meet, they merge
- If two alive cells pass by each other, they merge
- If an alive cell meets a dead cell, it dies (crowded)

Step 2: Eliminate Options

- Can't backtrack
- Can't grow through a shape
- Can't go out of bounds

Step 3: Choose a Remaining Direction

- if only one option remains, take it
- A cell is attracted to a dead cell of a different strain (prevents parallel paths)
- Cells like easy paths (low values)
- Cells avoid change (growing in new directions)
- If still multiple valid options, log error and die

Notes:

- grow till no alive cells
- see other dead cells like low paths in opp scoring
- set out of bounds to mirror terrain level / path score next to it, not just 1
