import { drawCharacter } from './characters';
import type { CharacterId, GameState } from './model';
import { barHeight, character, eventInfo, jumpEvent, obstacleCount, obstaclePosition, raceScale, stationaryEvent, verticalEvent } from './model';

type C = CanvasRenderingContext2D;
let stadium: HTMLImageElement | null = null;
if (typeof Image !== 'undefined') {
  stadium = new Image();
  stadium.src = `${import.meta.env.BASE_URL}art/stadium.webp`;
}
const colors = ['#ffd358', '#78c5e9', '#ef8cac', '#8fd5a4'];
function rect(c: C, x: number, y: number, w: number, h: number, color: string) {
  c.fillStyle = color;
  c.fillRect(x, y, w, h);
}
function text(c: C, value: string, x: number, y: number, size: number, color: string, align: CanvasTextAlign = 'left') {
  c.font = `800 ${size}px ui-sans-serif, system-ui, sans-serif`;
  c.textAlign = align;
  c.fillStyle = color;
  c.fillText(value, x, y);
}
function circle(c: C, x: number, y: number, r: number, color: string) {
  c.fillStyle = color;
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fill();
}
export function drawStadium(c: C, w: number, h: number, t: number) {
  if (stadium?.complete && stadium.naturalWidth) {
    c.drawImage(stadium, 0, 0, stadium.naturalWidth, stadium.naturalHeight * 0.58, 0, 0, w, h * 0.45);
    c.drawImage(stadium, 0, stadium.naturalHeight * 0.58, stadium.naturalWidth, stadium.naturalHeight * 0.42, 0, h * 0.44, w, h * 0.56);
    const track = c.createLinearGradient(0, h * 0.44, 0, h);
    track.addColorStop(0, '#8e5f5c22');
    track.addColorStop(1, '#68374d33');
    c.fillStyle = track;
    c.fillRect(0, h * 0.44, w, h * 0.56);
    return;
  }
  const sky = c.createLinearGradient(0, 0, 0, h * 0.52);
  sky.addColorStop(0, '#b7c8ec');
  sky.addColorStop(1, '#e5e9f8');
  rect(c, 0, 0, w, h, '#acd9c0');
  c.fillStyle = sky;
  c.fillRect(0, 0, w, h * 0.45);
  circle(c, w * 0.79, h * 0.14, h * 0.07, '#ffedaa');
  for (let i = 0; i < 5; i++) {
    const x = ((((i * w * 0.26 - t * 5) % (w + 180)) + w + 180) % (w + 180)) - 90;
    circle(c, x, h * 0.13, 27, '#f6f4f4');
    circle(c, x + 24, h * 0.12, 36, '#f6f4f4');
    circle(c, x + 55, h * 0.14, 24, '#f6f4f4');
  }
  rect(c, 0, h * 0.28, w, h * 0.16, '#625b8c');
  rect(c, 0, h * 0.28, w, 7, '#f5e5c2');
  for (let row = 0; row < 4; row++)
    for (let i = 0; i < Math.ceil(w / 22); i++) {
      const x = i * 22 + (row % 2) * 8;
      const y = h * 0.3 + row * h * 0.026;
      circle(c, x, y, 3.7, ['#e8c883', '#dad9f5', '#a3cfca', '#de9d9a'][(i * 7 + row * 3) % 4]);
      rect(c, x - 4, y + 4, 8, 5, ['#af91b9', '#89b6d5', '#d29a84'][(i + row) % 3]);
    }
  rect(c, 0, h * 0.405, w, h * 0.035, '#3e776e');
  for (let i = 0; i < Math.ceil(w / 150); i++) {
    const x = i * 150 + 42;
    rect(c, x, h * 0.2, 3, h * 0.08, '#7b749c');
    c.fillStyle = ['#ffd358', '#ff9782', '#87d5c7'][i % 3];
    c.beginPath();
    c.moveTo(x + 3, h * 0.2);
    c.lineTo(x + 40, h * 0.22);
    c.lineTo(x + 3, h * 0.24);
    c.fill();
  }
  rect(c, 0, h * 0.44, w, h * 0.56, '#c36966');
}
export function drawScene(c: C, w: number, h: number, state: GameState | null, t: number, cast: CharacterId[] = ['mickey', 'stitch', 'elsa']) {
  drawStadium(c, w, h, t);
  const info = state ? eventInfo(state.event) : null;
  const field = info?.type === 'field';
  const worldScale = state && !field ? raceScale(state.event) : 1;
  const focus =
    (state
      ? state.runners.slice(0, state.settings.players).reduce((s, r) => s + (r.launched && field ? r.x + r.flightX : r.x), 0) / state.settings.players
      : t * 6) / worldScale;
  const positions = state ? state.runners.slice(0, state.settings.players).map((r) => (field && r.launched ? r.x + r.flightX : r.x) / worldScale) : [0];
  const span = Math.max(...positions) - Math.min(...positions);
  const shared = state && state.settings.players > 1;
  const laneOffset = shared ? Math.min(52, w * 0.08) : 52;
  const ppm = (shared ? w * 0.88 - laneOffset * 3 : w) / Math.max(36, span + 22);
  const camera = Math.max(0, (shared ? Math.min(...positions) : focus) - 8);
  const x = (meters: number, lane = 0) => (meters / worldScale - camera) * ppm + w * 0.12 + lane * laneOffset;
  const rowH = h * 0.115;
  const first = h * 0.53;
  for (let lane = 0; lane < 4; lane++) {
    const y = first + lane * rowH;
    rect(c, 0, y - rowH * 0.72, w, rowH, lane % 2 ? '#d28b782e' : '#ffd2b22c');
    rect(c, 0, y + rowH * 0.28, w, 2, '#f4d9c5');
    text(c, String(lane + 1), Math.max(22, x(0, lane) - 22), y - 10, Math.max(15, h * 0.032), '#fff0d6');
    if (field) {
      if (state && ['longJump', 'tripleJump'].includes(state.event)) {
        rect(c, x(18, lane), y - rowH * 0.68, ppm * 11, rowH * 0.9, '#ead7aa');
        for (let z = 20; z < 29; z += 2) rect(c, x(z, lane), y - rowH * 0.65, 2, 9, '#bba879');
      } else if (state && verticalEvent(state.event)) {
        const bh = barHeight(state.event, state.attempt);
        const by = y - bh * 15 * Math.max(0.5, Math.min(1.6, h / 380));
        rect(c, x(20, lane), y - 5, ppm * 8, 12, '#8c85bd');
        rect(c, x(22, lane), by, 3, y - by, '#ddd0e6');
        rect(c, x(22, lane) + 34, by + 3, 3, y - by, '#ddd0e6');
        rect(c, x(22, lane) - 3, by, 44, 3, '#ffdb68');
        text(c, `${bh.toFixed(2)} m`, x(22, lane) + 48, by + 4, 10, '#493b62');
      } else rect(c, x(state && stationaryEvent(state.event) ? 0 : 18, lane), y - rowH * 0.68, Math.max(w, ppm * 65), rowH * 0.9, '#8abf9c');
      rect(c, x(state && stationaryEvent(state.event) ? 0 : 18, lane), y - rowH * 0.68, 6, rowH * 0.96, '#fff4d6');
    } else {
      for (let mark = Math.max(0, Math.floor(camera / 10) * 10) * worldScale; mark < (camera + 65) * worldScale; mark += 10 * worldScale) {
        rect(c, x(mark, lane), y - rowH * 0.7, 1, rowH * 0.96, '#eeb5a1');
        if (lane === 3) text(c, `${Math.round(mark)} m`, x(mark, lane) + 4, y + rowH * 0.52, Math.max(10, h * 0.022), '#633e51');
      }
      const finish = info?.distance ?? 100;
      for (let a = 0; a < 3; a++)
        for (let b = 0; b < 8; b++) rect(c, x(finish, lane) + a * 6, y - rowH * 0.7 + b * rowH * 0.12, 6, rowH * 0.12, (a + b) % 2 ? '#fff5dd' : '#423454');
      if (state && obstacleCount(state.event) > 0)
        for (let i = 0; i < obstacleCount(state.event); i++) {
          const hx = x(obstaclePosition(state.event, i), lane);
          if (hx < -40 || hx > w + 40) continue;
          if (state.event === 'steeplechase' && i % 3 === 2) rect(c, hx, y - 8, ppm * 4, rowH * 0.9, '#78c8df');
          const cleared = state.runners[lane].hurdle > i;
          rect(c, hx - 1, y - 30, 3, 32, '#ebdfc5');
          rect(c, hx + 17, y - 26, 3, 28, '#ebdfc5');
          c.save();
          c.translate(hx, y - 31);
          if (cleared) c.rotate(0.95);
          rect(c, -4, -3, 27, 6, '#fbf3df');
          rect(c, 3, -3, 7, 6, '#e27663');
          c.restore();
        }
    }
  }
  const list = state
    ? state.runners
    : cast.map((id, i) => ({
        character: id,
        x: camera + 8 + i * 5,
        speed: 8,
        human: i === 0 ? 0 : null,
        jump: 0,
        launched: false,
        flightX: 0,
        flightY: 0,
        done: false,
        stumble: 0,
        result: null,
      }));
  for (const [i, r] of list.entries()) {
    const y = first + i * rowH;
    const airborne = r.launched && state && jumpEvent(state.event);
    const rx = x(r.x + (airborne ? r.flightX : 0), i);
    const scale = Math.max(0.5, Math.min(1.6, h / 380));
    c.fillStyle = '#533c5338';
    c.beginPath();
    c.ellipse(rx + 4, y + 3, 25 * scale, 6 * scale, 0, 0, Math.PI * 2);
    c.fill();
    const jumping = airborne ? r.flightY : r.jump;
    drawCharacter(c, r.character, rx, y - jumping * 15 * scale, scale, r.done ? 0 : t * (r.stumble > 0 ? 3 : r.speed) * 1.7, r.done);
    if (state?.event === 'poleVault' && !r.launched) {
      c.strokeStyle = '#fbecb7';
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(rx + 8, y - 45 * scale);
      c.lineTo(rx + 30, y - 120 * scale);
      c.stroke();
    }
    const label = r.human === null ? character(r.character).name : `P${r.human + 1}`;
    const labelWidth = Math.max(32, label.length * 6.3);
    const labelY = y - jumping * 15 * scale - 120 * scale;
    rect(c, rx - labelWidth / 2 - 6, labelY - 24, labelWidth + 12, 20, r.human === null ? '#3a3159' : colors[i]);
    text(c, label, rx, labelY - 10, 10, r.human === null ? '#fff4db' : '#30264b', 'center');
    if (r.launched && state && !jumpEvent(state.event)) {
      const fx = x((stationaryEvent(state.event) ? 0 : 18) + r.flightX, i);
      const fy = y - r.flightY * 8 * scale;
      if (state.event === 'shotPut') {
        circle(c, x(0, i) + r.flightX * ppm, fy, 5 * scale, '#3d405c');
      } else if (state.event === 'discus') {
        c.fillStyle = '#e9c784';
        c.beginPath();
        c.ellipse(fx, fy, 9 * scale, 3 * scale, -0.3, 0, Math.PI * 2);
        c.fill();
      } else if (state.event === 'hammer') {
        c.strokeStyle = '#d2d5e1';
        c.lineWidth = 1.5;
        c.beginPath();
        c.moveTo(fx - 15, fy + 8);
        c.lineTo(fx, fy);
        c.stroke();
        circle(c, fx, fy, 6 * scale, '#51546b');
      } else {
        c.strokeStyle = '#f7e0a3';
        c.lineWidth = 3;
        c.beginPath();
        c.moveTo(fx - 18, fy + 4);
        c.lineTo(fx + 24, fy - 4);
        c.stroke();
        circle(c, fx + 24, fy - 4, 2, '#645971');
      }
    }
    if (r.done && r.result !== null && field) text(c, `${r.result.toFixed(2)} m`, Math.min(w - 50, rx + 55), y - 35, 14, '#35294c');
  }
  rect(c, 0, h * 0.96, w, h * 0.04, '#f5dec0');
  if (!state) {
    text(c, 'SAGO ARENA', w * 0.045, h * 0.1, Math.max(12, w * 0.023), '#4d4778');
    text(c, '★  SPORT • VÄNSKAP • MAGI', w * 0.045, h * 0.16, Math.max(8, w * 0.012), '#66628d');
  }
}
