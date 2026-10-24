import { drawCharacter } from './characters';
import { character, type GameState, type Runner } from './model';
import { arrowHeight, entryError, liftPower, liftWeight } from './skill-sports';

type C = CanvasRenderingContext2D;
const colors = ['#ffd358', '#78c5e9', '#ef8cac', '#8fd5a4'];
function text(c: C, value: string, x: number, y: number, size = 14, color = '#39314d', align: CanvasTextAlign = 'left') {
  c.fillStyle = color;
  c.font = `bold ${size}px system-ui, sans-serif`;
  c.textAlign = align;
  c.fillText(value, x, y);
}
function oval(c: C, x: number, y: number, rx: number, ry: number, color: string) {
  c.fillStyle = color;
  c.beginPath();
  c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  c.fill();
}
function line(c: C, points: number[], color: string, width = 2) {
  c.strokeStyle = color;
  c.lineWidth = width;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(points[0], points[1]);
  for (let i = 2; i < points.length; i += 2) c.lineTo(points[i], points[i + 1]);
  c.stroke();
}
function meter(c: C, value: number, balance: boolean) {
  c.fillStyle = '#625b70';
  c.fillRect(36, 248, 228, 9);
  c.fillStyle = '#90caa0';
  c.fillRect(balance ? 135 : 184, 248, balance ? 50 : 80, 9);
  const x = 36 + Math.max(0, Math.min(1, value)) * 228;
  line(c, [x, 244, x, 261], '#fff6de', 3);
}
function range(c: C, r: Runner, lane: number, time: number) {
  const s = r.skill;
  if (!s) return;
  const grass = c.createLinearGradient(0, 70, 0, 240);
  grass.addColorStop(0, '#b3ceac');
  grass.addColorStop(1, '#5d9d84');
  c.fillStyle = grass;
  c.fillRect(0, 34, 300, 200);
  for (let i = 0; i < 6; i++) {
    c.fillStyle = i % 2 ? '#f0e9cf30' : '#3a796418';
    c.fillRect(0, 84 + i * 26, 300, 14);
  }
  line(c, [225, 161, 214, 224, 251, 224, 260, 161], '#9c7955', 5);
  oval(c, 242, 130, 44, 50, '#e1d4b6');
  for (const [radius, color] of [
    [39, '#f8f2df'],
    [31, '#393d4b'],
    [23, '#73a6c9'],
    [15, '#d66d66'],
    [7, '#efcd61'],
  ] as const)
    oval(c, 242, 129, radius, radius * 1.12, color);
  line(c, [221, 89, 214, 104], '#ffffff80', 2);
  oval(c, 75, 217, 28, 5, '#314f5530');
  drawCharacter(c, r.character, 76, 215, 1.06, 0, false);
  // Bow, taut string and arrow point toward the target rather than the running lane.
  c.strokeStyle = '#795338';
  c.lineWidth = 3;
  c.beginPath();
  c.moveTo(116, 128);
  c.quadraticCurveTo(144, 160, 116, 192);
  c.stroke();
  line(c, [116, 128, 105, 160, 116, 192], '#f6e5b5', 1.2);
  const ty = s.stage === 'ready' ? arrowHeight(time, lane) : s.balance;
  const tx = 242 + s.aim * 39,
    hy = 129 + ty * 39;
  if (s.stage === 'ready') {
    c.strokeStyle = '#fffce9';
    c.lineWidth = 1.5;
    c.beginPath();
    c.arc(tx, hy, 6, 0, Math.PI * 2);
    c.stroke();
    line(c, [tx - 10, hy, tx + 10, hy], '#3c3b47', 1);
    line(c, [tx, hy - 10, tx, hy + 10], '#3c3b47', 1);
    line(c, [106, 160, 139, 160], '#e7c58a', 2);
  } else {
    const x = 110 + (tx - 110) * s.progress,
      y = 160 + (hy - 160) * s.progress;
    line(c, [x - 15, y + 3, x + 2, y], '#66483b', 2);
    if (r.done) {
      oval(c, tx, hy, 2.5, 2.5, '#fffbe1');
      text(c, `${r.result ?? 0} POÄNG`, 150, 65, 19, '#fff9df', 'center');
    }
  }
  text(c, s.stage === 'ready' ? '← SIKTA →   ·   SKJUT I MITTEN' : 'PILEN FLYGER', 150, 264, 12, '#554a5e', 'center');
}
function pool(c: C, r: Runner, time: number) {
  const s = r.skill;
  if (!s) return;
  const wall = c.createLinearGradient(0, 34, 0, 230);
  wall.addColorStop(0, '#d8e8ed');
  wall.addColorStop(1, '#a0c4d3');
  c.fillStyle = wall;
  c.fillRect(0, 34, 300, 246);
  c.strokeStyle = '#eef5e8';
  c.lineWidth = 1;
  for (let x = 0; x < 300; x += 30) line(c, [x, 40, x, 224], '#b6d3d6', 1);
  for (let y = 55; y < 224; y += 28) line(c, [0, y, 300, y], '#b6d3d6', 1);
  line(c, [43, 112, 43, 222, 67, 222, 67, 112], '#63869d', 4);
  for (let y = 130; y < 220; y += 20) line(c, [44, y, 66, y], '#edf2e7', 3);
  line(c, [33, 111, 99, 111], '#f0de9d', 7);
  c.fillStyle = '#4a9ebc';
  c.fillRect(0, 225, 300, 55);
  for (let i = 0; i < 5; i++) {
    c.beginPath();
    c.strokeStyle = i % 2 ? '#98d9dd' : '#d3f3ea';
    c.lineWidth = 1.5;
    for (let x = 0; x <= 300; x += 5) {
      const y = 230 + i * 9 + Math.sin(x * 0.08 + time * 2 + i) * 2;
      if (x === 0) c.moveTo(x, y);
      else c.lineTo(x, y);
    }
    c.stroke();
  }
  const p = s.progress;
  const x = s.stage === 'ready' ? 76 : 96 + p * 143;
  const y = s.stage === 'ready' ? 111 : 108 + p * 116 - Math.sin(p * Math.PI) * 55;
  if (!r.done) {
    c.save();
    c.translate(x, y - 30);
    c.rotate(s.stage === 'ready' ? 0 : s.aim);
    c.scale(1, s.stage === 'active' ? 0.75 : 1);
    drawCharacter(c, r.character, 0, 30, 0.66, 0, s.stage === 'released');
    c.restore();
  } else {
    for (let i = 0; i < 7; i++) oval(c, x + (i - 3) * 7, 220 - Math.sin(i * 1.4) ** 2 * 14, 2.5, 5, '#d6f4ee');
    text(c, `${r.result?.toFixed(1) ?? '0'} POÄNG`, 150, 66, 19, '#395570', 'center');
  }
  if (s.stage !== 'ready' && !r.done) {
    const error = entryError(s.aim) / Math.PI;
    text(
      c,
      error < 0.14 ? 'RAK INGÅNG!' : s.stage === 'active' ? 'ROTERA · STRÄCK MED KNAPPEN' : 'FINJUSTERA MED ← →',
      150,
      60,
      12,
      error < 0.14 ? '#3e7c63' : '#455577',
      'center',
    );
  }
  text(
    c,
    s.stage === 'ready' ? 'HOPPA · ROTERA · STRÄCK' : s.stage === 'active' ? 'HÅLL ← ELLER → FÖR VOLT' : 'STRÄCKT · SIKTA MED HUVUDET NER',
    150,
    267,
    11,
    '#f4f8e5',
    'center',
  );
}
function lifting(c: C, r: Runner, attempt: number, time: number) {
  const s = r.skill;
  if (!s) return;
  c.fillStyle = '#c8b8a2';
  c.fillRect(0, 34, 300, 246);
  for (let i = 0; i < 5; i++) {
    c.fillStyle = i % 2 ? '#faf1d240' : '#443b551a';
    c.fillRect(i * 66, 34, 40, 160);
  }
  c.fillStyle = '#806350';
  c.fillRect(0, 218, 300, 62);
  c.fillStyle = '#b58c62';
  c.fillRect(18, 214, 264, 18);
  line(c, [18, 232, 282, 232], '#d1ad7c', 2);
  const success = r.done && r.result !== null;
  const progress = s.stage === 'ready' ? 0 : success ? 1 : r.done ? 0 : s.progress;
  oval(c, 150, 220, 37, 6, '#3f334d30');
  drawCharacter(c, r.character, 150, 218, 1.18, 0, progress > 0.6);
  const by = 211 - progress * 119;
  line(c, [79, by, 221, by], '#c4d2d6', 5);
  line(c, [79, by - 1, 221, by - 1], '#f4f4e7', 1.5);
  for (const side of [-1, 1])
    for (const i of [0, 1, 2]) {
      const x = 150 + side * (46 + i * 8);
      c.fillStyle = i === 0 ? '#ca7669' : i === 1 ? '#688fba' : '#4c566a';
      c.fillRect(x - 4, by - 19 + i * 3, 8, 38 - i * 6);
      line(c, [x - 1, by - 16 + i * 3, x - 1, by + 15 - i * 3], '#ffffff50', 1);
    }
  text(c, `${liftWeight(attempt)} KG`, 150, 60, 20, '#514255', 'center');
  if (r.done) text(c, success ? 'GODKÄNT!' : 'NYTT FÖRSÖK NÄSTA GÅNG', 150, 83, 13, success ? '#41694e' : '#894c4f', 'center');
  meter(c, s.stage === 'ready' ? liftPower(time) : 0.5 + s.balance * 0.5, s.stage !== 'ready');
  text(
    c,
    s.stage === 'ready' ? 'LYFT I GRÖNT' : success ? 'STARKT JOBBAT!' : progress < 1 ? '← BALANSERA →' : 'HÅLL MITTEN · LÅS LYFTET',
    150,
    276,
    11,
    '#fff1d8',
    'center',
  );
}
export function drawSkillScene(c: C, w: number, h: number, state: GameState, time: number) {
  c.fillStyle = '#38314e';
  c.fillRect(0, 0, w, h);
  const columns = w > h * 1.5 ? 4 : 2,
    rows = 4 / columns,
    gap = 8,
    top = w < 600 ? 76 : 60;
  const width = (w - gap * (columns + 1)) / columns,
    height = (h - top - gap * (rows + 1)) / rows;
  for (const [lane, r] of state.runners.entries()) {
    const x = gap + (lane % columns) * (width + gap),
      y = top + gap + Math.floor(lane / columns) * (height + gap);
    c.save();
    c.beginPath();
    c.roundRect(x, y, width, height, 9);
    c.clip();
    c.fillStyle = '#eee6d7';
    c.fillRect(x, y, width, height);
    const scale = Math.min(width / 300, height / 284);
    c.translate(x + (width - 300 * scale) / 2, y + (height - 284 * scale) / 2);
    c.scale(scale, scale);
    if (state.event === 'archery') range(c, r, lane, time);
    else if (state.event === 'diving') pool(c, r, time);
    else lifting(c, r, state.attempt, time);
    c.fillStyle = r.human === null ? '#ddd4df' : colors[lane];
    c.fillRect(0, 0, 300, 34);
    text(c, `${r.human === null ? 'AI' : `P${r.human + 1}`} · ${character(r.character).name}`, 12, 23, 15);
    c.restore();
  }
}
