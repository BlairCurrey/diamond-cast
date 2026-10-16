import { useEffect, useMemo, useState } from 'preact/hooks';
import { getJSON } from '../api/client';
import { usePoll } from '../api/hooks';
import { ep } from '../api/endpoints';
import { sbGame, isActive, type SbGame } from '../model/schedule';
import { addDays, baseballToday, fmtDateLong, fmtDateWeekday, isValidYmd, lastName } from '../model/format';
import { href } from '../router';
import { TeamLogo, PlayerLink, ErrorBox, Loading, Empty } from '../components/common';
import { BasesMini } from '../components/graphics';

// Offseason: the default view ("Today", no date in the URL) opens on the last day of the
// most recent World Series instead of an empty page. It only does that when nothing is
// scheduled from today through the next week, so off days, the All-Star break and gaps
// between playoff rounds still show today. Unplayed games of a finished series drop out
// of the schedule, so this starts the day after the World Series ends.
const offseasonDay = new Map<string, string | null>(); // by today's date; null = show today

async function findOffseasonDay(today: string): Promise<string | null> {
  const ahead = await getJSON<any>(ep.gamesBetween(today, addDays(today, 7)));
  if (ahead?.dates?.some((d: any) => d.games?.length)) return null;
  const ws = await getJSON<any>(ep.gamesBetween(addDays(today, -365), addDays(today, -1), 'W'));
  return ws?.dates?.at(-1)?.date ?? null;
}

export function Scoreboard({ date: dateParam }: { date?: string }) {
  const today = baseballToday();
  const auto = !isValidYmd(dateParam);
  const [fallback, setFallback] = useState(() => offseasonDay.get(today));
  const date = isValidYmd(dateParam) ? dateParam : (fallback ?? today);
  const offseason = auto && fallback ? fallback : null;
  const yesterday = addDays(today, -1);

  // Poll quickly while anything is live, slowly if games are still to come today.
  // The interval is derived from the last response; changing it doesn't refetch early (10s cache).
  const [interval, setInterval_] = useState<number | null>(null);
  const res = usePoll<any>(ep.schedule(date), interval, 10_000);
  const data = res.data;
  const list: SbGame[] = useMemo(() => (data?.dates?.[0]?.games ?? []).map(sbGame), [data]);
  useEffect(() => {
    const anyLive = list.some((g) => isActive(g.kind));
    const anyPre = list.some((g) => g.kind === 'preview');
    setInterval_(anyLive ? 15_000 : anyPre && date === today ? 60_000 : null);
  }, [list, date, today]);

  // Nothing on today's default view: find out whether it's the offseason.
  const checking = auto && fallback === undefined && date === today && !!data && list.length === 0;
  useEffect(() => {
    if (!checking) return;
    let current = true;
    const done = (d: string | null) => { offseasonDay.set(today, d); if (current) setFallback(d); };
    findOffseasonDay(today).then(done, () => { if (current) setFallback(null); });
    return () => { current = false; };
  }, [checking, today]);

  const live = list.filter((g) => isActive(g.kind)).length;
  const final = list.filter((g) => g.kind === 'final').length;

  return (
    <div class="page scoreboard">
      <div class="datebar">
        <a class="btn" href={href.scores(addDays(date, -1))} title="Previous day">&laquo; {fmtDateWeekday(addDays(date, -1))}</a>
        <div class="datebar-mid">
          <h1>{fmtDateLong(date)}</h1>
          <div class="datebar-quick">
            <a href={href.scores(yesterday)} class={date === yesterday ? 'on' : ''}>Yesterday</a>
            <a href={offseason ? href.scores(today) : href.scores()} class={date === today ? 'on' : ''}>Today</a>
            <input
              type="date"
              value={date}
              aria-label="Pick a date"
              onChange={(e) => { const v = (e.target as HTMLInputElement).value; if (v) location.hash = href.scores(v); }}
            />
          </div>
        </div>
        <a class="btn" href={href.scores(addDays(date, 1))} title="Next day">{fmtDateWeekday(addDays(date, 1))} &raquo;</a>
      </div>

      {offseason && (
        <div class="sb-note">
          It's the offseason, so here's the last day of the {offseason.slice(0, 4)} World Series.{' '}
          <a href={href.scores(today)}>Today's scoreboard &raquo;</a>
        </div>
      )}

      {list.length > 0 && (
        <div class="sb-summary muted">
          {list.length} game{list.length === 1 ? '' : 's'}
          {live > 0 && <> · <span class="live-dot" /> {live} in progress</>}
          {final > 0 && <> · {final} final</>}
          {interval && <> · auto-updating</>}
        </div>
      )}

      {res.error && !data && <ErrorBox error={res.error} retry={res.refresh} />}
      {((!data && !res.error) || checking) && <Loading what="Loading games" />}
      {data && list.length === 0 && !checking && <Empty>No MLB games scheduled on this date.</Empty>}

      <div class="sb-grid">
        {list.map((g) => <GameCard key={g.pk} g={g} />)}
      </div>
    </div>
  );
}

