export const characters = [
  { id: 'mickey', name: 'Musse Pigg', film: 'Musse & vänner', color: '#e8504f', ink: '#211c36' },
  { id: 'minnie', name: 'Mimmi Pigg', film: 'Musse & vänner', color: '#e46f9b', ink: '#211c36' },
  { id: 'donald', name: 'Kalle Anka', film: 'Kalle Anka', color: '#387dd0', ink: '#fff9df' },
  { id: 'elsa', name: 'Elsa', film: 'Frost', color: '#57bfcf', ink: '#f2d59a' },
  { id: 'stitch', name: 'Stitch', film: 'Lilo & Stitch', color: '#537ed5', ink: '#4266ad' },
  { id: 'simba', name: 'Simba', film: 'Lejonkungen', color: '#e7ac3b', ink: '#bb6c29' },
  { id: 'moana', name: 'Vaiana', film: 'Vaiana', color: '#e57a52', ink: '#55332d' },
  { id: 'rapunzel', name: 'Rapunzel', film: 'Trassel', color: '#a577c6', ink: '#e9bc50' },
  { id: 'goofy', name: 'Långben', film: 'Musse & vänner', color: '#d58a39', ink: '#43483b' },
  { id: 'daisy', name: 'Kajsa Anka', film: 'Kalle Anka', color: '#bd82c9', ink: '#694179' },
  { id: 'anna', name: 'Anna', film: 'Frost', color: '#608c77', ink: '#a45e3e' },
  { id: 'olaf', name: 'Olof', film: 'Frost', color: '#91cbd6', ink: '#486c88' },
  { id: 'aladdin', name: 'Aladdin', film: 'Aladdin', color: '#a789ca', ink: '#603a6d' },
  { id: 'jasmine', name: 'Jasmine', film: 'Aladdin', color: '#41b5b3', ink: '#263f56' },
  { id: 'mulan', name: 'Mulan', film: 'Mulan', color: '#8fa970', ink: '#414e3a' },
  { id: 'belle', name: 'Belle', film: 'Skönheten & odjuret', color: '#e8be51', ink: '#9c7135' },
  { id: 'ariel', name: 'Ariel', film: 'Den lilla sjöjungfrun', color: '#68bfa1', ink: '#b54446' },
  { id: 'woody', name: 'Woody', film: 'Toy Story', color: '#d9a748', ink: '#875536' },
  { id: 'buzz', name: 'Buzz Lightyear', film: 'Toy Story', color: '#8ebe6c', ink: '#7956a3' },
  { id: 'baymax', name: 'Baymax', film: 'Big Hero 6', color: '#bbd1dc', ink: '#557387' },
] as const;
export type CharacterId = (typeof characters)[number]['id'];
export const character = (id: CharacterId) => characters.find((c) => c.id === id) ?? characters[0];
const originalEvents = [
  {
    id: 'sprint100',
    name: '100 meter',
    type: 'run',
    distance: 100,
    unit: 's',
    label: 'RAKT MOT MÅL',
    description: 'En snabb start och full fart över mållinjen.',
    icon: 'run',
    record: 10.5,
    mechanic: 'run',
  },
  {
    id: 'sprint200',
    name: '200 meter',
    type: 'run',
    distance: 200,
    unit: 's',
    label: 'HÅLL RYTMEN',
    description: 'Ett längre sprintlopp. Hitta en rytm som håller.',
    icon: 'run',
    record: 22,
    mechanic: 'run',
  },
  {
    id: 'sprint400',
    name: '400 meter',
    type: 'run',
    distance: 400,
    unit: 's',
    label: 'ETT HELT VARV',
    description: 'Ett helt arenavarv i en kort arkadversion.',
    icon: 'run',
    record: 48,
    mechanic: 'run',
  },
  {
    id: 'middle800',
    name: '800 meter',
    type: 'run',
    distance: 800,
    unit: 's',
    label: 'TVÅ VARV',
    description: 'Medeldistans i en kort arkadversion. Håll farten till slutet.',
    icon: 'run',
    record: 110,
    mechanic: 'run',
  },
  {
    id: 'middle1500',
    name: '1 500 meter',
    type: 'run',
    distance: 1500,
    unit: 's',
    label: 'MED ETT MÅL I SIKTE',
    description: 'Medeldistans med en sista spurt. Kort arkadversion.',
    icon: 'run',
    record: 230,
    mechanic: 'run',
  },
  {
    id: 'distance5000',
    name: '5 000 meter',
    type: 'run',
    distance: 5000,
    unit: 's',
    label: 'LÅNGLOPP',
    description: 'Många meter på liten tid. Ett långt lopp i kort arkadformat.',
    icon: 'run',
    record: 820,
    mechanic: 'run',
  },
  {
    id: 'distance10000',
    name: '10 000 meter',
    type: 'run',
    distance: 10000,
    unit: 's',
    label: 'ÄNDA TILL MÅL',
    description: 'Arenans längsta banlopp, förkortat till ett snabbt arkadlopp.',
    icon: 'run',
    record: 1700,
    mechanic: 'run',
  },
  {
    id: 'marathon',
    name: 'Maraton',
    type: 'run',
    distance: 42195,
    unit: 's',
    label: '42 195 METER',
    description: 'Ett helt maraton i miniformat. Samma stegknappar, ett stort mål.',
    icon: 'run',
    record: 7800,
    mechanic: 'run',
  },
  {
    id: 'hurdles',
    name: '110 m häck',
    type: 'run',
    distance: 110,
    unit: 's',
    label: 'SPRING & HOPPA',
    description: 'Tajma hoppen över tio häckar och spring vidare.',
    icon: 'hurdles',
    record: 13.5,
    mechanic: 'hurdle',
  },
  {
    id: 'hurdles400',
    name: '400 m häck',
    type: 'run',
    distance: 400,
    unit: 's',
    label: 'HÄCKAR HELA VÄGEN',
    description: 'Tio häckar och ett helt varv, i kort arkadformat.',
    icon: 'hurdles',
    record: 55,
    mechanic: 'hurdle',
  },
  {
    id: 'steeplechase',
    name: '3 000 m hinder',
    type: 'run',
    distance: 3000,
    unit: 's',
    label: 'ÖVER HINDER & VATTEN',
    description: 'Hoppa över hinder. Vattengraven bromsar extra om du missar.',
    icon: 'hurdles',
    record: 540,
    mechanic: 'steeple',
  },
  {
    id: 'raceWalk',
    name: 'Gång · halvmaraton',
    type: 'run',
    distance: 21097.5,
    unit: 's',
    label: 'STEG FÖR STEG',
    description: 'Håll en jämn gångrytm. Hopp ger en kort fartförlust. Kort arkadversion.',
    icon: 'run',
    record: 5700,
    mechanic: 'walk',
  },
  {
    id: 'longJump',
    name: 'Längdhopp',
    type: 'field',
    distance: 18,
    unit: 'm',
    label: 'SIKTA PÅ PLANKAN',
    description: 'Bygg fart och hoppa precis före plankan. Bäst av tre.',
    icon: 'jump',
    record: 7,
    mechanic: 'long',
  },
  {
    id: 'tripleJump',
    name: 'Tresteg',
    type: 'field',
    distance: 18,
    unit: 'm',
    label: 'HOPP · STEG · HOPP',
    description: 'Ta sats. Tryck tre gånger: före plankan och vid varje landning.',
    icon: 'jump',
    record: 15,
    mechanic: 'triple',
  },
  {
    id: 'highJump',
    name: 'Höjdhopp',
    type: 'field',
    distance: 18,
    unit: 'm',
    label: 'ÖVER RIBBAN',
    description: 'Ta sats och hoppa nära ribban. Bästa klarade höjd av tre försök.',
    icon: 'jump',
    record: 2,
    mechanic: 'high',
  },
  {
    id: 'poleVault',
    name: 'Stavhopp',
    type: 'field',
    distance: 18,
    unit: 'm',
    label: 'SÄTT STAVEN & LYFT',
    description: 'Bygg fart. Sätt staven före linjen och lyft över ribban.',
    icon: 'jump',
    record: 5,
    mechanic: 'pole',
  },
  {
    id: 'shotPut',
    name: 'Kula',
    type: 'field',
    distance: 0,
    unit: 'm',
    label: 'LADDA & STÖT',
    description: 'Bygg kraft och stöt när vinkelmätaren känns rätt. Bäst av tre.',
    icon: 'throw',
    record: 13,
    mechanic: 'shot',
  },
  {
    id: 'discus',
    name: 'Diskus',
    type: 'field',
    distance: 0,
    unit: 'm',
    label: 'ROTERA & SLÄPP',
    description: 'Stegknapparna bygger rotation. Släpp diskusen i den gula vinkelzonen.',
    icon: 'throw',
    record: 55,
    mechanic: 'discus',
  },
  {
    id: 'hammer',
    name: 'Slägga',
    type: 'field',
    distance: 0,
    unit: 'm',
    label: 'SVINGA & SLÄPP',
    description: 'Bygg rotationsfart och släpp släggan med kastknappen.',
    icon: 'throw',
    record: 65,
    mechanic: 'hammer',
  },
  {
    id: 'javelin',
    name: 'Spjut',
    type: 'field',
    distance: 18,
    unit: 'm',
    label: 'FART, VINKEL, KAST',
    description: 'Ta sats. Släpp spjutet före linjen. Bäst av tre.',
    icon: 'throw',
    record: 55,
    mechanic: 'javelin',
  },
] as const;
const runningIds = ['sprint100', 'sprint200', 'sprint400', 'hurdles', 'steeplechase'];
export const legacyEvents = originalEvents.filter((e) => e.type === 'run' && !runningIds.includes(e.id));
const skillEvents = [
  {
    id: 'archery',
    name: 'Bågskytte',
    type: 'skill',
    distance: 0,
    unit: 'p',
    label: 'SIKTA & SKJUT',
    description: 'Flytta siktet med vänster och höger. Tajma höjden och skjut mot mitten. Tre pilar, totalpoäng.',
    icon: 'archery',
    record: 25,
    mechanic: 'archery',
  },
  {
    id: 'diving',
    name: 'Simhopp',
    type: 'skill',
    distance: 0,
    unit: 'p',
    label: 'ROTERA & STRÄCK',
    description: 'Hoppa från trampolinen. Rotera med vänster eller höger, sträck ut och landa rakt med huvudet först. Bäst av tre.',
    icon: 'diving',
    record: 8,
    mechanic: 'diving',
  },
  {
    id: 'weightlifting',
    name: 'Tyngdlyftning',
    type: 'skill',
    distance: 0,
    unit: 'kg',
    label: 'LYFT · BALANSERA · LÅS',
    description: 'Lyft i den gröna kraftzonen. Balansera med vänster och höger. Lås lyftet när stången är uppe. Tre tyngre försök.',
    icon: 'weightlifting',
    record: 60,
    mechanic: 'weightlifting',
  },
] as const;
export const events = [...originalEvents.filter((e) => e.type !== 'run' || runningIds.includes(e.id)), ...skillEvents];
export const allEvents = [...originalEvents, ...skillEvents];
export const legacyChampionshipEvents = ['sprint100', 'sprint200', 'hurdles', 'longJump', 'javelin', 'shotPut'] as const;
export const championshipEvents = ['sprint100', 'archery', 'longJump', 'weightlifting', 'diving', 'javelin'] as const;
export const programme = (state: GameState): readonly EventId[] => state.programme ?? legacyChampionshipEvents;
export const skillEvent = (id: EventId) => eventInfo(id).type === 'skill';
export const controlLabels = (id: EventId, assist: boolean) =>
  id === 'archery'
    ? ['Sikta', 'Skjut', 'vänster', 'höger', 'skjut']
    : id === 'diving'
      ? ['Rotera', 'Hoppa / sträck', 'rotera vänster', 'rotera höger', 'hoppa eller sträck']
      : id === 'weightlifting'
        ? ['Balansera', 'Lyft / lås', 'balansera vänster', 'balansera höger', 'lyft eller lås']
        : [
            assist ? 'Hjälpläge · håll' : 'Snabbare växling = mer fart',
            eventInfo(id).type === 'run' || jumpEvent(id) ? 'Hoppa' : 'Kasta',
            'vänster steg',
            'höger steg',
            eventInfo(id).type === 'run' || jumpEvent(id) ? 'hoppa' : 'kasta',
          ];
