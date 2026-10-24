# Alfred FC — game plan

## Current foundation

React, TypeScript, Three.js, Vite, PWA metadata, a static pitch preview and desktop/phone foundation checks are implemented. Matches, characters, input handling and game saves are not implemented yet.

## Confirmed game direction

- European football with chunky LEGO-style 3D characters and a brick-built world.
- Simple arcade feel inspired by 1990s console football games.
- Five players per team: four outfield players and a goalkeeper.
- Control one player at a time, with automatic switching and AI teammates.
- Solo against AI and two players against each other locally on the same device.
- Desktop keyboard, Android touch controls, and two USB/Bluetooth gamepads where exposed by the browser.
- Landscape on desktop; both portrait and landscape on Android, following device rotation.
- Browser play and an installable PWA. No backend, accounts or online multiplayer planned.

## Next implementation stages

1. Playable pitch, procedural characters, fixed-step match state, ball movement and camera-relative movement.
2. Passing, shooting, tackling, goal detection, goalkeeper behavior, teammates and automatic switching.
3. Solo and local versus setup; keyboard, multi-touch controls and stable gamepad assignments.
4. Scoreboard, match duration, pause/resume, settings and recoverable local saves.
5. Real-controller and Android checks, then separate hosting/install review.

## Controls and acceptance targets

These are future acceptance checks, not implemented behavior:

- Two connected gamepads control different teams simultaneously. Keyboard + gamepad is also supported.
- Detect already-connected and newly connected controllers after the browser exposes them. Show device assignment and allow button/axis mapping for nonstandard devices.
- Read gamepad state each frame, apply stick dead zones and avoid repeated actions from held buttons. Keep assignments stable when devices disconnect; pause and explain how to reconnect.
- Do not promise every USB/Bluetooth controller works: browser, OS and device mapping determine availability. Pressing a controller button may be required before detection. Production play uses HTTPS.
- Touch movement and actions work together without page scrolling. Controls meet a 48-pixel minimum target size and avoid phone safe areas.
- Device rotation keeps the match intact and adapts both camera and control directions. Portrait play must remain usable.
- Pause on focus loss or backgrounding; resume without simulating elapsed background time.
- Updates never reload an active match automatically. Save before a user-requested update, using Alfred-specific validated storage keys.

## Open tuning choices

Match duration, difficulty, exact button defaults, team names and sound design can be tuned with the first playable build.
