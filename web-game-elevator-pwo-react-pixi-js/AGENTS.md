# Elevator Explorer

A personal game for Colin, an autistic child around eight years old who loves elevators. Colin has blond-brown hair, brown eyes, and walks barefoot because he dislikes socks. Keep the experience predictable and tailored to him.

## Stack

React 19, PixiJS 8 with @pixi/react, TypeScript, Vite, and vite-plugin-pwa. HTML/CSS menus surround a Pixi canvas. No router, backend, authentication, physics engine, or React Compiler is configured.

## Layout

- `src/App.tsx`: menu, session lifetime, and background pause/save handling.
- `src/components/MenuScene.tsx`: approved painted menu illustration. `GameScene.tsx`: interactive world and camera. `GameView.tsx`: HTML controls and panels.
- `src/game/model.ts`, `simulation.ts`: building data and fixed-step rules. `session.ts` coordinates rendering notifications, audio, and saving.
- `src/game/room-art.ts`, `spatial.ts`, `room-interaction.ts`: perspective drawing, depth movement/door collision, and room hit targets. `audio.ts` synthesizes sound; `storage.ts` validates and migrates saves with backup recovery.
- `src/palette.ts`, `src/styles.css`, `src/game.css`, `src/copy.ts`: local colors, responsive styling, and Swedish copy.
- `src/pwa.ts`: production service-worker registration.
- `src/components/ArtStudy.tsx`: separate `?view=art` comparison, with three local concept images and prompts in `art-prompts.md`. Option 01 is approved and implemented in the game; the other concepts remain comparisons.
- `src/game/painted-assets.ts`: cached local Pixi texture loading with retry. `public/painted/`: runtime WebP art; `art-source/`: generated PNG originals and prompts. Export with `node scripts/prepare-painted-art.mjs`.
- `public/`: local app icons. `tests/`: simulation checks and desktop/phone browser checks against a production build.

## Styling

The approved 2.5D direction is implemented in the main game: perspective rooms, depth scaling, a recessed cabin with door occlusion, and Colin standing beside the call panel while reaching toward its illuminated button. `?view=depth` remains the original isolated, unsaved study for comparison.

Use `worldPalette` for the painted canvas and `palette` for readable HTML controls. Follow approved style 01: textured dark wood, brass doors, teal/amber lighting, and barefoot Colin with standing/walk sprites. Keep doors, gates, signs, and switches on independent interactive layers. Keep a clear illustrated style, generous spacing, and at least 48-pixel menu targets. Support touch, keyboard, reduced motion, and phone safe areas.

Room plates are 1448×1086 with a shared doorway plane and perspective projection. Preserve generous floor space and normal character/door sizes. Keep flame pictograms, alarm call points, and warning triangles separate. Version-3 saves include depth and doorway waypoints; migrate versions 1 and 2 and retain the existing storage keys for recovery.

Use Swedish labels, simple pictures, and floor numbers. Do not display Colin's diagnosis in the UI. Provide accessible HTML alternatives for world interactions; the menu canvas stays decorative.

The building overview previews a floor without moving Colin; tapping its room sends him there through the stairs. Följ Colin returns to his floor. Use mouse-wheel or +/− zoom and mouse/one-finger dragging within the room. Drags never move Colin or activate objects. Floor/building changes restore the fitted room view.

## Commands

Run commands in this folder with Node 22.12+ (or supported newer Node) and npm.

```sh
npm ci
npm start           # development, port 4010
npm run typecheck
npm run check       # Biome, no rewriting
npm run build       # TypeScript + Vite + offline precache
npm run preview     # production preview, port 4011
npm test            # simulation + production browser tests; build first
```

Install the test browser once with `npx playwright install chromium`. Test artifacts and build output are ignored by Git.

## Forms and panels

Use accessible HTML controls and right-side panels for simple menu information/settings. Preserve keyboard focus, Escape dismissal, and a labelled close control. Do not add a form library for simple controls.

## Game behavior

Follow [PLAN.md](PLAN.md). Portrait-first 2.5D free exploration: hotel, shopping centre, and an old apartment house, three floors each (0–2), connected outdoors. The green-signed door is a stairwell on every floor, including the entry floor; a separate regular door marked UT leads outside from each entry floor. Keep warning signs and repeatable light switches.

Tap to walk or approach an object. Tapping another floor routes Colin via the nearest staircase (currently one per building) and then to the tapped position; a new tap replaces the destination after completing any active stair flight. Preserve routes in saves. Elevators run independently: select a floor, step out during a five-second delay, and take the stairs to meet the lift. Timing: stairs three seconds/floor, elevator five seconds/floor, doors one second. No scores, losing, or time limits.

The cabin has visible numbered, illuminated buttons on its back wall. Tapping them after boarding selects a floor; large HTML floor controls remain available. Modern lifts also have an open/close control. Occupied doors visibly approach Colin, then reverse before reaching his body; queued automatic doors pause and retry. Door/gate interlocks keep the lift stationary while blocked. The apartment house retains separate manual landing and lattice-gate controls.

Add unhurried passengers so Colin can press buttons for them and watch them ride: 2–3 shoppers, 1–2 hotel guests, and occasional residents (default 0–3) in the old apartment house. Show their desired floor with a number bubble; let Colin operate the lift for them without requiring him to ride. Passengers wait patiently and never take over his buttons or turn the interaction into a timed task.

Sound is optional and synthesized locally. Alarm demos last three seconds, are stoppable and independently adjustable, and never start automatically. No music by default.

## Notes

The three-building game is playable. Preserve the independently running lifts, doorway interlocks, patient passengers, per-floor lights/doors, settings, and local save recovery. Physical-phone installation and sound comfort still need a device review.

Simulation state outlives rendered scenes. Use one fixed-step ticker and refs for continuous motion, not React state every frame. Pause simulation/audio when hidden; resume without elapsed-time catch-up.

Bundle assets locally. Production precaching includes the full game. Updates wait for existing clients to close and never force a reload. Versioned localStorage saves remain separate from service-worker caches; validate snapshots and preserve a previous valid backup.

GitHub Pages deploys through `../.github/workflows/pages.yml`. Local development defaults to `/`; CI sets `VITE_BASE_PATH` to the repository subpath for both build and tests. Use `import.meta.env.BASE_URL` in app links and public asset URLs. Keep manifest start/scope and the offline worker scoped to that same path. Only passing `main` builds deploy.

