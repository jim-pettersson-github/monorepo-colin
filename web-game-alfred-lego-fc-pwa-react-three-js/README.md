# Alfred FC

A clean foundation for a 3D five-a-side football game with LEGO-style characters. Independent from the Colin elevator game in the sibling folder.

## Implemented

- React + TypeScript + Three.js, built with Vite.
- Swedish starter screen and a static 3D football pitch preview. No playable matches yet.
- Responsive desktop, portrait-phone and landscape-phone layouts; fullscreen button where supported.
- Alfred FC icons, manifest and offline PWA shell. Rotation is unrestricted.
- Production updates download in the background and activate only after old clients close or the user requests an update.
- Separate development/preview ports and an Alfred-specific asset cache. No backend or accounts.

## Start

Run in this folder with Node 22.12+:

```sh
npm ci
npm start
```

Open http://localhost:4012. The elevator game keeps ports 4010/4011. Service workers are disabled in development.

## Verify

```sh
npm run check       # Biome
npm run build       # TypeScript, Vite and PWA
npm test            # Fresh build and browser checks on port 4013
npm run verify      # Biome and all current checks
npm run icons       # Regenerate PNG icons from public/icon.svg
```

Tests cover rendering, responsive resizing, manifest scope and offline loading in desktop and phone layouts. Chromium Headless Shell is installed by pretest if missing. Physical phones and controllers still need device testing once controls exist.

For a production preview, run `npm run build` then `npm run preview` and open http://localhost:4013. Close that server before `npm test`, which owns the same port.

## Structure

- `src/App.tsx`: starter screen, fullscreen and update controls.
- `src/components/PitchPreview.tsx`: React canvas lifecycle and WebGL fallback.
- `src/game/pitch-preview.ts`: static Three.js pitch and GPU resource cleanup.
- `src/palette.ts`, `src/styles.css`: semantic colors and responsive layout.
- `src/pwa.ts`: production service-worker registration and user-requested updates.
- `public/`: local app icons.
- `tests/foundation.spec.ts`: foundation browser checks.
- [PLAN.md](PLAN.md): agreed game scope and future implementation stages.

## Hosting and Git

`VITE_BASE_PATH` supports hosting under a subpath; it must start and end with `/`. App links, manifest scope and the service worker use that base. For example, in PowerShell:

```powershell
$env:VITE_BASE_PATH = '/alfred-fc/'
npm test
Remove-Item Env:VITE_BASE_PATH
```

Alfred FC is not deployed. The existing root Pages workflow and pre-commit hook still target the elevator project. This project's install does not alter Git hooks. Run `npm run verify` before committing Alfred changes. A separate hosting setup can follow after the foundation is reviewed.
