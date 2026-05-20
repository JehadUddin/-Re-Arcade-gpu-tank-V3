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
