# Colin and Alfred — browser games

## Colin — Elevator Explorer

**[Play the game](https://jim-pettersson-github.github.io/monorepo-colin/)**

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

Open http://localhost:4012. Production preview and browser tests use 4013. Run `npm run verify` in the Alfred folder before committing; the root hook checks Colin's game. The Pages workflow builds and publishes both games, keeping their existing URLs separate. See the [Alfred README](web-game-alfred-lego-fc-pwa-react-three-js/README.md) and [game plan](web-game-alfred-lego-fc-pwa-react-three-js/PLAN.md).
