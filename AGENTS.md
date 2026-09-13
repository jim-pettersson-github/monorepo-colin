# Colin — Elevator Explorer

A personal elevator exploration game for an autistic child around eight years old. Build around Colin's preferences: predictable interactions, large touch targets, and a calm illustrated world. Do not assume every autistic child shares his preferences.

## Where things live

| Folder | Purpose | Local port |
| --- | --- | --- |
| [web-game-elevator-pwo-react-pixi-js](web-game-elevator-pwo-react-pixi-js/) | React + PixiJS game, delivered as an Android PWA | 4010 |

Read each folder's CLAUDE.md and AGENTS.md before working there. This is standalone, with no backend, accounts, or external services.

## Writing UI

Portrait-first, painted 2.5D rooms with Swedish labels. Colin walks across a perspective floor and scales with depth. Use large HTML buttons for menus and PixiJS for the world. Prefer right-side panels for settings and information; avoid browser confirmation popups.

Keep colors in local semantic palette roles and check existing components before adding primitives. Colin has blond-brown hair, brown eyes, and bare feet: no shoes or socks. Elevators are the focus; green emergency-exit signs are a small secondary theme.

Keep rooms spacious, with normal-sized characters and doors, mouse/touch panning, and zoom. Fire signage needs a recognizable flame and detailed alarm call point. Option 01, the modern Monkey Island-inspired painted adventure, is the approved game direction: warm brass, dark wood, teal shadows, and painted characters. Keep the original comparison page as a reference.

The small building overview previews a floor without moving Colin. Tapping a destination in that room routes him through the stairs; Följ Colin returns to his floor. Keep elevator entry recessed, draw closing doors in front of cabin occupants, and make Colin stand beside the call button and reach toward it as it lights up.

## Colin's interests and game preferences

- Turning lights on and off, green exit signs, and warning signs.
- Standing in the elevator doorway to stop closing doors and make them reopen; this is a repeatable game interaction.
- Old elevators with manually operated lattice gates, as well as modern lifts.
- Pressing elevator buttons for other people and watching them ride, with or without joining them.

The game has three buildings: hotel, shopping centre, and an old apartment house. Keep passengers sparse and unhurried: 1–2 hotel guests, 2–3 shoppers, and occasional apartment residents. Follow the behavior and acceptance checks in the [game plan](web-game-elevator-pwo-react-pixi-js/PLAN.md).

## Not an npm workspace

Install and run commands inside the game folder. There is no root package, workspace configuration, or shared package dependency.

### Starting the dev server

Run `npm ci` and `npm start` in the game folder. Check port 4010 before starting another server. Do not assume a server is running or stop unrelated processes.

## Worktrees

Install dependencies independently in each worktree. Use `npm start -- --port 4012` when another checkout occupies 4010. There are no secrets or generated clients to copy.

## Formatting

Biome 2 is configured in the game folder: 160 columns, two-space indentation, and single quotes. Run `npx biome check --write <changed paths>` there. Dependencies, build output, and test artifacts are excluded.

### Prettier

Biome owns formatting. No Prettier configuration or dependency is needed; do not introduce a competing formatter.

## Deployment and PWA updates

GitHub Pages is the hosting target. `.github/workflows/pages.yml` builds and tests the game before deploying `main`. The repository must have Pages source set to GitHub Actions. `VITE_BASE_PATH` supplies the repository subpath; keep app links, icons, manifest, and service-worker scope inside it. Verify the live build after deployment.

Download updates without interrupting an open session. Let the service worker activate after old clients close. Keep saves separate from asset caches; never force a reload during play.

## CI

The Pages workflow checks relevant pull requests and pushes to `main`, with a manual trigger. It runs `npm ci`, Biome, TypeScript/build, and Playwright against the same repository-path artifact it deploys. Pull requests never deploy. Keep deployment permissions scoped to the deploy job.

## Documentation style

Keep sections short and factual. Distinguish implemented behavior from future plans; never describe planned files, tooling, or services as already present.

## Code preferences and style

Prefer simple, self-documenting code and local logic. Extract reusable components or substantial shared behavior when useful; avoid speculative abstractions. Separate logical steps with one blank line and keep proper indentation.

## Finishing work

Touch only relevant files and check changed code. Do not commit or push unless explicitly requested; leave changes available for review.

## Dev flow — localhost

Use port 4010 for development and 4011 for production preview. Service workers are disabled in development; test offline behavior against production preview. Gameplay is implemented locally; hosting and real-phone installation remain separate review steps.

