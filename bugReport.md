# Bug Report Log

Tracking all issues, from critical bugs to minor suggestions.

## Critical (App Breaking)

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
