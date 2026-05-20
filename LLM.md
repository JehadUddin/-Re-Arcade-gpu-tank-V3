# LLM Instructions - ARCADE_GPU

## File Paths
- `/components/App/App.tsx`: Main React entry and HUD.
- `/components/App/game/GameScreen.ts`: Main game loop and rendering pipeline.
- `/components/App/game/Tank.ts`: Player tank logic and component assembly.
- `/components/App/game/Enemy.ts`: AI tank behavior and rendering.
- `/components/App/game/Environment.ts`: World layout and static collision.

## Design Rules
- **No Tailwind**: Styling must use the `Tokens` object in `App.tsx` or similar JS style objects.
- **Premium Aesthetics**: Use Inter for UI, Bebas Neue for display, and Victor Mono for labels.
- **Modular Components**: Architecture follows Core → Package → Section → Page → App.
- **Physics-Visual Sync**: Always sync visual meshes to physics transforms in the `draw` or `update` loop.
