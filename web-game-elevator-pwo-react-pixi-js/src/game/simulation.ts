import {
  type Building,
  type Command,
  currentBuilding,
  type Door,
  definition,
  floorCount,
  floorLabel,
  type GameState,
  type Intent,
  isOpen,
  layout,
  playerLevel,
  random,
  type SoundEvent,
  stairDuration,
  stairProgress,
  timing,
  validFloor,
  worldWidth,
} from './model';
import { atThreshold, defaultDepth, doorClearance, movePlayer, movePoint, setWalkTarget } from './spatial';

export interface SimulationUI {
  panel: 'floors' | 'sign' | null;
  notice: string;
  sounds: SoundEvent[];
  alarmRemaining: number;
  reach: { building: string; floor: number; remaining: number; type: string } | null;
}

export const createUI = (): SimulationUI => ({
  panel: null,
  notice: 'Tryck på golvet för att gå. Hissen väntar på dig.',
  sounds: [],
  alarmRemaining: 0,
  reach: null,
});
const move = (value: number, target: number, amount: number) => value + Math.sign(target - value) * Math.min(Math.abs(target - value), amount);
const near = (a: number, b: number, distance = 20) => Math.abs(a - b) < distance;

export function requestFloor(building: Building, floor: number) {
  if (!validFloor(building.id, floor)) return false;
  const lift = building.lift;
  if (lift.destination === floor || lift.queue.includes(floor)) return false;
  if (lift.destination === null && lift.position === floor) {
    lift.landing.target = 1;
    if (!definition(building.id).manual) lift.gate.target = 1;
    lift.dwell = timing.dwell;
    return false;
  }
  lift.queue.push(floor);
  if (lift.destination === null && (lift.landing.open > 0 || lift.gate.open > 0)) lift.dwell = timing.dwell;
  return true;
}

function perform(state: GameState, ui: SimulationUI, intent: Intent) {
  const player = state.player;
  const building = currentBuilding(state);
  if (intent.type === 'enter' && player.place === 'outside') {
    player.place = intent.building;
    player.floor = 0;
    player.x = layout.exit;
    player.depth = 0.3;
    ui.notice = `Välkommen till ${definition(intent.building).name.toLowerCase()}!`;
    return;
  }
  if (!building) return;
  const lift = building.lift;
  const manual = definition(building.id).manual;
  const atFloor = lift.destination === null && lift.position === player.floor;
  ui.sounds.push({ type: 'click', building: building.id });
  if (['call', 'light', 'alarm', 'panel', 'gate', 'landing'].includes(intent.type))
    ui.reach = { building: building.id, floor: player.floor, remaining: 1.6, type: intent.type };

  switch (intent.type) {
    case 'call':
      requestFloor(building, player.floor);
      ui.notice = atFloor
        ? manual
          ? 'Hissen är här. Öppna grinden med spaken bredvid hissen.'
          : 'Hissen är här. Tryck på Gå in.'
        : `Hissen kommer till våning ${floorLabel(player.floor)}.`;
      break;
    case 'panel':
      if (player.riding) ui.panel = 'floors';
      break;
    case 'threshold':
      ui.notice = 'Här kan du stå kvar. Dörrarna väntar på dig.';
      break;
    case 'board':
      ui.notice = manual ? 'Välj våning och stäng grinden. Ytterdörren stängs själv.' : 'Välj en våning. Du kan åka med eller kliva ut.';
      break;
    case 'leave':
      ui.notice = 'Du kan ta trapporna och möta hissen.';
      break;
    case 'stairs': {
      const to = player.floor + intent.direction;
      if (validFloor(building.id, to) && !player.riding)
        player.stairs = {
          from: player.floor,
          to,
          elapsed: 0,
          duration: stairDuration(Math.abs((player.route?.floor ?? to) - player.floor)),
        };
      break;
    }
    case 'light':
      building.lights[player.floor] = !building.lights[player.floor];
      ui.notice = building.lights[player.floor] ? 'Nu är lamporna tända.' : 'Lamporna är släckta. Utgångsskylten lyser fortfarande.';
      break;
    case 'exit':
      if (player.floor === 0) {
        player.place = 'outside';
        player.x = 130 + state.buildings.indexOf(building) * 250;
        player.riding = false;
        player.depth = 0.3;
        ui.notice = 'Vilket hus vill du besöka?';
      }
      break;
    case 'sign':
      ui.panel = 'sign';
      break;
    case 'alarm':
      ui.alarmRemaining = ui.alarmRemaining > 0 ? 0 : 3;
      if (ui.alarmRemaining) ui.sounds.push({ type: 'alarm', building: building.id });
      break;
    case 'gate':
    case 'landing':
      if (atFloor && (manual || intent.type === 'landing')) {
        const door = lift[intent.type];
        door.target = intent.target ?? (door.target === 1 ? 0 : 1);
        if (!manual) lift.gate.target = door.target;
        if (door.target === 1) lift.dwell = timing.dwell;
        ui.sounds.push({ type: 'door', building: building.id });
        ui.notice = door.target ? 'Öppnar.' : 'Stänger. Stå i öppningen om du vill öppna igen.';
      }
      break;
    case 'invite': {
      const person = building.people.find((passenger) => passenger.id === intent.id);
      if (person?.phase === 'idle' && person.floor === player.floor) {
        person.phase = 'waiting';
        ui.notice = `${definition(building.id).people[person.id]} vill till våning ${floorLabel(person.wanted)}. Du får trycka på knapparna.`;
      }
      break;
    }
    default:
      break;
  }
}

