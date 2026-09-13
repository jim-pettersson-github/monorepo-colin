# Colin — Elevator Explorer

**[Play the game](https://jim-pettersson-github.github.io/monorepo-colin/)**

The hosting link is also under [Settings → Pages](https://github.com/jim-pettersson-github/monorepo-colin/settings/pages). Updates publish automatically after the [Pages workflow](https://github.com/jim-pettersson-github/monorepo-colin/actions/workflows/pages.yml) passes on `main`.

A personal, illustrated elevator game built with React + PixiJS. Explore three buildings with Colin, operate elevators for passengers, experiment with doors and lights, and continue from a local save.

```sh
cd web-game-elevator-pwo-react-pixi-js
npm ci
npm start
```

Open http://localhost:4010. `npm ci` installs the local pre-commit hook; install its browser once with `npx playwright install chromium`. Tests run before committing; GitHub only checks formatting, builds, and deploys. See the [game README](web-game-elevator-pwo-react-pixi-js/README.md) for checks and offline preview, and [AGENTS.md](AGENTS.md) for project guidance.
