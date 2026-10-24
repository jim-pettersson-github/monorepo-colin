import { drawGuest } from './character-guests';
import { arm, type C, eye, form, legs, limb, line, oval } from './character-paint';
import { drawPerson, isPerson } from './character-people';
import type { CharacterId } from './model';

function mouse(c: C, minnie: boolean, stride: number, celebrate: boolean) {
  const black = '#282733';
  const outfit = minnie ? '#df618e' : '#d84840';
  line(c, 'M-10-29Q-30-26-24-43', black, 2.2);
  legs(c, stride, -25, black, '#f3c549', true);
  arm(c, -1, -49, stride, black, null, true, celebrate);
  form(c, 'M-10-55Q0-59 11-54L14-29Q0-22-13-29Z', black);
  form(c, minnie ? 'M-9-52Q0-57 10-51L9-39 19-24Q0-17-19-25L-9-40Z' : 'M-12-37Q0-34 13-37L14-24-1-23-1-29-3-23-14-25Z', outfit);
  if (minnie) {
    for (const [x, y] of [
      [-4, -48],
      [5, -40],
      [-8, -33],
      [8, -28],
      [-1, -25],
    ])
      oval(c, x, y, 1.6, 1.8, '#fff4dc');
  } else {
    oval(c, -5, -30, 2.7, 4, '#fff2c5', 0.15);
    oval(c, 6, -30, 2.7, 4, '#fff2c5', -0.15);
  }
  line(c, minnie ? 'M-9-35Q-6-26-14-25M6-35Q10-27 14-25' : 'M-10-25-8-32M10-25 8-32', minnie ? '#f79cb7' : '#f07963', 1.1);
  arm(c, 1, -49, stride, black, null, true, celebrate);
  oval(c, -17, -88, 12.8, 13.2, black);
  oval(c, 17, -87, 12.8, 13.2, black);
  oval(c, -20, -92, 4, 3, '#44434e', -0.5);
  oval(c, 14, -92, 4, 3, '#44434e', -0.5);
  oval(c, 0, -69, 22, 23, black);
  line(c, 'M-19-75Q-20-87-10-90M14-86Q20-82 20-75', '#514b5d', 1.2);
  form(c, 'M-16-72Q-17-89-7-86Q-2-86 0-79Q4-88 12-84Q20-81 16-69Q23-60 13-54Q0-45-14-54Q-22-61-16-72Z', '#efcba9');
  oval(c, -5, -71, 4.4, 9, '#fff9e9');
  oval(c, 6, -71, 4.2, 8.8, '#fff9e9');
  oval(c, -3.5, -69, 2.2, 5.6, '#292633');
  oval(c, 7.5, -69, 2.2, 5.4, '#292633');
  oval(c, -4.1, -71, 0.8, 1.4, '#ffffff');
  oval(c, 6.9, -71, 0.8, 1.4, '#ffffff');
  oval(c, 1, -60.5, 7, 4.5, black);
  oval(c, -0.5, -62, 2.2, 1.2, '#6d6570');
  form(c, 'M-11-57Q0-48 13-57Q9-45 1-46Q-6-46-11-57Z', '#693e41', false);
  oval(c, 2, -48, 4, 1.6, '#d88f92');
  line(c, 'M-13-58Q-12-60-10-58M12-58Q14-59 15-57', '#9d705c', 0.9);
  if (minnie) {
    line(c, 'M-10-76-13-80M-6-79-7-83M8-79 10-83M12-76 15-80', black, 1.3);
    form(c, 'M0-91Q-15-105-20-95L-18-85Q-9-83 0-89Q11-101 19-96L19-84Q10-80 0-91Z', outfit);
    oval(c, 0, -90, 4.6, 4.6, '#e77b9c');
    for (const [x, y] of [
      [-12, -93],
      [-11, -87],
      [12, -92],
      [14, -86],
    ])
      oval(c, x, y, 1.4, 1.6, '#fff7df');
  }
}
function duck(c: C, stride: number, celebrate: boolean, daisy: boolean) {
  const jacket = daisy ? '#ac79c8' : '#367bbd';
  if (daisy) legs(c, stride, -25, '#e4a13c', '#e76da4', true);
  else
    for (const side of [-1, 1]) {
      const swing = Math.sin(stride + (side < 0 ? Math.PI : 0));
      const lift = Math.max(0, -swing) * 8;
      const footX = side * 5 + swing * 12;
      limb(c, [side * 5, -25, side * 6 + swing * 7, -12 - lift * 0.3, footX, -4 - lift], '#e6a43e', 5);
      c.save();
      c.translate(footX, -lift);
      form(c, 'M-4-6Q0-8 3-4L12-2 15 1 8 3 3 2-4 3Q-7 1-4-6Z', '#efb24c');
      line(c, 'M0-3 7 1M3-4 11 0', '#c38a39', 0.8);
      c.restore();
    }
  arm(c, -1, -48, stride, '#f7f4e5', jacket, false, celebrate);
  form(c, 'M-12-52Q0-57 13-51L17-28Q12-18-1-19Q-16-21-17-31Z', '#f8f5e9');
  form(c, 'M-12-54Q0-59 13-52L14-34Q0-29-14-35Z', jacket);
  if (!daisy) form(c, 'M-12-54 0-45 12-54 9-40 0-44-9-40Z', '#f2f0df');
  if (!daisy) line(c, 'M-10-51 0-45 10-51', '#d7b750', 1.5);
  if (!daisy) form(c, 'M0-45-7-48-6-40 0-43 6-39 8-47Z', '#d64f49');
  arm(c, 1, -48, stride, '#f7f4e5', jacket, false, celebrate);
  form(c, 'M-17-73Q-19-92 0-92Q20-92 19-74L15-63Q19-56 9-51Q-9-47-17-61Z', '#f7f5e9');
  oval(c, -5.5, -74, 5.2, 10, '#fffdf8');
  oval(c, 7, -73, 5.3, 10, '#fffdf8');
  oval(c, -3.8, -71, 2.3, 5.2, '#4277a5');
  oval(c, 8.7, -71, 2.3, 5.2, '#4277a5');
  oval(c, -3.2, -71, 1.1, 3.4, '#292638');
  oval(c, 9.3, -71, 1.1, 3.4, '#292638');
  form(c, 'M-14-64Q-5-68 7-64Q23-64 25-58Q21-51 2-52Q-17-51-19-57Z', '#edb348');
  line(c, 'M-13-57Q6-53 22-58', '#a76e34', 1.1);
  if (daisy) {
    line(c, 'M-10-79-14-83M-5-82-7-86M9-81 11-85M14-78 18-82', '#383246', 1.3);
    form(c, 'M0-91Q-16-105-21-95L-17-85Q-9-83 0-89Q12-103 20-95L18-83Q8-82 0-91Z', '#e770a6');
    oval(c, 0, -90, 4.7, 4.4, '#ef9abe');
    line(c, 'M-13-96-7-90M13-96 7-90', '#f9c5df', 1.1);
    oval(c, 13, -35, 3.4, 2, '#e9bd4f');
  } else {
    form(c, 'M-10-91Q-18-99-6-101Q7-105 15-97L11-91Z', '#397fc6');
    form(c, 'M-16-90Q0-96 16-89L14-85Q0-89-15-85Z', '#23334d');
    line(c, 'M-12-91Q-22-88-20-83', '#23334d', 2.4);
  }
}
function alien(c: C, stride: number, celebrate: boolean) {
  legs(c, stride, -21, '#5288be', null, true);
  arm(c, -1, -45, stride, '#5388bf', null, false, celebrate);
  form(c, 'M-12-50Q0-58 13-50L17-28Q14-17 0-16Q-15-17-17-29Z', '#568fc7');
  oval(c, 0, -33, 10, 14, '#9fc3df');
  arm(c, 1, -45, stride, '#6098ce', null, false, celebrate);
  c.save();
  c.rotate(Math.sin(stride) * 0.035);
  form(c, 'M-17-70Q-31-80-42-91L-39-67Q-32-53-19-57Z', '#5b95ce');
  form(c, 'M18-70Q34-79 43-91L40-67Q32-53 19-57Z', '#5b95ce');
  form(c, 'M-21-69-37-83-34-67Q-29-59-22-60Z', '#b283b2', false);
  form(c, 'M22-69 38-83 35-67Q29-59 22-60Z', '#b283b2', false);
  c.restore();
  form(c, 'M-24-70Q-24-88-3-88Q20-90 25-73Q31-55 11-49Q-11-45-23-58Z', '#659ed2');
  form(c, 'M-19-76Q-8-84-4-71L-6-61Q-16-54-21-63Z', '#38577e', false);
  form(c, 'M7-73Q12-84 21-75L23-64Q17-54 9-60Z', '#38577e', false);
  oval(c, -12, -68, 5.8, 8.5, '#242d42', 0.12);
  oval(c, 15, -68, 5.6, 8.2, '#242d42', -0.12);
  oval(c, -13.5, -72, 1.8, 2.4, '#f3f9f6');
  oval(c, 13.5, -72, 1.8, 2.4, '#f3f9f6');
  oval(c, 1.5, -61, 8.5, 5.3, '#2b5483');
  oval(c, -1, -63, 2.4, 1.2, '#7195b8');
  line(c, 'M-14-56Q0-46 17-57', '#2e4b6c', 1.2);
  form(c, 'M-7-53-5-49-2-51M8-52 11-49 12-54Z', '#fbf1da', false);
  line(c, 'M-4-86-1-91 2-86 6-90 7-85', '#3e6a9d', 2);
}
function lion(c: C, stride: number, celebrate: boolean) {
  const fur = '#dfab53';
  c.save();
  c.translate(-3, 0);
  line(c, 'M-19-31Q-42-36-35-54Q-32-60-35-63', '#b87c34', 3);
  oval(c, -36, -62, 4, 6, '#9a622e', -0.3);
  for (const [i, hip] of [-17, 13, -12, 18].entries()) {
    const phase = stride + (i % 2 ? Math.PI : 0);
    const swing = Math.sin(phase) * 10;
    const lift = Math.max(0, -Math.sin(phase)) * 7;
    const base = i < 2 ? -32 : -28;
    limb(c, [hip, base, hip + swing * 0.4, -14, hip + swing, -3 - lift], i < 2 ? '#ba883e' : fur, 6);
    oval(c, hip + swing + 3, -1 - lift, 7, 3.4, i < 2 ? '#c89849' : '#edc87c');
    if (i === 1) form(c, 'M-24-36Q-24-49-4-47Q20-47 23-32L19-21Q3-13-17-24Z', fur);
  }
  if (celebrate) c.rotate(-0.05);
  oval(c, 4, -71, 8, 9, '#ce9744');
  oval(c, 29, -68, 8, 9, '#ce9744');
  oval(c, 5, -71, 4.5, 5.2, '#885b3c');
  oval(c, 29, -68, 4.5, 5.2, '#885b3c');
  form(c, 'M1-68Q3-81 17-80Q34-78 35-63L33-50Q25-39 10-44Q-2-48 1-68Z', '#e5b35b');
  form(c, 'M4-75 10-83 14-78 20-83 24-75 31-76 28-69Z', '#bb8133');
  eye(c, 10, -64, '#8a713e', 1.25);
  eye(c, 27, -62, '#8a713e', 1.1);
  line(c, 'M5-69Q10-72 14-69M23-68Q28-69 31-66', '#9e682f', 1.3);
  oval(c, 13, -52, 8, 6.5, '#f3d99e');
  oval(c, 25, -51, 8, 6, '#f3d99e');
  form(c, 'M14-57Q20-60 26-56L21-51Q18-51 14-57Z', '#815045');
  line(c, 'M20-51 20-48M12-48Q19-43 27-47', '#895534', 1);
  line(c, 'M10-53-1-55M10-50-2-49M28-51 40-52M28-48 39-46', '#a7834c', 0.7);
  c.restore();
}
export function drawCharacter(c: C, id: CharacterId, x: number, y: number, scale: number, stride = 0, celebrate = false) {
  c.save();
  c.translate(x, y - Math.abs(Math.sin(stride)) * 1.8);
  c.scale(scale, scale);
  // Body weight shifts over the planted foot; costumes have their own secondary motion.
  c.transform(1, 0, celebrate ? 0 : -0.035 * Math.sin(stride), 1, 0, 0);
  if (isPerson(id)) drawPerson(c, id, stride, celebrate);
  else if (id === 'mickey' || id === 'minnie') mouse(c, id === 'minnie', stride, celebrate);
  else if (id === 'donald' || id === 'daisy') duck(c, stride, celebrate, id === 'daisy');
  else if (id === 'stitch') alien(c, stride, celebrate);
  else if (id === 'simba') lion(c, stride, celebrate);
  else drawGuest(c, id, stride, celebrate);
  c.restore();
}
