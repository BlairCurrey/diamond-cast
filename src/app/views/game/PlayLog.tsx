import { useRef, useState } from 'preact/hooks';
import { playByIndex, atBat, type LogHalf, type LogPA } from '../../model/game';
import { Tag, PlayerLink, TeamLogo } from '../../components/common';
import { StrikeZone, SprayField } from '../../components/graphics';
import { PitchTable, HitLine } from './bits';

/**
 * Plate appearances grouped by half-inning. Each row is one sentence; click to
 * open its pitch sequence. `newestFirst` for the live feed, chronological for the Plays tab.
 */
export function PlayLog({ feed, halves, newestFirst, abbr, scoringOnly = false, markFresh = false, limit = 0 }: {
  feed: any; halves: LogHalf[]; newestFirst: boolean; abbr: { away: string; home: string }; scoringOnly?: boolean; markFresh?: boolean;
  /** Show only the most recent N half-innings until the user asks for more (0 = all). */
  limit?: number;
}) {
  const [open, setOpen] = useState<Set<number>>(new Set());
  const [showAll, setShowAll] = useState(false);
  // Remember which plays we've already shown so new ones can flash briefly.
  const seen = useRef<Set<number> | null>(null);
  const firstRender = seen.current === null;
  if (firstRender) seen.current = new Set();
  const fresh = new Set<number>();
  halves.forEach((h) => h.pas.forEach((pa) => {
    if (!seen.current!.has(pa.idx)) { if (!firstRender && markFresh) fresh.add(pa.idx); seen.current!.add(pa.idx); }
  }));

  const toggle = (idx: number) => {
    const n = new Set(open);
    n.has(idx) ? n.delete(idx) : n.add(idx);
    setOpen(n);
  };

  const list = (newestFirst ? [...halves].reverse() : halves)
    .map((h) => ({ ...h, pas: scoringOnly ? h.pas.filter((p) => p.scoring) : h.pas }))
    .filter((h) => h.pas.length || (!scoringOnly && h.summary));

  if (!list.length) return <div class="empty">{scoringOnly ? 'No scoring plays yet.' : 'No plays yet.'}</div>;
  const hidden = limit && !showAll ? Math.max(0, list.length - limit) : 0;
  const visible = hidden ? (newestFirst ? list.slice(0, limit) : list.slice(hidden)) : list;

  return (
    <div class="playlog">
      {visible.map((h) => {
        const pas = newestFirst ? [...h.pas].reverse() : h.pas;
        const summary = h.summary && !scoringOnly && (
          <div class="half-sum">
            <b>End of {h.label.toLowerCase().replace(/^(top|bottom)/, (m) => m)}:</b>{' '}
            {h.summary.runs} R, {h.summary.hits} H, {h.summary.errors} E, {h.summary.lob} LOB
            <span class="half-score">{abbr.away} {h.summary.away}, {abbr.home} {h.summary.home}</span>
          </div>
        );
        return (
          <div class="half" key={h.key}>
            <div class="half-head">
              {h.team && <TeamLogo id={h.team.id} size={14} />}
              <span>{h.label}</span>
              {h.team && <span class="muted"> — {h.team.club} batting</span>}
            </div>
            {newestFirst && summary}
            {pas.map((pa) => (
              <PARow
                key={pa.idx}
                pa={pa}
                feed={feed}
                abbr={abbr}
                open={open.has(pa.idx)}
                fresh={fresh.has(pa.idx)}
                onToggle={() => toggle(pa.idx)}
                newestFirst={newestFirst}
              />
            ))}
            {!newestFirst && summary}
          </div>
        );
      })}
      {hidden > 0 && (
        <button class="more" onClick={() => setShowAll(true)}>
          Show {hidden} earlier half-inning{hidden === 1 ? '' : 's'} ▾
        </button>
      )}
    </div>
  );
}

function PARow({ pa, feed, abbr, open, fresh, onToggle, newestFirst }: {
  pa: LogPA; feed: any; abbr: { away: string; home: string }; open: boolean; fresh: boolean; onToggle: () => void; newestFirst: boolean;
}) {
  const actions = pa.actions.map((a, i) => <div key={i} class={`pa-action ${a.eventType?.includes('substitution') ? 'sub' : ''}`}>{a.text}</div>);
  return (
    <div class={`pa${pa.scoring ? ' scoring' : ''}${fresh ? ' fresh' : ''}${open ? ' open' : ''}`}>
      {/* Actions (steals, subs, pitching changes) happened before the result: show them first chronologically. */}
      {!newestFirst && actions}
      <div class="pa-main" onClick={onToggle} role="button" tabIndex={0} aria-expanded={open}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } }}>
        <Tag tag={pa.tag} />
        <span class="pa-text">{pa.text}</span>
        <span class="pa-meta">
          {pa.outRecorded && <span class="pa-outs">{pa.outs} out{pa.outs === 1 ? '' : 's'}</span>}
          {pa.scoring && <span class="pa-score">{abbr.away} {pa.awayScore}, {abbr.home} {pa.homeScore}</span>}
          <span class="pa-caret">{open ? '▾' : '▸'}</span>
        </span>
      </div>
      {newestFirst && actions}
      {open && <PADetail feed={feed} idx={pa.idx} />}
    </div>
  );
}

function PADetail({ feed, idx }: { feed: any; idx: number }) {
  const play = playByIndex(feed, idx);
  const ab = atBat(feed, play);
  if (!ab) return null;
  return (
    <div class="pa-detail">
      <div class="pa-detail-zone">
        <StrikeZone pitches={ab.pitches} szTop={ab.szTop} szBot={ab.szBot} bats={ab.bats} size={150} />
      </div>
      <div class="pa-detail-body">
        <div class="pa-matchup">
          <PlayerLink p={ab.pitcher} full /> <span class="muted">pitching to</span> <PlayerLink p={ab.batter} full />
        </div>
        <PitchTable events={ab.events} compact />
        {ab.hit && (
          <div class="pa-hit">
            <SprayField hits={[{ ...ab.hit, cls: ab.tag?.cls }]} size={110} />
            <HitLine hit={ab.hit} />
          </div>
        )}
      </div>
    </div>
  );
}
