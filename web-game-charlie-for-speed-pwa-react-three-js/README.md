# Charlie for Speed

An arcade sports-car racer inspired by late-1990s supercar racing games, with modern graphics, built with React, Three.js and Vite and delivered as an offline-capable PWA. Swedish UI.

## Implemented

- **Six tracks:** two circuits (Växjö Motorring, Rheinland-Ring), two city tracks (Stockholm City at blue hour, Hamburg Hafen with warehouses and cranes) and two country roads (Smålandsslingan through fields and farms, Schwarzwaldpass with hairpins and a castle). Each has a lit tunnel.
- **Nineteen 1990s cars**, from the [requested Need for Speed III PC racer list](https://nfs.fandom.com/wiki/Need_for_Speed_III:_Hot_Pursuit/Cars_(PC)): Ford Falcon GT, Aston Martin DB7, HSV VT GTS, Jaguar XK8 and XKR, Mercedes-Benz SL600 and CLK-GTR, Lamborghini Countach and Diablo SV, the Corvette and ’98 Indy 500 Pace Car, Spectre R42, Ferrari 355 F1 Spider, 456 M GT and 550 Maranello, Italdesign Scighera, El Niño, Jaguar XJR-15 and Lister Storm. Local procedural models have individual body sections, wheelbase and cabin profiles, tight circular wheel openings, flush reflector headlights, model-specific rear lights and exhausts, glazing seals, wipers, bonnet/deck seams and machined wheel lips. The Spider and Indy Corvette have open cockpits; the SL600 wears its hardtop. The showroom displays the cars with lights off, matching the reference views. The purple/yellow Indy livery stays local. No reference photos are bundled.
- **Career:** start with 25 000 kr, buy a car, enter six cups across classes C, B and A, earn points and prize money, and upgrade engine, tyres and brakes in three steps. Seven rivals earn money too and buy upgrades after every cup, so winners get faster. Progress is saved on the device.
- **Car classes:** C (about 255–265 km/h), B (290–300) and A (305–345). Quick races pick rivals from your car's class.
- **Races** against seven AI drivers: 1, 2, 3 or 5 laps, three difficulty levels, automatic or manual gearbox, countdown with start lights, lap and best-lap times, positions, wrong-way warning and a results table. Best laps are saved per track.
- **Driving model:** fixed-step arcade physics with a gearbox, grip-limited steering that narrows with speed (so keys turn at the tyre limit instead of scrubbing), downforce that grows with speed in the faster classes, handbrake slides, grass slowdown, barrier scrapes and car-to-car contact. Brakes stop a class A car from 300 to 100 km/h in about 160 m.
- **HUD:** analog tachometer with redline, digital speed, gear, position, lap, timers and a live track map with a chequered start and finish line. Each time you cross the line it shows the gap to the car ahead (red, `+1.25`) and, once it crosses too, to the car behind (green, `−0.80`).
- **Topplistor (scoreboard):** every finished race, local, career or online, sends the player's best lap to the room server with their name (asked for on the results screen if none is set), car, gearbox and whether it was online. Quick races alone and online rank on one list, where **Läge** shows Ensam or Online; career races have their own list (**Karriär**), since career cars carry bought upgrades. **Topplistor** in the main menu shows each track's top 20 by each player's best lap, every track's record and an overall table where placings on each track give 10, 8, 6, 5, 4, 3, 2 and 1 points beside each driver's best laps added up, for all time, the last 30 days or the last 7 days. Laps that cannot be sent wait on the device and go up when the game next opens with a connection. Players are the device's own made-up id; there are no accounts, so the lists trust the game.
- **Cameras:** chase, far chase and bumper, plus an intro sweep and a finish orbit.
- **Controls:** keyboard, standard gamepads and on-screen touch pads on phones.
- **Sound:** four synthesised engine characters respond to revs, throttle load and gear changes. Separate tyre squeal, asphalt/kerb/grass rumble, wind, barrier scrapes and cushioned impacts share a compressed mix; tunnels add short exhaust echoes. Sound stays local, with no audio downloads. Volume is saved per device and adjustable in Settings and Pause, alongside mute. Pausing or backgrounding suspends audio; exiting releases the audio context.
- **Effects:** translucent tyre smoke, fading paired skid marks, grass dust, barrier sparks, sun haze and lens flare. Headlight pools illuminate the road on evening tracks and inside tunnels. Skid marks use a fixed 1,024-segment pool and fade over 35 seconds; marks and headlights add at most two draw calls.
- **Body designs:** fourteen independent width/elevation profiles, with angular wedge, rounded fastback, muscle-car and prototype sections; different canopy positions, roof widths, wheel sizes, rear tyre widths and sculpted intake surrounds. The Velox has raised round headlamp pods, the Stallion has side exhausts, and the NX-R has a black roof. `node scripts/capture-car-lineup.mjs` captures identical-paint, side-profile and colour comparisons while the development server runs on 4014.
- **Graphics:** filmic tone mapping, cloud and sky reflections on paint and tinted glass, fine door seams, rough asphalt and real-time car, building and grandstand shadows on desktop.
- **Performance:** car wheels use instancing; distant rivals switch to simpler versions of their own body shape. Modelled foliage, tyre walls and posts use spatial groups so off-screen sections can be culled. Static scenery and car bodies are merged by material, and high-density phones skip multisampling. Below 30 fps the game steps its graphics down (resolution first, then shadows, smoke and sparks, view distance and car detail) and climbs back when there is room; the next race starts at the step the last one ended on. Empty particle systems and off-screen showrooms skip rendering.

## Online multiplayer

Online quick races support 2–8 devices, one player per device, with AI filling the eight-car grid. The host chooses the track, laps and car; each guest chooses their own car. Guests join from the open-game list or with a four-character room code. Everyone sees the player list and readiness; changing settings requires a fresh confirmation. The host can hide the listing or remove a player.

The [room server](../game-server/README.md) swaps WebRTC pairing data; the race runs directly between devices with host-owned simulation and results. The Pages build uses `VITE_ROOM_SERVER=https://games.charliecare.se/api.php`. Public STUN servers help devices connect, and a configured TURN relay supports strict networks. Connection attempts time out with a retry message. Each device has its own camera and keyboard, touch or gamepad controls. Everyone pauses on backgrounding, controller loss, stale data or disconnection. Solo races and careers remain playable offline.

Online quick races allow all 19 cars together across career classes. Acceleration, top speed and brakes move 90% toward one shared baseline; grip and downforce are equal. Per-car engine trims in `src/game/online-trims.ts` compensate for the remaining differences. Career races, including online careers, keep full specifications and purchased upgrades. The lobby shows a rotating car preview and track map, and each driver's name appears in the lobby, standings and above their car. Quick online races preserve career progress and lap records.

Guests predict their own car from their own input, so it reacts at once, and quietly blend in the host's corrections; other cars glide between the host's 25 snapshots a second, drawn 90 ms in the past. Snapshots travel on an unordered data channel so a lost packet never stalls the next one. A brief network drop gets 10 seconds to recover before the link is given up. Everyone pauses on backgrounding, controller loss, stale data or disconnection. All players finish, with a 30-second allowance after the first human finish before estimated results for an unfinished driver. The host can restart on the same connection. Quick Wi-Fi races do not modify career progress or lap records. QR pairing uses no game server, STUN, TURN or signaling service; use a reachable LAN and avoid isolated guest networks. After loading the PWA, pairing and play work without HTTP services. Physical desktop/phone LAN and gamepad checks remain a separate review step.

### Online career

Online-karriär runs the career cups for 2–8 devices. The host creates a session (Ny start: everyone begins with 25 000 kr; Egna bilar: everyone brings a copy of their solo garage, which stays untouched) or resumes a saved one. Each player buys cars and upgrades on their own device, the host picks cups and starts races, and AI rivals upgrade from their winnings. The host saves the session and guests retain a copy. Returning devices keep their progress; a new player can join from the hub and start from scratch. Physical desktop/phone LAN and gamepad checks remain a separate review step.

Career classes retain C/B/A, split 7/6/6 by a combined reference score (35% acceleration, 40% top speed, 25% brakes):

| Class | Cars |
| --- | --- |
| C | Falcon GT, DB7, HSV VT GTS, XK8, XKR, SL600, Countach |
| B | ’98 Indy Pace Car, Corvette, Spectre R42, 355 F1 Spider, 456 M GT, Scighera |
| A | El Niño, 550 Maranello, Diablo SV, XJR-15, Storm, CLK-GTR |

The source ratings are recorded in `src/game/cars.ts`. Displayed km/h, acceleration times and braking values are arcade conversions, not real-world specifications. Existing saves migrate car IDs while retaining money, upgrades, records and cup progress. A migrated garage that would lose access to class C gets a free Falcon GT; rivals retain a valid car in each class.

Run `node scripts/tune-online.mjs` to check balance, or add `--write` to recalibrate after physics changes. It compares all 19 cars over two laps on all six tracks with the same AI driver and no traffic. The current largest lap-time spread is below 1%; this is a deterministic simulation check, not a guarantee for every driving style. `CFS_DEV_PORT=4014 node scripts/capture-car-lineup.mjs` captures front, side and rear comparisons against a running development server, plus detailed/distant draw counts and triangle counts in test-results/car-metrics.json. Set the CFS_CAPTURE_CAR environment variable to a car ID for a close-up.

## Controls

| Action | Keyboard |
| --- | --- |
| Throttle / brake (and reverse) | Up / Down or W / S |
| Steer | Left / Right or A / D |
| Handbrake | Space |
| Shift up / down (manual) | E / Q |
| Camera | C |
| Back on track | R |
| Pause | Esc or P |
| Sound on/off | M |

## Code layout

- `src/game` — track paths, cars, physics, AI, race rules, input, audio and storage. No Three.js, so it runs headless in tests.
- `src/render` — procedural textures, car models, track world, scenery and the race renderer.
- `src/components` — React menus, HUD, touch controls and the race screen.

## Commands

```bash
npm ci
npm start        # http://127.0.0.1:4014
npm run check    # Biome
npm run build    # TypeScript + production build
npm test         # Playwright: headless race simulation, then desktop and phone checks against preview on 4015
```

Set `VITE_BASE_PATH=/sub/path/` to build for a hosting subpath. The Pages workflow publishes the game at https://jim-pettersson-github.github.io/monorepo-colin/charlie-fs/.
