import { arm, type C, eye, form, legs, line, oval, tint } from './character-paint';
import type { CharacterId } from './model';

const people = {
  elsa: { skin: '#f0c7b1', hair: '#eee0b0', dress: '#65bfd2', eyes: '#5c9db9' },
  moana: { skin: '#bc8058', hair: '#36292a', dress: '#d77955', eyes: '#694c36' },
  rapunzel: { skin: '#f0c6ab', hair: '#e7b84f', dress: '#a67bc5', eyes: '#79964f' },
  anna: { skin: '#edc2a6', hair: '#a65d35', dress: '#436b58', eyes: '#65988b' },
  aladdin: { skin: '#c78d61', hair: '#302734', dress: '#9368ac', eyes: '#61452f' },
  jasmine: { skin: '#c78d66', hair: '#242b39', dress: '#47b6b6', eyes: '#76583c' },
  mulan: { skin: '#edc3a1', hair: '#28303a', dress: '#8aa970', eyes: '#544736' },
  belle: { skin: '#efc4a8', hair: '#805332', dress: '#e8bf56', eyes: '#855b36' },
  ariel: { skin: '#f1c2ab', hair: '#c94543', dress: '#64bd9c', eyes: '#4f99b8' },
} as const;
type Person = keyof typeof people;
export const isPerson = (id: CharacterId): id is Person => id in people;

