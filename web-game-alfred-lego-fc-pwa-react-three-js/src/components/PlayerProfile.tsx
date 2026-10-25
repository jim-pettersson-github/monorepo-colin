import { type ClubId, getClub } from '../game/clubs';
import { boostedStat, type TeamForm } from '../game/form';
import type { Footballer } from '../game/players';
import { palette } from '../palette';
import './transfers.css';

export function PlayerStats({ player, form }: { player: Footballer; form?: TeamForm | null }) {
  return (
    <dl className='athlete-stats'>
      {(
        [
          ['Fart', player.pace],
          ['Skott', player.shooting],
          ['Pass', player.passing],
          ['Försvar', player.defending],
          ['Målvakt', player.goalkeeping],
        ] as const
      ).map(([label, base]) => {
        const value = boostedStat(base, form);
        return (
          <div key={label}>
            <dt>{label}</dt>
            <dd>
              <meter min='0' max='100' value={value} aria-label={`${label}: ${value} av 100`} />
              <span>{value}</span>
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
export function PlayerPortrait({ player, club }: { player: Footballer; club: ClubId }) {
  const shirt = player.keeper ? palette.keeper : getClub(club).shirt;
  const hair = ['#604635', '#d8b958', '#302c2c', '#a06641'][Number(player.id.split('-').at(-1)) % 4];
  return (
    <svg className='athlete-portrait' viewBox='0 0 72 88' aria-hidden='true'>
      <rect x='5' y='3' width='62' height='82' rx='14' fill='#233c49' />
      <path d='M15 83V62q21-18 42 0v21' fill={shirt} />
      <path d='M29 54v9q7 7 14 0v-9' fill='#e5b680' />
      <rect x='20' y='14' width='32' height='43' rx='13' fill='#f1c58f' />
      <path d='M19 31V24q0-17 17-17t17 17v8l-7-10-21 3Z' fill={hair} />
      <circle cx='29' cy='36' r='2' fill='#29343b' />
      <circle cx='43' cy='36' r='2' fill='#29343b' />
      <path d='M31 47q5 4 10 0' stroke='#925e47' strokeWidth='2' fill='none' />
      <path d='M31 68h10v15H31Z' fill='#ffffff45' />
    </svg>
  );
}
