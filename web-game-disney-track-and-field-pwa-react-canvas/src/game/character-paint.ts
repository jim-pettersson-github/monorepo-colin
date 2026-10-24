export type C = CanvasRenderingContext2D;
const paths = new Map<string, Path2D>();
function path(data: string) {
  let result = paths.get(data);
  if (!result) {
    result = new Path2D(data);
    paths.set(data, result);
  }
  return result;
}
export function tint(color: string, amount: number) {
  return `#${[1, 3, 5]
    .map((p) =>
      Math.max(0, Math.min(255, parseInt(color.slice(p, p + 2), 16) + amount))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}
export function form(c: C, data: string, color: string, outline = true) {
  const gradient = c.createLinearGradient(-24, -85, 26, -25);
  gradient.addColorStop(0, tint(color, 22));
  gradient.addColorStop(0.5, color);
  gradient.addColorStop(1, tint(color, -23));
  c.fillStyle = gradient;
  c.fill(path(data));
  if (outline) {
    c.strokeStyle = tint(color, -48);
    c.lineWidth = 0.8;
    c.lineJoin = 'round';
    c.stroke(path(data));
  }
}
export function line(c: C, data: string, color: string, width = 1) {
  c.strokeStyle = color;
  c.lineWidth = width;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.stroke(path(data));
}
export function oval(c: C, x: number, y: number, rx: number, ry: number, color: string, rotation = 0) {
  const g = c.createRadialGradient(x - rx * 0.35, y - ry * 0.4, 0, x, y, Math.max(rx, ry) * 1.2);
  g.addColorStop(0, tint(color, 20));
  g.addColorStop(0.6, color);
  g.addColorStop(1, tint(color, -24));
  c.fillStyle = g;
  c.beginPath();
  c.ellipse(x, y, rx, ry, rotation, 0, Math.PI * 2);
  c.fill();
}
export function limb(c: C, points: number[], color: string, width: number) {
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.beginPath();
  c.moveTo(points[0], points[1]);
  c.lineTo(points[2], points[3]);
  c.lineTo(points[4], points[5]);
  c.strokeStyle = tint(color, -38);
  c.lineWidth = width + 1;
  c.stroke();
  c.strokeStyle = color;
  c.lineWidth = width;
  c.stroke();
  c.beginPath();
  c.moveTo(points[0] - width * 0.2, points[1]);
  c.lineTo(points[2] - width * 0.2, points[3]);
  c.strokeStyle = tint(color, 25);
  c.lineWidth = Math.max(0.8, width * 0.18);
  c.stroke();
}
export function shoe(c: C, x: number, y: number, color: string, large = false) {
  c.save();
  c.translate(x, y);
  c.scale(large ? 1.3 : 1, large ? 1.2 : 1);
  form(c, 'M-5-6Q0-8 3-4L10-2Q14 0 10 3L-5 3Q-8 1-5-6Z', color);
  line(c, 'M-6 1Q3 3 11 0', tint(color, -45), 1.1);
  line(c, 'M-1-4 3-3M1-6 5-4', tint(color, 45), 0.9);
  c.restore();
}
export function legs(c: C, phase: number, hip: number, skin: string, shoes: string | null, large = false) {
  for (const side of [-1, 1]) {
    const swing = Math.sin(phase + (side === -1 ? Math.PI : 0));
    const lift = Math.max(0, -swing) * 8;
    const x = side * 5 + swing * 12;
    const y = -lift;
    limb(c, [side * 5, hip, side * 6 + swing * 7, hip * 0.45 - lift * 0.3, x, y - 4], side === -1 ? tint(skin, -16) : skin, large ? 6 : 5);
    if (shoes) shoe(c, x, y, shoes, large);
    else oval(c, x + 2, y, 6.4, 3, skin);
  }
}
export function arm(c: C, side: number, y: number, phase: number, skin: string, sleeve: string | null, glove: boolean, celebrate: boolean) {
  const swing = Math.sin(phase + (side === -1 ? 0 : Math.PI));
  const elbowX = side * 2 + swing * 8;
  const elbowY = 12 - Math.abs(swing) * 3;
  const handX = elbowX + side * 3;
  const handY = 17 - Math.abs(swing) * 12;
  c.save();
  c.translate(side * 10, y);
  if (celebrate) c.rotate(side * -2.1);
  limb(c, [0, 0, elbowX, elbowY, handX, handY], skin, 5.6);
  if (sleeve) {
    limb(c, [0, 0, elbowX * 0.4, elbowY * 0.4, elbowX * 0.7, elbowY * 0.7], sleeve, 7);
    oval(c, elbowX * 0.7, elbowY * 0.7, 3.5, 1.1, tint(sleeve, 28), Math.atan2(-elbowX, elbowY));
  }
  c.save();
  c.translate(handX, handY);
  oval(c, 0, 0, glove ? 4.6 : 3.4, glove ? 4.8 : 3.7, glove ? '#fff9e9' : skin, -0.3);
  line(c, 'M-1-2 1 0M-2 0 0 2', glove ? '#b3abb6' : tint(skin, -24), 0.7);
  c.restore();
  c.restore();
}
export function eye(c: C, x: number, y: number, iris: string, size = 1) {
  c.save();
  c.translate(x, y);
  c.scale(size, size);
  form(c, 'M-3 0Q0-3.8 3.5-.2Q.8 2.7-3 0Z', '#fffdf5', false);
  oval(c, 0.8, -0.1, 1.65, 2, iris);
  oval(c, 1.2, 0, 0.8, 1.4, '#282437');
  oval(c, 0.9, -0.8, 0.45, 0.55, '#ffffff');
  line(c, 'M-3 0Q0-3.8 3.5-.2', '#51404a', 0.75);
  c.restore();
}