export function command(state: GameState, ui: SimulationUI, action: Command) {
  const player = state.player;
  const building = currentBuilding(state);
  if (action.type === 'alarm' && ui.alarmRemaining > 0) {
    ui.alarmRemaining = 0;
    return;
  }
  // Cabin controls must not cancel Colin's last steps through the doorway.
  if ((action.type === 'panel' || action.type === 'gate' || action.type === 'landing') && player.riding && player.intent?.type === 'board') {
    perform(state, ui, action);
    return;
  }
  if (action.type === 'floor') {
    if (!building || !player.riding) return;
    requestFloor(building, action.floor);
    if (!definition(building.id).manual) ui.panel = null;
    ui.sounds.push({ type: 'click', building: building.id });
    ui.notice = definition(building.id).manual
      ? 'Stäng grinden när du är redo. Ytterdörren stängs själv.'
      : 'Du kan åka med eller kliva ut innan dörrarna stängs.';
    return;
  }
  if (action.type === 'walk') {
    const floor = action.floor ?? player.stairs?.to ?? player.floor;
    if (
      !Number.isFinite(action.x) ||
      (action.depth !== undefined && (!Number.isFinite(action.depth) || action.depth < -0.25 || action.depth > 1)) ||
      !Number.isInteger(floor) ||
      floor < 0 ||
      (building && !validFloor(building.id, floor)) ||
      (!building && floor !== 0)
    )
      return;
    ui.panel = null;
    player.intent = null;
    player.targetX = null;
    player.targetDepth = null;
    player.waypoints = [];
    ui.reach = null;
    player.route = {
      floor,
      x: Math.max(25, Math.min(worldWidth(player.place) - 30, action.x)),
      depth: action.depth ?? (building ? defaultDepth(action.x) : 0.3),
    };
    if (floor !== player.floor || player.stairs) ui.notice = `Colin tar trappan till våning ${floorLabel(floor)}.`;
    return;
  }
  if (player.stairs) {
    ui.notice = 'Colin går färdigt i trappan först.';
    return;
  }
  ui.panel = null;
  player.intent = null;
  player.targetX = null;
  player.targetDepth = null;
  player.waypoints = [];
  ui.reach = null;
  player.route = null;
  if (player.place === 'outside') {
    if (action.type === 'enter') {
      setWalkTarget(player, { x: 130 + state.buildings.findIndex((b) => b.id === action.building) * 250, depth: 0.3 });
      player.intent = action;
    }
    return;
  }
  if (!building) return;
  const lift = building.lift;
  if (action.type === 'enter') return;
  if (action.type === 'exit' && player.floor !== 0) return;
  if (action.type === 'panel') {
    if (player.riding) perform(state, ui, action);
    else ui.notice = 'Gå in i hissen för att välja våning.';
    return;
  }
  if ((action.type === 'gate' || action.type === 'landing') && (player.riding || atThreshold(player))) {
    perform(state, ui, action);
    return;
  }
  if (action.type === 'board' && (!isOpen(lift) || lift.position !== player.floor)) {
    ui.notice = 'Vänta tills hissen är här och dörrarna är öppna.';
    return;
  }
  if (action.type === 'threshold' && (lift.destination !== null || lift.position !== player.floor || Math.min(lift.landing.open, lift.gate.open) <= 0.15)) {
    ui.notice = 'Vänta tills dörröppningen är fri.';
    return;
  }
  if (action.type === 'stairs' && (player.floor + action.direction < 0 || !validFloor(building.id, player.floor + action.direction))) return;
  const positions: Partial<Record<Intent['type'], number>> = {
    call: 424,
    board: layout.cabin,
    leave: 750,
    threshold: layout.threshold,
    stairs: layout.stairs,
    light: 350,
    exit: layout.exit,
    sign: 765,
    alarm: 285,
    gate: 785,
    landing: 785,
  };
  const person = action.type === 'invite' ? building.people.find((p) => p.id === action.id) : null;
  const depth =
    action.type === 'board'
      ? -0.18
      : action.type === 'threshold'
        ? 0
        : ['call', 'light', 'alarm', 'stairs'].includes(action.type)
          ? 0.025
          : (person?.depth ?? 0.3);
  setWalkTarget(player, { x: person?.x ?? positions[action.type] ?? player.x, depth });
  player.intent = action;
}

