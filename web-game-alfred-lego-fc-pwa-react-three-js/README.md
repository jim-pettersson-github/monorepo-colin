# Alfred FC

A playable 3D five-a-side arcade football game with LEGO-style characters, built with React, TypeScript and Three.js. Independent from the Colin elevator game in the sibling folder.

## Play

```sh
npm ci
npm start
```

Open http://localhost:4012 with Node 22.12+. Choose **Snabbmatch** to select two clubs and play solo or local versus on one screen. The start/resume actions sit below the mode tabs and scroll with the page without covering settings. Update controls appear directly below the header. Choose a separate input for each player and a 1-, 3- or 5-minute match. Exiting a paused match replaces the pause panel with a short, focused confirmation modal; Escape returns to pause.

Solo has **Lätt**, **Vanlig** and **Svår** difficulty. Lätt gives much slower opponents, delayed reactions, weaker and less accurate shots, a slower keeper, and no opponent slide tackles. Vanlig adds moderate speed and tackling; Svår uses faster movement, quicker reactions and stronger, more accurate shots. Human players and their AI teammates keep their normal movement. Local versus treats both sides equally.

## Cup play

Choose **Cupspel** for three separately saved competitions. **Alfredcupen** includes all twenty clubs from both divisions in direct elimination: twelve drawn byes into the round of 16, then quarterfinals through final (19 fixtures). **Mästarpokalen** starts with two ten-club groups, with nine single round-robin games per club; the top two qualify for A1–B2 and B1–A2 semifinals, followed by the final (93 fixtures). Group ties use points, goal difference, goals scored and finally alphabetical Swedish team-name order. Knockout draws continue with untimed golden goal, using the normal controls and match rules. Saved twelve-club cups retain their original byes, group sizes and schedules until finished or replaced.

All cups support solo, shared-screen opponents, two-device QR matches, watching at 1×/2×/5× and direct simulation. Your chosen team always appears on the left of the scoreboard. Other fixtures in its round resolve automatically. After elimination, the remaining bracket completes and shows the winner. Results commit once; leaving an unfinished match preserves the earlier cup rounds. Unfinished local matches can resume after reload. Each cup has a validated save and backup, separate from the other cups and the division season. Starting over asks before replacing that cup. Wi-Fi records results only on the host and reconnects for each fixture.

**Världscupen** is a five-a-side national-team cup with 24 countries: Sweden, Denmark, Norway, Finland, Iceland, Spain, Argentina, France, England, Brazil, Portugal, Netherlands, Belgium, Germany, Croatia, Morocco, Italy, Colombia, USA, Mexico, Uruguay, Switzerland, Japan and Iran. Local SVG flags and national kit colours identify the teams; the away side changes to its alternative kit when the primary shirts are similar. Six groups of four play three games per country. The top two from each group and the four best third-place teams reach the round of 16, followed by quarterfinals, semifinals and the final (51 fixtures total). The six group winners and two best runners-up are seeded; round-of-16 pairings avoid the same group. This is the game's own format, not the official current World Cup schedule. Quick matches, club cups and the league use the separate twenty-club roster.

