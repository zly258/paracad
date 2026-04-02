# Architecture

ParaCad uses a three-layer structure:

1. Graph scheduling layer (`core/graph`) for node execution and dependency propagation.
2. Runtime kernel layer (`core/kernel`) for engine state and runtime summary.
3. View and interaction layer (`components`) for node editor and viewport.

## Runtime

- Engine: Three.js only.
- Focus: fast browser modeling preview and interaction.
- Export: GLB/OBJ.
