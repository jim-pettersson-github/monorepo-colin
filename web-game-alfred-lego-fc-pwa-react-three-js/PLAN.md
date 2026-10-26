# Alfred FC — game plan

## Implemented

- Quick match and two-division entry, with inline start/resume actions near the top and visible update controls and a focused match-exit confirmation modal.
- Twenty clubs in two ten-team divisions: 18 home/away rounds and 180 fixtures, both tables, automatic round results and two promotions/relegations between completed seasons. Season numbers and division membership persist; original 12-club seasons finish unchanged.
- League results record once at full time. Unfinished fixtures can resume; abandoning one preserves past rounds and lets the player retry. A replacement season requires confirmation.
- League fixtures support solo, shared-screen and online opponents. Player 2 controls the scheduled opponent; only the network host records the season result. Reconnect per fixture; abandoned games do not count.
- League-only options to play, watch AI versus AI at 1×/2×/5×, or simulate directly without a pitch view. All use the same fixed-step rules, auto-take penalties, save progress and record each round once.
- A 96 x 60 pitch, twice the original length and width, with scaled goals, markings, formations and AI positioning. Character sizes and tackle/contact distances remain unchanged.
- A smooth shared follow camera with limited automatic zoom, pitch-edge bounds and a live overview. The menu preview still shows the whole stadium.
- Five-a-side football: four outfield players and one AI goalkeeper per team.
- Twenty selectable clubs with distinct shirt colors, trim and crests; team selections persist through saves and rematches.
- Procedural LEGO-style characters, animated limbs, selection rings, a patterned ball and brick-built stadium.
- Solo versus AI or two local human players on one screen, with AI teammates.
- Two-device online play via WebRTC, paired with a four-character room code through the PHP room server (games.charliecare.se by default). The server only swaps compact pairing codes; STUN, and TURN when the server supplies it, help devices connect. The host runs the match; the guest controls player 2. Separate device input/orientation, shared pause, lost-peer handling, room reopening after a failed join, host rematches and local-save isolation. QR pairing has been removed.
- Fixed-step movement, possession, directional passes, open-corner assisted shots and automatic/manual player switching.
- Moving slide tackles with ball contact, possession transfer, opponent knockdowns and timed recovery.
- Feet-first slides use small swept contact areas relative to both players' motion. Empty slides have no decision; any ball contact makes the tackle clean. Contact without a ball win has equal chances of a yellow card, free kick or play-on. Announcements identify the offender.
- Free-kick decisions inside the defending penalty area become penalties, with painted spots, visible aiming, automatic AI takers and other outfield players held back until the shot.
- Black goalkeeper kits with white gloves/rings and MV labels. Keepers stay in their own area; AI attackers steer around bodies and avoid piling into the goalmouth.
- Goals, score, conceding-side restarts, match clock, full-time result and rematches.
- Rebound boards instead of offsides, corners and throw-ins. Basic tackle fouls and penalties are implemented; dismissals are not.
- 1-, 3- and 5-minute matches; Lätt, Vanlig and Svår solo difficulty. Lätt reduces AI speed, reaction rate, shot power/accuracy and keeper speed, and disables opponent slide tackles.
- Two keyboard layouts, touch movement/actions, and up to two browser-visible USB/Bluetooth gamepads.
- Stable explicit controller slots, dead zones, one-shot action edges, disconnect pause, per-device remapping and live input testing.
- Landscape/portrait cameras with matching input directions and unrestricted PWA rotation.
- Pause on focus loss/backgrounding, explicit resume and validated local saves with backup recovery and one-time position migration from the smaller pitch.
- Offline production PWA and save-before-update behavior. No accounts or backend.
- Locally synthesized kick/pass, slide/contact, save/rebound, goal and referee/finish sound effects. Saved mute/volume controls, user-gesture audio unlocking, pause/background silence and event deduplication for restored matches and network snapshots.