function GameCard({ g }: { g: SbGame }) {
  const active = isActive(g.kind);
  const showLine = g.kind === 'final' || active;
  const innings = Math.max(g.scheduledInnings, g.innings.length);
  const cols = Array.from({ length: innings }, (_, i) => i);
  const winnerClass = (side: 'away' | 'home') => (g.kind === 'final' && g[side].winner ? 'win' : g.kind === 'final' ? 'lose' : '');
  const outsText = active && g.inningState !== 'Middle' && g.inningState !== 'End' && g.outs !== undefined ? ` · ${g.outs} out${g.outs === 1 ? '' : 's'}` : '';

  const teamRow = (side: 'away' | 'home') => {
    const t = g[side];
    return (
      <tr class={winnerClass(side)}>
        <th class="sb-team"><div class="sb-teamcell">
          <a href={href.team(t.id)}>
            <TeamLogo id={t.id} size={18} />
            <span class="sb-abbr">{t.abbr}</span>
            <span class="sb-club">{t.club}</span>
          </a>
          {t.record && <span class="sb-rec muted">{t.record}</span>}
        </div></th>
        {showLine && cols.map((i) => {
          const v = g.innings[i]?.[side];
          const cur = active && g.inning === i + 1 && ((side === 'away') === !!g.isTop);
          return <td class={`inn${cur ? ' cur' : ''}`}>{v ?? (g.kind === 'final' && side === 'home' && i === innings - 1 && g.innings[i]?.away !== undefined ? 'x' : '')}</td>;
        })}
        {showLine ? (
          <>
            <td class="rhe r">{t.runs ?? 0}</td>
            <td class="rhe">{t.hits ?? 0}</td>
            <td class="rhe">{t.errors ?? 0}</td>
          </>
        ) : (
          <td class="sb-prob">{t.probable ? <PlayerLink p={{ id: t.probable.id, name: t.probable.name, short: t.probable.name }} /> : <span class="muted">TBD</span>}</td>
        )}
      </tr>
    );
  };

  return (
    <div class={`sb-card ${g.kind}`}>
      <a class="sb-status" href={href.game(g.pk)}>
        <span class="sb-state">
          {active && <span class="live-dot" />}
          {g.status}{outsText}
        </span>
        {g.series && <span class="sb-series">{g.series}</span>}
      </a>
      <table class="sb-table num">
        {showLine && (
          <thead>
            <tr>
              <th></th>
              {cols.map((i) => <th class={`inn${active && g.inning === i + 1 ? ' cur' : ''}`}>{i + 1}</th>)}
              <th class="rhe">R</th><th class="rhe">H</th><th class="rhe">E</th>
            </tr>
          </thead>
        )}
        {!showLine && (
          <thead><tr><th></th><th class="sb-prob muted">Probable</th></tr></thead>
        )}
        <tbody>{teamRow('away')}{teamRow('home')}</tbody>
      </table>
      <div class="sb-foot">
        {active && g.kind === 'live' && (
          <div class="sb-live">
            <BasesMini bases={g.bases} />
            <span><span class="muted">P:</span> <PlayerLink p={g.pitcher && { ...g.pitcher, short: lastName(g.pitcher.name) }} /></span>
            <span><span class="muted">{g.inningState === 'Middle' || g.inningState === 'End' ? 'Due:' : 'AB:'}</span> <PlayerLink p={g.batter && { ...g.batter, short: lastName(g.batter.name) }} /></span>
            {g.inningState !== 'Middle' && g.inningState !== 'End' && g.balls !== undefined && <span class="muted num">{g.balls}-{g.strikes}</span>}
          </div>
        )}
        {g.kind === 'final' && (
          <div class="sb-dec">
            {g.winner && <span><span class="muted">W:</span> <PlayerLink p={{ ...g.winner, short: lastName(g.winner.name) }} /></span>}
            {g.loser && <span><span class="muted">L:</span> <PlayerLink p={{ ...g.loser, short: lastName(g.loser.name) }} /></span>}
            {g.save && <span><span class="muted">S:</span> <PlayerLink p={{ ...g.save, short: lastName(g.save.name) }} /></span>}
          </div>
        )}
        {(g.kind === 'preview' || g.kind === 'warmup') && (
          <div class="sb-pre muted">{[g.venue, g.tv].filter(Boolean).join(' · ')}</div>
        )}
        {(g.kind === 'postponed' || g.kind === 'suspended') && <div class="sb-pre muted">{g.note ?? ''}</div>}
        {g.seriesStatus && <div class="sb-seriesline">{g.seriesStatus}</div>}
        <div class="sb-links">
          {active && <a href={href.game(g.pk)}><b>Gamecast</b></a>}
          {(g.kind === 'final' || active) && <a href={href.game(g.pk, 'box')}>Box score</a>}
          {g.kind === 'final' && <a href={href.game(g.pk, 'plays')}>Plays</a>}
          {g.kind === 'final' && <a href={href.game(g.pk, 'gamecast')}>Replay</a>}
          {(g.kind === 'preview' || g.kind === 'warmup') && <a href={href.game(g.pk)}><b>Preview</b></a>}
        </div>
      </div>
    </div>
  );
}

