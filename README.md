# Uniquely Shaped Spaces: 3D Shelving Generator

Creates efficient and visually interesting layouts for irregularly shaped objects

## Project Overview

Uniquely Shaped Spaces is a 3D shelving generator that uses Simulated Annealing and Cellular Automata algorithms to optimize the placement of irregularly shaped objects.

### Architecture

Uniquely Shaped Spaces is a dual-environment application for generative design:
- **Browser-based Web App** for interactive design, allowing users to define shapes, generate optimal layouts, and export designs
- **CLI Tool** for bulk processing, enabling statistical analysis by running the generation process hundreds or thousands of times

Both environments share the exact same core algorithmic logic, ensuring that results from the bulk analysis tool are a valid representation of the interactive tool's capabilities.

**Core Technologies:** p5.js (web rendering), Node.js (CLI runtime), SQLite (bulk results storage), jstat.js (statistical analysis), dxf-writer.js (export)

### Documentation

- [**ARCHITECTURE.md**](ARCHITECTURE.md) - System design and component architecture

## Algorithms

- **Simulated Annealing**: Optimizes the placement of irregular objects on a grid
- **Cellular Automata**: Generates dynamic shelving between objects

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
   - Respect boundary buffer constraints

4. **Step 3: Choose Growth Direction**
   - If only one valid option remains, select it
   - Cells are attracted to dead cells of a different strain (prevents parallel paths)
   - Preference given to easy paths (low values)
   - Cells tend to maintain their current growth direction

## Unit Tests

```sh
# run all unit tests
npm test

# update dxf snapshot for unit tests
npm test -- -u
```