- Two independently saved twenty-club cups: Alfredcupen (twelve drawn byes into the round of 16) and Mästarpokalen (two ten-team groups, cross-group semifinals and final). Original 12-club cup saves retain their format. Group tables, brackets, champions, golden-goal knockout ties, solo/local/online play, watching and direct simulation.
- Världscupen: 24 national teams selected from the December 2025 FIFA men's ranking plus all five Nordic countries, flags and alternative kits. Six four-team groups, best-third-place table, round of 16 through final, a separate save and the same cup play modes. This is an arcade format; the ranking selects the roster and does not change AI strength.

- Persistent transfers and wallets: 200 players (129 modern stars, 52 classics, 19 family players), balanced ten-player squads with two GK/two DEF/three MID/three FWD, era/position filters, estimated prime-year stats (professional overall ratings 86–96 and all professional attributes at most 96) and exact requested family ratings. Rebalancing retains the original IDs, names, roles and club assignments. IF Danielsson has a full ten-player Danielsson squad; IFK Katona and Petterssons FC have the other family players. Purchases, sales, swaps, protected new signings and infrequent AI moves respect money and squad minima. Match and trophy rewards are deduplicated; national squads remain fixed and earnings go to a domestic club. Old domestic slots keep IDs, keeper roles and purchased ownership when upgraded.

- Family-first default starting fives plus saved manual choices per club, family-first/rating/default shortcuts, setup selectors across quick/league/cup modes, and guest lineup selection from the host roster. Paused rolling substitutions preserve bench snapshots, positions and personal cards; shared-screen players manage either team and network peers only their own team.

- Team browser in the menu header with persistent starting-five edits from bench-player cards and lineup selectors: all clubs and nations, current-owner player search, starter pitch, bench list and full player-stat cards. Browsing stays read-only until an explicit edit; saved matches and simulation lock lineup edits. Match previews and pause views remain read-only and use the actual roster snapshot, including the host roster on guest devices.

- Stat-based background league/cup results use current starters, ownership and role-weighted skills with a modest nonlinear advantage and upset chance. Shared team form gives +2 to all stats for 1–3 completed games; wins cannot refresh active form. Form saves, match snapshots, substitutions, peer validation, result deduplication, cup byes/elimination and visible effective stat cards are implemented.

- Världscupen has a direct national-squad dialog in setup and the cup hub. All 24 ten-player squads, starters, benches, stats and form are browsable without changing the chosen cup country or saves.

## Verification

Rules tests cover balanced star allocation, migration of old economies and schedules, promotion/relegation, the full home/away season, standings, instant/watched simulation equivalence, watch speed/pause, result deduplication, backups and invalid schedules, alongside close non-contact slides, late ball wins, three-way referee decisions, difficulty, pitch boundaries, cameras, scoring, penalties, input and save validation.

Desktop, portrait-phone and landscape-phone browser checks cover star search and era/position filters, old economy upgrades, season rollover, direct simulation/results, watch speed changes, saved viewing, full-time recording, league-only options and close slides without whistles, alongside menu actions, exit confirmation, season fixtures, camera scrolling, scoring, tackles, penalties, input, rotation and offline reload.

## Next review

- Play with two real controllers and verify assignment, mappings, reconnect and simultaneous actions.
- Test Android browser/PWA portrait, landscape, multi-touch and Bluetooth/USB hardware.
- Review room-code pairing between physical devices on home, mobile and strict school/guest networks; verify background, disconnect and rematch behavior.
- Tune AI difficulty, movement, tackle range, shot assistance and match pace through playtesting.
- Review minifigure detail and camera scale on physical phones.
- Review sound levels and comfort on real speakers/headphones; consider additional team customization if wanted.
- Review installation and update behavior on a real phone using the GitHub Pages address.

## Scope

Local single-device quick matches, two-device online matches and two-division play with promotion/relegation and optional human opponents are implemented. Automatic matchmaking without a room code, full football rules, music and replays are not implemented. Controller compatibility depends on the OS, browser and device. Universal compatibility is not promised.
