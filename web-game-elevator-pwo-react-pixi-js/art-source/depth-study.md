# Depth movement study

This isolated `?view=depth` prototype uses the built-in image tool for a painted lobby and a reaching Colin sprite. It does not initialize GameSession or write game saves. Export source PNGs with `node scripts/prepare-depth-art.mjs`; runtime assets are `public/depth-study/room.webp` and `reach.webp`.

It demonstrates perspective floor movement and character scaling, a recessed cabin, sliding leaves drawn in front of a rider, threshold obstruction/reopening, and approaching beside the call panel with a reaching pose and illuminated button. It is a fixed-camera 2.5D study, not a replacement for the three-building game. Directional animation, full navigation around furniture, floor changes and passenger routes remain main-game integration work after review.

## Final prompts

### Room

Use case: stylized-concept. Create a polished hand-painted 2.5D point-and-click adventure game BACKGROUND PLATE, landscape 4:3. Use the reference only for its modern Monkey Island-inspired painted art direction: warm amber light, dark walnut, brass, deep teal shadows, rich brushwork and welcoming Swedish hotel. NO people or characters. A spacious hotel elevator lobby, viewed from a fixed slightly elevated camera, real perspective depth instead of side elevation. Composition is important for a playable floor: entire bottom 42 percent is EMPTY WALKABLE checkerboard marble floor with strong converging perspective lines. Rear wall meets floor at roughly 60 percent image height. Center-right is a large OPEN elevator occupying horizontal 55–77 percent, top at 13 percent, sill at 62 percent. Door opening almost straight-on, vertical parallel door jambs and horizontal sill. Its open cabin shows visible SIDE WALLS, handrail, BACK WALL and a SMALL RECEDING FLOOR extending from sill back to 55 percent image height, so walking into it is unmistakable. NO elevator door leaves, no gates; game animates those. A small brass two-button call panel on the wall just LEFT of lift opening, around 51 percent horizontal and 47 percent vertical. Warm pleated wall lamps, a green emergency exit sign and detailed red fire alarm further left, an open stairwell door on left. Confine furniture and plants to far outer edges; central floor wide and unobstructed. Strong atmospheric depth but crisp readable interactive objects. No writing apart from legible exit pictograms, no numbers, no watermark. Frame entire room floor to bottom edge; no vignette or border.

### Reaching Colin

Use case: identity-preserve. Edit this Colin sprite into a reaching pose for a painted point-and-click game. Preserve exact child identity, proportions, clothes, hairstyle, brown eyes, bare feet, professional painted style and whole body standing position. Colin faces RIGHT in three-quarter side view. Raise his visible arm toward the RIGHT: upper arm angled slightly upward and forearm extended horizontally, hand at his shoulder height, INDEX FINGER pointing right to press an imaginary button beyond his body. Other arm relaxed. Full body feet and extended fingertip entirely visible, spacious margins. NO button or other object. Deliver genuinely transparent RGBA PNG alpha zero background, no checkerboard, no ground shadow.

### Transparent cutout cleanup

Use case: background-extraction. Remove ALL background and ALL colored glow/halo from this Colin reaching sprite. Preserve the entire character exactly. Deliver a true transparent RGBA cutout: alpha zero everywhere outside the hard painted silhouette including around hair, under the reaching arm, between legs, around feet. No brown/blue glow or ground shadow. No checkerboard. Do not redraw or change pose. Full body pointing right. Only character pixels remain.

