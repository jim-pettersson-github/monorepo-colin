# Charlie for Speed

An arcade sports-car racer inspired by late-1990s supercar racing games, with modern graphics, built with React, Three.js and Vite and delivered as an offline-capable PWA. Swedish UI.

## Implemented

- **Six tracks:** two circuits (Växjö Motorring, Rheinland-Ring), two city tracks (Stockholm City at blue hour, Hamburg Hafen with warehouses and cranes) and two country roads (Smålandsslingan through fields and farms, Schwarzwaldpass with hairpins and a castle). Each has a lit tunnel.
- **Fourteen fictional lookalikes of 80s and 90s supercars**, including a Countach-style Torrone Contaccio, a Diablo-style Furia SV, F355- and 550-style Ferros, a CLK-GTR-style Hessen CL-R and a Lister-style Tempest GT. Each has its own silhouette with wheel arches, signature details (air boxes, NACA ducts, intakes, louvres, hood bulges, wings), smooth lofted bodies with flared wheel arches, clear-coated paint reflecting the track's sky, modelled spoked wheels with brake discs and calipers, light clusters, mirrors, diffusers and exhausts, and its own top speed, acceleration, grip and brakes.
- **Career:** start with 25 000 kr, buy a car, enter six cups across classes C, B and A, earn points and prize money, and upgrade engine, tyres and brakes in three steps. Seven rivals earn money too and buy upgrades after every cup, so winners get faster. Progress is saved on the device.
- **Car classes:** C (about 255–265 km/h), B (290–300) and A (305–345). Quick races pick rivals from your car's class.
- **Races** against seven AI drivers: 1, 2, 3 or 5 laps, three difficulty levels, automatic or manual gearbox, countdown with start lights, lap and best-lap times, positions, wrong-way warning and a results table. Best laps are saved per track.
- **Driving model:** fixed-step arcade physics with a gearbox, grip-limited steering that narrows with speed (so keys turn at the tyre limit instead of scrubbing), downforce that grows with speed in the faster classes, handbrake slides, grass slowdown, barrier scrapes and car-to-car contact. Brakes stop a class A car from 300 to 100 km/h in about 160 m.
- **HUD:** analog tachometer with redline, digital speed, gear, position, lap, timers and a live track map.
- **Cameras:** chase, far chase and bumper, plus an intro sweep and a finish orbit.
- **Controls:** keyboard, standard gamepads and on-screen touch pads on phones.
- **Sound:** four synthesised engine characters respond to revs, throttle load and gear changes. Separate tyre squeal, asphalt/kerb/grass rumble, wind, barrier scrapes and cushioned impacts share a compressed mix; tunnels add short exhaust echoes. Sound stays local, with no audio downloads. Volume is saved per device and adjustable in Settings and Pause, alongside mute. Pausing or backgrounding suspends audio; exiting releases the audio context.
- **Effects:** translucent tyre smoke, fading paired skid marks, grass dust, barrier sparks, sun haze and lens flare. Headlight pools illuminate the road on evening tracks and inside tunnels. Skid marks use a fixed 1,024-segment pool and fade over 35 seconds; marks and headlights add at most two draw calls.
- **Body designs:** fourteen independent width/elevation profiles, with angular wedge, rounded fastback, muscle-car and prototype sections; different canopy positions, roof widths, wheel sizes, rear tyre widths and sculpted intake surrounds. The Velox has raised round headlamp pods, the Stallion has side exhausts, and the NX-R has a black roof. `node scripts/capture-car-lineup.mjs` captures identical-paint, side-profile and colour comparisons while the development server runs on 4014.
- **Graphics:** filmic tone mapping, cloud and sky reflections on paint and tinted glass, fine door seams, rough asphalt and real-time car, building and grandstand shadows on desktop.
- **Performance:** car wheels use instancing; distant rivals switch to simpler versions of their own body shape. Modelled foliage, tyre walls and posts use spatial groups so off-screen sections can be culled. Static scenery and car bodies are merged by material, resolution adapts to frame rate, and high-density phones skip multisampling. Empty particle systems and off-screen showrooms skip rendering.

## Wi-Fi multiplayer

**Room codes (internet or Wi-Fi):** when the game is built with `VITE_ROOM_SERVER` (the Pages build uses https://games.charliecare.se/api.php), the host gets a four-character room code. Guests choose Jag går med and type it; several guests can type it at once, and each gets the next free place. The server only swaps the pairing codes. The race runs directly between the devices, which use public STUN servers to find each other across networks. If the server cannot be reached, the lobby falls back to QR pairing. Online quick races keep to the host's class (guests can only pick cars from it) and are arcade-balanced: each car moves most of the way to its class average, and a simulated per-car trim (`arcadeTrim` in `src/game/cars.ts`) evens out the rest to within a fraction of a second per lap. Career races keep each car's full spec. The lobby shows the chosen car turning in a showroom beside the track map, and everyone's name (Ditt namn, also in Inställningar) appears in the lobby, on the standings and above their car. Hosted games appear in an open-game list (host name, track, laps, class and players); guests join with one tap, and the host can turn the listing off or send a player away with Sparka. Everyone sees the same player list in the lobby, with names from Ditt namn and who has pressed Redo. A join that cannot get through gives up after 30 seconds with a message; the guest keeps the code to try again, and the host's room opens the next place by itself. When the server has a relay key (see [game-server](../game-server/README.md)), devices on strict networks connect through a TURN relay. The Wi-Fi career keeps its room code open in the hub for players who join later.

Pairing uses a short code shown as a QR image. If a camera cannot read it, Dela koden opens the share sheet (SMS, chat) and Kopiera koden copies it; the other device pastes it with Klistra in.

Choose Spela via Wi-Fi to race on 2–8 devices, one player per device, with AI drivers filling the rest of the eight-car grid. The host picks the number of players, the track, the laps and their own car; each guest picks their car on their own device. The host pairs with one guest at a time by exchanging QR codes, and every guest confirms readiness; changed settings or car picks require confirmation again. Camera scanning, QR-image upload and manual code copying work. Each device controls its own car and follows its own chase/bumper camera with keyboard, touch or a browser-visible gamepad.

The host owns physics and results. Everyone pauses on backgrounding, controller loss, stale data or disconnection. All players finish, with a 30-second allowance after the first human finish before estimated results for an unfinished driver. The host can restart on the same connection. Quick Wi-Fi races do not modify career progress or lap records. QR pairing uses no game server, STUN, TURN or signaling service; use a reachable LAN and avoid isolated guest networks. After loading the PWA, pairing and play work without HTTP services. Physical desktop/phone LAN and gamepad checks remain a separate review step.

### Wi-Fi career

Wi-Fi-karriär runs the career cups for 2–8 devices. The host creates a session (Ny start: everyone begins with 25 000 kr; Egna bilar: everyone brings a copy of their solo garage, which stays untouched) or resumes a saved one. Each player buys cars and upgrades on their own device inside the session, the host picks cups and starts races, and AI rivals fill the grid and upgrade from their winnings. The host device saves the session (guests keep a copy); returning devices are recognised by a per-device id and get their progress back, while new players can join at any time from the hub and start from scratch.

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