function stepPlayer(state: GameState, ui: SimulationUI, dt: number) {
  const player = state.player;
  const building = currentBuilding(state);
  if (player.stairs) {
    player.stairs.elapsed = Math.min(player.stairs.duration, player.stairs.elapsed + dt);
    player.x = layout.stairs + Math.sin(stairProgress(player.stairs) * Math.PI) * 45;
    player.depth = 0.025;
    if (player.stairs.elapsed >= player.stairs.duration) {
      player.floor = player.stairs.to;
      player.x = layout.stairs;
      player.stairs = null;
      ui.notice = `Våning ${floorLabel(player.floor)}.`;
    }
    return;
  }
  if (building && player.riding && building.lift.destination === null) player.floor = Math.round(building.lift.position);
  if (player.route && !(player.riding && building?.lift.destination !== null)) {
    if (player.floor === player.route.floor) {
      setWalkTarget(player, player.route);
      player.intent = null;
      player.route = null;
    } else {
      if (player.targetX !== layout.stairs || player.targetDepth !== 0.025) setWalkTarget(player, { x: layout.stairs, depth: 0.025 });
      player.intent = { type: 'stairs', direction: player.route.floor > player.floor ? 1 : -1 };
    }
  }
  if (player.targetX === null) return;
  if (movePlayer(state, timing.walk * dt)) {
    const intent = player.intent;
    player.targetX = null;
    player.targetDepth = null;
    player.intent = null;
    if (intent) perform(state, ui, intent);
  }
}

function stepPeople(state: GameState, building: Building, dt: number) {
  const lift = building.lift;
  const colinAtDoor = state.player.place === building.id && !state.player.stairs && near(playerLevel(state), lift.position, 0.01) && atThreshold(state.player);
  const count = floorCount(building.id);
  let crossing = building.people.some((person) => person.phase === 'boarding' || person.phase === 'leaving');
  // Unload before admitting another passenger. Only one passenger uses the doorway at a time.
  for (const person of [...building.people].sort((a, b) => Number(b.phase === 'riding') - Number(a.phase === 'riding'))) {
    const homeX = 420 + person.id * 90;
    if (person.phase === 'away') {
      person.timer -= dt;
      if (person.timer <= 0) {
        person.floor = Math.floor(random(state) * count);
        person.wanted = (person.floor + 1 + Math.floor(random(state) * (count - 1))) % count;
        person.x = layout.stairs;
        person.depth = 0.025;
        person.phase = 'returning';
        person.timer = 12;
      }
    } else if (person.phase === 'waiting') {
      Object.assign(person, movePoint(person, { x: 770 - person.id * 45, depth: 0.22 + person.id * 0.08 }, timing.passengerWalk * dt));
      if (!crossing && !colinAtDoor && isOpen(lift) && lift.position === person.floor && near(person.x, 770 - person.id * 45, 1)) {
        person.phase = 'boarding';
        crossing = true;
      }
    } else if (person.phase === 'boarding') {
      if (!isOpen(lift) || lift.position !== person.floor) continue;
      if (colinAtDoor && person.depth > 0.05) continue;
      const target =
        person.depth > 0.121 && !near(person.x, layout.threshold, 1)
          ? { x: layout.threshold, depth: 0.12 }
          : { x: 870 + person.id * 40, depth: -0.18 + person.id * 0.015 };
      Object.assign(person, movePoint(person, target, timing.passengerWalk * dt));
      if (near(person.x, 870 + person.id * 40, 1) && person.depth < -0.13) person.phase = 'riding';
    } else if (person.phase === 'riding') {
      if (lift.destination === null) person.floor = Math.round(lift.position);
      if (!crossing && !colinAtDoor && isOpen(lift) && lift.position === person.wanted) {
        person.phase = 'leaving';
        crossing = true;
      }
    } else if (person.phase === 'leaving') {
      if (!isOpen(lift) || lift.position !== person.floor) continue;
      if (colinAtDoor && person.depth < -0.05) continue;
      Object.assign(person, movePoint(person, { x: 765, depth: 0.22 }, timing.passengerWalk * dt));
      if (near(person.x, 765, 1) && person.depth > 0.2) {
        person.phase = 'returning';
        person.timer = 15;
      }
    } else if (person.phase === 'departing') {
      Object.assign(person, movePoint(person, { x: layout.stairs, depth: 0.025 }, timing.passengerWalk * dt));
      if (near(person.x, layout.stairs, 1) && person.depth < 0.03) {
        person.phase = 'away';
        person.timer = 25 + random(state) * 35;
      }
    } else if (person.phase === 'returning') {
      Object.assign(person, movePoint(person, { x: homeX, depth: 0.24 + person.id * 0.12 }, timing.passengerWalk * dt));
      person.timer -= dt;
      if (person.timer <= 0 && near(person.x, homeX, 1)) {
        if (building.id === 'house' && random(state) < 0.6) {
          person.phase = 'departing';
        } else {
          person.phase = 'idle';
          person.wanted = (person.floor + 1 + Math.floor(random(state) * (count - 1))) % count;
        }
      }
    }
  }
}

