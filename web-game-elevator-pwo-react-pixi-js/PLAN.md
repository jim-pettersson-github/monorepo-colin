# Colins hissäventyr — game plan

## Current milestone

Implemented: the Swedish menu and playable three-building world, independent elevators, manual gates, doorway blocking, stairs, patient passengers, lights, signs, short sound demos, settings, and versioned local saves with backup recovery. React + PixiJS + TypeScript + Vite deliver the offline PWA. The sections below describe the game behavior to preserve.

Automated acceptance covers simulation rules and desktop/phone browser flows, including offline gameplay and save restore. A local pre-commit hook runs formatting, a fresh Pages-path build, and the full test suite. GitHub Actions only checks formatting, builds, and publishes passing `main` builds to Pages; tests stay local to keep releases quick. The root README links to the hosted game. Physical-phone installation, restart/update behavior, and Colin's comfort with controls and synthesized sounds still need hands-on review.

## Colin and the experience

Built for Colin, an autistic child around eight years old who loves elevators. His character has blond-brown hair, brown eyes, and bare feet: no shoes or socks, because he dislikes socks. Tailor the experience to Colin's preferences rather than assuming these apply to all autistic children.

He enjoys switching lights on and off, green exit signs, warning signs, old elevator gates, reopening closing doors by standing in the doorway, and operating elevators for other people. These are activities to repeat and explore, with no scores, losing, time limits, or unlocking.

Use clear, believable painted illustrations in portrait and landscape 2.5D rooms. Colin walks sideways, toward the camera, and away, scaling with depth. The view follows his current floor through stairs and elevator rides. Keep Swedish labels short, menus compact, touch targets at least 48 pixels, and sound optional. Landscape fills the viewport with the room and overlays toggleable controls, hidden by default. The initial camera fits the whole room. Remember the chosen zoom across rotation, floors, buildings, menu returns, and reloads; dragging explores cropped edges after zooming. The installed PWA permits rotation without restarting play. Do not display his diagnosis in the game UI.

A horizontally scrollable building overview with at least 48-pixel touch targets marks Colin's floor and the elevator's position. Select a floor to preview its room without moving Colin; tap a destination in that room to send him there through the nearest staircase. Följ Colin returns to his current floor without moving him. Zoom with two fingers, the mouse wheel, or touch-friendly +/− buttons that stay visible in the corner. Pinch around the point between the fingers, within camera bounds; drag with a mouse or one finger. Drags, pinches, and cancelled gestures never issue walking/object actions. Floor/building changes and Följ Colin recenter the camera without changing the chosen zoom. Save cameraZoom with the other settings; older saves default to 1×. Rotation must not change it.

Installed launch requests fullscreen. In the browser, or an existing installation still using standalone mode, choose Helskärm in the menu or the ⛶ button beside Settings (open Kontroller first in landscape). Keep rotation unrestricted and respect the user's fullscreen exit. Browser and Android system gestures can temporarily reveal their bars; fullscreen is a request to the platform, not a CSS layout setting.

## Three buildings

Rooms have generous perspective floor space, with 1448×1086 painted plates and a shared doorway plane. Keep Colin and doors at believable relative sizes. Version-4 saves include depth, doorway waypoints, building-sized light arrays, and active stair duration. Versions 1–3 start a fresh game with default settings; there is no migration.

The hotel has ten floors (E–9), the mall five (E–4), and the old house seven (E–6), each with its own elevator and open stairs. E counts toward the total and is stored internally as zero. Connect their ground-floor entrances through a small outdoor area. Start a new game in the hotel lobby; everything is accessible from the beginning.

| Building | Floors | Elevator | Other people |
| --- | --- | --- | --- |
| Hotel | E–9: lobby through breakfast lounge | Enclosed lift with visible cutaway cabin and automatic sliding doors | 1–2 guests |
| Shopping centre / department store | E–4: entry, clothes, toys, books, café | Glass lift with automatic sliding doors | 2–3 shoppers |
| Old apartment house | E–6: entry and six plain residential landings | Old lift with automatic steel-bar landing grilles and a separate manual folding cabin gate | A few occasional residents; default 0–3 present |

Keep each elevator's buttons, appearance, and sounds distinct. Hotel indicators have amber digital digits; mall indicators have a modern illuminated floor strip; house indicators retain a vintage dial with a continuously moving needle. All show actual lift position independently of the floor being viewed. The old gate should visibly fold/slide when Colin opens or closes it; model the cabin gate and landing door separately, with travel blocked until both are closed. Use the same forgiving doorway-obstruction rule across the game's lifts.

