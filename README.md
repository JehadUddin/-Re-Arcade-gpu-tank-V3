# ARCADE_GPU

A premium, minimalist 3D tank combat prototype built with Gfx3 and Jolt Physics.

## Directory Structure
- `/components/App`: UI layers and main entry.
- `/components/App/game`: Core game logic (Tank, Enemy, Environment).
- `/lib`: Engine components (Gfx3, Jolt, Core).

## Core Mechanisms
- **Reactive System**: React manages UI and high-level intent.
- **Decoupled Physics**: Jolt handles collisions and movement; visual components sync every frame.
- **PERSUASION Design**: Minimalist HUD with focused combat metrics.

## Running the Project
The project uses an `importmap.js` for clean module resolution.
- Dev: `npm run dev`
- Build: `npm run build`
