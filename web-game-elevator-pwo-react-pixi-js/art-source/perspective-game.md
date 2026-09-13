# Perspective game assets

Generated with the built-in image tool from the approved depth-room reference; local originals are room-hotel.png, room-mall.png, room-house.png and colin-back.png. These original room plates are retained as references. The current entry/upper plates and floor landmarks are documented in [floor-refresh.md](floor-refresh.md); runtime exports use scripts/prepare-painted-art.mjs. The existing depth-reach.png provides the reaching pose. All assets are bundled for offline use.

## hotel

Edit the supplied painted game room. Preserve EXACT perspective, camera, canvas size, all floor and elevator geometry: doorway opening x720..1063, y158..636 on 1448x1086 canvas; open stairs on left; clear foreground floor. This is a matching background variant for the same 2.5D game. No characters. Keep open elevator EMPTY with no doors/gate leaves (animated separately). Keep call panel at x654 y416. Keep fire alarm and exit sign where they are, recognizable and painted. ADD a narrow closed wooden room door on right wall between the lift and plant, approximately x1150..1260,y285..655, replacing the lower portion of that right lamp if necessary. No writing, labels or numbers. Keep the warm hotel style, amber lamps, dark walnut and teal cabin rug. Preserve the wide marble floor and left stairwell.

## mall

Edit the supplied painted game room. Preserve EXACT perspective, camera, canvas size, all floor and elevator geometry: doorway opening x720..1063, y158..636 on 1448x1086 canvas; open stairs on left; clear foreground floor. This is a matching background variant for the same 2.5D game. No characters. Keep open elevator EMPTY with no doors/gate leaves (animated separately). Keep call panel at x654 y416. Keep fire alarm and exit sign where they are, recognizable and painted. ADD a narrow closed wooden room door on right wall between the lift and plant, approximately x1150..1260,y285..655, replacing the lower portion of that right lamp if necessary. No writing, labels or numbers. Transform decor into an elegant Swedish department store: cream and pale teal wall panels, brass and glass elevator cabin, restrained toy/book window displays at outer edges, polished cream-and-teal marble floor. Cozy detailed painterly Monkey Island-inspired style consistent with reference. Preserve positions and silhouettes of all interactive objects.

## house

Edit the supplied painted game room. Preserve EXACT perspective, camera, canvas size, all floor and elevator geometry: doorway opening x720..1063, y158..636 on 1448x1086 canvas; open stairs on left; clear foreground floor. This is a matching background variant for the same 2.5D game. No characters. Keep open elevator EMPTY with no doors/gate leaves (animated separately). Keep call panel at x654 y416. Keep fire alarm and exit sign where they are, recognizable and painted. ADD a narrow closed wooden room door on right wall between the lift and plant, approximately x1150..1260,y285..655, replacing the lower portion of that right lamp if necessary. No writing, labels or numbers. Transform decor into a charming old Swedish apartment house: slightly worn ochre plaster, dark wooden wainscoting, aged brass elevator cabin, moss green rug, vintage wall lamps and a cared-for potted plant. Painterly Monkey Island-inspired style consistent with reference. The elevator is open with NO lattice gate drawn (game animates gate). Preserve positions and silhouettes of all interactive objects.

## Colin rear pose

Use case: identity-preserve. Turn this exact game character around: full-body Colin viewed from BEHIND, walking away toward the back of a room. Same eight-year-old proportions, tousled blond-brown hair, blue T-shirt, navy shorts and BARE FEET, no socks or shoes. We see back of head and back of shirt, relaxed walking passing pose with one bare heel slightly raised and arms gently swinging. Match the reference's detailed painted illustration. Isolated clean TRANSPARENT RGBA background, alpha zero around every character edge and between legs. NO glow, halo, shadow, background color or checkerboard. Entire head and both feet visible. Only this single character, centered.

Transparency correction: remove all checkerboard background pixels, preserve the boy, and output actual transparent RGBA. The final source was checked for an alpha channel before export.

