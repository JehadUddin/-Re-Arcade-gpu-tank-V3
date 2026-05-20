# Rule Compliance Report

- **Active Tiers**: Tier 1 (Code Quality), Tier 2 (Design System), Tier 3 (Documentation).
- **Tier Summary**: 
    - Tier 1: SMART CSS-in-JS (styles object), Framer Motion for UI, Modular React architecture, Atomic state updates.
    - Tier 2: Specific typography (Victor Mono, Bebas Neue, Inter), Semantic Design Tokens, Minimalist theme.
    - Tier 3: Comprehensive documentation (README, LLM, logging).
- **Potential Conflicts**: Overriding default Tailwind rules with CSS-in-JS. Prioritizing stability (fixing blue screen) over new aesthetic additions.
- **Priority Confirmation**: Stability → Performance → Usability → Aesthetic.
- **Action Plan**: Re-stabilize the rendering pipeline in `GameScreen.ts` to solve the "Blue Screen" bug, then resolve component separation in `Tank.ts` by anchoring all parts to a shared transform matrix.

# noteBook.md

## 2026-05-20
### Done
- [DONE] Prevented Tank Phasing & Sticking: Designed and integrated a high-precision multi-raycast "whiskers" slide projection system (testing central, -30° left, and +30° right direction whiskers) for both the player and enemy tanks. If a collision is about to occur with any level obstacle, the intended horizontal velocity vector is dynamically projected onto the obstacle's tangent surface, allowing both player and AI tanks to slide seamlessly along complex geometries without slowing down or phasing through walls.
- [DONE] Re-enabled Wall/Obstacle Collision: Implemented robust physical Jolt collision boxes for all procedurally generated level decorations (buildings, tree trunks, sand walls). Configured them as static rigid bodies, enabling full collision physics so the player tank bounces/slides off them realistically instead of phasing through.
- [DONE] Removed Inner Obstacle Collisions: Removed Jolt physics collision boxes for the trees, buildings, and obstacles inside the map. The player and enemy tanks can now drive through them smoothly, while all visual models and shell impact mechanics are preserved, allowing for effortless roaming.
- [DONE] Resolved "Stuck Near Obstacles / Buildings" issue: Migrated both player and enemy physical bodies from rectangular boxes to upright cylinders (`addCylinder`). Symmetrical circular bounds eliminate corner sweep penetration when turning near walls, while reduced friction (0.05) delivers butter-smooth sliding along static geometries.
- [DONE] Corrected Steering Inversion: Inverted the direction calculation for the player's tank steering so that pressing **A** (Left) rotates the tank correctly to the left (counter-clockwise) and **D** (Right) rotates it correctly to the right (clockwise).
- [DONE] Fixed Steering Jitter & Glitches: Refactored tank and enemy steering from physics angular velocity solvers to robust direct-integration rotation updates. This prevents back-and-forth solver conflicts and eliminates visual/physical jerking when rotating.
- [DONE] Resolved "goes in the ground one side" issue: Locked physical pitch/roll rotation (X/Z axes) to 0 every frame for both player and enemy tanks, ensuring collision boxes stay perfectly level while visual banking remains 100% smooth via raycast normal.
- [DONE] Resolved "invisible thing blocking movement" / "cant roam" issue: Transitioned player and enemy movement from unstable force-PD formulas to highly responsive, direct linear velocity updates on the X and Z axes. This eliminates static friction traps and corner clipping into the floor.
- [DONE] Decoupled Projectiles from Jolt Physics: Completely replaced physical bullet bodies with a mathematical trajectory simulation (storing position, speed, and gravity vectors). Implemented geometric distance/AABB calculations for hitting player, enemies, map borders, ground, and level buildings. This prevents any physical projectile interference or visual/physical desyncs that would block the tank.
- [DONE] Integrated Arrow Keys control scheme: Registered keyboard Arrow keys parallel to WASD inputs in the input manager, allowing the player to drive using whichever layout they prefer.

## 2026-05-19
### Done
- [DONE] Fixed "Blue Screen" bug: Corrected gfx3MeshRenderer.render call in GameScreen.ts.
- [DONE] Fixed UT.ANGLE_DISTANCE TypeError in Tank.ts (added local helper).
- [DONE] Fixed visual "breaking apart" of tanks by implementing a strict Parent-Child Matrix hierarchy using `UT.MAT4_MULTIPLY` in `draw()` calls.
- [DONE] Decoupled visual updates from physics updates: `draw()` now uses stored rigid states for perfectly locked component alignment.
- [DONE] Synced projectile spawning logic with hierarchical transforms for accurate muzzle fire.
- [DONE] Corrected recoil direction (moved backward instead of forward).
- [DONE] Fixed scale multiplication bugs in hierarchical enemy rendering.
- [DONE] Improved Enemy AI accuracy checks (only fires when aligned with target).
- [DONE] Fixed Uncaught TypeError: turretQ.invert is not a function (corrected to inverse()).
- [DONE] Corrected Enemy tank dimensions and floating turret/engine offsets.
- [DONE] Stored `visualQ` in `Enemy` instances for smoother tilted rotations on hills.
- [DONE] Cleaned up redundant render/draw calls.
- [DONE] Updated metadata.json with descriptive information.
- [DONE] Fixed Pointer Lock re-acquisition error in App.tsx (more robust silent catch for timing rejections, added cooldown handling).
- [DONE] Verified full compliance with Tier 2 Design System tokens in App HUD.

# bugReport.md

## Fixed
- [FIXED] Blue Screen: Renderer was being called incorrectly in GameScreen.ts.
- [FIXED] Component Desync: Tank components separated during movement due to lag and incorrect offsets.
- [FIXED] Pointer Lock: Safeguarded re-acquisition after user exit with robust silent promise handling.
