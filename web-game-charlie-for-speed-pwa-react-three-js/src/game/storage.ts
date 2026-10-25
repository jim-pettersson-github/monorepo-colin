import type { CameraMode } from '../render/race-renderer';
import type { Career } from './career';
import type { Identity } from './career-session';
import { cars } from './cars';
import { type Session, validSession } from './multi-career';
import type { RaceSettings } from './race';
import { trackDefs } from './tracks';

export type Settings = RaceSettings & { sound: boolean; volume: number; camera: CameraMode };
export type LapRecord = { time: number; carId: string };

const SETTINGS_KEY = 'charlie-for-speed:settings';
const RECORDS_KEY = 'charlie-for-speed:records';

export const defaultSettings: Settings = {
  trackId: 'vaxjo',
  carId: 'sting',
  laps: 3,
  difficulty: 'normal',
  transmission: 'auto',
  sound: true,
  volume: 0.7,
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
  settings.volume =
    typeof settings.volume === 'number' && Number.isFinite(settings.volume) ? Math.max(0, Math.min(1, settings.volume)) : defaultSettings.volume;
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

const IDENTITY_KEY = 'charlie-for-speed:identity';
const SESSIONS_KEY = 'charlie-for-speed:wifi-careers';

// A stable id per device lets an online career recognise returning players.
export function loadIdentity(): Identity {
  try {
    const raw = localStorage.getItem(IDENTITY_KEY);
    const stored = raw ? (JSON.parse(raw) as Identity) : undefined;
    if (stored && typeof stored.id === 'string' && typeof stored.name === 'string') return stored;
  } catch {
    // Fall through to a fresh identity.
  }
  const identity = { id: `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`, name: '' };
  saveIdentity(identity);
  return identity;
}

export function saveIdentity(identity: Identity) {
  try {
    localStorage.setItem(IDENTITY_KEY, JSON.stringify(identity));
  } catch {
    // Storage is optional.
  }
}

export function loadSessions(): Session[] {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    const list = raw ? (JSON.parse(raw) as unknown[]) : [];
    return list.filter(validSession).sort((a, b) => b.updated - a.updated);
  } catch {
    return [];
  }
}

export function saveSession(session: Session) {
  try {
    const others = loadSessions().filter((stored) => stored.id !== session.id);
    localStorage.setItem(SESSIONS_KEY, JSON.stringify([session, ...others].slice(0, 12)));
  } catch {
    // Storage is optional.
  }
}

export function deleteSession(id: string) {
  try {
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(loadSessions().filter((stored) => stored.id !== id)));
  } catch {
    // Storage is optional.
  }
}
