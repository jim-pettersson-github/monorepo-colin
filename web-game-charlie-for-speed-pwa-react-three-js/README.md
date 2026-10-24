# Charlie for Speed

An arcade sports-car racer inspired by late-1990s supercar racing games, with modern graphics, built with React, Three.js and Vite and delivered as an offline-capable PWA. Swedish UI.

## Implemented

- **Six tracks:** two circuits (Växjö Motorring, Rheinland-Ring), two city tracks (Stockholm City at blue hour, Hamburg Hafen with warehouses and cranes) and two country roads (Smålandsslingan through fields and farms, Schwarzwaldpass with hairpins and a castle). Each has a lit tunnel.
- **Fourteen fictional lookalikes of 80s and 90s supercars**, including a Countach-style Torrone Contaccio, a Diablo-style Furia SV, F355- and 550-style Ferros, a CLK-GTR-style Hessen CL-R and a Lister-style Tempest GT. Each has its own silhouette with wheel arches, signature details (air boxes, NACA ducts, intakes, louvres, hood bulges, wings), smooth lofted bodies with flared wheel arches, clear-coated paint reflecting the track's sky, modelled spoked wheels with brake discs and calipers, light clusters, mirrors, diffusers and exhausts, and its own top speed, acceleration, grip and brakes.
- **Career:** start with 25 000 kr, buy a car, enter six cups across classes C, B and A, earn points and prize money, and upgrade engine, tyres and brakes in three steps. Seven rivals earn money too and buy upgrades after every cup, so winners get faster. Progress is saved on the device.
- **Car classes:** C (about 255–265 km/h), B (290–300) and A (305–345). Quick races pick rivals from your car's class.
- **Races** against seven AI drivers: 1, 2, 3 or 5 laps, three difficulty levels, automatic or manual gearbox, countdown with start lights, lap and best-lap times, positions, wrong-way warning and a results table. Best laps are saved per track.
- **Driving model:** fixed-step arcade physics with a gearbox, grip-limited steering, handbrake slides, grass slowdown, barrier scrapes and car-to-car contact.
- **HUD:** analog tachometer with redline, digital speed, gear, position, lap, timers and a live track map.
- **Cameras:** chase, far chase and bumper, plus an intro sweep and a finish orbit.
- **Controls:** keyboard, standard gamepads and on-screen touch pads on phones.
- **Sound:** synthesised engine, tyre squeal, impacts and start beeps.
- **Effects:** tyre smoke when sliding, dust on the grass, sparks along the barriers, sun lens flare and darker light inside tunnels.
- **Body designs:** fourteen independent width/elevation profiles, with angular wedge, rounded fastback, muscle-car and prototype sections; different canopy positions, roof widths, wheel sizes, rear tyre widths and sculpted intake surrounds. The Velox has raised round headlamp pods, the Stallion has side exhausts, and the NX-R has a black roof. `node scripts/capture-car-lineup.mjs` captures identical-paint, side-profile and colour comparisons while the development server runs on 4014.
- **Graphics:** filmic tone mapping, sky reflections, real-time sun shadows on desktop and detailed textures. **Retro mode** (Inställningar) switches to a late-90s look: half resolution, chunky pixels and flat shading.
- **Performance:** static scenery and each car body are merged into a few draw calls per material, render resolution adapts to the frame rate, and high-density phone screens skip multisampling.

## Wi-Fi multiplayer

Choose Spela via Wi-Fi to race on 2–8 devices, one player per device, with AI drivers filling the rest of the eight-car grid. The host picks the number of players, the track, the laps and their own car; each guest picks their car on their own device. The host pairs with one guest at a time by exchanging QR codes, and every guest confirms readiness; changed settings or car picks require confirmation again. Camera scanning, QR-image upload and manual code copying work. Each device controls its own car and follows its own chase/bumper camera with keyboard, touch or a browser-visible gamepad.

The host owns physics and results. Everyone pauses on backgrounding, controller loss, stale data or disconnection. All players finish, with a 30-second allowance after the first human finish before estimated results for an unfinished driver. The host can restart on the same connection. Quick Wi-Fi races do not modify career progress or lap records. No game server, STUN, TURN or signaling service is used; use a reachable LAN and avoid isolated guest networks. After loading the PWA, pairing and play work without HTTP services. Physical desktop/phone LAN and gamepad checks remain a separate review step.

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
