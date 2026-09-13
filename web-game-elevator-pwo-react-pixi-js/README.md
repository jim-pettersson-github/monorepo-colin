# Colins hissäventyr

React + PixiJS, TypeScript, Vite, and an offline Android PWA. A playable Swedish exploration game for Colin: three buildings, independent elevators, manual gates, stairs, patient passengers, light switches, signs, and optional sound. Progress saves locally; there is no backend.

See [PLAN.md](PLAN.md) for Colin's preferences, game rules, and acceptance scenarios.

## Playing

Choose a floor in the building overview to preview its room without moving Colin. Tap a point in that room and he takes the stairs there. **Följ Colin** returns to his current floor. Zoom with the mouse wheel or +/− buttons; drag with the left mouse button or one finger to look around the enlarged room.

Tap the perspective floor to walk sideways, closer, or farther away, or use the large buttons. The green-signed door is the stairwell; each entry floor has a separate door marked UT for going outdoors. Colin stands beside the call button and reaches toward it. Enter the recessed cabin, choose a floor, then ride or step out and take the stairs. Stand in the doorway to keep it open. In the old house, operate both the landing door and lattice gate yourself.

Tap a person with a number to help them ride; they wait for Colin to choose their floor. Explore room lights, doors, warning signs, and green exits. Settings pause play and provide separate sound volumes, mute, camera motion, and a confirmed restart.

The cabin's back-wall buttons show 0/1/2 and light up when selected. Modern lifts have **Stäng dörrarna / Öppna dörrarna** controls. Stand in the doorway and close the doors to watch them approach Colin and bounce open; queued automatic lifts pause and retry until he steps away.

## Development

Art comparison: open `http://127.0.0.1:4010/?view=art` or use **Jämför tre konststilar** in the menu. Three original concepts can be enlarged without changing your save. Option 01 is now implemented in the playable world. Assets and their generation prompts are documented in [art-prompts.md](art-prompts.md).

Use Node 22.12+ and run commands in this directory:

```sh
npm ci
npm start
```

Open http://localhost:4010. The port is strict; an occupied port fails rather than silently changing addresses. No environment variables are required.

## Verification

```sh
npm run check
npm run build
npx playwright install chromium
npm test
```

Tests cover queues, gate interlocks, doorway obstruction, passengers, offscreen simulation, pause, and save recovery, plus desktop/phone play and fresh offline launch. Browser tests start their own preview on port 4011, which must be free. Two workers avoid competing WebGL renderers overwhelming the test machine. Use `npm run preview` for manual production review afterward.

## Structure

`src/game/model.ts` defines the world; `simulation.ts` advances it independently of rendering. `spatial.ts` handles projection, depth movement and doorway crossing; `room-interaction.ts` maps room taps to commands. `room-art.ts` layers the painted rooms and characters. `session.ts` owns simulation lifetime, local audio and saving. `storage.ts` validates version-3 snapshots, migrates versions 1/2 and recovers a valid backup.

`GameScene.tsx` connects the ticker, floor overview, pointer interaction and camera to Pixi; `GameView.tsx` provides accessible HTML controls and panels. `App.tsx` owns the menu/session and background handling. Colors live in `src/palette.ts`. `src/pwa.ts` registers the worker. Regenerate icons with `npm run icons`. `node scripts/prepare-painted-art.mjs` exports 20 local WebP assets; new prompts are in [art-source/perspective-game.md](art-source/perspective-game.md). The original `?view=depth` prototype remains available without changing saves.

## Offline and hosting

Development has no service worker. Production precaches the complete game and bundled assets. New versions download when opened online or when the connection returns; they wait for all old browser/app clients to close. No forced reload interrupts play.

For Android installation, open the deployed HTTPS site in Chrome and use its install/add-to-home-screen action. First installation needs internet. Saves use separate localStorage keys (`colin-game-v1` and `colin-game-backup-v1`); clearing browser site data removes both saves and the offline copy. Real-device installation, phone restart, update behavior, and comfortable sound levels still need manual verification.

Use Settings/About → Sök efter uppdatering → Uppdatera spelet to apply a downloaded update after saving. Checks also run on launch, reconnection, and return to the foreground. Older installations without this control need all game windows and Chrome game tabs closed before reopening. Android's installed orientation setting updates separately from game assets: enable Auto-rotate and allow Chrome to refresh the installation while closed, charging, and on Wi-Fi.

For fullscreen, choose **Helskärm** in the menu or **⛶** beside Settings during play (in landscape, open **Kontroller** first). The installed app requests fullscreen at launch; existing Android installations may retain their old display mode until Chrome updates the installation. The button works independently of that manifest update. Android/browser exit gestures remain available, and system bars may briefly reappear after a swipe.

## GitHub Pages

The [Pages workflow](../.github/workflows/pages.yml) checks relevant pull requests and pushes to `main`. It installs dependencies with Node 24, checks formatting, builds, and runs simulation plus desktop/phone browser tests, including offline play. Only a passing `main` build is uploaded and deployed; pull requests only run checks. GitHub supplies the deployment token, so no personal access token or server secrets are needed.

**[Play the hosted game](https://jim-pettersson-github.github.io/monorepo-colin/)**. The link is also in the root README and [Settings → Pages](https://github.com/jim-pettersson-github/monorepo-colin/settings/pages), which shows the last deployment. The public repository uses GitHub Actions as its Pages source.

Push reviewed changes to `main` to deploy after all checks pass. **Actions → Game checks and GitHub Pages → Run workflow** can also deploy `main` manually. A failed build leaves the previous live version in place.

The workflow derives `/monorepo-colin/` from the repository name. `VITE_BASE_PATH` controls Vite assets, links, manifest start/scope, and the service-worker fallback. To reproduce that build locally in PowerShell:

```powershell
$env:VITE_BASE_PATH = '/monorepo-colin/'
npm run build
npm test
npm run preview
```

Preview at http://127.0.0.1:4011/monorepo-colin/. Clear the variable with `Remove-Item Env:VITE_BASE_PATH` and rebuild to return to root-path preview. Ordinary `npm start` needs no variable. A future custom domain or account-root Pages site needs the workflow base changed to `/` and a fresh build.
