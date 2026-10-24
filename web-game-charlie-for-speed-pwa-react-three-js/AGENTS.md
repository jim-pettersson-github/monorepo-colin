# Charlie for Speed

A standalone 3D sports-car racing game set on closed circuit tracks. The sibling elevator and football games are separate. Racing requirements here supersede inherited elevator-specific instructions.

## Stack

React, TypeScript, Three.js, Vite and vite-plugin-pwa. React owns menus and the HUD; Three.js owns the track. `src/game` stays free of Three.js so races simulate headlessly in `tests/rules.spec.ts`; keep that test passing when tuning physics, AI or track layouts. Cars, tracks and scenery use procedural geometry and canvas textures; assets stay local.

## Direction

An original late-1990s-style arcade racer inspired by that era of supercar racing games, without recreating any specific game: low-poly cars with glossy paint, bold colors, chunky HUD, chase camera. Cars are fictional lookalikes of real 80s/90s supercars; never use real brand names or logos. Shapes live in src/render/car-designs.ts.

## Language and layout

Swedish UI, semantic colors, accessible menus and 48-pixel touch targets. Desktop landscape with keyboard; phones in landscape with touch controls.

## Commands

Run commands here with Node 22.12+. npm ci, npm start (4014), npm run check, npm run build, npm test (preview 4015). Check ports first. The siblings use 4010–4013. Biome: two spaces, single quotes, 160 columns. Run npx biome check --write on changed paths.

## PWA and scope

Keep VITE_BASE_PATH support, offline precaching and user-requested updates without forced refresh. Charlie-specific storage and caches. GitHub Pages publishes the game under `/charlie-fs/`; the elevator service worker excludes that path from its navigation fallback, so keep both in sync. Do not change the pre-commit hook. Do not commit or push unless requested. Distinguish implemented behavior from future plans.
