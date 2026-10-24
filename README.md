# Spelhörnan — browser games

**[Choose a game](https://jim-pettersson-github.github.io/monorepo-colin/)** at the root game selector.

| Game | Published path | Development / preview |
| --- | --- | --- |
| Colins hissäventyr | `colin-elevator/` | 4010 / 4011 |
| Alfred FC | `alfred-fc/` | 4012 / 4013 |
| Charlie for Speed | `charlie-fs/` | 4014 / 4015 |
| Sagospelen | `sagospelen/` | 4016 / 4017 |

Every game is an independent npm project. The shared workflow builds all four, then `.github/scripts/assemble-pages.mjs` creates `pages-site/` with the static selector at its root. The selector caches only its own assets and leaves each game's worker scope and saves separate. Elevator saves retain their original same-origin localStorage keys. Old installed root shortcuts open the selector after the normal update; active sessions are never forcibly reloaded.

## Colin — Elevator Explorer

**[Play the elevator game](https://jim-pettersson-github.github.io/monorepo-colin/colin-elevator/)**

The hosting link is also under [Settings → Pages](https://github.com/jim-pettersson-github/monorepo-colin/settings/pages). Updates publish automatically after the [Pages workflow](https://github.com/jim-pettersson-github/monorepo-colin/actions/workflows/pages.yml) passes on `main`.

A personal, illustrated elevator game built with React + PixiJS. Explore three buildings with Colin, operate elevators for passengers, experiment with doors and lights, and continue from a local save.

```sh
cd web-game-elevator-pwo-react-pixi-js
npm ci
npm start
```

Open http://localhost:4010. `npm ci` installs the local pre-commit hook; `npm test` installs its browser automatically if missing. Tests run before committing; GitHub only checks formatting, builds, and deploys. See the [game README](web-game-elevator-pwo-react-pixi-js/README.md) for checks and offline preview, and [AGENTS.md](AGENTS.md) for project guidance.

## Alfred FC

A separate React + Three.js five-a-side football game with LEGO-style characters. Solo versus AI and local two-player matches support keyboard, touch and browser-visible gamepads. **[Play Alfred FC](https://jim-pettersson-github.github.io/monorepo-colin/alfred-fc/)**.

```sh
cd web-game-alfred-lego-fc-pwa-react-three-js
npm ci
npm start
```

Open http://localhost:4012. Production preview and browser tests use 4013. Run `npm run verify` in the Alfred folder before committing; the root hook checks Colin's game at its relocated Pages path. See the [Alfred README](web-game-alfred-lego-fc-pwa-react-three-js/README.md) and [game plan](web-game-alfred-lego-fc-pwa-react-three-js/PLAN.md).

## Sagospelen

[Play Sagospelen](https://jim-pettersson-github.github.io/monorepo-colin/sagospelen/). A mixed Disney cast competes in 20 individual athletics events, with solo and shared-screen play, keyboard/touch/gamepad input, personal records and an optional six-event championship. Its standalone folder is `web-game-disney-track-and-field-pwa-react-canvas`.

Run `npm run verify` there for game checks and `npm run test:hosting` after all four hosted-path builds for the combined selector, scopes and save-preservation checks. The combined preview uses port 4018. The root pre-commit hook still checks the elevator game; CI runs formatting and builds, with tests local.
