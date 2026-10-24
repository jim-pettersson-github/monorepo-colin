# Sagospelen

A standalone Disney-character athletics game, built from the repository's React/TypeScript/Vite/PWA base. The SNES-inspired side-scrolling world uses Canvas 2D. Local procedural character art, a painted stadium, four competitors, keyboard, touch and browser-visible gamepads. No accounts, backend or external game assets at runtime.

## Run

Use Node 22.12+. npm ci, npm start, then http://127.0.0.1:4016/. Production preview and Playwright use 4017. Run npm run verify for formatting, a fresh production build, simulation and desktop/portrait/landscape checks. npm run check:hosting checks the root selector and deployment scripts. The new project keeps the same standalone structure and inherited fullscreen, offline and requested-update components; unneeded football/Three.js dependencies are removed.

## Play

Twenty individual events: 100/200/400 m, 800/1500/5000/10000 m, marathon, 110/400 m hurdles, steeplechase, half-marathon race walking, long jump, triple jump, high jump, pole vault, shot put, discus, hammer and javelin. No team events or relays. The catalogue follows the individual event families in the [LA28 athletics programme](https://la28.org/en/games-plan/olympics/athletics.html); rules and distances are simplified for an arcade game. Long races compress distance/time and finish in roughly 30–60 seconds of play. No official world records are claimed.

Choose from twenty characters: Musse Pigg, Mimmi Pigg, Kalle Anka, Elsa, Stitch, Simba, Vaiana, Rapunzel, Långben, Kajsa Anka, Anna, Olof, Aladdin, Jasmine, Mulan, Belle, Ariel, Woody, Buzz Lightyear and Baymax. The character picker has a larger animated preview; portraits and in-game athletes share shaded, articulated Canvas illustrations. Characters have identical movement parameters. Easy, normal and hard adjust AI speed. One to four players share a screen, with AI filling the remaining four lanes. Each player chooses a different character and a separate keyboard group or gamepad; touch controls can share a screen. Alternatively, choose Spela via Wi-Fi to connect two to four devices, with one person per device and AI filling unused lanes.

Hold-to-run is the default. Classic mode uses alternating steps. Player 1: A/D and Space to jump or throw. Player 2: left/right arrows and Enter. Player 3: J/L and I. Player 4: V/N and B. Esc pauses. Some keyboards limit simultaneous key presses; gamepads avoid this keyboard limitation. Touch buttons accept independent pointers, including four players. Gamepads use bottom/left face buttons for steps, right face button for action, Start for pause; custom button mappings are saved. A disconnect or background event pauses without time catch-up. Real hardware compatibility still needs physical-device review.

Jumps/throws have three attempts, with the best valid result retained. Triple jump requires another action after each landing. High jump and pole vault use rising bars and report the best cleared height. Crossing the takeoff line without acting is a foul. Steeplechase water obstacles slow missed jumps more than ordinary hurdles. Race walking penalizes jumping. These are arcade interpretations, not full official judging rules.

An optional individual six-event championship uses 100 m, 200 m, hurdles, long jump, javelin and shot put. Places earn 5/3/2/1 points; ties share place points. Results record once. Personal bests keep hold and rhythm modes separate.

## Wi-Fi multiplayer

The host chooses an event or championship, characters and running style. Each guest exchanges QR codes with the host and confirms readiness; changing the settings requires confirmation again. Camera scanning, QR-image upload and manual code copying are supported. Each device can use keyboard, touch or a browser-visible gamepad. Desktop and mobile browsers can play together on a reachable LAN.

The host runs the simulation and broadcasts validated snapshots. Guests send only their controls. The host advances attempts, events and rematches. Any peer can pause; backgrounding, controller loss, stale data or disconnection stops the competition for everyone. Reconnect after a reload or broken connection. Wi-Fi sessions and results never overwrite local saves or records. There is no game server, STUN, TURN or signaling service; guest-network isolation can prevent pairing. The loaded PWA works without HTTP access during play, including QR-image decoding. Physical cross-device LAN checks remain a separate review step.

## Saves and updates

The active event/championship saves periodically, on pause and before a requested update. A validated backup can recover a corrupted primary save. Settings, controller mappings, sound preference and personal records use Sagospelen-specific storage keys. Asset caches stay separate. Effects unlock on interaction, have a mute toggle and stop during pause/backgrounding.

Production builds precache the game and art. Updates check on launch, reconnection and return to the foreground. The update control appears near the top of the menu and in the pause dialog. A new worker waits for old clients to close or an explicit update; no forced reload during play.

## Hosting

[Game selector](https://jim-pettersson-github.github.io/monorepo-colin/), [Sagospelen](https://jim-pettersson-github.github.io/monorepo-colin/sagospelen/). The Pages workflow builds all four independent projects and assembles them with .github/scripts/assemble-pages.mjs. Elevator: colin-elevator/; football: alfred-fc/; racing: charlie-fs/. Each game has its own worker scope and caches. Root selector updates do not intercept game routes. Existing elevator saves remain on the same origin and use their original keys.

See ARTWORK.md for the generated stadium source and prompt. Tests cover all twenty event results, input styles, hurdles, jumps/throws, championship totals, invalid saves, backups, pause/resume, one-to-four-player controls and offline/subpath behavior. Physical Android/controller checks remain a separate review step.
