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

Step 1: Die Rule (end condition for a strain)

- If there's a collision with another cell, both cells die

Setup Phase:

- Start with left, up, and right set to True
- Cell retrieve score of path for left, up, and right

Step 2: Eliminate Options

- Can't backtrack -
- Can't grow through a shape -
- Can't go out of bounds -

Step 3: Choose a Remaining Direction

- if only one option remains, take it -
- A cell is attracted to a dead cell of a different strain (prevents parallel paths)
  - One cell will move towards another
- Cells like easy paths (low values)
  - If there are two or more remaining paths, look ahead to the next intersection
    - Calculate the available path scores at that intersection
    - Return the lowest value
    - Calculate the cumulative score of the initial path and the lowest value path in the future
    - Compare the available combined path scores, and take the lowest path (gets out of local minimum)
- Cells are attracted to change
  - Growing in a new direction

Step 4: Divide to solve problems

- If can't decide between remaining options, add a new cell in all remaining directions

Notes:

- calcOppScore should give a opportunity a good score if the attraction rule applies (another cell nearby) and not just path values
- when two cells meet at a turn point, they die before one of them gets the chance to turn
- dont allow c turns?

