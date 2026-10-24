# Sagospelen

Standalone React + TypeScript + Canvas 2D athletics game. Swedish UI; locally drawn Disney characters and procedural stadium artwork. Keyboard, touch and browser-visible gamepads; solo or two players sharing a screen. Three running and three field events, quick events and a six-event championship.

Keep the simulation independent from drawing. Fixed 60 Hz steps, bounded frame catch-up, explicit pause on blur/background/controller disconnect. Preserve records, settings and resumable events under Sagospelen-specific localStorage keys. PWA assets, manifest and scope must stay under VITE_BASE_PATH; updates wait for user consent or old clients closing.

Development 4016; production preview/tests 4017. Check ports first. Run npm ci, npm start, npm run verify. Biome owns formatting: two spaces, single quotes, 160 columns. Respect root instructions. Do not edit sibling games, commit, push or publish unless requested. No backend or external assets. GitHub Pages deploys this game under /monorepo-colin/sagospelen/ and the root game selector links to it.
