import {
  type Building,
  type Command,
  currentBuilding,
  type Door,
  definition,
  type GameState,
  type Intent,
  isOpen,
  layout,
  playerLevel,
  random,
  roomDoorX,
  type SoundEvent,
  timing,
  worldWidth,
} from './model';

export interface SimulationUI {
  panel: 'floors' | 'sign' | null;
  notice: string;
  sounds: SoundEvent[];
  alarmRemaining: number;
}

export const createUI = (): SimulationUI => ({ panel: null, notice: 'Tryck på golvet för att gå. Hissen väntar på dig.', sounds: [], alarmRemaining: 0 });
const move = (value: number, target: number, amount: number) => value + Math.sign(target - value) * Math.min(Math.abs(target - value), amount);
const near = (a: number, b: number, distance = 20) => Math.abs(a - b) < distance;

export function requestFloor(building: Building, floor: number) {
  if (!Number.isInteger(floor) || floor < 0 || floor > 2) return false;
  const lift = building.lift;
  if (lift.destination === floor || lift.queue.includes(floor)) return false;
  if (lift.destination === null && lift.position === floor) {
    if (!definition(building.id).manual) {
      lift.landing.target = 1;
      lift.gate.target = 1;
    }
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
    ui.notice = `Välkommen till ${definition(intent.building).name.toLowerCase()}!`;
    return;
  }
  if (!building) return;
  const lift = building.lift;
  const manual = definition(building.id).manual;
  const atFloor = lift.destination === null && lift.position === player.floor;
  ui.sounds.push({ type: 'click', building: building.id });

  switch (intent.type) {
    case 'call':
      requestFloor(building, player.floor);
      ui.notice = atFloor ? (manual ? 'Öppna dörren och grinden.' : 'Hissen är här. Tryck på Gå in.') : `Hissen kommer till våning ${player.floor}.`;
      break;
    case 'panel':
      if (player.riding) ui.panel = 'floors';
      break;
    case 'threshold':
      ui.notice = 'Här kan du stå kvar. Dörrarna väntar på dig.';
      break;
    case 'board':
      ui.notice = manual ? 'Välj våning. Du öppnar och stänger dörren och grinden själv.' : 'Välj en våning. Du kan åka med eller kliva ut.';
      break;
    case 'leave':
      ui.notice = 'Du kan ta trapporna och möta hissen.';
      break;
    case 'stairs': {
      const to = player.floor + intent.direction;
      if (to >= 0 && to <= 2 && !player.riding) player.stairs = { from: player.floor, to, elapsed: 0 };
      break;
    }
    case 'light':
      building.lights[player.floor] = !building.lights[player.floor];
      ui.notice = building.lights[player.floor] ? 'Nu är lamporna tända.' : 'Lamporna är släckta. Utgångsskylten lyser fortfarande.';
      break;
    case 'roomDoor':
      building.roomDoors[player.floor] = !building.roomDoors[player.floor];
      ui.notice = building.roomDoors[player.floor] ? 'Dörren är öppen. Titta in!' : 'Dörren är stängd.';
      break;
    case 'exit':
      if (player.floor === 0) {
        player.place = 'outside';
        player.x = 130 + state.buildings.indexOf(building) * 250;
        player.riding = false;
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
      if (manual && atFloor) {
        const door = lift[intent.type];
        door.target = door.target === 1 ? 0 : 1;
        ui.sounds.push({ type: 'door', building: building.id });
        ui.notice = door.target ? 'Öppnar.' : 'Stänger. Stå i öppningen om du vill öppna igen.';
      }
      break;
    case 'invite': {
      const person = building.people.find((passenger) => passenger.id === intent.id);
      if (person?.phase === 'idle' && person.floor === player.floor) {
        person.phase = 'waiting';
        ui.notice = `${definition(building.id).people[person.id]} vill till våning ${person.wanted}. Du får trycka på knapparna.`;
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
  if (action.type === 'floor') {
    if (!building || !player.riding || ui.panel !== 'floors') return;
    requestFloor(building, action.floor);
    ui.panel = null;
    ui.sounds.push({ type: 'click', building: building.id });
    ui.notice = definition(building.id).manual ? 'Stäng dörren och grinden när du är redo.' : 'Du kan åka med eller kliva ut innan dörrarna stängs.';
    return;
  }
  if (action.type === 'walk') {
    const floor = action.floor ?? player.stairs?.to ?? player.floor;
    if (!Number.isFinite(action.x) || !Number.isInteger(floor) || floor < 0 || floor > 2 || (!building && floor !== 0)) return;
    ui.panel = null;
    player.intent = null;
    player.targetX = null;
    player.route = { floor, x: Math.max(25, Math.min(worldWidth(player.place) - 30, action.x)) };
    if (floor !== player.floor || player.stairs) ui.notice = `Colin tar trappan till våning ${floor}.`;
    return;
  }
  if (player.stairs) {
    ui.notice = 'Colin går färdigt i trappan först.';
    return;
  }
  ui.panel = null;
  player.intent = null;
  player.targetX = null;
  player.route = null;
  if (player.place === 'outside') {
    if (action.type === 'enter') {
      player.targetX = 130 + state.buildings.findIndex((b) => b.id === action.building) * 250;
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
  if ((action.type === 'gate' || action.type === 'landing') && player.riding) {
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
  if (action.type === 'stairs' && (player.floor + action.direction < 0 || player.floor + action.direction > 2)) return;
  const positions: Partial<Record<Intent['type'], number>> = {
    call: 775,
    board: layout.cabin,
    leave: 750,
    threshold: layout.threshold,
    stairs: layout.stairs,
    light: 630,
    roomDoor: roomDoorX(player.floor) + 32,
    exit: layout.exit,
    sign: 765,
    alarm: 703,
    gate: 785,
    landing: 785,
  };
  player.targetX = action.type === 'invite' ? (building.people.find((person) => person.id === action.id)?.x ?? player.x) : (positions[action.type] ?? player.x);
  player.intent = action;
}

function stepPlayer(state: GameState, ui: SimulationUI, dt: number) {
  const player = state.player;
  const building = currentBuilding(state);
  if (player.stairs) {
    player.stairs.elapsed = Math.min(timing.stairs, player.stairs.elapsed + dt);
    player.x = layout.stairs + Math.sin((player.stairs.elapsed / timing.stairs) * Math.PI) * 45;
    if (player.stairs.elapsed >= timing.stairs) {
      player.floor = player.stairs.to;
      player.x = layout.stairs;
      player.stairs = null;
      ui.notice = `Våning ${player.floor}.`;
    }
    return;
  }
  if (building && player.riding && building.lift.destination === null) player.floor = Math.round(building.lift.position);
  if (player.route && !(player.riding && building?.lift.destination !== null)) {
    if (player.floor === player.route.floor) {
      player.targetX = player.route.x;
      player.intent = null;
      player.route = null;
    } else {
      player.targetX = layout.stairs;
      player.intent = { type: 'stairs', direction: player.route.floor > player.floor ? 1 : -1 };
    }
  }
  if (player.targetX === null) return;
  let nextX = move(player.x, player.targetX, timing.walk * dt);
  if (building) {
    const lift = building.lift;
    const canCross = isOpen(lift) && (player.riding || lift.position === player.floor);
    if (!canCross) {
      const approachingOpenDoor = lift.destination === null && lift.position === player.floor && Math.min(lift.landing.open, lift.gate.open) > 0.15;
      const clearance = approachingOpenDoor ? 18 : 26;
      if (player.x < layout.threshold) nextX = Math.min(nextX, layout.threshold - clearance);
      else nextX = Math.max(nextX, layout.threshold + clearance);
    }
    player.riding = nextX > layout.threshold + 20;
  }
  player.x = nextX;
  if (Math.abs(player.x - player.targetX) < 0.01) {
    const intent = player.intent;
    player.targetX = null;
    player.intent = null;
    if (intent) perform(state, ui, intent);
  }
}

function stepPeople(state: GameState, building: Building, dt: number) {
  const lift = building.lift;
  const colinAtDoor =
    state.player.place === building.id && !state.player.stairs && near(playerLevel(state), lift.position, 0.01) && near(state.player.x, layout.threshold, 28);
  let crossing = building.people.some((person) => person.phase === 'boarding' || person.phase === 'leaving');
  // Unload before admitting another passenger. Only one passenger uses the doorway at a time.
  for (const person of [...building.people].sort((a, b) => Number(b.phase === 'riding') - Number(a.phase === 'riding'))) {
    const homeX = 420 + person.id * 90;
    if (person.phase === 'away') {
      person.timer -= dt;
      if (person.timer <= 0) {
        person.floor = Math.floor(random(state) * 3);
        person.wanted = (person.floor + 1 + Math.floor(random(state) * 2)) % 3;
        person.x = 245;
        person.phase = 'returning';
        person.timer = 12;
      }
    } else if (person.phase === 'waiting') {
      person.x = move(person.x, 770 - person.id * 45, timing.passengerWalk * dt);
      if (!crossing && !colinAtDoor && isOpen(lift) && lift.position === person.floor && near(person.x, 770 - person.id * 45, 1)) {
        person.phase = 'boarding';
        crossing = true;
      }
    } else if (person.phase === 'boarding') {
      if (!isOpen(lift) || lift.position !== person.floor) continue;
      if (colinAtDoor && person.x < layout.threshold - 35) continue;
      person.x = move(person.x, 870 + person.id * 40, timing.passengerWalk * dt);
      if (near(person.x, 870 + person.id * 40, 1)) person.phase = 'riding';
    } else if (person.phase === 'riding') {
      if (lift.destination === null) person.floor = Math.round(lift.position);
      if (!crossing && !colinAtDoor && isOpen(lift) && lift.position === person.wanted) {
        person.phase = 'leaving';
        crossing = true;
      }
    } else if (person.phase === 'leaving') {
      if (!isOpen(lift) || lift.position !== person.floor) continue;
      if (colinAtDoor && person.x > layout.threshold + 35) continue;
      person.x = move(person.x, 765, timing.passengerWalk * dt);
      if (person.x <= 765) {
        person.phase = 'returning';
        person.timer = 15;
      }
    } else if (person.phase === 'returning') {
      person.x = move(person.x, homeX, timing.passengerWalk * dt);
      person.timer -= dt;
      if (person.timer <= 0 && near(person.x, homeX, 1)) {
        if (building.id === 'house' && random(state) < 0.6) {
          person.phase = 'away';
          person.timer = 25 + random(state) * 35;
        } else {
          person.phase = 'idle';
          person.wanted = (person.floor + 1 + Math.floor(random(state) * 2)) % 3;
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
      if (!definition(building.id).manual) {
        lift.landing.target = 1;
        lift.gate.target = 1;
      }
      ui.sounds.push({ type: 'arrival', building: building.id });
    }
    return;
  }
  const player = state.player;
  const playerBlocks = player.place === building.id && !player.stairs && near(playerLevel(state), lift.position, 0.01) && near(player.x, layout.threshold, 25);
  const personBlocks = building.people.some((person) => (person.phase === 'boarding' || person.phase === 'leaving') && person.floor === lift.position);
  lift.blocked = playerBlocks || personBlocks;
  if (lift.blocked) {
    const wasClosing = lift.landing.target === 0 || lift.gate.target === 0;
    lift.landing.target = 1;
    lift.gate.target = 1;
    lift.dwell = timing.dwell;
    if (wasClosing) ui.sounds.push({ type: 'door', building: building.id });
  } else {
    lift.dwell = Math.max(0, lift.dwell - dt);
    if (!definition(building.id).manual && lift.queue.length && lift.dwell === 0) {
      if (lift.landing.target === 1) ui.sounds.push({ type: 'door', building: building.id });
      lift.landing.target = 0;
      lift.gate.target = 0;
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
  stepPlayer(state, ui, dt);
  for (const building of state.buildings) {
    stepPeople(state, building, dt);
    stepLift(state, building, ui, dt);
  }
}
