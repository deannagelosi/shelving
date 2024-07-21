# Uniquely Shaped Spaces: 3D Shelving Generator

Creates efficient and visually interesting layouts for irregularly shaped objects

## Project Overview

Uniquely Shaped Spaces is a 3D shelving generator that uses Simulated Annealing and Cellular Automata algorithms to optimize the placement of irregularly shaped objects.

## Key Features

- **Simulated Annealing**: Optimizes the placement of irregular objects on a grid
- **Cellular Automata**: Generates dynamic shelving between objects
- **p5.js**: Utilizes p5.js canvas for rendering and interaction

## Object Representation

Objects are represented as grid-based outlines with padding, allowing for flexible and efficient storage arrangements.

## Simulated Annealing Process

## Cellular Automata Process

Cellular Automata is used to grow shelving between objects

1. **Setup Phase**
   - Precalculate all path scores and store in an array
   - Initialize cells with growth options: Left, Up, and Right
   - Each cell retrieves scores for potential growth paths

2. **Step 1: Merge and Die Rules**
   - Merging occurs when two alive cells meet or pass by each other
   - An alive cell dies when it meets a dead cell (simulating crowding)

3. **Step 2: Eliminate Invalid Options**
   - Prevent backtracking
   - Avoid growing through existing shapes
   - Respect boundary constraints

4. **Step 3: Choose Growth Direction**
   - If only one valid option remains, select it
   - Cells are attracted to dead cells of a different strain (prevents parallel paths)
   - Preference given to easy paths (low values)
   - Cells tend to maintain their current growth direction
