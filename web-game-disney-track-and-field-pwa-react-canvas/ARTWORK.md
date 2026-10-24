# Artwork

The stadium backdrop is generated with the built-in image tool and saved in public/art/stadium.webp. The full-resolution generated source is art-source/stadium.png. Character drawings remain local Canvas code in src/game/characters.ts.

Twenty characters use outlined silhouettes, shaded faces, costume embroidery, hair and accessory details, articulated limbs and body weight shifts. Human outfits, braids and loose hair have secondary motion. Baymax, Olof, Långben, Buzz and Woody have separate body construction and running proportions. Character art is split between character-people.ts, character-guests.ts and characters.ts, using the drawing helpers in character-paint.ts. Simba has a four-legged running pose. The same drawings are used in the character picker and during events; no extra image downloads are needed.

Prompt: Original premium 2.5D hand-painted family athletics stadium; rich textures, golden afternoon lighting; empty terracotta running track in the foreground; impressionistic crowd, cream stadium architecture, teal and lavender canopies, pennants, floodlights, wooded hills and painterly turquoise sky. No text, logos or characters. Leave the track clear for interactive runners and markings.

The requested character sprite-sheet generation was rejected by the image tool. No generated character sprites are used.

Run node scripts/capture-characters.mjs with the dev server on port 4016 to save a twenty-character contact sheet in ignored test-results/. Character selection includes a larger running preview, paused offscreen/backgrounded and static when reduced motion is requested.