## Lights, exits, and signs

- Put a reachable light switch on every floor. Repeated taps turn that room's lights on and off with immediate, predictable feedback.
- Keep Colin, routes, controls, and green exit signs readable with the room lights off. Do not turn off the whole interface or make navigation depend on seeing in darkness.
- Every floor has an open stairwell with a recognisable green sign, including the entry floor. Upper floors have no doors besides the elevator. Tapping it goes up one floor (down on the top floor). Each entry floor also has a separate regular door marked UT that leads outdoors; keep these two doors visually distinct.
- Place recognisable warning signs by lifts, gates, and maintenance doors. Tapping a sign approaches it and opens a simple enlarged view with a short Swedish label; it does not trigger an alarm or danger event.
- Fire alarm stations have a large flame pictogram and a detailed red call point with glass, a press target, and BRANDLARM lettering. Keep them separate from yellow door warnings; the optional sound sample remains short and stoppable.
- Keep these details secondary to elevators. Every floor has a large E/number plaque, muted accent, and one sparse painted landmark. Apartment halls are mostly empty, with plain plaster, terrazzo and simple lights. No ordinary room-door interaction remains.

## Movement and elevator operation

- Tap reachable ground to walk briskly; tap an object to approach and interact. A new destination replaces the old route and cancels an interaction that has not happened yet. Walls, floors, and closed doors constrain movement.
- Selecting a floor in the overview only previews it. Tapping a point in that room routes Colin to the nearest staircase (one per building), through intermediate floors, then to the selected position and depth. A new tap during a stair flight replaces the remaining route after that flight finishes. A tap during an elevator ride waits for arrival before routing through the stairs. Save and restore the destination with the route.
- Tap stairs to travel one floor at a time. Finish the current flight before changing route. A single flight takes three seconds. At each flight start, speed is min(1.6, 1 + 0.1 × (remaining gap − 1)); duration is three seconds divided by speed. Complete every intermediate flight and preserve its duration when retargeting. Corridor walking keeps its normal speed.
- Calling the lift approaches beside the wall panel, raises Colin's arm, and illuminates the button. Then tap the open cabin to board. He walks through the threshold into its recessed floor and becomes smaller; closing doors draw in front of cabin occupants. Boarding stays a separate choice. A brass panel on the back wall has visible E and numbered buttons for every floor, arranged in two columns that light up when selected. Tap them after boarding or use the large HTML floor buttons; selecting a floor dismisses the large panel immediately.
- A new destination selected with doors open starts a fresh five-second departure delay. Colin can step out and use the stairs; leaving never cancels the request. Duplicate selections do not restart the delay.
- Initial elevator travel takes five seconds per floor; opening/closing takes about one second. For the old lift, Colin explicitly operates the gate; selecting a destination does not close the manual gate for him. After closing it, any remaining departure delay must still expire before travel.
- The old lift's outer door closes automatically once its gate is shut and opens on arrival. A visible jamb lever operates only the gate from either side. Open/close arrow buttons beside the cabin numbers and in the HTML panel control only the automatic outer doors. The old-house panel stays open after floor selection and provides a separate gate control.
- Each lift keeps a deduplicated FIFO queue and completes its active journey before serving further stops. For modern lifts, a current-floor request while stationary opens or keeps open the doors; an idle lift stays open when no journey is queued. The old lift unlocks access at a stop, but its gate remains manually operated.
- Both sliding doors and closing gates visibly approach Colin, stop with clearance around his body, and reverse open when he occupies the threshold. Queued automatic doors pause five seconds and retry; a manual gate awaits another close action. Provide an easy doorway standing position and a modern open/close control that also works while he stands there. Never pull him out of the doorway to operate it. Repeatable obstruction has no penalty, injury, jam, or alarm. Clearing the threshold gives automatic doors a fresh departure delay.
- No lift moves with an occupied threshold or an open required door/gate. Closed gates cannot be crossed, and characters cannot exit between floors. Old landing doors can open only when the cabin is present and stationary.
- All three elevators continue independently off screen and while Colin explores another building. Camera and scene changes never reset their state.

## Operating the lift for passengers

Use small, calm groups with the building counts above. Treat the user's store reference as the shopping centre / department store; the old apartment house is the separate third building.

Passengers show a desired floor using a number bubble. Tapping one invites them to wait by the elevator. Colin calls the lift, lets them board, and selects their destination using the cabin panel. He can ride along or step out before departure and watch them go. For the old lift, make the manual gate operable from either side at the doorway so he can close it for a passenger while staying outside.

