import { Application, extend, useApplication } from '@pixi/react';
import { Graphics } from 'pixi.js';
import { useEffect, useState } from 'react';
import { copy } from '../copy';
import { palette as p } from '../palette';

extend({ Graphics });

function drawLobby(g: Graphics) {
  g.clear();
  const box = (x: number, y: number, w: number, h: number, color: string, radius = 0) => g.roundRect(x, y, w, h, radius).fill(color);
  const oval = (x: number, y: number, rx: number, ry: number, color: string) => g.ellipse(x, y, rx, ry).fill(color);
  const line = (points: number[], color: string, width = 2) => g.poly(points, false).stroke({ color, width, cap: 'round', join: 'round' });

  // A decorative title-screen illustration, deliberately independent of future game state.
  box(0, 0, 760, 520, p.wall);
  box(0, 398, 760, 122, p.floor);
  box(0, 385, 760, 13, p.trim);
  line([0, 458, 760, 458], p.trim);
  for (const x of [80, 265, 450, 635]) line([x, 399, x - 30, 520], p.trim);

  // Window and the tree outside.
  box(29, 103, 135, 209, p.surface, 64);
  box(39, 114, 115, 187, p.glass, 55);
  oval(92, 235, 37, 58, p.frame);
  line([92, 208, 92, 301], p.ink, 4);
  line([39, 207, 154, 207], p.surface, 7);
  line([96, 114, 96, 301], p.surface, 7);
  box(23, 301, 147, 12, p.surface, 3);

  // The lift surround, closed doors, floor display, and a reachable call button.
  box(208, 84, 258, 316, p.trim, 8);
  box(220, 96, 234, 302, p.ink, 4);
  box(230, 105, 214, 291, p.frame, 2);
  box(240, 115, 95, 279, p.glass);
  box(340, 115, 95, 279, p.glass);
  box(247, 123, 10, 262, p.surface);
  box(347, 123, 6, 262, p.surface);
  box(317, 226, 5, 43, p.frame, 2);
  box(355, 226, 5, 43, p.frame, 2);
  box(214, 396, 246, 8, p.ink, 2);
  box(298, 40, 82, 33, p.ink, 7);
  line([317, 61, 323, 51, 329, 61], p.light, 2);
  box(345, 48, 13, 17, p.light, 3);
  box(349, 51, 5, 11, p.ink, 1);
  box(477, 215, 24, 53, p.surface, 5);
  oval(489, 233, 6, 6, p.accent);
  oval(489, 251, 5, 5, p.frame);

  // The green sign has a running person and an arrow, not text alone.
  box(551, 169, 133, 230, p.trim, 5);
  box(561, 179, 113, 215, p.frame, 3);
  box(572, 190, 91, 154, p.glass, 2);
  box(569, 347, 97, 9, p.surface, 3);
  box(576, 119, 82, 35, p.exit, 4);
  box(584, 125, 15, 23, p.surface, 1);
  box(588, 128, 11, 20, p.exit);
  oval(611, 126, 3, 3, p.surface);
  line([607, 132, 614, 133, 619, 140], p.surface, 3);
  line([611, 132, 607, 140, 602, 145], p.surface, 3);
  line([608, 138, 615, 141, 615, 148], p.surface, 3);
  line([626, 136, 648, 136, 641, 129], p.surface, 3);
  line([648, 136, 641, 143], p.surface, 3);

  // Plant, pendant, and warm pools of light.
  line([140, 371, 140, 324], p.plant, 4);
  oval(125, 329, 17, 8, p.plant);
  oval(150, 344, 18, 9, p.frame);
  oval(144, 309, 10, 19, p.plant);
  box(120, 361, 40, 41, p.accent, 5);
  box(116, 358, 48, 10, p.accent, 3);
  line([517, 0, 517, 48], p.ink, 3);
  g.poly([487, 72, 501, 45, 533, 45, 548, 72]).fill(p.light);
  box(486, 70, 63, 5, p.ink, 2);

  // Colin: blond-brown hair, brown eyes, blue shirt, and bare feet.
  oval(414, 453, 42, 9, p.trim);
  box(393, 405, 15, 36, p.skin, 7);
  box(419, 405, 15, 36, p.skin, 7);
  oval(396, 442, 14, 7, p.skin);
  oval(429, 442, 15, 7, p.skin);
  box(389, 379, 49, 37, p.pants, 6);
  box(410, 399, 7, 19, p.wall);
  box(380, 337, 17, 48, p.skin, 8);
  box(431, 337, 17, 48, p.skin, 8);
  box(382, 329, 63, 57, p.shirt, 13);
  box(400, 320, 27, 16, p.skin, 5);
  oval(412, 298, 34, 36, p.skin);
  oval(380, 300, 6, 9, p.skin);
  oval(444, 300, 6, 9, p.skin);
  oval(411, 274, 35, 21, p.hair);
  oval(385, 285, 8, 18, p.hair);
  g.poly([393, 269, 433, 270, 441, 291, 428, 280, 423, 286, 414, 278, 403, 286]).fill(p.hair);
  oval(402, 300, 3, 4, p.eyes);
  oval(426, 300, 3, 4, p.eyes);
  line([407, 314, 413, 317, 420, 314], p.eyes, 2);
}

function LobbyDrawing() {
  const { app } = useApplication();

  useEffect(() => {
    app.render();
  }, [app]);

  return <pixiGraphics draw={drawLobby} />;
}

export function MenuScene() {
  const [ready, setReady] = useState(false);

  return (
    <div className='scene' aria-busy={!ready}>
      {!ready && (
        <p className='scene-loading' role='status'>
          {copy.loading}
        </p>
      )}
      <div aria-hidden='true'>
        <Application
          width={760}
          height={520}
          resolution={Math.min(window.devicePixelRatio || 1, 2)}
          antialias
          autoStart={false}
          preference='webgl'
          onInit={() => setReady(true)}
        >
          <LobbyDrawing />
        </Application>
      </div>
    </div>
  );
}
