# Alfred FC

A playable 3D five-a-side arcade football game with LEGO-style characters, built with React, TypeScript and Three.js. Independent from the Colin elevator game in the sibling folder.

## Play

```sh
npm ci
npm start
```

Open http://localhost:4012 with Node 22.12+. Choose **Snabbmatch** to select two clubs and play solo or local versus on one screen. The start/resume actions stay visible in a fixed bottom bar on desktop and phones. Choose a separate input for each player and a 1-, 3- or 5-minute match. Exiting a paused match replaces the pause panel with a short, focused confirmation modal; Escape returns to pause.

Solo has **Lätt**, **Vanlig** and **Svår** difficulty. Lätt gives much slower opponents, delayed reactions, weaker and less accurate shots, a slower keeper, and no opponent slide tackles. Vanlig adds moderate speed and tackling; Svår uses faster movement, quicker reactions and stronger, more accurate shots. Human players and their AI teammates keep their normal movement. Local versus treats both sides equally.

## Division play

Choose **Divisionsspel**, a club and match settings, then **Starta ligan**. Division 1 contains all 12 clubs. A double round-robin schedule has 22 rounds of six games: every pair meets once at home and once away. Play your club's 22 fixtures against AI; the other five results in each round are simulated when your game finishes. Your club appears on the left of the match scoreboard, including away fixtures; the league records results in scheduled home/away order.

The league view shows the next opponent, a table and all rounds. Wins give three points and draws one; goal difference and goals scored break ties. Completed rounds save immediately, before leaving the result screen, and cannot count twice. The season has its own validated local save and backup, separate from the current match. Reloading can resume an unfinished fixture. Abandoning that match leaves previous rounds intact and lets you replay the pending fixture. A new season asks before replacing the old table. The final table and champion remain available after all 22 games. Multiple divisions and promotion/relegation are not simulated.

League fixtures offer **Spela själv**, **Se matchen** and **Simulera direkt**. Watching lets AI control both teams with the same difficulty settings, without needing an assigned controller. Choose 1×, 2× or 5× speed before starting or during the match. Speed changes the number of fixed simulation steps; animation and camera movement follow the same pace. Pausing, backgrounding and restoring a saved viewing session retain its speed and progress. Both teams also take penalties automatically.

Direct simulation runs that same AI match without opening the pitch, yielding between batches so the menu stays responsive. A saved pending match continues from its snapshot. Progress saves during calculation; the final result and the other five games update the table once, with the latest result shown in the league view. Quick matches do not offer watching or direct simulation.

The pitch is 96 x 60: twice the original length and width. Goals, markings, formations and AI positioning follow the larger dimensions; characters and contact distances keep their size. A smooth shared camera follows the ball and nearby controlled players, widens when needed for local versus, and stops panning at the pitch edges. A live overview locates all ten players and the ball. Portrait and landscape keep their matching movement directions; the menu preview shows the whole stadium.

Each side has four outfield players and an AI goalkeeper. Keepers wear black with white gloves, a white ring and an MV marker, and stay in their own area. AI teammates use supporting positions and steer around bodies; shots favour the space away from the keeper. Control one outfielder at a time with automatic or manual switching. Player one's team attacks right in landscape and up in portrait. Rebound boards keep the ball in play; offsides and throw-ins are not simulated.

Choose from 12 clubs: Alfred FF, IFK Göteborg, Norrköping FC, Colin FF, Charlie FC, Växjö IF, Malmö IF, Jim FF, IFK Älmhult, IFK Örebro, Värnamo FF and IFK Lund. Each has its own shirt color, trim and crest. Choose both sides before kickoff; selecting the other side's club swaps them. Team choices follow the pitch preview, kits, HUD, goal/result messages, saves and rematches. Earlier saves keep their original club selections.

## Play via Wi-Fi

Choose **Spela via Wi-Fi** on both devices. The host selects **Skapa match** and the guest **Anslut**. The guest scans the host's match QR code, then shows the generated answer QR code for the host to scan. Both directions are required. Camera access is requested only after pressing **Skanna med kameran**; the camera stops after a scan, cancellation or leaving the screen. **Välj QR-bild** reads a saved image, and expandable copy/paste fields support devices without cameras.