Passengers never choose floors automatically, demand a quick response, become upset, or take over Colin's controls. They wait while he experiments with doors and lights. On arrival at their requested floor, they leave the cabin when the doors/gate are open; if Colin sends them elsewhere, they keep their requested-floor bubble and wait patiently. With the old lift they wait for him to open the gate.

Use occasional, slow resident arrivals/departures through the open stairwell, capped at three present; avoid sudden appearances beside Colin. Keep active requests and passengers stable across backgrounding and saves. Characters share the doorway obstruction rules, take turns crossing, and do not overlap or permanently block the cabin.

## Sound, saving, and delivery

- Use recognisable clicks, motors, doors/gates, and arrival chimes, with no music by default. Motor sound uses 0.08 gain with a quiet higher harmonic and gentle start/stop envelopes. Include a labelled alarm demonstration panel in each building: one short sample, tap again to stop, no overlap or automatic evacuation event. Parent settings provide separate elevator/alarm volumes and mute.
- Keep the simulation independent of React scene lifecycles. Use one fixed-step ticker with refs for continuous motion; React handles menus and discrete state changes. Define reusable building/elevator data rather than separate engines per building.
- Save versioned local state: Colin's position/route, all three lifts' phases/timers/queues, gate and light states, passenger locations/requests, and settings. Save at transitions, periodically while moving, and on backgrounding. Pause movement/audio when hidden and restore without elapsed-time catch-up; alarm samples do not restart.
- Parent settings use a right-side panel and pause play. Restart resets the world after confirmation while preserving settings. Validate current-version saves and keep a previous valid current-version snapshot for recovery. Older primary saves reset the entire game and settings; never migrate or restore an older-version backup.
- Remain an Android PWA with bundled local assets and offline play. Check updates on launch, reconnection, and return to the foreground; Settings/About offers a manual check and an explicit update action that saves before reloading. Otherwise wait until existing clients close. Keep saves separate from asset caches. Publish the static build through GitHub Pages after passing checks. No accounts, backend, ads, purchases, or analytics; native packaging remains outside this milestone.

## Acceptance and device review

### Approved perspective game

The approved 2.5D direction is integrated with all three buildings, floor previews, stairs, lifts, passengers, lighting and saves. Colin has front/side walking poses, a rear pose for walking away, and a reaching pose. Source prompts are in `art-source/perspective-game.md`. The original `?view=depth` study stays isolated and unsaved for comparison; it is no longer the main game's engine.

Art direction 01 is approved and implemented: locally bundled painted wall/material textures, wood/brass elevators, Colin standing/walking sprites, painted passengers, and the selected menu illustration. Menus, settings, and game controls share the painted wood/brass/teal theme, with readable cream text and illuminated brass selections. Preserve distinct buildings, readable signs and working lighting/doors; keep high-contrast HTML controls. Source prompts live in `art-source/README.md`.

Art reference: `?view=art` preserves the three original concepts side by side: a modern Monkey Island-inspired painted adventure, a refined illustrated game, and a tactile clay miniature. Click/tap to enlarge. The comparison does not initialize or modify saves. Option 01 is the selected direction. Generation prompts are recorded in `art-prompts.md`.

The hotel loop and shared systems are implemented across all three buildings. Use these scenarios for regression checks and the remaining hands-on device review.

- Call, board, select floor 2, step out, climb the stairs, and meet the independently arriving lift.
- Stand in closing doors repeatedly; verify they stop/reopen and travel remains blocked. Repeat with the old gate and with a passenger crossing the threshold.
- Open/close the old gate manually, from inside and outside, and verify gate/landing-door interlocks without trapping Colin or passengers.
- Send a passenger to their requested floor while Colin stays behind, joins them, or takes the stairs. Verify duplicate requests, patient waiting, wrong-floor stops, and eventual exit on arrival.
- Exercise the intended passenger counts and occasional apartment-resident arrivals without crowds, collisions, surprise spawning, or timers.
- Toggle lights repeatedly, inspect warning signs, use every signed stairwell, and leave through each separate entry-floor exit; controls and routes remain visible with lights off.
- Preview floors above and below Colin without moving him, then tap destinations at different depths, replace a route mid-flight, and restore a saved route. Confirm the final floor/position and that the entry stairwell never sends him outdoors. Check that mouse/touch drags only move the zoomed camera.
- Restore during travel, gate motion, doorway blocking, and passenger boarding. Preserve light states, requests, and positions without background time advancing.
- Verify portrait/landscape rotation and touch controls, camera following, moving indicators, louder motor audio, stoppable sound samples, fresh offline launch, and uninterrupted update downloads on Colin's actual phone before expanding scope further.
