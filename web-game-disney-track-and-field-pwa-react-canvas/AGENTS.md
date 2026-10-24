# Sagospelen

Standalone React + TypeScript + Canvas 2D athletics game. Swedish UI; locally drawn Disney characters and painted stadium artwork. Keyboard, touch and browser-visible gamepads; one to four players sharing a screen. Sixteen individual events (five running, eight jumping/throwing and three other sports), twenty illustrated characters, quick events and a six-event championship. Character art stays in local Canvas code; portraits and gameplay use the same drawing functions.

Keep the simulation independent from drawing. Fixed 60 Hz steps, bounded frame catch-up, explicit pause on blur/background/controller disconnect. Preserve records, settings and resumable events under Sagospelen-specific localStorage keys. PWA assets, manifest and scope must stay under VITE_BASE_PATH; updates wait for user consent or old clients closing.

Development 4016; production preview/tests 4017. Check ports first. Run npm ci, npm start, npm run verify. Biome owns formatting: two spaces, single quotes, 160 columns. Respect root instructions. Do not edit sibling games, commit, push or publish unless requested. No backend or external assets. GitHub Pages deploys this game under /monorepo-colin/sagospelen/ and the root game selector links to it.

Two to four devices can play via direct host/guest WebRTC and two-way QR signaling, with one participant per device. No STUN, TURN or signaling service. Host-owned simulation and advancement; guests send controls. Network play never overwrites local saves/records. Pause all peers on background/input/connection loss.

Retired running events remain in legacy metadata for saved competitions and records. New championships store their event programme; saves without one use the original six events. Archery, diving and weightlifting use skill-sports.ts and skill-drawing.ts. Held directional controls are carried through the same validated host/guest snapshots and input messages.