The guest chooses a local keyboard, touch input or gamepad and presses **Jag är redo**. The host chooses both clubs and the duration, then starts from the fixed bottom bar. Both players use their own screen and input; the guest is player 2 and can use the same keyboard layout as the host on their separate device. The lobby displays each player's club. Portrait/landscape controls follow each device's camera orientation independently.

WebRTC uses local ICE candidates with no STUN, TURN, signaling server, accounts or external QR service. The host runs the fixed-step match and sends snapshots at 20 Hz; the guest sends controls and smooths the displayed positions between snapshots. Scores, tackles, cards, penalties, restarts and full time all come from the host. Only the host can start a rematch; the same connection is reused.

Either player can pause or request resume. Backgrounding, losing a controller or losing contact pauses the match for both. Resume requires both devices to be back with available inputs and a responding connection. Missing peer traffic stops play after two seconds. A closed connection or reload requires new QR codes and a new match; live network matches do not replace local match or league saves.

Use the same reachable home network, with client isolation disabled; guest Wi-Fi may block the connection. Open the HTTPS site on phones. Once the PWA is cached on both devices, the match does not need HTTP services or internet access. Real Android cameras, two physical devices and router-specific discovery still need device review; browser tests verify real WebRTC connections between isolated browser contexts, QR image decoding and copy/paste, keyboard/touch control, shared pause, disconnects, save isolation and operation with all HTTP requests blocked after caching.

## Controls

| Input | Move | Pass | Shoot / slide tackle | Switch | Sprint |
| --- | --- | --- | --- | --- | --- |
| Keyboard 1 | WASD | J | K | L | Left Shift |
| Keyboard 2 | Arrow keys | Comma or numpad 1 | Period or numpad 2 | Slash or numpad 3 | Right Shift |
| Standard gamepad | Left stick / D-pad | Bottom face button | Right face button | Left face button | Right shoulder |
| Touch | Movement pad | Passa | Skjut / glidtackla | Byt | Hold Spring |

Aim with movement when passing or shooting. Shooting assists toward the goal, favouring an open corner when there is no sideways input. Without possession, the shoot button starts a short slide in the movement direction, or toward the ball if stationary. The player must reach the ball to win it. A successful tackle knocks down the opponent briefly, gives the tackler possession, then both recover.

A slide without contact has no whistle or card. Contact uses a small area at the feet and relative motion of both players, rather than a broad proximity check. Touching the ball at any point during the slide makes it successful and clears pending body contact, including when the carrier falls. If the tackler knocks down an opponent and never reaches the ball, the referee chooses equally between a yellow card, a free kick and play-on (one third each). Only the first two stop play; announcements identify the tackler's club and shirt number. Yellow cards are counted per player and shown next to the team name; they do not cause dismissals. A free kick places an outfield taker at the contact location, moves opposing outfield players back five metres, and briefly protects the restart. AI takers play automatically. Stoppages pause the match clock. Esc, gamepad Start or Paus pauses the match.

A free-kick decision inside the tackler's own penalty area becomes a penalty. The ball moves to the painted spot, with the defending keeper in goal and all other outfield players behind the taker. After the announcement, hold movement across the goal to adjust the visible aiming line, then press Shoot. Keyboard, gamepad and touch use the same controls. Players and the match clock wait until the shot; AI takers shoot automatically. Saves and rebounds return to open play.

Connect USB/Bluetooth controllers, press a button and select them in match setup. Two gamepads, keyboard + gamepad, two keyboard layouts, and touch + an external input are supported. One touch player is supported per device. The pause screen allows input changes. Controller details include a live input test and saved button/axis mappings for nonstandard devices. Index numbers are zero-based.

Controller availability depends on browser, operating system and hardware. Production play requires HTTPS; localhost is suitable for development. Physical controllers and Android installation still need real-device review. Automated checks simulate two gamepads and simultaneous touch inputs.