export const raceScale = (id: EventId) => Math.max(1, eventInfo(id).distance / 280);
export const obstacleCount = (id: EventId) => (eventInfo(id).mechanic === 'steeple' ? 12 : eventInfo(id).mechanic === 'hurdle' ? 10 : 0);
export const obstaclePosition = (id: EventId, index: number) =>
  id === 'hurdles' ? 13 + index * 9.14 : (eventInfo(id).distance * (index + 1)) / (obstacleCount(id) + 1);
export const stationaryEvent = (id: EventId) => eventInfo(id).type === 'field' && eventInfo(id).distance === 0;
export const verticalEvent = (id: EventId) => ['high', 'pole'].includes(eventInfo(id).mechanic);
export const barHeight = (id: EventId, attempt: number) => (id === 'poleVault' ? [3, 4, 5] : [1.2, 1.55, 1.9])[attempt];
export const jumpEvent = (id: EventId) => eventInfo(id).icon === 'jump';
export type EventId = (typeof allEvents)[number]['id'];
export const eventInfo = (id: EventId) => allEvents.find((e) => e.id === id) ?? events[0];
export type Source = 'keyboard1' | 'keyboard2' | 'keyboard3' | 'keyboard4' | 'touch' | `pad:${number}`;
export function separateControls(sources: Source[], players: number) {
  const physical = sources.slice(0, players).filter((source) => source !== 'touch');
  return sources.length >= players && new Set(physical).size === physical.length;
}
export interface Settings {
  runningStyleVersion?: 2;
  event: EventId;
  championship: boolean;
  players: 1 | 2 | 3 | 4;
  characters: CharacterId[];
  sources: Source[];
  difficulty: 'easy' | 'normal' | 'hard';
  assist: boolean;
}
export const defaultSettings = (): Settings => ({
  runningStyleVersion: 2,
  event: 'sprint100',
  championship: false,
  players: 1,
  characters: ['mickey', 'stitch', 'elsa', 'simba'],
  sources: ['keyboard1', 'keyboard2', 'keyboard3', 'keyboard4'],
  difficulty: 'easy',
  assist: false,
});
export interface SkillState {
  stage: 'ready' | 'active' | 'released' | 'done';
  aim: number;
  progress: number;
  balance: number;
  score: number;
  target: number;
  elapsed: number;
}
export const newSkill = (): SkillState => ({ stage: 'ready', aim: -0.65, progress: 0, balance: 0, score: 0, target: 0, elapsed: 0 });
export interface Runner {
  skill?: SkillState;
  character: CharacterId;
  human: 0 | 1 | 2 | 3 | null;
  x: number;
  speed: number;
  rhythm: number;
  lastFoot: number;
  lastStep: number;
  stumble: number;
  jump: number;
  jumpV: number;
  hurdle: number;
  finish: number | null;
  done: boolean;
  result: number | null;
  launched: boolean;
  flightX: number;
  flightY: number;
  flightVx: number;
  flightVy: number;
  foul: boolean;
  attempts: (number | null)[];
  aiNext: number;
  hops: number;
  landingWindow: number;
  peak: number;
  takeoffQuality: number;
}
export interface GameState {
  version: 1;
  programme?: EventId[];
  settings: Settings;
  event: EventId;
  round: number;
  attempt: number;
  phase: 'countdown' | 'playing' | 'attempt-result' | 'results';
  countdown: number;
  time: number;
  runners: Runner[];
  points: number[];
  awarded: boolean;
}
export interface Commands {
  feet: (0 | 1)[];
  hold: boolean;
  action: boolean;
  steer?: -1 | 0 | 1;
}
export const neutral = (): Commands => ({ feet: [], hold: false, action: false });
export const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
export const angle = (time: number) => 43 + Math.sin(time * 2.3) * 13;
export const formatResult = (value: number | null, event: EventId) =>
  value === null
    ? eventInfo(event).type === 'run'
      ? 'Ej i mål'
      : skillEvent(event)
        ? 'Ej godkänt'
        : 'Övertramp'
    : `${value.toFixed(2).replace('.', ',')} ${eventInfo(event).unit}`;
