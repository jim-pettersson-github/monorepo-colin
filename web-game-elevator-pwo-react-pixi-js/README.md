# Colins hissäventyr

React + PixiJS, TypeScript, Vite, and an offline Android PWA. A playable Swedish exploration game for Colin: three buildings, independent elevators, manual gates, stairs, patient passengers, light switches, signs, and optional sound. Progress saves locally; there is no backend.

See [PLAN.md](PLAN.md) for Colin's preferences, game rules, and acceptance scenarios.

## Playing

Drag with the left mouse button or one finger to look around; the mouse wheel also moves the camera. Bring a lower floor into view, then tap it to walk there. Use **Följ Colin** to bring the camera back to Colin without moving him.

Tap the floor to walk, or use the large buttons. Tap another floor and Colin takes the stairs there automatically. The green-signed door is the stairwell; each entry floor has a separate door marked UT for going outdoors. Call the lift, enter, choose a floor, then ride or step out and take the stairs. Stand in the doorway to keep it open. In the old house, operate both the landing door and lattice gate yourself.

Tap a person with a number to help them ride; they wait for Colin to choose their floor. Explore room lights, doors, warning signs, and green exits. Settings pause play and provide separate sound volumes, mute, camera motion, and a confirmed restart.

## Development

Art comparison: open `http://127.0.0.1:4010/?view=art` or use **Jämför tre konststilar** in the menu. Three local concept illustrations can be enlarged without changing your save or the game's drawing style. Assets and their generation prompts are documented in [art-prompts.md](art-prompts.md).

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

`src/game/model.ts` defines the world; `simulation.ts` advances it independently of rendering. `session.ts` owns its lifetime, audio, and saving. `storage.ts` validates versioned snapshots and recovers a previous valid backup. `art.ts` draws the illustrated world and `audio.ts` synthesizes sounds locally.

`GameScene.tsx` connects the fixed-step ticker, pointer interaction, and camera to Pixi; `GameView.tsx` provides accessible HTML controls and panels. `App.tsx` owns the menu/session and background handling. Colors live in `src/palette.ts`. `src/pwa.ts` registers the worker. Regenerate app icons with `npm run icons`.

## Offline and hosting

Development has no service worker. Production precaches the complete game and bundled assets. New versions download when opened online or when the connection returns; they wait for all old browser/app clients to close. No forced reload interrupts play.

For Android installation, open the deployed HTTPS site in Chrome and use its install/add-to-home-screen action. First installation needs internet. Saves use separate localStorage keys (`colin-game-v1` and `colin-game-backup-v1`); clearing browser site data removes both saves and the offline copy. Real-device installation, phone restart, update behavior, and comfortable sound levels still need manual verification.

## GitHub Pages

The [Pages workflow](../.github/workflows/pages.yml) checks relevant pull requests and pushes to `main`. It installs dependencies with Node 24, checks formatting, builds, and runs simulation plus desktop/phone browser tests, including offline play. Only a passing `main` build is uploaded and deployed; pull requests only run checks. GitHub supplies the deployment token, so no personal access token or server secrets are needed.

One-time setup:

1. Make the repository public for free Pages hosting.
2. In [repository Pages settings](https://github.com/jim-pettersson-github/monorepo-colin/settings/pages), choose **Build and deployment → Source → GitHub Actions**.
3. Review, commit, and push the project and workflow to `main`. Later relevant pushes deploy automatically; **Actions → Game checks and GitHub Pages → Run workflow** can also deploy `main` manually.

After the first successful deployment, the expected URL is https://jim-pettersson-github.github.io/monorepo-colin/. The pipeline is prepared locally; this does not mean the site is already deployed. Verify online play, offline launch, and phone installation at that URL afterward.

The workflow derives `/monorepo-colin/` from the repository name. `VITE_BASE_PATH` controls Vite assets, links, manifest start/scope, and the service-worker fallback. To reproduce that build locally in PowerShell:

```powershell
$env:VITE_BASE_PATH = '/monorepo-colin/'
npm run build
npm test
npm run preview
```

Preview at http://127.0.0.1:4011/monorepo-colin/. Clear the variable with `Remove-Item Env:VITE_BASE_PATH` and rebuild to return to root-path preview. Ordinary `npm start` needs no variable. A future custom domain or account-root Pages site needs the workflow base changed to `/` and a fresh build.