## Saving and PWA

Matches save locally every few seconds and when paused or backgrounded. On launch, **Fortsätt sparad match** restores the latest valid snapshot or its backup, including slides, knockdowns, yellow cards, free-kick restarts and aimed penalties. Earlier saves gain the new rules and scale their positions to the larger pitch once, without losing scores or match time. A new match replaces the previous save. Finished or explicitly abandoned matches clear it. Match saves and controller mappings use Alfred-specific localStorage keys, separate from asset caches.

The app pauses when focus is lost or it goes into the background, without time catch-up. Portrait and landscape are supported without locking rotation. Fullscreen is available where the browser supports it.

Production builds cache the game for offline play after the first online load. Updates download in the background, then wait until old clients close or the user chooses Uppdatera spelet from the pause screen. A requested update saves the current match before reload. Service workers are disabled in development.

## Verify

```sh
npm run check       # Biome
npm run build       # TypeScript, Vite and PWA
npm test            # Fresh build, rules and desktop/phone checks on 4013
npm run verify      # Formatting and all checks
npm run icons       # Regenerate PNG app icons
```

Tests cover a complete league season, home/away scheduling, standings, result deduplication, instant/watched simulation equivalence, 1×/2×/5× timing, pause/restored viewing, direct results and league-only controls. They also check close non-contact slides, late ball wins, the three referee outcomes, difficulty, keepers, penalties, controls, rotation, saves, PWA scope and offline loading. Chromium Headless Shell is installed by pretest if missing.

For a production preview, run `npm run build` then `npm run preview` and open http://localhost:4013. Close that server before `npm test`, which owns the same port. The elevator game keeps 4010/4011.

## Structure

- `src/App.tsx`: match/season lifetime, result recording and background handling.
- `src/components/StartMenu.tsx`, `start-menu.css`: quick-match setup, league entry and persistent start actions.
- `src/game/league.ts`, `src/components/LeagueView.tsx`: schedule, table, simulated results, league saves and season UI.
- `src/components/MatchView.tsx`, `GameCanvas.tsx`: match HUD, pause/result dialogs and canvas lifecycle.
- `src/components/ControlSetup.tsx`, `TouchControls.tsx`: assignments, mapping and touch input.
- `src/game/model.ts`, `simulation.ts`: serializable state and fixed-step rules.
- `src/game/input.ts`: keyboard/gamepad/touch input, dead zones and action edges.
- `src/game/session.ts`, `storage.ts`: timing, subscriptions and validated local saves with backup recovery.
- `src/game/camera.ts`: framing for the shared follow camera, orientation and full-pitch preview.
- `src/components/PitchOverview.tsx`: live team and ball overview.
- `src/game/football-world.ts`: procedural stadium, minifigures, animation and camera; shared with the menu preview.
- `src/palette.ts`, `src/styles.css`, `src/match.css`: semantic colors and responsive layouts.
- `src/game/peer-link.ts`, `network-session.ts`: local WebRTC signaling codes, peer lifecycle, authoritative host and guest synchronization.
- `src/components/WifiLobby.tsx`, `QrExchange.tsx`: QR camera/image/copy pairing and per-device setup.
- `src/pwa.ts`: service-worker registration and requested updates.
- [PLAN.md](PLAN.md): implemented scope and remaining review work.

## Hosting and Git

[Play Alfred FC](https://jim-pettersson-github.github.io/monorepo-colin/alfred-fc/). The root Pages workflow checks and builds both games, then publishes Alfred under `/monorepo-colin/alfred-fc/` while keeping the elevator game at its existing address. Pushes to `main` affecting either game trigger a deployment; pull requests only run checks and builds. The root Git hook still checks the elevator project. Run `npm run verify` here before committing Alfred changes.

`VITE_BASE_PATH` supports hosting under a subpath and must start and end with `/`. Links, manifest and the worker use the same base. Example in PowerShell:

```powershell
$env:VITE_BASE_PATH = '/monorepo-colin/alfred-fc/'
npm test
Remove-Item Env:VITE_BASE_PATH
```