function runners(settings: Settings): Runner[] {
  const ids = settings.characters.slice(0, settings.players);
  for (const c of characters) if (!ids.includes(c.id) && ids.length < 4) ids.push(c.id);
  return ids.map((id, lane) => ({
    skill: newSkill(),
    character: id,
    human: lane < settings.players ? (lane as 0 | 1 | 2 | 3) : null,
    x: 0,
    speed: 0,
    rhythm: 0,
    lastFoot: -1,
    lastStep: -1,
    stumble: 0,
    jump: 0,
    jumpV: 0,
    hurdle: 0,
    finish: null,
    done: false,
    result: null,
    launched: false,
    flightX: 0,
    flightY: 0,
    flightVx: 0,
    flightVy: 0,
    foul: false,
    attempts: [],
    aiNext: 0.2 + lane * 0.08,
    hops: 0,
    landingWindow: 0,
    peak: 0,
    takeoffQuality: 1,
  }));
}
export function createGame(settings: Settings): GameState {
  return {
    version: 1,
    programme: [...championshipEvents],
    settings: structuredClone(settings),
    event: settings.championship ? championshipEvents[0] : settings.event,
    round: 0,
    attempt: 0,
    phase: 'countdown',
    countdown: 3,
    time: 0,
    runners: runners(settings),
    points: [0, 0, 0, 0],
    awarded: false,
  };
}
export function ranking(state: GameState): number[] {
  const run = eventInfo(state.event).type === 'run';
  return state.runners
    .map((_, i) => i)
    .sort((a, b) => {
      const x = state.runners[a].result;
      const y = state.runners[b].result;
      if (x === y) return a - b;
      if (x === null) return 1;
      if (y === null) return -1;
      return run ? x - y : y - x;
    });
}
export function nextAttempt(state: GameState) {
  if (state.phase !== 'attempt-result') return;
  const fresh = runners(state.settings);
  state.runners = fresh.map((r, i) => ({ ...r, attempts: state.runners[i].attempts }));
  state.time = 0;
  state.countdown = 3;
  state.attempt++;
  state.phase = 'countdown';
}
export function nextEvent(state: GameState) {
  if (state.phase !== 'results' || !state.settings.championship || state.round >= programme(state).length - 1) return;
  state.round++;
  state.event = programme(state)[state.round];
  state.attempt = 0;
  state.time = 0;
  state.countdown = 3;
  state.runners = runners(state.settings);
  state.phase = 'countdown';
  state.awarded = false;
}
