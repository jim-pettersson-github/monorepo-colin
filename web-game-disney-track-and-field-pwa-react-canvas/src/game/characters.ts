import type { CharacterId } from './model';

type C = CanvasRenderingContext2D;
function tint(color: string, n: number) {
  if (!/^#[0-9a-f]{6}$/i.test(color)) return color;
  return (
    '#' +
    [1, 3, 5]
      .map((p) =>
        Math.max(0, Math.min(255, parseInt(color.slice(p, p + 2), 16) + n))
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  );
}
function ellipse(c: C, x: number, y: number, rx: number, ry: number, color: string) {
  if (rx > 7 && ry > 5) {
    const g = c.createRadialGradient(x - rx * 0.35, y - ry * 0.4, 1, x, y, Math.max(rx, ry) * 1.3);
    g.addColorStop(0, tint(color, 30));
    g.addColorStop(0.65, color);
    g.addColorStop(1, tint(color, -22));
    c.fillStyle = g;
  } else c.fillStyle = color;
  c.beginPath();
  c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  c.fill();
}
function stroke(c: C, points: number[], color: string, width: number) {
  c.strokeStyle = tint(color, -48);
  c.lineWidth = width + 1.6;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.beginPath();
  c.moveTo(points[0], points[1]);
  for (let i = 2; i < points.length; i += 2) c.lineTo(points[i], points[i + 1]);
  c.stroke();
  c.strokeStyle = color;
  c.lineWidth = width;
  c.stroke();
}
function shape(c: C, points: number[], color: string) {
  const gradient = c.createLinearGradient(0, -55, 0, -20);
  gradient.addColorStop(0, tint(color, 24));
  gradient.addColorStop(1, tint(color, -18));
  c.fillStyle = gradient;
  c.beginPath();
  c.moveTo(points[0], points[1]);
  for (let i = 2; i < points.length; i += 2) c.lineTo(points[i], points[i + 1]);
  c.closePath();
  c.fill();
  c.strokeStyle = tint(color, -35);
  c.lineWidth = 0.8;
  c.stroke();
}
export function drawCharacter(c: C, id: CharacterId, x: number, y: number, scale: number, stride = 0, celebrate = false) {
  c.save();
  c.translate(x, y + Math.abs(Math.sin(stride)) * 1.7);
  c.scale(scale, scale);
  const mouse = id === 'mickey' || id === 'minnie';
  const human = ['elsa', 'moana', 'rapunzel'].includes(id);
  const skin =
    id === 'moana' ? '#bd8059' : human ? '#f4c9a8' : id === 'donald' ? '#fff9e9' : id === 'stitch' ? '#6598d9' : id === 'simba' ? '#edb64f' : '#26233c';
  const shirt =
    id === 'elsa'
      ? '#77dce2'
      : id === 'moana'
        ? '#df7558'
        : id === 'rapunzel'
          ? '#b187d2'
          : id === 'donald'
            ? '#357ac0'
            : id === 'minnie'
              ? '#e4729d'
              : id === 'stitch'
                ? '#527dbd'
                : id === 'simba'
                  ? '#e3a23b'
                  : '#e25550';
  const a = Math.sin(stride) * 15,
    b = Math.sin(stride + Math.PI) * 15;
  if (id === 'simba') stroke(c, [-10, -23, -27, -31, -33, -21], '#ca8432', 5);
  if (id === 'stitch') {
    shape(c, [-18, -69, -39, -91, -34, -60, -20, -55], skin);
    shape(c, [18, -69, 39, -91, 34, -60, 20, -55], skin);
    shape(c, [-23, -69, -34, -82, -29, -63], '#bb83af');
    shape(c, [23, -69, 34, -82, 29, -63], '#bb83af');
  }
  if (mouse) {
    ellipse(c, -17, -84, 13, 13, '#26233c');
    ellipse(c, 17, -84, 13, 13, '#26233c');
  }
  if (human) {
    ellipse(c, 0, -62, 23, 29, id === 'moana' ? '#4a2d2e' : id === 'elsa' ? '#f5df9d' : '#edbd51');
    if (id === 'rapunzel') stroke(c, [-16, -65, -25, -35, -18, -4, 13, -3], '#edbd51', 12);
  }
  if (id === 'simba') {
    ellipse(c, -16, -78, 9, 10, '#d9993c');
    ellipse(c, 16, -78, 9, 10, '#d9993c');
    ellipse(c, -16, -78, 5, 6, '#8d572b');
    ellipse(c, 16, -78, 5, 6, '#8d572b');
  }
  const leg = human ? skin : id === 'donald' ? '#e7a342' : skin;
  stroke(c, [-6, -24, -7 + b * 0.55, -13, -8 + b, 0], leg, 8);
  stroke(c, [7, -24, 8 + a * 0.55, -12, 9 + a, 0], leg, 8);
  const shoe = mouse ? '#f8d45b' : human ? '#fbf3d9' : id === 'donald' ? '#f4b34f' : skin;
  ellipse(c, -4 + b, 0, 10, 5, shoe);
  ellipse(c, 13 + a, 0, 10, 5, shoe);
  stroke(c, [-13, -48, -23 - a * 0.45, -32 - a * 0.35], skin, 8);
  stroke(c, [13, -48, 23 - b * 0.45, celebrate ? -75 : -32 - b * 0.35], skin, 8);
  if (mouse || id === 'donald') {
    ellipse(c, -23 - a * 0.45, -32 - a * 0.35, 6, 6, '#fff9e9');
    ellipse(c, 23 - b * 0.45, celebrate ? -75 : -32 - b * 0.35, 6, 6, '#fff9e9');
  }
  shape(c, [-13, -52, 13, -52, 14, -27, -14, -27], shirt);
  if (['minnie', 'elsa', 'moana', 'rapunzel'].includes(id)) shape(c, [-11, -38, 11, -38, 20, -22, -20, -22], id === 'moana' ? '#f1d4a1' : shirt);
  if (id === 'mickey') {
    ellipse(c, -5, -34, 2.7, 4, '#fff2cd');
    ellipse(c, 5, -34, 2.7, 4, '#fff2cd');
  }
  if (id === 'minnie') {
    for (const [dx, dy] of [
      [-10, -31],
      [5, -26],
      [9, -37],
      [-3, -43],
    ])
      ellipse(c, dx, dy, 2, 2, '#fff9e9');
  }
  if (id === 'donald') {
    shape(c, [-14, -52, 0, -43, 14, -52, 8, -37, -8, -37], '#edf7ff');
    shape(c, [-3, -46, 3, -46, 0, -32], '#ec5354');
  }
  if (id === 'moana') {
    stroke(c, [-11, -42, 10, -42], '#fff0d0', 3);
    stroke(c, [-9, -27, 9, -25], '#ba6b42', 2);
  }
  ellipse(c, 0, -66, id === 'stitch' ? 25 : 20, id === 'stitch' ? 20 : 23, skin);
  if (mouse) {
    ellipse(c, -7, -68, 8, 15, '#f5d7b7');
    ellipse(c, 7, -68, 8, 15, '#f5d7b7');
    ellipse(c, 0, -55, 17, 11, '#f5d7b7');
  }
  if (id === 'simba') {
    ellipse(c, 0, -57, 15, 10, '#f7d994');
    shape(c, [-11, -83, -3, -89, 3, -83, 8, -87, 11, -79], '#bb7c30');
  }
  if (id === 'stitch') {
    ellipse(c, -12, -66, 8, 10, '#243c69');
    ellipse(c, 12, -66, 8, 10, '#243c69');
    ellipse(c, -10, -69, 2.5, 3, '#fff6e0');
    ellipse(c, 14, -69, 2.5, 3, '#fff6e0');
    ellipse(c, 0, -58, 7, 5, '#294570');
  } else {
    ellipse(c, -6, -67, 4, 7, '#fffdf2');
    ellipse(c, 6, -67, 4, 7, '#fffdf2');
    ellipse(c, -4.5, -67, 1.9, 4, '#28253c');
    ellipse(c, 7.5, -67, 1.9, 4, '#28253c');
    if (id === 'donald') {
      ellipse(c, 5, -54, 20, 6, '#efad3d');
      stroke(c, [-9, -53, 20, -52], '#bd7531', 1.4);
    } else {
      ellipse(c, 1, -56, mouse ? 6 : 3, mouse ? 4 : 2.5, mouse ? '#26233c' : id === 'simba' ? '#80533b' : '#d9957c');
      c.strokeStyle = '#75433e';
      c.lineWidth = 1.5;
      c.beginPath();
      c.arc(1, -55, 8, 0.3, 2.5);
      c.stroke();
    }
  }
  if (id === 'donald') {
    ellipse(c, 0, -87, 14, 5, '#377dc7');
    shape(c, [-12, -88, 9, -90, 14, -82, -13, -82], '#377dc7');
    stroke(c, [-9, -82, 9, -82], '#1c355e', 3);
  }
  if (id === 'minnie') {
    shape(c, [-3, -88, -18, -98, -20, -85, -3, -84], '#e4729d');
    shape(c, [3, -88, 18, -98, 20, -85, 3, -84], '#e4729d');
    ellipse(c, 0, -87, 5, 5, '#e4729d');
    ellipse(c, -13, -91, 2, 2, '#fff9e9');
    ellipse(c, 13, -91, 2, 2, '#fff9e9');
  }
  if (human) {
    const hair = id === 'moana' ? '#4a2d2e' : id === 'elsa' ? '#f5df9d' : '#edbd51';
    shape(c, [-19, -70, -19, -82, -7, -91, 10, -88, 19, -78, 18, -69, 9, -79, -6, -80], hair);
    if (id === 'elsa') {
      for (let i = 0; i < 6; i++) ellipse(c, 18 - i * 0.7, -65 + i * 6, 5.5, 5.5, hair);
      stroke(c, [-8, -90, 0, -95, 7, -89], '#c8f9f0', 3);
    }
    if (id === 'moana') ellipse(c, -18, -77, 5, 5, '#f7e2b6');
  }
  // Fine costume details remain visible on the larger in-game silhouettes.
  if (mouse) {
    stroke(c, [-10 + b, -1, 3 + b, -1], '#fff0a3', 1);
    stroke(c, [7 + a, -1, 20 + a, -1], '#fff0a3', 1);
    stroke(c, [-21 - a * 0.45, -34 - a * 0.35, -20 - a * 0.45, -30 - a * 0.35], '#bdb6b6', 1);
  }
  if (human) {
    stroke(c, [-10, -57, -15, -48], tint(skin, 20), 2);
    stroke(c, [-7, -74, -3, -75], '#92715e', 1.2);
    stroke(c, [4, -75, 9, -74], '#92715e', 1.2);
  }
  if (id === 'elsa') {
    for (const [dx, dy] of [
      [0, -43],
      [9, -34],
      [-8, -29],
    ]) {
      stroke(c, [dx - 3, dy, dx + 3, dy], '#e6ffff', 1);
      stroke(c, [dx, dy - 3, dx, dy + 3], '#e6ffff', 1);
    }
  }
  if (id === 'simba') {
    stroke(c, [-9, -57, -20, -59], '#bd823b', 0.8);
    stroke(c, [10, -57, 21, -59], '#bd823b', 0.8);
  }
  if (id === 'stitch') {
    stroke(c, [-15, -49, -8, -43, 8, -43, 15, -49], '#8eb5e8', 3);
  }
  c.restore();
}
