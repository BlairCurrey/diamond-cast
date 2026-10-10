import { useEffect, useMemo } from 'preact/hooks';
import { usePoll } from '../api/hooks';
import { ep } from '../api/endpoints';
import { addDays, baseballToday, fmtDateWeekday, seasonOf } from '../model/format';
import { sbGame, isActive, type SbGame } from '../model/schedule';
import { href } from '../router';
import { ErrorBox, Loading, PlayerLink, Section, TeamLogo } from '../components/common';
import { DIVISIONS, TEAMS } from '../../shared/teams';
import { SITE_NAME } from '../../shared/config';

export function Team({ id }: { id: number }) {
  const today = baseballToday();
  const season = seasonOf(today);
  const sched = usePoll<any>(ep.teamSchedule(id, addDays(today, -14), addDays(today, 10)), null, 60_000);
  const roster = usePoll<any>(ep.roster(id), null, 3_600_000);
  const standings = usePoll<any>(ep.standings(season), null, 600_000);
  const t = TEAMS[id];
  useEffect(() => { if (t) document.title = `${t.name} — ${SITE_NAME}`; }, [id]);

  const games: SbGame[] = useMemo(() => (sched.data?.dates ?? []).flatMap((d: any) => d.games).map(sbGame), [sched.data]);
  const past = games.filter((g) => g.kind === 'final').slice(-10).reverse();
  const upcoming = games.filter((g) => g.kind !== 'final').slice(0, 7);

  const rec = useMemo(() => {
    for (const r of standings.data?.records ?? []) {
      const tr = r.teamRecords?.find((x: any) => x.team?.id === id);
      if (tr) return { tr, div: DIVISIONS[r.division?.id] };
    }
    return undefined;
  }, [standings.data, id]);

  const people: any[] = roster.data?.roster ?? [];
  const pitchers = people.filter((p) => p.position?.abbreviation === 'P' || p.position?.type === 'Pitcher');
  const hitters = people.filter((p) => !pitchers.includes(p));
  const posOrder = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'OF', 'DH', 'TWP'];
  hitters.sort((a, b) => posOrder.indexOf(a.position?.abbreviation) - posOrder.indexOf(b.position?.abbreviation));

  const row = (g: ReturnType<typeof sbGame>) => {
    const home = g.home.id === id;
    const opp = home ? g.away : g.home;
    const us = home ? g.home : g.away;
    const res = g.kind === 'final' ? ((us.runs ?? 0) > (opp.runs ?? 0) ? 'W' : 'L') : '';
    return (
      <tr>
        <td class="name">{fmtDateWeekday(g.date)}</td>
        <td class="name">{home ? 'vs' : '@'} <a href={href.team(opp.id)}><TeamLogo id={opp.id} size={14} /> {opp.club}</a></td>
        <td class="name">
          <a href={href.game(g.pk)}>
            {g.kind === 'final' ? <><b class={res === 'W' ? 'res-w' : 'res-l'}>{res}</b> {us.runs}-{opp.runs}</> :
              isActive(g.kind) ? <><span class="live-dot" />{g.status} · {us.runs}-{opp.runs}</> : g.status}
          </a>
        </td>
      </tr>
    );
  };

  return (
    <div class="page team">
      <div class="team-head box">
        <TeamLogo id={id} size={64} />
        <div>
          <h1>{t?.name ?? `Team ${id}`}</h1>
          {rec && (
            <div class="muted">
              {rec.tr.wins}-{rec.tr.losses} ({rec.tr.winningPercentage}) · {ordinalRank(rec.tr.divisionRank)} in <a href={href.standings()}>{rec.div?.name}</a>
              {rec.tr.gamesBack && rec.tr.gamesBack !== '-' ? `, ${rec.tr.gamesBack} GB` : ''}
              {rec.tr.streak?.streakCode ? ` · Streak ${rec.tr.streak.streakCode}` : ''}
            </div>
          )}
        </div>
      </div>
      {sched.error && !sched.data && <ErrorBox error={sched.error} retry={sched.refresh} />}
      <div class="two-col">
        <div>
          <Section title="Upcoming" flush>
            {!sched.data ? <Loading /> : upcoming.length === 0 ? <div class="pad muted">No games scheduled in the next 10 days.</div> :
              <table class="stat"><tbody>{upcoming.map(row)}</tbody></table>}
          </Section>
          <Section title="Recent results" flush>
            {!sched.data ? <Loading /> : past.length === 0 ? <div class="pad muted">No recent games.</div> :
              <table class="stat"><tbody>{past.map(row)}</tbody></table>}
          </Section>
        </div>
        <Section title="Active roster" flush>
          {!roster.data ? <Loading /> : (
            <div class="roster-cols">
              <RosterTable title="Pitchers" list={pitchers} />
              <RosterTable title="Position players" list={hitters} />
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}

function RosterTable({ title, list }: { title: string; list: any[] }) {
  return (
    <table class="stat tight">
      <thead><tr><th class="name" colSpan={3}>{title}</th></tr></thead>
      <tbody>
        {list.map((p) => (
          <tr>
            <td class="muted num">{p.jerseyNumber}</td>
            <td class="name"><PlayerLink p={{ id: p.person.id, name: p.person.fullName }} full /></td>
            <td class="muted">{p.position?.abbreviation}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ordinalRank(r: string | undefined) {
  const n = Number(r);
  if (!n) return '';
  return n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`;
}
