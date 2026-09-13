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

Use Swedish labels, simple pictures, and floor numbers. Do not display Colin's diagnosis in the UI. Provide accessible HTML alternatives for world interactions; the menu canvas stays decorative. Menus share the game's painted wood, brass, and teal theme using `menuPalette` and existing material textures, with bright readable text and illuminated selections. Keep menus compact with 48-pixel touch targets. Support portrait and landscape, with a full-viewport landscape canvas, toggleable floating controls hidden by default, scrollable settings, and unrestricted PWA orientation.

The building overview previews a floor without moving Colin; tapping its room sends him there through the stairs. Följ Colin returns to his floor. Use two-finger pinch, mouse-wheel, or +/− zoom and mouse/one-finger dragging within the room. Keep the corner zoom buttons visible even with landscape controls hidden. Pinches preserve their focal point within camera bounds; drags, pinches, and cancelled gestures never move Colin or activate objects. Floor/building changes and Följ Colin recenter the camera without changing the chosen zoom. Save cameraZoom with the other settings; older saves default to 1×. Rotation must not change it.

The installed app requests fullscreen display with unrestricted orientation. The menu and game header provide a user-triggered Helskärm button for browser play and existing installations. Fullscreen covers the document so controls and dialogs remain usable; respect browser exit gestures and never force fullscreen back on.

## Commands

Run commands in this folder with Node 22.12+ (or supported newer Node) and npm.

```sh
npm ci
npm start           # development, port 4010
npm run typecheck
npm run check       # Biome, no rewriting
npm run build       # TypeScript + Vite + offline precache
npm run preview     # production preview, port 4011
npm test            # fresh build + simulation + production browser tests
```

`npm test` ensures the matching Chromium headless browser is installed through `pretest`; a missing browser is downloaded before starting tests. Playwright builds before launching preview, using the same `VITE_BASE_PATH` as the tests (default `/`), so an older Pages-path build cannot break plain `npm test`. Local `npm ci` installs the root `.githooks/pre-commit` hook via `prepare`: Biome, a fresh Pages-path build, and all tests must pass before committing. Run it manually with `git hook run pre-commit`; port 4011 must be free. It checks the working tree, so stage the intended, verified changes before committing. Test artifacts and build output are ignored by Git.

## Forms and panels

Use accessible HTML controls and right-side panels for simple menu information/settings. Preserve keyboard focus, Escape dismissal, and a labelled close control. Do not add a form library for simple controls.

## Game behavior

Follow [PLAN.md](PLAN.md). Portrait and landscape 2.5D free exploration: hotel, shopping centre, and an old apartment house, three floors each (0–2), connected outdoors. The green-signed door is a stairwell on every floor, including the entry floor; a separate regular door marked UT leads outside from each entry floor. Keep warning signs and repeatable light switches.

Tap to walk or approach an object. Tapping another floor routes Colin via the nearest staircase (currently one per building) and then to the tapped position; a new tap replaces the destination after completing any active stair flight. Preserve routes in saves. Elevators run independently: select a floor, step out during a five-second delay, and take the stairs to meet the lift. Timing: stairs three seconds/floor, elevator five seconds/floor, doors one second. No scores, losing, or time limits.

The cabin has visible numbered, illuminated buttons on its back wall. Tapping them after boarding selects a floor; large HTML floor controls remain available. Modern lifts also have an open/close control. Occupied doors visibly approach Colin, then reverse before reaching his body; queued automatic doors pause and retry. Door/gate interlocks keep the lift stationary while blocked. The apartment house retains separate manual landing and lattice-gate controls.

Add unhurried passengers so Colin can press buttons for them and watch them ride: 2–3 shoppers, 1–2 hotel guests, and occasional residents (default 0–3) in the old apartment house. Show their desired floor with a number bubble; let Colin operate the lift for them without requiring him to ride. Passengers wait patiently and never take over his buttons or turn the interaction into a timed task.

Sound is optional and synthesized locally. Alarm demos last three seconds, are stoppable and independently adjustable, and never start automatically. No music by default.

## Notes

The three-building game is playable. Preserve the independently running lifts, doorway interlocks, patient passengers, per-floor lights/doors, settings, and local save recovery. Physical-phone installation and sound comfort still need a device review.

Simulation state outlives rendered scenes. Use one fixed-step ticker and refs for continuous motion, not React state every frame. Pause simulation/audio when hidden; resume without elapsed-time catch-up.

Bundle assets locally. Production precaching includes the full game. Updates check on launch, reconnection, and return to the foreground. Settings/About offers a manual check and Uppdatera spelet; save before that user-requested reload. Otherwise updates wait for old clients to close. Versioned localStorage saves remain separate from service-worker caches; validate snapshots and preserve a previous valid backup.

GitHub Pages deploys through `../.github/workflows/pages.yml`. Local development defaults to `/`; CI and the local pre-commit hook build with the repository subpath in `VITE_BASE_PATH`. Use `import.meta.env.BASE_URL` in app links and public asset URLs. Keep manifest start/scope and the offline worker scoped to that same path. CI only checks formatting, builds, and deploys; keep all tests in the local pre-commit gate. Long movement tests use bounded Playwright clock steps and three local workers; keep offline/update/layout checks on normal time. Windows browser tests use Direct3D 11 for GPU rendering. Benchmark before raising concurrency: CPU rendering made four workers no faster, and GPU rendering with four workers hit a Chromium asset-download buffer error.

