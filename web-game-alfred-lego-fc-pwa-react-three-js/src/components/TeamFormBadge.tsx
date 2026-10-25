import type { TeamForm } from '../game/form';
import './team-form.css';

export function TeamFormBadge({ form }: { form?: TeamForm | null }) {
  return form ? (
    <span className='team-form-badge'>
      Segerform +{form.bonus} · {form.remaining} {form.remaining === 1 ? 'match kvar' : 'matcher kvar'}
    </span>
  ) : null;
}
