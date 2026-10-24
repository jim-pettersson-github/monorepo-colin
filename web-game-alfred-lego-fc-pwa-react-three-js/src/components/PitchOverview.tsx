import type { MatchState } from '../game/model';
import { FIELD } from '../game/model';

export function PitchOverview({ state }: { state: MatchState }) {
  return (
    <svg
      className={`pitch-overview ${state.ball.x < 0 ? 'overview-upper' : ''}`}
      viewBox='-50 -32 100 64'
      role='img'
      aria-label='Planöversikt med spelarna och bollen'
    >
      <title>Planöversikt med spelarna och bollen</title>
      <rect x={-FIELD.halfLength} y={-FIELD.halfWidth} width={FIELD.halfLength * 2} height={FIELD.halfWidth * 2} rx='1' className='overview-pitch' />
      <path d='M0-30V30M-48-14h14v28h-14M48-14H34v28h14' className='overview-line' />
      <circle r='8' className='overview-line' />
      {state.players.map((player) => (
        <circle
          key={player.id}
          cx={player.x}
          cy={player.z}
          r={state.selected[player.team] === player.id ? 2.3 : 1.5}
          className={`overview-player overview-team-${player.team} ${player.role === 0 ? 'overview-keeper' : ''}`}
        />
      ))}
      <circle cx={state.ball.x} cy={state.ball.z} r='1.5' className='overview-ball' />
    </svg>
  );
}
