import { type RefObject, useEffect, useMemo, useRef } from 'react';
import { forwardSpeed } from '../game/physics';
import { formatTime, type Race } from '../game/race';
import { mapProjection } from './TrackMap';

export type HudController = { update: (race: Race) => void };

const DIAL = 9;
const angleFor = (thousands: number) => 135 + (thousands / DIAL) * 270;
const point = (angle: number, radius: number) => {
  const radians = (angle * Math.PI) / 180;
  return [100 + Math.cos(radians) * radius, 100 + Math.sin(radians) * radius] as const;
};

function Tachometer() {
  const ticks = [];
  for (let value = 0; value <= DIAL; value += 0.5) {
    const major = value % 1 === 0;
    const [x1, y1] = point(angleFor(value), major ? 72 : 78);
    const [x2, y2] = point(angleFor(value), 86);
    ticks.push(<line key={`tick-${value}`} x1={x1} y1={y1} x2={x2} y2={y2} className={value >= 7.5 ? 'tick red' : 'tick'} strokeWidth={major ? 4 : 2} />);
    if (major) {
      const [tx, ty] = point(angleFor(value), 58);
      ticks.push(
        <text key={`label-${value}`} x={tx} y={ty} className='tick-label'>
          {value}
        </text>,
      );
    }
  }
  const [redX, redY] = point(angleFor(7.5), 86);
  const [endX, endY] = point(angleFor(DIAL), 86);

  return (
    <svg className='tacho' viewBox='0 0 200 200' aria-hidden='true'>
      <circle cx='100' cy='100' r='96' className='dial-ring' />
      <circle cx='100' cy='100' r='90' className='dial-face' />
      <path d={`M ${redX} ${redY} A 86 86 0 0 1 ${endX} ${endY}`} className='redline' />
      {ticks}
      <text x='100' y='70' className='dial-unit'>
        x1000
      </text>
      <line data-hud='needle' x1='100' y1='100' x2='176' y2='100' className='needle' transform={`rotate(${angleFor(0)} 100 100)`} />
      <circle cx='100' cy='100' r='9' className='hub' />
      <text data-hud='speed' x='100' y='150' className='dial-speed'>
        0
      </text>
      <text x='100' y='170' className='dial-unit'>
        KM/H
      </text>
    </svg>
  );
}

export function Hud({ race, controller }: { race: Race; controller: RefObject<HudController | null> }) {
  const root = useRef<HTMLDivElement>(null);
  const map = useMemo(() => mapProjection(race.track, 150), [race.track]);

  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const find = (name: string) => element.querySelector<SVGElement | HTMLElement>(`[data-hud="${name}"]`);
    const fields = {
      needle: find('needle'),
      speed: find('speed'),
      gear: find('gear'),
      position: find('position'),
      lap: find('lap'),
      lapTime: find('lap-time'),
      bestLap: find('best-lap'),
      total: find('total'),
      banner: find('banner'),
      wrongWay: find('wrong-way'),
    };
    const dots = [...element.querySelectorAll<SVGCircleElement>('[data-car]')];
    const rows = [...element.querySelectorAll<HTMLLIElement>('[data-board]')].map((row) => ({ row, name: row.querySelector('.board-name') }));
    const write = (field: Element | null, value: string) => {
      if (field && field.textContent !== value) field.textContent = value;
    };

    controller.current = {
      update(current) {
        const { player, racers, settings } = current;
        const car = player.state;
        const kmh = Math.round(Math.abs(forwardSpeed(car)) * 3.6);
        fields.needle?.setAttribute('transform', `rotate(${angleFor(Math.min(DIAL, car.rpm * 8.2)).toFixed(1)} 100 100)`);
        write(fields.speed, String(kmh));
        write(fields.gear, car.gear === 0 ? 'R' : String(car.gear));
        write(fields.position, String(player.position));
        write(fields.lap, `${Math.max(1, Math.min(settings.laps, player.lap + 1))}/${settings.laps}`);
        write(fields.lapTime, formatTime(current.phase === 'countdown' ? 0 : player.finishTime ? player.lastLap : current.time - player.lapStart));
        write(fields.bestLap, formatTime(player.bestLap));
        write(fields.total, formatTime(player.finishTime || current.time));

        let banner = '';
        if (current.phase === 'countdown') banner = current.countdown > 3 ? '' : String(Math.ceil(current.countdown));
        else if (current.banner && current.time < current.banner.until) banner = current.banner.text;
        write(fields.banner, banner);
        fields.banner?.classList.toggle('visible', banner !== '');
        fields.wrongWay?.classList.toggle('visible', current.wrongWay > 1.2 && Math.floor(current.time * 3) % 2 === 0);

        // The live standings: one row per place, in race order.
        for (const racer of racers) {
          const entry = rows[racer.position - 1];
          if (!entry) continue;
          write(entry.name, racer.finishTime ? `${racer.driverName} ✓` : racer.driverName);
          entry.row.classList.toggle('me', racer === player);
          entry.row.classList.toggle('human', racer.isPlayer && racer !== player);
        }

        racers.forEach((racer, index) => {
          const [x, y] = map.project(racer.state.x, racer.state.z);
          dots[index]?.setAttribute('cx', x.toFixed(1));
          dots[index]?.setAttribute('cy', y.toFixed(1));
        });
        element.dataset.speed = String(kmh);
        element.dataset.phase = current.phase;
      },
    };
    return () => {
      controller.current = null;
    };
  }, [controller, map]);

  return (
    <div className='hud' ref={root} data-testid='hud'>
      <div className='hud-standing'>
        <div className='hud-label'>POS</div>
        <div className='hud-position'>
          <span data-hud='position'>{race.player.position}</span>
          <small>/{race.racers.length}</small>
        </div>
        <div className='hud-label'>VARV</div>
        <div className='hud-lap' data-hud='lap'>
          1/{race.settings.laps}
        </div>
        <ol className='hud-board' aria-label='Placeringar'>
          {race.racers.map((racer, index) => (
            <li key={racer.id} data-board={index}>
              <span className='board-place'>{index + 1}</span>
              <span className='board-name'>{racer.driverName}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className='hud-times'>
        <dl>
          <dt>TID</dt>
          <dd data-hud='total'>0:00.00</dd>
          <dt>VARV</dt>
          <dd data-hud='lap-time'>0:00.00</dd>
          <dt>BÄSTA</dt>
          <dd data-hud='best-lap'>-:--.--</dd>
        </dl>
        <svg className='hud-map' viewBox='0 0 150 150' aria-hidden='true'>
          <polygon points={map.points} className='map-road' />
          <polygon points={map.points} className='map-line' />
          {race.racers.map((racer) => (
            <circle key={racer.id} data-car={racer.id} r={racer.isPlayer ? 5 : 3.5} className={racer.isPlayer ? 'map-player' : 'map-rival'} />
          ))}
        </svg>
      </div>

      <div className='hud-banner' data-hud='banner' role='status' />
      <div className='hud-wrong-way' data-hud='wrong-way'>
        FEL HÅLL!
      </div>

      <div className='hud-gauge'>
        <Tachometer />
        <div className='hud-gear'>
          <small>VÄXEL</small>
          <span data-hud='gear'>1</span>
        </div>
      </div>
    </div>
  );
}
