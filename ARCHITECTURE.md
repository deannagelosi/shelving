# Uniquely Shaped Spaces - Architecture Overview

This document provides a high-level overview of the application architecture. See [README.md](README.md) for project overview.

---

## 1. Directory and File Structure

```
project-root/
├── index.html           # Main entry point for the web application.
├── README.md            # Project overview and setup instructions.
├── package.json         # Project dependencies and scripts.
├── css/                 # All application stylesheets.
├── img/                 # Static image assets.
├── lib/                 # Third-party libraries (p5.js, dxf-writer.js, jstat.min.js).
├── tasks/               # Development workflow documents.
├── tests/               # Unit and integration tests.
│   ├── fixtures/        # Sample data for tests (e.g., sample_shapes.json).
│   └── *.test.js        # Test files for core logic and components.
└── js/                  # Application source code.
    ├── core/            # Pure, environment-agnostic algorithms.
    │   ├── Anneal.js    # Simulated annealing algorithm.
    │   ├── Cellular.js  # Cellular automaton algorithm.
    │   ├── Solution.js  # Layout solution data model.
    │   ├── Shape.js     # Shape processing and buffer generation.
    │   └── ...          # Other core logic (Board, appState, etc.)
    ├── interfaces/      # All user interaction layers.
    │   ├── web/         # Browser interface components.
    │   │   ├── main.js      # Application entry point for the web.
    │   │   ├── *UI.js       # DOM management classes (InputUI, etc.).
    │   │   └── *Renderer.js # Canvas rendering classes.
    │   └── bulk/            # Bulk runner interfaces (cli, viewer)
    │       ├── BulkCLI.js   # Orchestrates bulk analysis runs.
    │       ├── viewer.html  # Bulk results viewer HTML.
    │       ├── viewer.js    # Main UI controller for the viewer.
    │       ├── viewer.css   # Bulk results viewer styles.
    │       ├── viewerState.js # Centralized state for the viewer.
    │       ├── repository.js  # Data access layer for the viewer.
    │       ├── viewerRenderer.js # p5.js rendering logic for the viewer.
    │       └── stats.js     # Statistical helpers for the viewer.
    ├── workers/         # Web workers for parallel processing.
    │   ├── solution-worker.js # Runs the full generation pipeline.
    │   └── queue-worker.js  # Manages database writes for the CLI.
    └── models/          # Data layer for the CLI.
        └── Result.js    # Handles all SQLite operations.
```

---

## 2. System Architecture Visual Map

This diagram provides a mental model of how the major components interact and how data flows through the system.

