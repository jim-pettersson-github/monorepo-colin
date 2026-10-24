import { arm, type C, eye, form, legs, limb, line, oval, shoe } from './character-paint';

function goofy(c: C, stride: number, celebrate: boolean) {
  const black = '#30303a';
  // Long, loose trousers and oversized shoes distinguish the lanky running gait.
  legs(c, stride * 0.9, -37, '#4a6e9c', '#815b3e', true);
  arm(c, -1, -68, stride, '#dc9442', null, true, celebrate);
  form(c, 'M-10-73Q0-76 11-71L13-40Q0-35-12-41Z', '#db9445');
  form(c, 'M-12-70-6-71-5-44-13-43ZM7-72 12-69 15-43 7-43Z', '#3e4140');
  line(c, 'M-8-38Q0-35 9-39M0-37v13M-9-47l7 3M5-47 11-49', '#2a486e', 1.1);
  arm(c, 1, -68, stride, '#e9a452', null, true, celebrate);
  c.save();
  c.rotate(Math.sin(stride - 0.5) * 0.035);
  form(c, 'M-11-91Q-25-93-23-71Q-20-60-17-69L-15-86Z', black);
  form(c, 'M13-91Q24-91 22-69Q18-61 17-71L17-87Z', black);
  form(c, 'M-13-89Q-14-100 0-99Q16-98 16-86L13-74Q3-65-9-75Z', black);
  form(c, 'M-9-91Q-4-100 0-89Q5-101 10-92L11-80-10-79Z', '#fff6dc');
  oval(c, -3, -87, 1.8, 4.8, black);
  oval(c, 7, -87, 1.8, 4.8, black);
  form(c, 'M-9-80Q-18-81-17-74Q-14-65 3-67Q21-67 24-75Q23-83 9-81Z', '#d6ad7b');
  oval(c, 19, -78, 7, 4.7, black, -0.15);
  oval(c, 18, -80, 2.3, 1, '#6a6370');
  form(c, 'M-7-71Q1-64 10-70L7-62Q0-59-6-65Z', '#6d4544');
  form(c, 'M-3-69h4v6h-4ZM2-69h4v6H2Z', '#fff7df', false);
  line(c, 'M-12-74Q-10-77-7-74', '#9f704d', 0.8);
  form(c, 'M-12-102-10-113Q0-117 9-111L10-102Z', '#88a94f');
  form(c, 'M-14-101Q0-106 14-100L12-96Q0-100-14-97Z', '#55723f');
  line(c, 'M-7-103 8-103', black, 2.2);
  line(c, 'M-5-99-8-103M-2-99-1-104', black, 1);
  c.restore();
}
function olaf(c: C, stride: number, celebrate: boolean) {
  const snow = '#f3f5ee';
  for (const side of [-1, 1]) {
    const swing = Math.sin(stride + (side < 0 ? Math.PI : 0));
    oval(c, side * 8 + swing * 8, -3 - Math.max(0, -swing) * 7, 8.5, 5.5, snow, swing * 0.2);
  }
  for (const side of [-1, 1]) {
    c.save();
    c.translate(side * 13, -49);
    c.rotate(celebrate ? -side * 1.5 : Math.sin(stride + side * 1.5) * 0.45);
    line(c, `M0 0 ${side * 12} 9 ${side * 19} 3M${side * 16} 5l${side * 5}-5M${side * 16} 5l${side * 7} 3`, '#795640', 2.3);
    c.restore();
  }
  form(c, 'M-11-40Q-27-27-18-12Q-10-3 5-6Q24-9 22-25Q21-35 11-41Z', snow);
  oval(c, 0, -44, 13, 13, snow);
  for (const [x, y, r] of [
    [0, -48, 2.4],
    [1, -35, 2.7],
    [2, -22, 3],
  ])
    oval(c, x, y, r, r, '#45424a');
  c.save();
  c.rotate(Math.sin(stride) * 0.04);
  form(c, 'M-14-82Q-18-98-2-100Q15-103 18-87L14-67Q8-57-4-61Q-15-64-14-82Z', snow);
  oval(c, -5, -85, 4.2, 6, '#ffffff');
  oval(c, 7, -85, 4.3, 6, '#ffffff');
  oval(c, -3.8, -84, 1.7, 2.6, '#342f3e');
  oval(c, 8, -84, 1.7, 2.6, '#342f3e');
  line(c, 'M-10-93Q-6-97-2-93M4-94Q9-97 13-92', '#6b5b53', 1.4);
  form(c, 'M0-81Q6-87 25-80Q16-77 2-76Z', '#e99b41');
  line(c, 'M9-81l-1 3M14-81l-1 2', '#c57b35', 0.8);
  form(c, 'M-9-74Q1-67 13-75Q10-61-1-65Z', '#51404a');
  form(c, 'M-3-72 6-72 5-66-2-66Z', '#fffdf5');
  line(c, 'M-5-99-8-109M-1-100 1-112M3-99 9-108', '#795640', 1.8);
  c.restore();
}
function woody(c: C, stride: number, celebrate: boolean) {
  legs(c, stride, -38, '#5b7f9f', '#97613a');
  arm(c, -1, -67, stride, '#dda94a', null, false, celebrate);
  form(c, 'M-10-70Q0-73 11-69L11-41Q0-37-12-42Z', '#e4b44e');
  for (const y of [-65, -59, -53, -47]) line(c, `M-10 ${y}h20`, '#bb7c3e', 0.65);
  for (const x of [-6, 0, 6]) line(c, `M${x}-68v27`, '#bb7c3e', 0.65);
  form(c, 'M-11-69-5-68-4-44-12-44ZM6-69 11-67 14-44 6-44Z', '#f3eee1');
  form(c, 'M-10-65-6-62-10-58ZM8-63 12-60 8-56ZM-11-51-6-49-10-46ZM9-49 12-47 7-45Z', '#3b3439', false);
  form(c, 'M-5-72 6-72 6-65 0-60-6-65Z', '#edbb96');
  form(c, 'M-9-67 0-63 9-67 4-60 6-55-1-57-5-62Z', '#bc4e47');
  form(c, 'M-12-42Q0-40 12-42L12-36-12-36Z', '#835536');
  form(c, 'M-3-42h7v6h-7Z', '#d8b35c');
  oval(c, 0.5, -39, 2, 2, '#b98542');
  // The sheriff badge has a five-point silhouette, rather than a plain circle.
  form(c, 'M-8-62-7-59-4-59-6-57-5-54-8-56-11-54-10-57-12-59-9-59Z', '#dfb94f');
  arm(c, 1, -67, stride, '#e8b653', null, false, celebrate);
  oval(c, -11, -85, 2.8, 4, '#e2ac85');
  oval(c, 12, -85, 2.8, 4, '#e2ac85');
  form(c, 'M-11-94Q1-101 12-93L11-78 5-71-3-72-10-80Z', '#eab48e');
  form(c, 'M-12-89-13-98Q0-104 13-96L12-87 8-93Q-2-90-7-94L-9-86Z', '#78513b');
  eye(c, -4.6, -86, '#815b3d', 0.95);
  eye(c, 6, -86, '#815b3d', 0.9);
  line(c, 'M-8-91Q-5-93-1-91M3-91Q7-93 10-91', '#76503a', 1.2);
  line(c, 'M2-85 4-81 1-80M-3-76Q2-72 7-77', '#a76956', 0.9);
  form(c, 'M-14-99-12-109Q-7-114-1-108Q6-114 12-108L15-99Z', '#9a683f');
  form(c, 'M-24-100Q-12-97 0-101Q14-98 24-103L22-97Q12-91-1-95Q-14-91-24-96Z', '#ac7747');
  line(c, 'M-14-101Q0-103 15-101', '#6d4937', 2.5);
  line(c, 'M-21-98Q-10-95-2-98M5-98 19-99', '#d3a270', 0.8);
}
function buzz(c: C, stride: number, celebrate: boolean) {
  // Folded flight wings, plated legs and a broad breastplate give a separate silhouette.
  form(c, 'M-14-65-28-72-31-49-14-45ZM14-65 29-72 31-48 14-45Z', '#9c83b3');
  line(c, 'M-27-67v16M27-67v16', '#c84f54', 2.4);
  for (const side of [-1, 1]) {
    const swing = Math.sin(stride + (side < 0 ? Math.PI : 0));
    const x = side * 8 + swing * 10;
    const y = -Math.max(0, -swing) * 7;
    limb(c, [side * 8, -32, side * 9 + swing * 6, -18, x, y - 5], side < 0 ? '#b9c3c9' : '#f1f1e5', 10);
    oval(c, side * 9 + swing * 6, -18, 5.8, 4.5, '#9481ad');
    shoe(c, x, y, '#91bd58', true);
  }
  for (const side of [-1, 1]) {
    c.save();
    c.translate(side * 16, -61);
    c.rotate(celebrate ? -side * 1.3 : Math.sin(stride + side * 1.5) * 0.5);
    limb(c, [0, 0, side * 5, 13, side * 2, 23], '#e8ece6', 10);
    oval(c, 0, 1, 7, 7, '#9fc85f');
    oval(c, side * 4, 15, 5.7, 5.2, '#aa91be');
    oval(c, side * 2, 24, 5.3, 5.6, '#f5f2e8');
    if (side === 1) oval(c, 1, 8, 1.6, 2.5, '#c54c4f');
    c.restore();
  }
  form(c, 'M-16-65Q0-73 17-65L17-44 11-31Q0-27-11-32L-17-45Z', '#e8ede6');
  form(c, 'M-16-65Q0-70 16-64L14-51-14-51Z', '#9ec463');
  form(c, 'M-13-42Q0-37 13-42L12-32Q0-28-12-32Z', '#9479b0');
  line(c, 'M-11-46h22M-8-35h16', '#c9d0c7', 1.4);
  form(c, 'M-9-61h8v6h-8Z', '#e2eae4');
  for (const [x, color] of [
    [4, '#4b9ac0'],
    [8, '#dcba41'],
    [12, '#c85b52'],
  ] as const)
    oval(c, x, -58, 1.5, 2.4, color);
  form(c, 'M0-63-3-59 0-60 2-57 4-62Z', '#617c94');
  oval(c, 0, -76, 19, 10, '#c0d0ce');
  form(c, 'M-14-85Q-15-103 0-104Q15-103 15-87L11-75Q0-68-11-76Z', '#8f72a7');
  form(c, 'M-10-91Q0-98 11-91L10-79 5-73-5-74-10-81Z', '#ecc3a5');
  eye(c, -4, -87, '#6096ab', 0.85);
  eye(c, 6, -87, '#6096ab', 0.85);
  line(c, 'M-7-92-1-91M3-92 9-93', '#624d5d', 1.4);
  line(c, 'M2-86 4-83 1-82M-4-78Q1-75 7-79', '#a57766', 0.9);
  line(c, 'M2-74Q6-74 5-77Q3-78 2-76', '#8f6b5c', 0.7);
  // Open, translucent helmet rim keeps the face readable at track size.
  line(c, 'M-20-77Q-27-111 0-114Q28-111 21-77', '#c9e5e7', 1.6);
  line(c, 'M-20-94Q-18-105-10-108', '#ffffff', 1.3);
}
function baymax(c: C, stride: number, celebrate: boolean) {
  const shell = '#f1f1e9';
  for (const side of [-1, 1]) {
    const swing = Math.sin(stride + (side < 0 ? Math.PI : 0));
    oval(c, side * 10 + swing * 5, -9 - Math.max(0, -swing) * 5, 9, 12, side < 0 ? '#d2d9d9' : shell, swing * 0.2);
  }
  for (const side of [-1, 1]) {
    c.save();
    c.translate(side * 21, -55);
    c.rotate(celebrate ? -side * 1.2 : Math.sin(stride + side) * 0.3);
    oval(c, side * 3, 10, 9.3, 18, side < 0 ? '#d7dede' : shell, -side * 0.25);
    oval(c, side * 7, 26, 6, 7, shell);
    line(c, `M${side * 8} 26l${side * 3} 3M${side * 5} 28l${side * 2} 4`, '#c8d2d4', 0.8);
    c.restore();
  }
  form(c, 'M-13-67Q-25-62-28-39Q-32-16-17-11Q0-5 19-12Q33-19 26-42Q23-61 12-67Z', shell);
  line(c, 'M-19-47Q-24-30-17-18M19-46Q24-29 17-18', '#d2dad9', 1.1);
  oval(c, 9, -55, 3.8, 3.4, '#d1dbda');
  line(c, 'M6-55h6M9-57v4', '#f9fcf4', 0.8);
  oval(c, 0, -79, 17, 12.5, shell);
  line(c, 'M-7-79H7', '#333d49', 1.4);
  oval(c, -7, -79, 2.2, 2.2, '#333d49');
  oval(c, 7, -79, 2.2, 2.2, '#333d49');
  line(c, 'M-20-30Q0-19 20-30', '#e1e5e0', 0.8);
}
export function drawGuest(c: C, id: 'goofy' | 'olaf' | 'woody' | 'buzz' | 'baymax', stride: number, celebrate: boolean) {
  switch (id) {
    case 'goofy':
      goofy(c, stride, celebrate);
      break;
    case 'olaf':
      olaf(c, stride, celebrate);
      break;
    case 'woody':
      woody(c, stride, celebrate);
      break;
    case 'buzz':
      buzz(c, stride, celebrate);
      break;
    case 'baymax':
      baymax(c, stride, celebrate);
      break;
  }
}