function stepDoor(door: Door, dt: number) {
  door.open = move(door.open, door.target, dt / timing.door);
}

function stepLift(state: GameState, building: Building, ui: SimulationUI, dt: number) {
  const lift = building.lift;
  if (lift.destination !== null) {
    lift.position = move(lift.position, lift.destination, dt / timing.travel);
    if (lift.position === lift.destination) {
      lift.destination = null;
      lift.dwell = timing.dwell;
      lift.landing.target = 1;
      if (!definition(building.id).manual) lift.gate.target = 1;
      ui.sounds.push({ type: 'arrival', building: building.id });
    }
    return;
  }
  const player = state.player;
  const playerBlocks = player.place === building.id && !player.stairs && near(playerLevel(state), lift.position, 0.01) && atThreshold(player);
  const personBlocks = building.people.some((person) => (person.phase === 'boarding' || person.phase === 'leaving') && person.floor === lift.position);
  const wasBlocked = lift.blocked;
  lift.blocked = playerBlocks || personBlocks;
  if (wasBlocked && !lift.blocked) lift.dwell = timing.dwell;
  const landingLimit = doorClearance(player);
  const gateLimit = doorClearance(player, definition(building.id).manual);
  const contact =
    playerBlocks &&
    ((lift.landing.target === 0 && lift.landing.open <= landingLimit + dt / timing.door) ||
      (lift.gate.target === 0 && lift.gate.open <= gateLimit + dt / timing.door));
  if (personBlocks || contact) {
    const wasClosing = lift.landing.target === 0 || lift.gate.target === 0;
    if (contact) {
      lift.landing.open = Math.max(lift.landing.open, landingLimit);
      lift.gate.open = Math.max(lift.gate.open, gateLimit);
    }
    lift.landing.target = 1;
    lift.gate.target = 1;
    lift.dwell = timing.dwell;
    if (wasClosing) ui.sounds.push({ type: 'door', building: building.id });
  } else {
    const reopening = playerBlocks && (lift.landing.open < lift.landing.target || lift.gate.open < lift.gate.target);
    lift.dwell = reopening ? timing.dwell : Math.max(0, lift.dwell - dt);
    if (lift.queue.length && lift.dwell === 0 && (!definition(building.id).manual || lift.gate.open === 0)) {
      if (lift.landing.target === 1) ui.sounds.push({ type: 'door', building: building.id });
      lift.landing.target = 0;
      if (!definition(building.id).manual) lift.gate.target = 0;
    }
  }
  stepDoor(lift.landing, dt);
  stepDoor(lift.gate, dt);
  if (!lift.blocked && lift.dwell === 0 && lift.landing.open === 0 && lift.gate.open === 0 && lift.queue.length) {
    lift.destination = lift.queue.shift() ?? null;
  }
}

export function step(state: GameState, ui: SimulationUI, dt: number) {
  if (!Number.isFinite(dt) || dt <= 0 || dt > 0.05) return;
  state.time += dt;
  ui.alarmRemaining = Math.max(0, ui.alarmRemaining - dt);
  if (ui.reach) {
    ui.reach.remaining -= dt;
    if (ui.reach.remaining <= 0) ui.reach = null;
  }
  stepPlayer(state, ui, dt);
  for (const building of state.buildings) {
    stepPeople(state, building, dt);
    stepLift(state, building, ui, dt);
  }
}
