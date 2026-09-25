# Colin idle poses

Generated with the built-in imagegen tool, using `public/painted/colin-0.webp` as the character reference. Source: `colin-idle.png`. Export the five used poses with `node scripts/prepare-colin-idle.mjs`; the unused hand-up pose is retained only in the original sheet.

Use case: stylized-concept. Asset type: transparent painted game animation sprite sheet, landscape 1536x1024.
Reference image is Colin's existing standing sprite: preserve this exact child's face, tousled blond-brown hair, brown eyes, blue T-shirt and blue shorts, bare feet, painterly outlines and shading.
Create ONE 3-column by 2-row sprite sheet, six equally sized cells, no borders/text. Same character scale and three-quarter right-facing view throughout, full figure in each cell. Genuine transparent background, no floor, no shadows. The same head size in every cell, including seated poses. Leave generous transparent separation.
Top row: (1) standing with knees slightly bent, starting to lower into squat, arms forward gently; (2) deep squat with bent knees, heels planted, arms resting on knees; (3) sitting comfortably on the ground, knees bent casually, feet in front, one hand resting beside him.
Bottom row: (4) standing with right hand raised halfway toward his forehead; (5) standing with right index finger touching his right eyebrow, gently scratching; (6) a small cheerful jump in place, knees lightly bent, arms relaxed slightly out, both bare feet visible.
No duplicate arms, no shoes or socks, no props, no effects, no checkerboard baked in. Natural anatomy, calm happy expression. Must match supplied character, not redesigned.

## Runtime

After eight quiet seconds, Colin cycles through sitting, scratching his eyebrow, squatting, and two small hops, with another eight-second pause between actions. Commands cancel the animation immediately. Movement, pending routes, stairs, reaching, open panels, alarm demos, and occupied doorways suppress it. The browser's reduced-motion preference disables the idle sequence, including when changed during play. Pausing/backgrounding freezes its timer. Pose timing is transient UI state and does not alter saves, movement, lift interlocks, or simulation randomness.
