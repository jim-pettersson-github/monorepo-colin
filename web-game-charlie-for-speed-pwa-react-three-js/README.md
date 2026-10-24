# Charlie for Speed

An arcade sports-car racer in a late-1990s style, built with React, Three.js and Vite and delivered as an offline-capable PWA. Swedish UI.

## Implemented

- **Two circuits:** Växjö Motorring (3.0 km, evening sun, pine and birch forest, lake, red cottages, water tower) and Rheinland-Ring (3.5 km, long main straight, concrete walls, village, castle on the hill, wind turbines).
- **Ten fictional sports cars** inspired by classic supercars, each with its own low-poly silhouette, top speed, acceleration, grip and brakes.
- **Races** against seven AI drivers: 1, 2, 3 or 5 laps, three difficulty levels, automatic or manual gearbox, countdown with start lights, lap and best-lap times, positions, wrong-way warning and a results table. Best laps are saved per track.
- **Driving model:** fixed-step arcade physics with a gearbox, grip-limited steering, handbrake slides, grass slowdown, barrier scrapes and car-to-car contact.
- **HUD:** analog tachometer with redline, digital speed, gear, position, lap, timers and a live track map.
- **Cameras:** chase, far chase and bumper, plus an intro sweep and a finish orbit.
- **Controls:** keyboard, standard gamepads and on-screen touch pads on phones.
- **Sound:** synthesised engine, tyre squeal, impacts and start beeps.
- **Retro mode** (Inställningar) renders at half resolution with chunky pixels.

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

Set `VITE_BASE_PATH=/sub/path/` to build for a hosting subpath. Deployment is not set up yet.