function braid(c: C, x: number, y: number, hair: string, length: number, sway: number) {
  for (let i = 0; i < length; i++) {
    const dx = Math.sin(i * 0.85 + sway) * (i / length) * 3;
    oval(c, x + dx + (i % 2 ? 1 : -1), y + i * 3.7, 3.5 - i * 0.13, 3.2, i % 2 ? tint(hair, -12) : hair, -0.25);
  }
  line(c, `M${x - 2} ${y + length * 3.7}h5`, '#7ba8bf', 1.7);
}
function hairBack(c: C, id: Person, hair: string, stride: number) {
  c.save();
  c.rotate(Math.sin(stride - 0.7) * 0.045);
  if (id === 'moana') {
    form(c, 'M-14-91Q-28-76-20-59Q-29-45-17-31L13-31Q28-41 20-63Q27-83 11-97Z', hair);
    line(c, 'M-18-84Q-25-70-18-61Q-23-48-18-41M15-82Q22-69 16-57L20-43', tint(hair, 27), 1.7);
  } else if (id === 'rapunzel') {
    form(c, 'M-14-90Q-24-71-19-49Q-31-23-17-8Q-7-2 1-13Q-14-8-11-24L16-52 13-91Z', hair);
    line(c, 'M-16-83Q-23-56-17-37Q-25-15-16-12M-12-81Q-17-49-13-34', '#f8dc82', 1.8);
  } else if (id === 'elsa') {
    form(c, 'M-10-62Q-21-49-29-24L-18-15Q-4-24 14-42L9-64Z', '#a4e1e6');
    line(c, 'M-4-58Q-10-35-23-22', '#e4fbf6', 1);
  } else if (id === 'anna') {
    braid(c, -13, -77, hair, 9, stride);
    braid(c, 13, -77, hair, 9, stride + 1);
  } else if (id === 'jasmine') {
    form(c, 'M-11-91Q-23-79-17-65L-22-57Q-30-45-20-35Q-12-28-8-41L2-68 14-91Z', hair);
    for (const y of [-65, -51, -38]) line(c, `M-23 ${y}q7 5 13 0`, '#45b6b8', 2.4);
  } else if (id === 'ariel') {
    form(c, 'M-14-90Q-28-75-18-57Q-29-43-15-26Q-18-38-4-39L18-48Q26-66 16-88Z', hair);
    line(c, 'M-18-77Q-23-64-14-52Q-22-42-15-33M14-78Q22-62 14-51', '#ed7160', 1.6);
  } else if (id === 'mulan') {
    form(c, 'M-12-93Q-24-79-17-60Q-22-46-11-37L14-45Q23-60 17-85Z', hair);
    line(c, 'M-15-83Q-21-65-14-48M14-82Q20-66 13-51', '#505361', 1.5);
  } else if (id === 'belle') {
    form(c, 'M-12-88Q-22-76-15-63Q-24-54-15-43L-3-41Q-8-54 7-66L13-88Z', hair);
    line(c, 'M-15-78Q-21-62-12-59Q-19-51-12-46', '#ac7744', 1.7);
  }
  c.restore();
}
function costume(c: C, id: Person, skin: string, dress: string, stride: number) {
  if (id === 'aladdin') {
    form(c, 'M-11-43Q0-39 11-43L17-22 4-15-1-31-6-16-18-22Z', '#f5e6c8');
    line(c, 'M-6-39-10-24M7-39 11-25', '#c2ad98', 1.3);
    form(c, 'M-5-70 6-70 7-63Q15-62 13-47L10-40-12-40-14-55Q-13-62-6-63Z', skin);
    form(c, 'M-7-65-12-62-15-42-7-43-4-60ZM6-65 13-61 15-43 8-43 4-60Z', dress);
    form(c, 'M-12-42Q0-46 13-41L11-35Q0-38-12-35Z', '#b94d4c');
    return;
  }
  if (id === 'jasmine') {
    form(c, 'M-9-43Q0-39 10-43L16-25Q14-14 5-19L0-32Q-4-15-12-20L-17-25Z', dress);
    line(c, 'M-10-39Q-15-28-11-23M9-39Q15-27 10-23', '#9be0cf', 1.2);
    form(c, 'M-5-70 6-70 6-61 11-58 9-47Q0-43-10-47L-12-58-5-61Z', skin);
    form(c, 'M-11-60Q-5-63 0-55Q5-63 11-60L10-49Q0-46-10-49Z', dress);
    line(c, 'M-10-48Q0-44 10-48M-11-43Q0-38 11-43', '#e8ce74', 1.5);
    oval(c, 0, -41, 2.5, 2.8, '#55a7b1');
    return;
  }
  form(c, 'M-5-71L6-71 6-64Q14-63 13-55L9-43 15-28Q0-23-15-28L-10-43-13-55Q-13-63-5-64Z', dress);
  form(c, 'M-5-72 6-72 6-64Q0-59-6-64Z', skin);
  c.save();
  c.translate(Math.sin(stride - 0.5) * 1.4, 0);
  if (id === 'moana') {
    form(c, 'M-10-46Q0-42 11-46L17-26Q6-22-16-28Z', '#ead3a0');
    line(c, 'M-11-42Q1-39 13-43M-12-36Q1-33 14-37M-12-30 13-28', '#b88553', 1.3);
    for (let i = -9; i < 14; i += 4) line(c, `M${i}-31l2 5`, '#f5e7bb', 1.2);
    line(c, 'M-10-57Q1-53 11-57M-9-61-5-57-2-61 2-57 5-61 9-57', '#f6d2a4', 1);
    line(c, 'M-3-63Q0-50 4-57', '#f4e4ba', 1.1);
    oval(c, 3, -56, 2, 2.6, '#58aab3');
  } else if (id === 'mulan') {
    form(c, 'M-12-60 0-47 11-61 13-47 4-39-10-44Z', '#c8d69c');
    form(c, 'M-11-45 11-45 12-39-12-39Z', '#c9768d');
    form(c, 'M-10-39 10-39 17-25Q0-20-17-26Z', '#477c76');
    line(c, 'M-3-37-8-26M4-37 9-25', '#80afa0', 1.1);
    form(c, 'M1-44 7-41 15-33 9-31 1-40Z', '#d28a9e');
  } else if (id === 'anna') {
    form(c, 'M-11-62-3-60 0-56 4-61 12-62 10-44-10-44Z', '#333a43');
    line(c, 'M-10-61-8-46Q0-41 9-46L11-61', '#c5a74d', 1.1);
    form(c, 'M-10-43 10-43 17-24Q0-19-17-25Z', '#507c9a');
    line(c, 'M0-54v8M-5-49 0-46 5-49M-10-29l3-5 3 5M7-27l3-5 3 5', '#d38eaa', 1.1);
    oval(c, 0, -54, 1.7, 2, '#cf7c9c');
  } else if (id === 'belle') {
    form(c, 'M-10-46Q0-41 10-46L20-24Q0-15-20-25Z', dress);
    line(c, 'M-15-33Q-8-25 0-32Q9-23 16-31M-7-42-12-27M7-42 12-26', '#f9e18d', 1.5);
    form(c, 'M-13-62Q-6-59 0-56Q6-60 13-62L14-57Q7-53 0-54Q-7-54-14-57Z', '#f5d97b');
    oval(c, 0, -56, 2.2, 2.5, '#e5ac3b');
  } else {
    form(c, 'M-10-44Q0-39 10-44L18-25Q0-20-18-27Z', dress);
    line(c, 'M-5-39-11-26M3-40 8-25M-13-29Q0-24 14-27', tint(dress, 35), 1.2);
    if (id === 'rapunzel') {
      form(c, 'M-6-59 6-59 5-45-5-45Z', '#bc9cd9');
      line(c, 'M-4-57 4-53-4-50 4-46M4-57-4-53 4-50-4-46', '#f5d9cf', 0.9);
      line(c, 'M-13-29Q0-22 15-27', '#e2b6d4', 1.3);
    } else if (id === 'elsa') {
      line(c, 'M0-58v12M-4-52h8M-3-55 3-49M3-55-3-49M8-36v7M5-33h6', '#e7ffff', 0.9);
      for (const [x, y] of [
        [-9, -32],
        [0, -29],
        [10, -29],
      ])
        oval(c, x, y, 0.8, 0.9, '#f2ffff');
    } else if (id === 'ariel') {
      form(c, 'M-11-59Q-4-65 0-57Q6-65 11-59L9-48Q0-45-9-49Z', '#a07dbb');
      line(c, 'M-7-58-3-50M-3-60-1-50M7-58 3-50M3-60 1-50', '#d4b4dd', 0.8);
      line(c, 'M-10-43Q0-39 10-43', '#d8e3aa', 1.3);
    }
  }
  c.restore();
}
export function drawPerson(c: C, id: Person, stride: number, celebrate: boolean) {
  const { skin, hair, dress, eyes } = people[id];
  hairBack(c, id, hair, stride);
  legs(c, stride, -36, id === 'aladdin' ? '#f5e6c8' : skin, id === 'moana' ? null : id === 'belle' ? '#d8a64b' : '#eee5cf');
  const sleeve = ['rapunzel', 'anna', 'mulan'].includes(id) ? dress : null;
  arm(c, -1, -61, stride, tint(skin, -15), sleeve, false, celebrate);
  costume(c, id, skin, dress, stride);
  arm(c, 1, -61, stride, skin, sleeve, false, celebrate);
  c.save();
  c.translate(Math.sin(stride) * 0.65, Math.sin(stride * 2) * 0.4);
  oval(c, -10.5, -81, 2.5, 3.7, skin);
  oval(c, 11, -81, 2.4, 3.7, skin);
  const face = id === 'aladdin' ? 'M-11-89Q-10-98 1-97Q13-97 13-86L10-75 3-69-4-71-10-78Z' : 'M-11-89Q-10-97 0-97Q12-97 12-86L10-76Q6-69 1-69Q-5-69-9-76Z';
  form(c, face, skin);
  oval(c, -6, -78.6, 3, 1.5, tint(skin, -4));
  oval(c, 7.4, -78.4, 2.6, 1.4, tint(skin, -4));
  eye(c, -4.6, -83, eyes);
  eye(c, 6.3, -82.8, eyes, 0.92);
  line(c, 'M-8-88Q-4-90-1-88M3-88Q7-89 10-87', tint(hair, -22), id === 'aladdin' ? 1.6 : 1.1);
  line(c, 'M2-82Q1-79 4-78L2-77', tint(skin, -40), 0.75);
  form(c, 'M-2-74Q2-75 6-74Q2-70-2-74Z', id === 'aladdin' ? '#a66050' : '#b86c72', false);
  line(c, 'M0-73Q2-72 4-73', '#f4c6b7', 0.7);
  if (id === 'anna' || id === 'rapunzel')
    for (const [x, y] of [
      [-8, -79],
      [-5, -78],
      [-3, -79],
      [6, -79],
      [8, -78],
    ])
      oval(c, x, y, 0.45, 0.45, '#bb8564');
  if (id === 'moana') {
    form(c, 'M-12-76Q-20-85-13-95Q-3-104 9-96Q22-90 14-73L10-85Q4-89 0-95Q-4-83-11-81Z', hair);
    line(c, 'M-13-92Q-11-85-16-78M7-96Q16-88 13-80', '#674136', 1.5);
    for (let i = 0; i < 5; i++) oval(c, -12 + Math.cos(i * 1.25) * 2.4, -86 + Math.sin(i * 1.25) * 2.4, 1.9, 2.1, '#fff1d4');
    oval(c, -12, -86, 1.5, 1.5, '#e7b056');
  } else if (id === 'jasmine') {
    form(c, 'M-12-75Q-23-86-13-96Q0-105 13-97Q23-88 13-75L10-86Q2-85-2-93Q-6-83-12-75Z', hair);
    line(c, 'M-14-91Q0-98 15-90', '#59c7c3', 3);
    oval(c, 0, -95, 3, 3.5, '#e9ca67');
    oval(c, 0, -95, 1.8, 2.4, '#4d9db0');
    for (const x of [-12, 12]) form(c, `M${x}-79l-3 5 3 3 3-3Z`, '#e2be58');
  } else if (id === 'aladdin') {
    form(c, 'M-12-77Q-20-87-12-96L-16-100-6-99Q5-108 13-98L17-97 13-88 10-81 9-92Q-1-86-4-94L-9-80Z', hair);
    form(c, 'M-6-100-5-106Q1-110 8-105L9-100Z', '#b84d50');
    line(c, 'M-13-91Q-9-98-3-97M4-97 11-94', '#51414b', 1.1);
  } else if (id === 'mulan') {
    form(c, 'M-12-77Q-21-91-11-98Q0-104 12-97Q20-90 12-78L9-91Q1-86-3-94Q-7-82-12-77Z', hair);
    line(c, 'M-12-91Q-5-102 7-96M-8-89-4-94', '#59606a', 1.3);
  } else {
    form(c, 'M-11-77Q-19-86-12-97Q-2-105 10-98Q19-92 12-82L9-88Q-1-87-5-94Q-5-83-11-77Z', hair);
    line(c, 'M-12-90Q-10-98 0-99Q7-98 11-92M-7-93Q-3-89 6-89', tint(hair, 38), 1.5);
    if (id === 'elsa') braid(c, 12, -80, hair, 7, stride);
    if (id === 'belle') {
      oval(c, 0, -100, 7, 5, hair);
      line(c, 'M-5-102Q0-105 5-101', '#b6844b', 1.2);
      line(c, 'M-7-97Q0-100 7-97', '#e8bc51', 1.8);
    }
    if (id === 'ariel') form(c, 'M-12-86Q-17-96-6-101Q6-107 13-97Q7-92-4-91L-12-80Z', hair);
    if (id === 'anna') line(c, 'M-10-93Q-7-98-2-97', '#efceac', 1.4);
  }
  c.restore();
}