The selection uses the top 18 in the men's ranking of 22 December 2025, Iran (20) to include a second Asian side, and all five Nordic countries. FIFA covers the world, while UEFA covers Europe. See [FIFA's year-end report](https://inside.fifa.com/fifa-rankings/world-ranking/men/news/coca-cola-december-2025-rank-spain-top-morocco-arab-cup-win) and the [December top-20 list](https://fieldlevelmedia.com/news/spain-ends-2025-atop-fifa-mens-world-rankings-u-s-stays-14th/). Ranking determines this roster; selected difficulty controls gameplay, with no national strength multiplier. All play and assets remain local; these reference links are optional reading.

## Players and transfers

**Trupp & transfers** manages a persistent club squad and wallet, independently of a season or cup restart. The domestic pool contains 200 players: 129 players prominent from 2016 onward, 52 classic legends and 19 family players, including Pelé (1970), Ronaldinho (2005) and Zlatan Ibrahimović (2013). Each appears once, at an estimated prime season. Twenty clubs each start with 6,000 coins and ten stars: two keepers, two defenders, three midfielders and three forwards. Family assignments are fixed first. A deterministic role-based draft and swaps between players in the same position balance the remaining stars without moving family players. Initial squad totals differ by at most five points. The old domestic 10/20/30/40 rating-band distribution is replaced by the star roster.

The selection is informed by [FIFPRO World 11 history](https://www.fifpro.org/en/articles/2023/10/history-mens-world-11) and [Ballon d’Or records](https://www.uefa.com/ballondor/news/0287-195e642735da-0594342b9554-1000--history-of-the-ballon-d-or-all-the-winners/), with additional famous players. Ratings and prime-year choices are our arcade estimates, not official ratings, current form or current club affiliations. Cards show era, country, position and prime year; filters include era and all four positions. Names, identities, stats and initial assignments are fixed on every device. National teams keep their existing 240 fictional players and cannot trade; the club roster contains 200 players, including 181 famous footballers and 19 family players.

Existing domestic player slots are upgraded to stars without changing their IDs or keeper roles. The economy upgrade preserves their purchased ownership, wallets, pending matches, reward ledgers and signing protection, adding the new squads and club wallets. Earlier 16-club development saves can also upgrade. Saved lineups retain their slot identities. National player IDs and stats remain unchanged.

Petterssons FC starts with Colin Pettersson (92), Jim Pettersson (93) and Jonas Pettersson (90). IFK Katona starts with Alfred Katona (98), Charlie Katona (96), Jim Katona (94), Jan Katona (91), Geza Katona (89) and Colin Katona (100). IF Danielsson has Alfred Danielsson (99), Charlie Danielsson (97) and eight generated Danielssons: Emil (91), Oscar (93), Anton (94), Viktor (92), Leo (95), Hugo (93), Lucas (96) and Noah (95). Family cards are labelled separately and can be traded like other players. These are starting assignments, not permanent transfer restrictions.

The 0–100 stats are overall, pace, shooting, passing, defending and goalkeeping. Open **Välj startfemma** in match setup or **Trupp & transfers** to select one keeper and four outfield players. Selections save per club (including national teams) and apply to quick matches, leagues, cups, viewing and simulation. **Familjen först** prefers family players; **Välj automatiskt efter betyg** restores the strongest-player selection. Selecting an existing starter in another outfield slot swaps their positions. Transfers repair only slots whose selected player has left; new signings do not displace a manual choice. Pace and keeping affect movement; shooting affects power and accuracy; passing affects pass speed; defending affects tackle recovery. Difficulty remains separate. Match snapshots preserve identities through restarts, reloads and WebRTC play.

Pause and open **Spelarbyten**, select **Spelare ut** and **Spelare in**, then **Genomför byte**. Unlimited rolling substitutions use the roster snapshot saved at kickoff, preserve the match clock and positions, and survive local reloads and subsequent kickoffs. Goalkeepers exchange only with goalkeepers. Players retain their own yellow cards when going off and returning; bench cards remain in the team total. Substitutions wait until a free kick/penalty or a sliding/fallen outgoing player has recovered. They affect this match, while the saved starting preference stays unchanged. The controlled player's name appears on the pitch badge.

On one device, solo players manage their own side and shared-screen players can manage either side. In a peer match, the host and guest each choose their own starting five before kickoff; the guest chooses from the host's squad snapshot. An already saved fixture keeps its original starters. During play each peer can substitute only its own team, with the host validating roster membership, slot, phase and pause state before broadcasting the change. The guest's local career and match saves stay separate. Old local matches gain a bench when resumed; older peer sessions without roster snapshots can use substitutions from their next match.

Completed matches pay 400 coins for a win, 300 for a draw and 200 for a loss. A league title adds 8,000 (second 4,000, third 2,000); winning Alfredcupen adds 6,000, Mästarpokalen 8,000, and Världscupen 10,000. National-match earnings go to the chosen domestic club. Watching and instant simulation also count. Results and competition prizes have independent deduplication IDs; abandoning an unfinished match pays nothing. Only the network host updates the local economy.

Between matches, buy players at their rating-based value, sell for 80%, or swap with a cash difference at full values. Both clubs must be able to afford the deal and retain at least five players, including a keeper and four outfield players. New signings are protected from AI purchases for three completed matches. AI makes at most one transfer attempt per match, on a 20% chance; attempts to buy your players need a 5% roll and a five-match cooldown, with full-value payment. It cannot force your squad below its minimum. The transfer window stays closed while a local match is saved or active. A result-screen button opens it after full time. Separate validated economy storage includes a backup.

## Division play

Choose **Divisionsspel**, a club and match settings, then **Starta ligan**. Twenty clubs are split into two divisions of ten. Each division has a double round-robin schedule of eighteen rounds: every pair meets once at home and once away, with no cross-division league fixtures. The season has 180 fixtures across both divisions. Play your club's eighteen matches against AI or a friend; the other nine results across both divisions resolve after your match. A division selector shows either table or schedule. Your club appears on the left of the match scoreboard, including away fixtures; the league records results in scheduled home/away order.

Wins give three points and draws one; goal difference and goals scored break ties. Completed rounds save immediately and cannot count twice. After the season, the bottom two in Division 1 exchange places with the top two in Division 2. **Starta nästa säsong** applies these movements, retains the chosen club and settings, increments the season number and builds new schedules. Wallets and transfers persist. No promotion occurs during an unfinished season. Each division awards the same league prize amounts.

The season has its own validated local save and backup, separate from the current match. Reloading can resume an unfinished fixture. Abandoning that match leaves previous rounds intact. A replacement season asks before replacing the old table. Saved original twelve-team leagues keep their 22-round, 132-fixture schedule until finished or replaced; the following season enters the new two-division structure.

League fixtures offer **Spela själv**, **Två på samma skärm**, **Två via Wi-Fi**, **Se matchen** and **Simulera direkt**. Player 1 controls the season club; player 2 controls the scheduled opponent. Shared-screen play uses separate keyboards or controllers and can resume from a saved fixture. For Wi-Fi, the season owner hosts the fixed fixture and the friend joins from **Spela via Wi-Fi**. Only the host records the completed result; guest saves stay separate. Abandoned fixtures do not count. Connect again for each league fixture. Watching lets AI control both teams with the same difficulty settings, without needing an assigned controller. Choose 1×, 2× or 5× speed before starting or during the match. Speed changes the number of fixed simulation steps; animation and camera movement follow the same pace. Pausing, backgrounding and restoring a saved viewing session retain its speed and progress. Both teams also take penalties automatically.

Direct simulation runs that same AI match without opening the pitch, yielding between batches so the menu stays responsive. A saved pending match continues from its snapshot. Progress saves during calculation; the final result and the other nine games update the table once, with the latest result shown in the league view. Quick matches do not offer watching or direct simulation.

The pitch is 96 x 60: twice the original length and width. Goals, markings, formations and AI positioning follow the larger dimensions; characters and contact distances keep their size. A smooth shared camera follows the ball and nearby controlled players, widens when needed for local versus, and stops panning at the pitch edges. A live overview locates all ten players and the ball. Portrait and landscape keep their matching movement directions; the menu preview shows the whole stadium.

The stadium has textured mowing stripes, complete pitch markings, fine goal netting, corner flags, stepped seating with spectators and light towers. Rounded brick players wear numbered shirts, trim, socks and detailed boots; the panelled football rolls with its movement. Filmic lighting and contact shadows keep the figures grounded. Repeated stadium and animated player parts share instanced draws, resolution adapts to frame rate, and phones use contact shadows without a sun shadow map. Paused matches redraw only when the view or state changes.

Each side has four outfield players and an AI goalkeeper. Keepers wear black with white gloves, a white ring and an MV marker, and stay in their own area. AI teammates use supporting positions and steer around bodies; shots favour the space away from the keeper. Control one outfielder at a time with automatic or manual switching. Player one's team attacks right in landscape and up in portrait. Rebound boards keep the ball in play; offsides and throw-ins are not simulated.

Choose from 20 clubs: Alfred FF, IFK Göteborg, Norrköping FC, Colin FF, Charlie FC, Växjö IF, Malmö IF, Jim FF, IFK Älmhult, IFK Örebro, Värnamo FF, IFK Lund, Stockholm Stjärnor, Uppsala United, Helsingborg BK, Norrsken FC, Petterssons FC, IFK Katona, IF Danielsson and Småland United. Each has its own shirt color, trim and crest. Choose both sides before kickoff; selecting the other side's club swaps them. Team choices follow the pitch preview, kits, HUD, goal/result messages, saves and rematches. Earlier saves keep their original club selections.

## Play via Wi-Fi

Choose **Spela via Wi-Fi** on both devices. The host selects **Skapa match** and the guest **Anslut**. The guest scans the host's match QR code, then shows the generated answer QR code for the host to scan. Both directions are required. Camera access is requested only after pressing **Skanna med kameran**; the camera stops after a scan, cancellation or leaving the screen. **Välj QR-bild** reads a saved image, and expandable copy/paste fields support devices without cameras.

The guest chooses a local keyboard, touch input or gamepad and presses **Jag är redo**. The host chooses both clubs and the duration, then starts with **Starta Wi-Fi-match**. Both players use their own screen and input; the guest is player 2 and can use the same keyboard layout as the host on their separate device. The lobby displays each player's club. Portrait/landscape controls follow each device's camera orientation independently.

**Room codes:** when built with `VITE_ROOM_SERVER` (the Pages build uses https://games.charliecare.se/api.php), the host also gets a four-character room code. The guest selects **Anslut** and types it instead of swapping QR codes. This works on the same Wi-Fi and over the internet. The server only swaps the pairing codes, and public STUN servers help the devices find each other. Some strict mobile or school networks still block direct contact, because there is no relay. QR pairing stays available under **Ingen internet? Para ihop med QR-kod**, and the lobby falls back to it when the server cannot be reached.

QR pairing uses local ICE candidates with no STUN, TURN, signaling server, accounts or external QR service. The host runs the fixed-step match and sends snapshots at 20 Hz; the guest sends controls and smooths the displayed positions between snapshots. Scores, tackles, cards, penalties, restarts and full time all come from the host. Only the host can start a rematch; the same connection is reused.

Either player can pause or request resume. Backgrounding, losing a controller or losing contact pauses the match for both. Resume requires both devices to be back with available inputs and a responding connection. Missing peer traffic stops play after two seconds. A closed connection or reload requires new QR codes and a new match; live network matches do not replace local match, cup or league saves; the host records only its completed competition fixture.

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

## Sound

Procedural Web Audio effects cover passes, shots, sliding, tackle impacts, goalkeeper catches, board rebounds, goals, kickoff/referee whistles and the final whistle. Effects are generated locally and work offline. Sound starts only after a user interaction, at a default 35% volume. Use the speaker icon in the menu, Wi-Fi lobby or pitch to mute; **Ljudinställningar** in the menu and the pause panel also provide volume. Each device saves its own mute and volume settings.

Effects follow observed match events in local play, match viewing and on each Wi-Fi device. They do not change simulation or network state. Pausing, backgrounding and leaving a match stop active effects; restored matches and resumed play do not replay old events. Fast match viewing keeps normal sound pitch and limits repeated effects. Direct league simulation stays silent.

## Saving and PWA

Matches save locally every few seconds and when paused or backgrounded. On launch, **Fortsätt sparad match** restores the latest valid snapshot or its backup, including slides, knockdowns, yellow cards, free-kick restarts and aimed penalties. Earlier saves gain the new rules and scale their positions to the larger pitch once, without losing scores or match time. A new match replaces the previous save. Finished or explicitly abandoned matches clear it. Match saves and controller mappings use Alfred-specific localStorage keys, separate from asset caches.

The app pauses when focus is lost or it goes into the background, without time catch-up. Portrait and landscape are supported without locking rotation. Fullscreen is available where the browser supports it.

Production builds cache the game for offline play after the first online load. Updates download in the background, then wait until old clients close or the user chooses **Uppdatera spelet** from the start menu or pause screen. A requested update saves the current match before reload. Service workers are disabled in development.

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
- `src/components/StartMenu.tsx`, `start-menu.css`: quick-match setup, league entry and inline start actions.
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
- `src/game/sound.ts`, `src/components/SoundControls.tsx`: match event cues, procedural effects and saved per-device mute/volume.
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
