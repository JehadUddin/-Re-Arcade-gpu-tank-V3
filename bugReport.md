# Bug Report Log

Tracking all issues, from critical bugs to minor suggestions.

## Critical (App Breaking)

-   **[RESOLVED] WALL PHASING & DIRECT VELOCITY OVERRIDE**: Direct linear velocity assignment (`SetLinearVelocity`) was executed every frame with the user's raw horizontal input vector. This completely bypassed/overwrote the natural velocity modifications and contact impulses of Jolt's collision solver when hitting thin or complex static walls, causing the tank to penetrate and phase through them if pushed. Resolved by implementing a robust 3-direction "whiskers" raycast prediction system (Center, Left -30°, Right +30°) for both player and enemy tanks. Prior to applying the velocity, any raw input component moving *into* an active contact normal is dynamically subtracted, projecting the movement vectors parallel to the wall surface for flawless, friction-free bumper sliding.
-   **[RESOLVED] INNER OBSTACLE BLOCKAGES**: Re-enabled Jolt static collision boxes for all level accessories (including trees/trunks, sand walls, and buildings) so the player's tank can no longer phase through them. By pairing them with our optimized cylindrical tank body bounds (`addCylinder`) and reduced friction (0.05), the tank slides and bumper-slides off the static geometries dynamically with zero sticking or trapping.
-   **[RESOLVED] WALL STUCK & STATIC JAMMING**: Direct velocity override coupled with rectangular dynamic bodies caused the tank's corners to sweep into static obstacles (buildings, walls, trees) during rotation, creating massive penetration depth. This locked up Jolt's engine and blocked all player/enemy movement. Resolved by converting both player and enemy dynamic shapes into upright cylinders (`addCylinder`). Since cylinders have radially symmetrical X-Z boundaries, their footprint remains unchanged when turning, preventing rotative wall penetration completely. Further optimized friction (0.05) to ensure frictionless, slick sliding along static hulls.
-   **[RESOLVED] ERRATIC TANK TURNING / SPINNING JITTER**: When turning the player or enemy tanks, reading the physical rotation from the Jolt body every frame, decomposing it, and calling `SetRotation` created a feedback loop that fought Jolt's internal solver. This caused visual/physical spinning jumps, stuttering, and extremely sluggish turning. Resolved by migrating both tank and enemy steering to direct rotation angle integration in the TS scripts, setting Jolt's physical quaternion flat (0 pitch/roll) to match, and zeroing out Jolt's angular velocity to remove any state conflicts inside the solver.
-   **[RESOLVED] TANK CORNER STUCK / 'INVISIBLE BLOCKAGE'**: The physical dynamic collision boxes for the player and enemy tanks could tilt (pitch and roll) and have their corners penetrate the static floor mesh under movement forces or collisions. This created immense friction that acted like an invisible wall, blocking movement. Fixed by forcing pitch and roll rotations of the physics bodies to exactly 0 every frame using direct `SetRotation` locking, while keeping the visual hull banking 100% smooth via procedural raycast mapping.
-   **[RESOLVED] UNSTABLE MOVEMENT FORCE STICKING**: The force-based PD movement controller fought against high contact friction coefficients on contact points, stopping linear movement. Fixed by applying direct linear velocity updates on the X and Z axes, ensuring consistent, snappy, and reliable movement speed under user input while preserving vertical gravity velocity.
-   **[RESOLVED] PROJECTILE INTERFERENCE & COLLISION BLOCKS**: Shells and grenades modeled as Jolt physical bodies could collide with player, enemies, or static elements unpredictably, blocking player movement or getting stuck. Completely decoupled projectiles from Jolt physics and migrated them to a pure mathematical trajectory model with distance and AABB box collision checks against targets and level decorations. This completely resolved "invisible collision" issues from physical shells or grenades.
-   **[RESOLVED] PROJECTILE PHYSICS DESYNC**: Shells weren't passing rotation to Jolt. Visually rotated, physically axis-aligned. Fixed by passing Euler-to-Quat to `addBox`.
-   **[RESOLVED] RECOIL CLIPPING**: Projectiles spawned at static offsets while barrel was recoiling, causing shells to spawn inside the turret. Fixed with dynamic muzzle offset.
-   **[RESOLVED] ELASTIC BOUNCE BUG**: Shells didn't explode on walls because speed didn't drop (elastic collision). Fixed by checking vector direction changes.
-   **[RESOLVED] THE 12-METER SAFE ZONE**: Projectiles were "invulnerable" for too long (0.1s), letting shells bounce off nearby walls without exploding. Fixed by tightening the window.
-   **[RESOLVED] TURRET INTERSECTION**: Turret center was at 0.675, body top at 0.45. Intersection caused Z-fighting/disappearing. Elevated to 0.85.
-   **[RESOLVED] GRENADE DUD BUG**: Grenades didn't explode if they came to a rest before life expired. Added expiry explosion logic.
-   **[RESOLVED] MOUSE LOOK/LOCK**: Added pointer lock and refined fire mappings for desktop feel.
-   **[RESOLVED] ERRORBOUNDARY TS COMPILATION**: `ErrorBoundary` failed to compile due to missing React types and incorrect extension syntax. Fixed by installing `@types/react` and using `React.Component`.
-   **[RESOLVED] JOLT API MISMATCHES**: `mLinearDamping` and `mAllowedDOFs` were non-existent properties in `Gfx3JoltBodySettings`. `removeBody` was missing. Fixed by removing invalid props and using `gfx3JoltManager.remove(bodyId)`.
-   **[RESOLVED] QUATERNION MULTIPLY ERRORS**: `Quaternion.multiply` was not a static method. Fixed by using instance `mul` method.
-   **[RESOLVED] REFINING APP LOGIC**: `App.tsx` had incorrect style property `touchNone` (renamed to `touchAction`) and incorrect player reference (renamed to `tank`).
-   **[RESOLVED] MISSING DEPENDENCIES**: Various core libraries were missing from `package.json`. Installed `jszip`, `bdfparser`, `curve-interpolator`, etc.
-   **[RESOLVED] DIMENSION LINE TYPE ERRORS**: `Stage.tsx` reported prop errors for `DimensionLine`. Fixed by using `React.FC` for better type inference.
-   **[RESOLVED] MISSING VIEWPORT COMPONENT**: `Slot.tsx` imported a non-existent `Scene3D` component. Created a placeholder backfilled component.
-   **[RESOLVED] ENV OPTIMIZATION**: Removed non-existent `optimizeBroadPhase` call in `Environment.ts`.
-   **[RESOLVED] ENEMY SCALE MISMATCH**: Enemy meshes were 1.5x larger than their physics bodies, causing grounding issues. Fixed by applying 0.66x scale to enemy models and offsets.
-   **[RESOLVED] TANK MODEL ALIGNMENT**: Refined turret, hatch, antenna, and track offsets in `Tank.ts` to improve structural cohesion and ground contact.
-   **[RESOLVED] ENEMY MUZZLE DESYNC**: Enemy projectiles were spawning from unscaled coordinates. Adjusted `getMuzzleData` to match 0.66x visual scaling.
-   **[RESOLVED] UNIT HEALTH BARS**: Removed HP bars as requested to keep UI minimal.
-   **[RESOLVED] COMPONENT SEPARATION**: Fixed bug where tank parts (turret, tracks) would drift or "break apart" from the hull during movement. Resolved by implementing hierarchical matrix transformations where the hull acts as the parent reference frame for all sub-components, ensuring perfect structural alignment regardless of physics lag.
-   **[RESOLVED] QUATERNION TYPO**: Fixed `Uncaught TypeError: turretQ.invert is not a function` by correcting the method name to `inverse()` in the tank's hierarchical drawing logic.
-   **[RESOLVED] ENEMY TANK DIMENSIONS**: Corrected enemy hull and track offsets and resized the Jolt physics box to perfectly match the 0.66x scaled visual footprint.
-   **[RESOLVED] BLUE SCREEN BUG**: `gfx3MeshRenderer.render` was called with a camera as the second argument, causing a crash because it expected a texture. Fixed in `GameScreen.ts`.
-   **[RESOLVED] POINTER LOCK BUG**: Added a global safeguard for `requestPointerLock` to handle "immediately after exit" and "user gesture" errors gracefully. By returning a silent resolved promise for these specific handled cases, we prevent app crashes and console noise when the browser security policy enforces small cooldowns between lock requests.
-   **[RESOLVED] UT.ANGLE_DISTANCE TYPEERROR**: Utility was missing from core library. Implemented local helper in `Tank.ts`.
-   **[RESOLVED] TANK & ENEMY STEERING JITTER**: Decoupled visual banking from physics rotation. Switched to `SetAngularVelocity` for steering and single-ray ground alignment to prevent physics "fights" and jittering.

## Warning (Unexpected Behavior)

-   ...

## Suggestion (Improvements)

-   [ ] Add more interactive SVG animations to the System Spec window for each rule.
-   ...