```
┌──────────────────────────────────────────────────────────────────┐
│                        APPLICATION STATE                         │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ appState.js (Single Source of Truth)                       │  │
│  │  • shapes[]                    • generationConfig{}        │  │
│  │  • savedAnneals[]              • display{}                 │  │
│  │  • currentAnneal               • Unit conversion methods   │  │
│  ├────────────────────────────────────────────────────────────┤  │
│  │ Event Bus (appEvents - EventEmitter.js)                    │  │
│  │  • stateChanged, screenChanged, settingsChanged, etc.      │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
                                  ↕ (read/write via setters)
┌──────────────────────────────────────────────────────────────────┐
│                          UI LAYER (web/)                         │
│       ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│       │  InputUI     │  │  DesignUI    │  │  ExportUI    │       │
│       │  • Drawing   │  │  • Settings  │  │  • Materials │       │
│       │  • Upload    │  │  • Generate  │  │  • DXF/JSON  │       │
│       │  • Shapes[]  │  │  • Solutions │  │  • Preview   │       │
│       └──────────────┘  └──────────────┘  └──────────────┘       │
│              │                  │                  │             │
│              └──────────────────┼──────────────────┘             │
│                                 ↓                                │
│                         RenderConfig.js                          │
│                         • Colors, sizes, scale factors           │
│                         • Layout calculations (static methods)   │
└──────────────────────────────────────────────────────────────────┘
                            ↕ (uses)
┌──────────────────────────────────────────────────────────────────┐
│                      RENDERING LAYER (web/)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │ShapeRenderer │  │SolutionRndrr │  │CellularRndrr │           │
│  └──────────────┘  └──────────────┘  └──────────────┘           │
│  ┌──────────────┐  ┌──────────────┐                             │
│  │BendWallRndrr │  │CubbyRenderer │                             │
│  └──────────────┘  └──────────────┘                             │
│         Stateless visualization - no business logic              │
└──────────────────────────────────────────────────────────────────┘
                            ↕ (renders data from)
┌──────────────────────────────────────────────────────────────────┐
│                    CORE LOGIC LAYER (core/)                      │
│                                                                  │
│  SHAPE PROCESSING PIPELINE:                                      │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ Shape.js                                                   │  │
│  │  User Input (quarter-inch grid)                            │  │
│  │    ↓ trim, void fill, edge detection                       │  │
│  │  High-Res Shape (isOriginalShape tracking)                 │  │
│  │    ↓ scale factor alignment                                │  │
│  │  Aligned Shape                                             │  │
│  │    ↓ custom buffer (customBufferSize * scaleFactor steps)  │  │
│  │  High-Res Buffer Shape (highResBufferShape)                │  │
│  │    ↓ downsample (÷ scaleFactor)                            │  │
│  │  Low-Res Buffer (bufferShape) -> for annealing             │  │
│  └────────────────────────────────────────────────────────────┘  │
│                            ↓                                     │
│  LAYOUT GENERATION:                                              │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ Anneal.js -> Solution.js -> Cellular.js                    │  │
│  │  Low-res grid placement -> Score -> Wall generation        │  │
│  │  (Resolution-agnostic - works in abstract grid units)      │  │
│  └────────────────────────────────────────────────────────────┘  │
│                            ↓                                     │
│  EXPORT PREPARATION:                                             │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ Board.js -> BoardExporter.js / CubbyExporter.js            │  │
│  │  Grid units -> MathUtils.gridUnitsToInches() -> Inches     │  │
│  │            -> Material-specific adjustments -> DXF         │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  UTILITIES:                                                      │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ MathUtils.js - Unit conversion utilities                   │  │
│  │  • inchesToHighres() / highresToInches() (always x 4)      │  │
│  │  • inchesToGridUnits() / gridUnitsToInches() (varies)      │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
                            ↕
┌──────────────────────────────────────────────────────────────────┐
│                    CONFIGURATION SYSTEM                          │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ material-configs.js                                        │  │
│  │  • plywood-laser: Pin/slot joints, kerf adjustments        │  │
│  │  • acrylic-laser: Etch lines, welded joints                │  │
│  │  • clay-plastic-3d: Curved walls, shrink compensation      │  │
│  │    (cubbies fabrication type for 3D printing)              │  │
│  │  [Behavior-driven: each material defines cutting strategy] │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

### Key Data Flows

**Buffer & Shape Processing:**
```
User settings -> appState -> Shape.saveUserInput() -> Pipeline: trim -> void fill ->
align -> buffer -> downsample -> Output: highResBufferShape, bufferShape (for annealing)
```

**Grid Resolution:**
```
minWallLength -> RenderConfig.getScaleFactor() (static) -> Shape processing
(buffer steps, downsampling) -> Anneal/Cellular (resolution-agnostic grid units) ->
Export (grid units -> MathUtils.gridUnitsToInches() -> inches)
```

**Export System:**
```
Material selection -> BoardExporter/CubbyExporter -> Internal calculations
(grid units) -> MathUtils unit conversion -> Material-specific adjustments
(kerf, joints) -> DXF generation (inches)
```

**UI State Management:**
```
User interaction -> appState update -> appEvents.emit() -> Component listeners react ->
UI re-renders from appState (single source of truth)
```

---

## 3. Core Architectural Patterns

### A. Environment Separation (Web vs. Bulk)
- **Web Interface** (`interfaces/web/`): Pure client-side SPA using `solution-worker` for off-thread generation
- **Bulk Tool** (`interfaces/bulk/`): Node.js CLI spawning parallel `solution-worker` instances, persisting to SQLite via `queue-worker` and `Result` model. Includes standalone viewer (`viewer.html`) for statistical analysis using shared rendering classes

### B. Decoupled Core Logic
- All algorithms in `js/core/` are environment-agnostic
- No DOM, canvas, or p5.js dependencies
- Enables code sharing between web app, web-worker, and CLI tool

### C. Web Worker Architecture
- **`solution-worker.js`**: Runs full pipeline (Anneal -> Cellular -> Export) for both environments. Bulk mode generates statistical baselines for validation
- **`queue-worker.js`**: CLI-only results buffer for queued and batched database writes

### D. Separation of Concerns

**Three-Layer Architecture:**
1. **Core Classes** (`js/core/`): Pure domain logic, zero UI/rendering dependencies, fail-fast design
2. **UI Classes** (`js/interfaces/web/*UI.js`): DOM management, event coordination, delegate processing to core
3. **Renderer Classes** (`js/interfaces/web/*Renderer.js`): Stateless visualization using `RenderConfig` for consistency

### E. Rendering Architecture

**Single-Array Design:**
- Unified data source: `highResBufferShape` for all shape visualization data
- Property-based filtering: `isOriginalShape` distinguishes shape content from buffer
- Direct coordinates: No alignment calculations or metadata caching
- Buffer support: Bounds expansion and handles all buffer configurations

**Benefits:** Eliminates alignment bugs, simplifies renderer logic, maintains visual fidelity

### F. Test Architecture

**Key Principles:**
- Tests use identical code paths as production
- Explicit dependency setup in test files (`global.appState`, `global.RenderConfig`)
- No environment detection or fallback logic in core classes
- Dependency injection patterns match production requirements

---

## 4. Unit Conversion System & The Conversion Boundary

The application maintains clear separation between abstract design space and real-world fabrication space.

### Three Coordinate Systems

**1. Inches (Real-World Fabrication):**
- Physical measurements for user input and export
- Material configurations (thickness, kerf, depth)
- Final cut lists and joint calculations
- Example: 0.25" buffer = 0.25

**2. Highres Units (Quarter-Inch - CONSTANT):**
- **Always 0.25" per square**, regardless of minWallLength
- Shape processing: input drawing, buffer, edge detection
- Example: 1" x 1" shape = 4 x 4 highres grid

**3. Grid Units (Lowres - VARIABLE):**
- Layout generation (annealing, cellular automata)
- **1 grid unit = minWallLength inches** (0.25", 0.5", 1", 1.5", 2")
- Example: 1" x 1" shape = 4 grid units (minWall=0.25") or 1 grid unit (minWall=1")

**Scale Factor:**
```
scaleFactor = minWallLength / 0.25

Examples:
  0.25" minWall -> scaleFactor 1  (1 highres = 1 grid)
  0.5" minWall  -> scaleFactor 2  (2 highres = 1 grid)
  1.0" minWall  -> scaleFactor 4  (4 highres = 1 grid)
  2.0" minWall  -> scaleFactor 8  (8 highres = 1 grid)
```

### The Conversion Boundary

**Location:** `BoardExporter.prepLayout()` and `CubbyExporter.prepLayout()` methods

**Critical Rule:** All layout data converts from grid units to inches **before** fabrication calculations (joints, material thickness, board and sheet positioning).

**Flow:**
```
Cellular (grid units) -> MathUtils.gridUnitsToInches() -> Fabrication calculations (inches) ->
Cut lists (inches) -> DXF export (inches)
```

Material properties (thickness, kerf) are defined in inches. All fabrication math must use inches. The conversion is one-way and happens once at the boundary.

### Export Preview & DXF Consistency

**Critical Rule:** Preview and DXF export must read from the same cut list data (WYSIWYG).

**Data Flow:**
```
prepLayout() builds cut lists (boards[], cubbies[])
      ↓
      ├──> previewLayout() reads cut list, renders to canvas
      └──> generateDXF() reads cut list, writes DXF file
```

All layout calculations (board lengths, joint positions, sheet positioning) happen once in `prepLayout()`. Both preview and DXF are read-only consumers of prepared data. No parallel implementations.

### Conversion Utilities (MathUtils.js)

**API:**
```javascript
gridUnitsToInches(gridUnits, minWallLength)  // Grid <-> Inches (varies)
inchesToGridUnits(inches, minWallLength)
highresToInches(highresUnits)                // Highres <-> Inches (constant: 0.25")
inchesToHighres(inches)
```

**Rules:**
- Use `scaleFactor` ONLY for Grid<->Highres conversions (downsampling)
- NEVER use `scaleFactor` for Inches<->Highres (always multiply by 4)
- Highres is 0.25" per square, independent of minWallLength

**Naming:** `In` suffix for inches (`caseDepthIn`), `Grid` suffix for grid units (`sheetWidthGrid`), context-based for highres (`bufferSteps`)

---

## 5. Key Components

### `core/` - Pure Algorithms

**Shape Processing:**
- **`Shape.js`**: Configurable shape processing pipeline (void fill, edge detection, alignment, buffer generation). Supports custom buffer, vertical centering, variable min wall lengths. Single-array rendering with `isOriginalShape` property

**Layout Generation:**
- **`Anneal.js`**: Simulated annealing for optimal placement in grid unit space
- **`Cellular.js`**: Cellular automaton for wall generation in grid unit space
- **`Solution.js`**: Layout solution data model supporting custom perimeter and variable grid resolutions

**Export:**
- **`Board.js`**: Board model with kerf-adjusted lengths
- **`BoardExporter.js`**: Laser-cut export implementing conversion boundary (grid->inches in `prepLayout()`), material-specific joints with kerf compensation
- **`CubbyExporter.js`**: 3D-print export mirroring BoardExporter's conversion pattern, bezier curves for DXF

**Utilities:**
- **`MathUtils.js`**: Unit conversions, bounds calculation, padding distribution
- **`appState.js`**: Centralized configuration with setters and event emission
- **`EventEmitter.js`**: Pub/sub for web interface

### `interfaces/web/` - Web UI

**Control:**
- **`main.js`**: p5.js entry, worker communication, screen orchestration

**UI Management:**
- **`InputUI.js`**: Shape input, file loading, library
- **`DesignUI.js`**: Generation settings, perimeter config, solution management
- **`ExportUI.js`**: Export options and file generation

**Visualization:**
- **`SolutionRenderer.js`**: Solution visualization with perimeter/collision highlighting
- **`ShapeRenderer.js`**: Shape-specific rendering with direct coordinates
- **`CellularRenderer.js`**: Wall generation visualization
- **`RenderConfig.js`**: Centralized colors, weights, scale factors, layouts

### `interfaces/bulk/` - Bulk Tools

**CLI:**
- **`BulkCLI.js`**: Bulk analysis orchestrator

**Viewer:**
- **`viewer.js`**: UI controller for results analysis
- **`viewerState.js`**: State management
- **`repository.js`**: SQLite query layer
- **`viewerRenderer.js`**: Result visualization
- **`stats.js`**: Statistical analysis (jstat)

### `workers/` - Background Processors

- **`solution-worker.js`**: Environment-agnostic pipeline (Anneal -> Cellular -> Export), supports single and bulk modes
- **`queue-worker.js`**: Safe concurrent database writes (Node.js only)

### `models/` - Data Persistence (CLI)

- **`Result.js`**: SQLite abstraction for job/solution/error storage and queries

---

## 6. Database Schema

The CLI uses SQLite for bulk analysis storage:

```
┌─────────────────────────────────────┐
│              bulk_jobs              │
├─────────────────────────────────────┤      ┌─────────────────────────────────────┐
│ job_id (TEXT, PK)                   │◄─────┤             solutions               │
│ created_at (DATETIME)               │      ├─────────────────────────────────────┤
│ completed_at (DATETIME)             │      │ job_id (TEXT, FK)                   │
│ total_workers (INTEGER)             │      │ solution_id (TEXT, PK)              │
│ completed_workers (INTEGER)         │      │ start_id (INTEGER)                  │
│ failed_workers (INTEGER)            │      │ created_at (DATETIME)               │
│ config_json (TEXT)                  │      │ export_data_json (TEXT)             │
│ input_shapes_json (TEXT)            │      │ cellular_json (TEXT)                │
│ status (TEXT) ∈ {running,           │      │ metadata_json (TEXT)                │
│          completed, failed}         │      │ score (REAL)                        │
└─────────────────────────────────────┘      │ valid (BOOLEAN)                     │
                                             │ baseline_grid_json (TEXT)           │
┌─────────────────────────────────────┐      │ stats_breakdown_json (TEXT)         │
│          solution_errors            │◄─────┤ board_render_data_optimized (TEXT)  │
├─────────────────────────────────────┤      └───────────────────────────────��─────┘
│ error_id (TEXT, PK)                 │
│ job_id (TEXT, FK)                   │
│ start_id (INTEGER)                  │
│ created_at (DATETIME)               │
│ error_message (TEXT)                │
│ error_stack (TEXT)                  │
│ worker_payload_json (TEXT)          │
└─────────────────────────────────────┘
```

**Key Features:**
- UUID primary keys for global uniqueness
- JSON storage for flexible complex data
- Statistical baselines for validation
- Progress tracking and error collection
- Optimized indexes for common queries

---

## 7. Configuration Management

Centralized configuration through `appState`:

**Shape Processing:**
- Custom Buffer Size: 0-1" perimeter expansion
- Center Shapes Vertically: Placement within buffer
- Minimum Wall Length: Grid resolution (1", 3/4", 1/2", 1/4")

**Layout:**
- Aspect Ratio: Square, wide, or tall optimization
- Custom Perimeter: Rectangular bounds constraints
- Fabrication Type: Material-specific settings (boards, cubbies, bent)

**State Flow:**
1. UI writes to `appState`
2. `appState` emits `settingsChanged` events
3. Systems react to changes (processing, rendering)
4. Automatic regeneration and visual updates
