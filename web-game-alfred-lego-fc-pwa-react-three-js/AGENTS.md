# Alfred FC

A standalone 3D brick-character five-a-side football game. The sibling elevator game is separate. Football requirements here supersede inherited elevator-specific instructions.

## Stack

React, TypeScript, Three.js, Vite and vite-plugin-pwa. Fixed-step simulation is independent from rendering. React owns menus; Three.js owns the pitch. Characters use procedural geometry; assets stay local.

## Controls and layout

Solo versus AI, two local players on one device, and two devices on the same reachable LAN using WebRTC with two-way QR signaling. The host owns simulation and results; the guest sends its local controls. No STUN, TURN or signaling service. Preserve local saves during network matches. Pause both peers on backgrounding, input loss or connection loss. Keyboard, touch and two browser-visible USB/Bluetooth gamepads. Stable controller slots, dead zones, mapping settings and pause on controller disconnect. Do not promise universal controller compatibility.

Swedish UI, semantic colors, accessible menus and 48-pixel touch targets. Desktop landscape; phones portrait and landscape with no orientation lock. Movement follows camera orientation. Pause when hidden or focus is lost, without time catch-up.

## Commands

Run commands here with Node 22.12+. npm ci, npm start (4012), npm run check, npm run build, npm test (preview 4013). Check ports first. The sibling uses 4010/4011. Biome: two spaces, single quotes, 160 columns. Run npx biome check --write on changed paths.

## PWA and scope

Keep VITE_BASE_PATH support, offline precaching and user-requested updates without forced refresh. Alfred-specific storage and caches. The shared Pages workflow deploys the elevator at `/monorepo-colin/colin-elevator/` and Alfred at `/monorepo-colin/alfred-fc/`. Keep both URLs working and retain separate PWA caches and Alfred scope. The elevator worker must exclude Alfred navigations. Keep the elevator Git hook; run Alfred verification separately. Physical controller/phone checks remain separate review steps. Do not commit or push unless requested. Distinguish implemented behavior from future plans.

The Pages root now hosts Spelhörnan, the game selector. The elevator lives under `/monorepo-colin/colin-elevator/`; existing same-origin saves retain their original keys.

Cupspel includes Alfredcupen (20-club knockout with twelve drawn byes) and Mästarpokalen (two ten-team groups, semifinals and final). Preserve saved 12-club formats and fixture identities. Cups have separate validated saves and backups; the season remains independent. Drawn knockout matches use untimed golden goal. Cup matches support solo, local versus, QR peers, viewing and simulation; only the Wi-Fi host records results.

Världscupen adds a separate 24-nation cup: six groups of four, top two plus four best third-place sides into a seeded round of 16 without group rematches, then quarterfinals through final. The selection is from the men's FIFA ranking of 22 December 2025 (top 18, Iran, all five Nordic countries); keep its source and selection explanation in the menu and README. National teams have flags and alternative kits. The national roster must stay out of the 20-club league and club cups; preserve their saves and schedules.

Domestic squads use 181 real-name stars and legends plus 19 family players at estimated prime years, with game-authored 0–100 ratings. Keep the club roster around 200 players; a little above 200 is allowed. Every initial ten-player squad has two keepers, two defenders, three midfielders and three forwards, distributed by a deterministic balanced draft and role-preserving swaps. Fix the family starting clubs before drafting; keep requested ratings exact, including Colin Katona at 100. IF Danielsson starts with ten Danielssons; IFK Katona and Petterssons FC hold the other family players. Transfers remain open to these players. Existing player IDs, keeper roles and purchased ownership survive the roster upgrade. National squads retain their separate fictional roster and original IDs/stats. Do not describe estimates as official ratings or imply current real club affiliations.

The 20 clubs play in two ten-team divisions, with 18 home/away rounds and 180 fixtures across both. Two clubs move each direction only when the next season starts after completion. Keep the saved membership, season number, schedules and prize deduplication. Original 12-club seasons finish unchanged before joining the new format. Keep nationals out of domestic divisions and club cups.

Transfers use separate club wallets and saved lineup snapshots. Keep a keeper and four outfield players in every club squad. Economy changes happen only between matches, and only the network host pays rewards. Preserve payout IDs, competition-prize deduplication, three-match signing protection, the gentle AI transfer cadence and economy backups. National squads cannot trade; their prize money goes to the chosen club. Upgrade old economies by adding new clubs while preserving balances and ownership; reject corrupt saves rather than partially repairing them.

Manual starting fives save per club in the economy save, with one keeper and four outfield players. Preserve manual choices after signings; repair only departing players after transfers. Match squads and benches are immutable ownership snapshots for that match, independent of future club saves. Substitutions happen only while paused and outside referee restarts, keep personal cards, and never overwrite the saved starting preference. The host validates guest changes to team 1; guests cannot alter team 0 or submit foreign players. Preserve guest local saves and host-only rewards. Both peers can choose starters in the lobby from the host roster; saved fixtures retain their existing lineup.
