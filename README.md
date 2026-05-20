# ARCADE_GPU

A premium, minimalist 3D tank combat prototype built with Gfx3 and Jolt Physics.

## Directory Structure
- `/components/App`: UI layers and main entry.
- `/components/App/game`: Core game logic (Tank, Enemy, Environment).
- `/lib`: Engine components (Gfx3, Jolt, Core).

## Core Mechanisms
- **Reactive System**: React manages UI and high-level intent.
- **Decoupled Physics**: Jolt handles collisions and movement; visual components sync every frame.
- **Advanced Collision Protection**: 
  - **Static Obstacle Physics**: All procedurally generated level accessories (buildings, sand walls, tree trunks) contain real static physical Jolt colliders to block tanks and shells dynamically.
  - **Symmetrical Cylinder Bounds**: Left and right tank hulls are represented by upright cylinder bodies (`addCylinder`), eliminating corner sweep penetration when turning near static structures & ensuring seamless rotation.
  - **Multi-Raycast "Whiskers" sliding**: A 3-direction raycast system (Center, Left -30°, Right +30°) projects desired velocity vectors onto wall tangent surfaces, delivering flawless, friction-free sliding along blockades instead of phasing or sticking.
- **PERSUASION Design**: Minimalist HUD with focused combat metrics.

## Running the Project
The project uses an `importmap.js` for clean module resolution.
- Dev: `npm run dev`
- Build: `npm run build`
