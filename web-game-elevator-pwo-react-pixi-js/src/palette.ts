export const palette = {
  ink: '#244b45',
  muted: '#687971',
  paper: '#f5f0e7',
  surface: '#fffaf2',
  wall: '#e6dfcf',
  trim: '#d1c6b0',
  accent: '#b85238',
  floor: '#d6b993',
  glass: '#abc5bf',
  frame: '#698b80',
  light: '#eac879',
  skin: '#e8b18b',
  hair: '#a68148',
  eyes: '#654636',
  shirt: '#678da7',
  pants: '#526879',
  plant: '#557963',
  exit: '#28754f',
} as const;

export const menuPalette = {
  text: '#f8ecd3',
  muted: '#c8b99a',
  wood: '#251e18',
  panel: '#39291e',
  brass: '#b18a4f',
  gold: '#edcb83',
  teal: '#193c39',
  shadow: '#100e0b',
  engraving: '#2b2116',
} as const;

// Painted world colors stay separate from the high-contrast HTML controls.
export const worldPalette = {
  ...palette,
  ink: '#261c17',
  paper: '#302820',
  surface: '#fff0cf',
  wall: '#9b9474',
  trim: '#543821',
  frame: '#754e2b',
  floor: '#c99f68',
  glass: '#426c6b',
  light: '#f3c775',
  accent: '#b83e29',
  plant: '#3c6150',
  exit: '#246e4b',
} as const;
