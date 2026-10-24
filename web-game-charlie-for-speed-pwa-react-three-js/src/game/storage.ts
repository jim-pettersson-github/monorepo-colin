import type { CameraMode } from '../render/race-renderer';
import type { Career } from './career';
import { cars } from './cars';
import type { RaceSettings } from './race';
import { trackDefs } from './tracks';

export type Settings = RaceSettings & { retro: boolean; sound: boolean; camera: CameraMode };
export type LapRecord = { time: number; carId: string };

const SETTINGS_KEY = 'charlie-for-speed:settings';
const RECORDS_KEY = 'charlie-for-speed:records';

export const defaultSettings: Settings = {
  trackId: 'vaxjo',
  carId: 'sting',
  laps: 3,
  difficulty: 'normal',
  transmission: 'auto',
  retro: false,
  sound: true,
  camera: 'chase',
};

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private windows may refuse storage; the game still works without saving.
  }
}

export function loadSettings(): Settings {
  const settings = read(SETTINGS_KEY, defaultSettings);
  if (!cars.some((car) => car.id === settings.carId)) settings.carId = defaultSettings.carId;
  if (!trackDefs.some((track) => track.id === settings.trackId)) settings.trackId = defaultSettings.trackId;
  return settings;
}

export function saveSettings(settings: Settings) {
  write(SETTINGS_KEY, settings);
}

export function loadRecords(): Record<string, LapRecord> {
  return read<Record<string, LapRecord>>(RECORDS_KEY, {});
}

// Returns true when the lap beats the stored record for the track.
export function saveLapRecord(trackId: string, time: number, carId: string) {
  if (!time) return false;
  const records = loadRecords();
  const current = records[trackId];
  if (current && current.time <= time) return false;
  records[trackId] = { time, carId };
  write(RECORDS_KEY, records);
  return true;
}

const CAREER_KEY = 'charlie-for-speed:career';

export function loadCareer(): Career | undefined {
  try {
    const raw = localStorage.getItem(CAREER_KEY);
    const career = raw ? (JSON.parse(raw) as Career) : undefined;
    return career?.version === 1 ? career : undefined;
  } catch {
    return undefined;
  }
}

export function saveCareer(career: Career | undefined) {
  try {
    if (career) localStorage.setItem(CAREER_KEY, JSON.stringify(career));
    else localStorage.removeItem(CAREER_KEY);
  } catch {
    // Without storage the career still works for this session.
  }
}
