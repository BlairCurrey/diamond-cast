import { teamInfo, type TeamInfo } from '../../shared/teams';
import { fmtTime, ordinal } from './format';

// View model for one game on the scoreboard (built from a /schedule game object).

export type GameKind = 'preview' | 'warmup' | 'live' | 'final' | 'postponed' | 'suspended' | 'delayed';

export interface Ref { id: number; name: string }

export interface SbTeam extends TeamInfo {
  record?: string;
  runs?: number;
  hits?: number;
  errors?: number;
  winner?: boolean;
  probable?: Ref;
}

export interface SbGame {
  pk: number;
  kind: GameKind;
  status: string;          // short status line: "Final", "Top 7th", "7:08 PM"
  detailed: string;
  date: string;            // officialDate
  time: string;
  away: SbTeam;
  home: SbTeam;
  inning?: number;
  isTop?: boolean;
  inningState?: string;
  outs?: number;
  balls?: number;
  strikes?: number;
  bases: [boolean, boolean, boolean];
  batter?: Ref;
  pitcher?: Ref;
  winner?: Ref; loser?: Ref; save?: Ref;
  series?: string;         // "ALCS · Game 4"
  seriesStatus?: string;   // "CLE leads 2-1"
  tv?: string;
  venue?: string;
  note?: string;           // postponement reason, doubleheader, extra innings
  innings: { away?: number; home?: number }[];
  scheduledInnings: number;
}

export function gameKind(status: any): GameKind {
  const a = status?.abstractGameState;
  const d: string = status?.detailedState ?? '';
  const c: string = status?.codedGameState ?? '';
  if (/postponed|cancel/i.test(d) || c === 'D' || c === 'C') return 'postponed';
  if (/suspended/i.test(d) || c === 'T' || c === 'U') return 'suspended';
  if (a === 'Final') return 'final';
  if (a === 'Live') {
    if (/warmup/i.test(d)) return 'warmup';
    if (/delay/i.test(d) && !/in progress/i.test(d)) return 'delayed';
    return 'live';
  }
  return 'preview';
}

const ref = (p: any): Ref | undefined => (p?.id ? { id: p.id, name: p.fullName ?? '' } : undefined);

export function sbGame(g: any): SbGame {
  const kind = gameKind(g.status);
  const ls = g.linescore ?? {};
  const mk = (side: 'away' | 'home'): SbTeam => {
    const t = g.teams?.[side] ?? {};
    const lr = t.leagueRecord;
    return {
      ...teamInfo(t.team),
      record: lr ? `${lr.wins}-${lr.losses}` : undefined,
      runs: ls.teams?.[side]?.runs ?? t.score,
      hits: ls.teams?.[side]?.hits,
      errors: ls.teams?.[side]?.errors,
      winner: t.isWinner,
      probable: ref(t.probablePitcher),
    };
  };
  const off = ls.offense ?? {};
  const isTop = ls.isTopInning ?? ls.inningHalf === 'Top';
  let status = g.status?.detailedState ?? '';
  const time = fmtTime(g.gameDate);
  if (kind === 'preview') status = g.status?.startTimeTBD ? 'Time TBD' : time;
  if (kind === 'final') {
    status = g.status?.detailedState === 'Final' || g.status?.detailedState === 'Game Over' ? 'Final' : g.status?.detailedState;
    const n = ls.currentInning;
    if (n && n !== (ls.scheduledInnings ?? 9)) status += `/${n}`;
  }
  if (kind === 'live' || kind === 'delayed') {
    const st = ls.inningState ?? (isTop ? 'Top' : 'Bottom');
    const lbl = st === 'Middle' ? 'Mid' : st === 'Bottom' ? 'Bot' : st;
    status = ls.currentInning ? `${lbl} ${ordinal(ls.currentInning)}` : 'In Progress';
    if (kind === 'delayed') status = `${g.status?.detailedState} · ${status}`;
  }
  if (kind === 'postponed' || kind === 'suspended') status = g.status?.detailedState ?? 'Postponed';

  const tvs = (g.broadcasts ?? []).filter((b: any) => b.type === 'TV' && (!b.language || b.language === 'en'));
  const national = tvs.filter((b: any) => b.isNational);
  const tvNames: string[] = Array.from(new Set((national.length ? national : tvs).map((b: any) => b.callSign || b.name)));

  const series = g.gameType && g.gameType !== 'R' && g.gameType !== 'S' && g.gameType !== 'E'
    ? [g.seriesStatus?.shortDescription ?? g.seriesDescription, g.seriesGameNumber ? `Game ${g.seriesGameNumber}` : '']
      .filter(Boolean).join(' · ')
    : undefined;

  let note: string | undefined;
  if (g.status?.reason) note = g.status.reason;
  else if (g.doubleHeader && g.doubleHeader !== 'N') note = `Game ${g.gameNumber} of doubleheader`;

  return {
    pk: g.gamePk,
    kind,
    status,
    detailed: g.status?.detailedState ?? '',
    date: g.officialDate,
    time,
    away: mk('away'),
    home: mk('home'),
    inning: ls.currentInning,
    isTop,
    inningState: ls.inningState,
    outs: ls.outs,
    balls: ls.balls,
    strikes: ls.strikes,
    bases: [!!off.first, !!off.second, !!off.third],
    batter: ref(off.batter),
    pitcher: ref(ls.defense?.pitcher),
    winner: ref(g.decisions?.winner),
    loser: ref(g.decisions?.loser),
    save: ref(g.decisions?.save),
    series,
    seriesStatus: g.seriesStatus?.result,
    tv: tvNames.slice(0, 3).join(', ') || undefined,
    venue: g.venue?.name,
    note,
    innings: (ls.innings ?? []).map((i: any) => ({ away: i.away?.runs, home: i.home?.runs })),
    scheduledInnings: ls.scheduledInnings ?? 9,
  };
}

export const isActive = (k: GameKind) => k === 'live' || k === 'delayed' || k === 'warmup';
