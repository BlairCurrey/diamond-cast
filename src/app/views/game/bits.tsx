import type { EventVM, HitVM } from '../../model/game';

/** Pitch-by-pitch table for one plate appearance (with steals/subs interleaved). */
export function PitchTable({ events, compact = false, newestFirst = false }: { events: EventVM[]; compact?: boolean; newestFirst?: boolean }) {
  const rows = newestFirst ? [...events].reverse() : events;
  if (!rows.length) return <div class="muted small">No pitches yet.</div>;
  return (
    <table class={`pitches num${compact ? ' compact' : ''}`}>
      {!compact && (
        <thead>
          <tr><th>#</th><th>Pitch</th><th class="r">MPH</th><th>Result</th><th class="r">Count</th></tr>
        </thead>
      )}
      <tbody>
        {rows.map((e, i) => e.kind === 'pitch' ? (
          <tr key={i} class={e.pitch!.cls}>
            <td class="pn"><span class={`pdot ${e.pitch!.cls}`}>{e.pitch!.n}</span></td>
            <td>{e.pitch!.type}</td>
            <td class="r">{e.pitch!.mph ? e.pitch!.mph.toFixed(1) : ''}</td>
            <td class="call">
              {e.pitch!.call}
              {e.pitch!.review && <span class={`review ${e.pitch!.review.toLowerCase()}`}>{e.pitch!.review === 'Challenged' ? 'Challenge' : `Challenge ${e.pitch!.review.toLowerCase()}`}</span>}
            </td>
            <td class="r muted">{e.pitch!.cls === 'inplay' ? '' : e.pitch!.count}</td>
          </tr>
        ) : (
          <tr key={i} class="action"><td></td><td colSpan={4}>{e.text}</td></tr>
        ))}
      </tbody>
    </table>
  );
}

export function HitLine({ hit }: { hit: HitVM }) {
  const parts = [
    hit.ev !== undefined && `${hit.ev.toFixed(1)} mph exit velo`,
    hit.la !== undefined && `${Math.round(hit.la)}° launch`,
    hit.dist !== undefined && hit.dist > 0 && `${Math.round(hit.dist)} ft`,
    hit.traj,
  ].filter(Boolean);
  if (!parts.length) return null;
  return <div class="hitline">{parts.join(' · ')}</div>;
}
