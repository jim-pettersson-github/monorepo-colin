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
