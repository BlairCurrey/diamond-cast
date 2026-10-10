import { teamInfo, type TeamInfo } from '../../shared/teams';
import { gameKind, type GameKind } from './schedule';
import { halfLabel, lastName, ordinal } from './format';

// ---------------------------------------------------------------------------
// View models derived from the live game feed (/api/v1.1/game/{pk}/feed/live).
// Every function here is a pure function of the feed, so the same code renders
// a live game, a finished game, and a replay frozen at any timecode.
// ---------------------------------------------------------------------------

export interface P { id: number; name: string; short: string }

export function person(feed: any, id: number | undefined, fallbackName = ''): P | undefined {
  if (!id) return undefined;
  const p = feed?.gameData?.players?.[`ID${id}`];
  const name = p?.fullName ?? fallbackName;
  return { id, name, short: p?.lastName ? (p.useLastName ?? p.lastName) : lastName(name) };
}

function boxPlayer(feed: any, id: number | undefined): any {
  if (!id) return undefined;
  const t = feed?.liveData?.boxscore?.teams;
  return t?.away?.players?.[`ID${id}`] ?? t?.home?.players?.[`ID${id}`];
}

// --------------------------- header / teams --------------------------------

export interface GameTeam extends TeamInfo { runs: number; hits: number; errors: number; lob: number; record?: string }

export interface GameHeader {
  pk: number;
  kind: GameKind;
  detailed: string;
  away: GameTeam;
  home: GameTeam;
  start?: string;
  venue?: string;
  series?: string;
  seriesStatus?: string;
  weather?: string;
  date: string;
}

export function header(feed: any): GameHeader {
  const gd = feed?.gameData ?? {};
  const ls = feed?.liveData?.linescore ?? {};
  const mk = (side: 'away' | 'home'): GameTeam => {
    const t = gd.teams?.[side];
    const rec = t?.record?.leagueRecord ?? t?.record;
    return {
      ...teamInfo(t),
      runs: ls.teams?.[side]?.runs ?? 0,
      hits: ls.teams?.[side]?.hits ?? 0,
      errors: ls.teams?.[side]?.errors ?? 0,
      lob: ls.teams?.[side]?.leftOnBase ?? 0,
      record: rec?.wins !== undefined ? `${rec.wins}-${rec.losses}` : undefined,
    };
  };
  const w = gd.weather;
  const gt = gd.game?.type;
  return {
    pk: gd.game?.pk ?? feed?.gamePk,
    kind: gameKind(gd.status),
    detailed: gd.status?.detailedState ?? '',
    away: mk('away'),
    home: mk('home'),
    start: gd.datetime?.dateTime,
    venue: gd.venue?.name,
    series: gt && gt !== 'R' && gt !== 'S' ? [gd.game?.seriesDescription ?? '', gd.game?.seriesGameNumber ? `Game ${gd.game.seriesGameNumber}` : ''].filter(Boolean).join(' · ') : undefined,
    seriesStatus: gd.seriesStatus?.result,
    weather: w?.condition ? `${w.temp ? w.temp + '°, ' : ''}${w.condition}${w.wind ? ', wind ' + w.wind : ''}` : undefined,
    date: gd.datetime?.officialDate ?? '',
  };
}

// ------------------------------ linescore -----------------------------------

export interface LineInning { num: number; away?: number; home?: number }

export function linescore(feed: any): { innings: LineInning[]; current?: number; isTop?: boolean; scheduled: number } {
  const ls = feed?.liveData?.linescore ?? {};
  const scheduled = ls.scheduledInnings ?? 9;
  const innings: LineInning[] = [];
  const n = Math.max(scheduled, ls.innings?.length ?? 0);
  for (let i = 1; i <= n; i++) {
    const inn = ls.innings?.find((x: any) => x.num === i);
    innings.push({ num: i, away: inn?.away?.runs, home: inn?.home?.runs });
  }
  return { innings, current: ls.currentInning, isTop: ls.isTopInning, scheduled };
}

// ------------------------------ situation -----------------------------------

export interface Situation {
  inning: number;
  isTop: boolean;
  state: string;           // Top | Middle | Bottom | End
  isBreak: boolean;        // between halves
  label: string;           // "Top 7th", "Middle 7th"
  outs: number;
  balls: number;
  strikes: number;
  runners: { first?: P; second?: P; third?: P };
  batter?: P;
  onDeck?: P;
  inHole?: P;
  pitcher?: P;
  battingTeam?: TeamInfo;
  fieldingTeam?: TeamInfo;
}

export function situation(feed: any): Situation {
  const ls = feed?.liveData?.linescore ?? {};
  const cp = feed?.liveData?.plays?.currentPlay;
  const off = ls.offense ?? {};
  const state: string = ls.inningState ?? (ls.isTopInning ? 'Top' : 'Bottom');
  const isBreak = state === 'Middle' || state === 'End';
  // Count: prefer the current play's count (the linescore copy can lag a pitch).
  const count = cp && !cp.about?.isComplete ? cp.count : undefined;
  const isTop = !!ls.isTopInning;
  const teams = feed?.gameData?.teams ?? {};
  // During a break the linescore already describes the team coming up.
  const battingSide = isBreak ? (state === 'Middle' ? 'home' : 'away') : (isTop ? 'away' : 'home');
  const p = (x: any) => person(feed, x?.id, x?.fullName);
  return {
    inning: ls.currentInning ?? 0,
    isTop,
    state,
    isBreak,
    label: isBreak ? `${state} ${ordinal(ls.currentInning ?? 0)}` : halfLabel(isTop ? 'top' : 'bottom', ls.currentInning),
    outs: isBreak ? 0 : (count?.outs ?? ls.outs ?? 0),
    balls: isBreak ? 0 : (count?.balls ?? ls.balls ?? 0),
    strikes: isBreak ? 0 : (count?.strikes ?? ls.strikes ?? 0),
    runners: isBreak ? {} : { first: p(off.first), second: p(off.second), third: p(off.third) },
    batter: p(off.batter),
    onDeck: p(off.onDeck),
    inHole: p(off.inHole),
    pitcher: p(ls.defense?.pitcher),
    battingTeam: teams[battingSide] ? teamInfo(teams[battingSide]) : undefined,
    fieldingTeam: teams[battingSide === 'away' ? 'home' : 'away'] ? teamInfo(teams[battingSide === 'away' ? 'home' : 'away']) : undefined,
  };
}

// --------------------------- player game lines -------------------------------

/** "2-4, 2B, HR, 3 RBI, BB" */
export function batterToday(feed: any, id: number | undefined): string {
  const s = boxPlayer(feed, id)?.stats?.batting;
  if (!s || s.plateAppearances === 0 || (s.atBats === undefined && s.hits === undefined)) return '0-0';
  const parts = [`${s.hits ?? 0}-${s.atBats ?? 0}`];
  const add = (n: number | undefined, lbl: string) => { if (n) parts.push(n > 1 ? `${n} ${lbl}` : lbl); };
  add(s.doubles, '2B'); add(s.triples, '3B'); add(s.homeRuns, 'HR'); add(s.rbi, 'RBI');
  add(s.baseOnBalls, 'BB'); add(s.strikeOuts, 'K'); add(s.stolenBases, 'SB');
  return parts.join(', ');
}

export function batterSeason(feed: any, id: number | undefined): string {
  const s = boxPlayer(feed, id)?.seasonStats?.batting;
  if (!s) return '';
  return `${s.avg ?? '.---'} AVG, ${s.homeRuns ?? 0} HR, ${s.ops ?? '.---'} OPS`;
}

export function pitcherToday(feed: any, id: number | undefined): { line: string; pitches: number; strikes: number } {
  const s = boxPlayer(feed, id)?.stats?.pitching;
  if (!s) return { line: '', pitches: 0, strikes: 0 };
  const pitches = s.numberOfPitches ?? s.pitchesThrown ?? 0;
  return {
    line: `${s.inningsPitched ?? '0.0'} IP, ${s.hits ?? 0} H, ${s.earnedRuns ?? 0} ER, ${s.baseOnBalls ?? 0} BB, ${s.strikeOuts ?? 0} K`,
    pitches,
    strikes: s.strikes ?? 0,
  };
}

export function pitcherSeason(feed: any, id: number | undefined): string {
  const s = boxPlayer(feed, id)?.seasonStats?.pitching;
  if (!s) return '';
  return `${s.wins ?? 0}-${s.losses ?? 0}, ${s.era ?? '-.--'} ERA`;
}

export function handOf(feed: any, id: number | undefined, kind: 'bat' | 'pitch'): string {
  const p = feed?.gameData?.players?.[`ID${id}`];
  return (kind === 'bat' ? p?.batSide?.code : p?.pitchHand?.code) ?? '';
}

// ------------------------------- pitches ------------------------------------

export type PitchCls = 'ball' | 'strike' | 'inplay';

export interface PitchVM {
  n: number;
  type: string;            // "Slider"
  typeCode: string;        // "SL"
  mph?: number;
  call: string;            // "Swinging Strike"
  cls: PitchCls;
  count: string;           // count after the pitch, "1-2"
  px?: number;
  pz?: number;
  szTop?: number;
  szBot?: number;
  review?: string;         // "Challenged" | "Overturned" | "Upheld"
  spin?: number;
  ivb?: number;
  hb?: number;
}

export interface EventVM {
  kind: 'pitch' | 'action';
  pitch?: PitchVM;
  text?: string;           // action description
  eventType?: string;
}

const NOISE = new Set(['game_advisory', 'batter_timeout', 'mound_visit', 'pitcher_step_off']);

function reviewLabel(r: any): string | undefined {
  if (!r) return undefined;
  if (r.inProgress) return 'Challenged';
  if (r.isOverturned === true) return 'Overturned';
  if (r.isOverturned === false) return 'Upheld';
  return undefined;
}

export function pitchVM(e: any, play?: any, isFirstPitchFromEnd = false): PitchVM {
  const d = e.details ?? {};
  const cls: PitchCls = d.isInPlay ? 'inplay' : d.isBall ? 'ball' : 'strike';
  const c = e.pitchData?.coordinates ?? {};
  const pd = e.pitchData ?? {};
  // A challenge on the deciding pitch is sometimes recorded on the play rather than the pitch.
  const review = reviewLabel(e.reviewDetails) ?? (isFirstPitchFromEnd ? reviewLabel(play?.reviewDetails) : undefined);
  return {
    n: e.pitchNumber ?? 0,
    type: d.type?.description ?? (cls === 'ball' && /automatic/i.test(d.description ?? '') ? 'Automatic' : '—'),
    typeCode: d.type?.code ?? '',
    mph: pd.startSpeed,
    call: d.description ?? d.call?.description ?? '',
    cls,
    count: `${e.count?.balls ?? 0}-${e.count?.strikes ?? 0}`,
    px: c.pX,
    pz: c.pZ,
    szTop: pd.strikeZoneTop,
    szBot: pd.strikeZoneBottom,
    review,
    spin: pd.breaks?.spinRate,
    ivb: pd.breaks?.breakVerticalInduced,
    hb: pd.breaks?.breakHorizontal,
  };
}

export function eventsOf(play: any): EventVM[] {
  const evs: any[] = play?.playEvents ?? [];
  const lastPitchIdx = evs.map((e) => e.isPitch).lastIndexOf(true);
  const out: EventVM[] = [];
  evs.forEach((e, i) => {
    if (e.isPitch) out.push({ kind: 'pitch', pitch: pitchVM(e, play, i === lastPitchIdx) });
    else if (e.type === 'action' && !NOISE.has(e.details?.eventType) && e.details?.description) {
      out.push({ kind: 'action', text: e.details.description, eventType: e.details.eventType });
    }
  });
  return out;
}

export interface HitVM { ev?: number; la?: number; dist?: number; traj?: string; x?: number; y?: number; hardness?: string }

export function hitOf(play: any): HitVM | undefined {
  const e = [...(play?.playEvents ?? [])].reverse().find((x: any) => x.hitData);
  const h = e?.hitData;
  if (!h) return undefined;
  return {
    ev: h.launchSpeed, la: h.launchAngle, dist: h.totalDistance,
    traj: h.trajectory?.replace(/_/g, ' '), hardness: h.hardness,
    x: h.coordinates?.coordX, y: h.coordinates?.coordY,
  };
}

// ------------------------------ the at-bat ----------------------------------

export interface AtBatVM {
  batter?: P;
  pitcher?: P;
  bats: string;
  throws: string;
  events: EventVM[];
  pitches: PitchVM[];
  complete: boolean;
  result?: string;
  tag?: Tag;
  hit?: HitVM;
  szTop: number;
  szBot: number;
  menOn?: string;
}

export function atBat(feed: any, play = feed?.liveData?.plays?.currentPlay): AtBatVM | undefined {
  if (!play) return undefined;
  const events = eventsOf(play);
  const pitches = events.filter((e) => e.kind === 'pitch').map((e) => e.pitch!);
  const last = pitches[pitches.length - 1];
  const complete = !!play.about?.isComplete;
  return {
    batter: person(feed, play.matchup?.batter?.id, play.matchup?.batter?.fullName),
    pitcher: person(feed, play.matchup?.pitcher?.id, play.matchup?.pitcher?.fullName),
    bats: play.matchup?.batSide?.code ?? '',
    throws: play.matchup?.pitchHand?.code ?? '',
    events,
    pitches,
    complete,
    result: complete ? play.result?.description : undefined,
    tag: complete ? tagFor(play) : undefined,
    hit: hitOf(play),
    szTop: last?.szTop ?? 3.4,
    szBot: last?.szBot ?? 1.6,
    menOn: play.matchup?.splits?.menOnBase,
  };
}

// ------------------------------- outcome tags --------------------------------

export type TagCls = 'hit' | 'hr' | 'out' | 'k' | 'walk' | 'run' | 'other';
export interface Tag { code: string; cls: TagCls; label: string }

const TAGS: Record<string, [string, TagCls]> = {
  'Single': ['1B', 'hit'], 'Double': ['2B', 'hit'], 'Triple': ['3B', 'hit'], 'Home Run': ['HR', 'hr'],
  'Walk': ['BB', 'walk'], 'Intent Walk': ['IBB', 'walk'], 'Hit By Pitch': ['HBP', 'walk'], 'Catcher Interference': ['CI', 'walk'],
  'Strikeout': ['K', 'k'], 'Strikeout Double Play': ['K DP', 'k'], 'Strikeout Triple Play': ['K TP', 'k'],
  'Groundout': ['GO', 'out'], 'Bunt Groundout': ['GO', 'out'], 'Flyout': ['FO', 'out'], 'Lineout': ['LO', 'out'],
  'Bunt Lineout': ['LO', 'out'], 'Pop Out': ['PO', 'out'], 'Bunt Pop Out': ['PO', 'out'], 'Forceout': ['FC', 'out'],
  'Fielders Choice': ['FC', 'other'], 'Fielders Choice Out': ['FC', 'out'], 'Grounded Into DP': ['GIDP', 'out'],
  'Double Play': ['DP', 'out'], 'Triple Play': ['TP', 'out'], 'Sac Fly': ['SF', 'out'], 'Sac Bunt': ['SAC', 'out'],
  'Sac Fly Double Play': ['SF DP', 'out'], 'Sac Bunt Double Play': ['SAC DP', 'out'],
  'Field Error': ['E', 'other'], 'Fan Interference': ['FI', 'other'],
};

export function tagFor(play: any): Tag {
  const ev: string = play?.result?.event ?? '';
  let t = TAGS[ev];
  if (!t) {
    if (/caught stealing/i.test(ev)) t = ['CS', 'out'];
    else if (/pickoff/i.test(ev)) t = ['PK', 'out'];
    else if (/stolen base/i.test(ev)) t = ['SB', 'other'];
    else if (/wild pitch|passed ball|balk/i.test(ev)) t = [ev.split(' ').map((w) => w[0]).join(''), 'other'];
    else t = [ev ? ev.slice(0, 3).toUpperCase() : '—', play?.result?.isOut ? 'out' : 'other'];
  }
  return { code: t[0], cls: t[1], label: ev };
}

// ------------------------------- headline -----------------------------------

export interface Headline {
  text: string;
  kind: 'pitch' | 'result' | 'action' | 'break' | 'status' | 'batter';
  pitchCls?: PitchCls;
  tag?: Tag;
  scoring?: boolean;
  time?: string;
}

/** The single most recent thing that happened, as one sentence. */
export function headline(feed: any): Headline {
  const h = header(feed);
  const plays = feed?.liveData?.plays;
  const cp = plays?.currentPlay;
  if (h.kind === 'final') {
    const w = h.away.runs > h.home.runs ? h.away : h.home;
    const l = w === h.away ? h.home : h.away;
    return { text: `Final: ${w.club} ${Math.max(h.away.runs, h.home.runs)}, ${l.club} ${Math.min(h.away.runs, h.home.runs)}.`, kind: 'status' };
  }
  if (h.kind === 'preview' || h.kind === 'warmup' || !cp) {
    return { text: h.detailed || 'Scheduled', kind: 'status' };
  }
  const sit = situation(feed);
  if (cp.about?.isComplete) {
    return { text: cp.result?.description ?? '', kind: 'result', tag: tagFor(cp), scoring: cp.about?.isScoringPlay, time: cp.about?.endTime };
  }
  if (sit.isBreak) {
    return { text: `${sit.label}. ${sit.battingTeam?.club ?? ''} coming up.`, kind: 'break' };
  }
  const evs: any[] = (cp.playEvents ?? []).filter((e: any) => e.isPitch || (e.type === 'action' && !NOISE.has(e.details?.eventType)));
  const last = evs[evs.length - 1];
  if (!last) {
    const b = person(feed, cp.matchup?.batter?.id, cp.matchup?.batter?.fullName);
    return { text: `Now batting: ${b?.name ?? ''}.`, kind: 'batter' };
  }
  if (last.isPitch) {
    const p = pitchVM(last, cp);
    const speed = p.mph ? `, ${p.mph.toFixed(1)} mph` : '';
    const count = p.cls === 'inplay' ? '' : ` Count ${p.count}.`;
    const rev = p.review ? ` (${p.review})` : '';
    return { text: `Pitch ${p.n}: ${p.type}${speed} — ${p.call}${rev}.${count}`, kind: 'pitch', pitchCls: p.cls, time: last.endTime };
  }
  return { text: last.details?.description ?? '', kind: 'action', scoring: last.details?.isScoringPlay, time: last.endTime };
}

/** The most recent completed plate appearance (for "Previous:" under the headline). */
export function previousPlay(feed: any): { text: string; tag: Tag; scoring: boolean; score?: string } | undefined {
  const all: any[] = feed?.liveData?.plays?.allPlays ?? [];
  const cp = feed?.liveData?.plays?.currentPlay;
  for (let i = all.length - 1; i >= 0; i--) {
    const p = all[i];
    if (!p.about?.isComplete) continue;
    if (cp && p.about.atBatIndex === cp.about?.atBatIndex) continue; // already the headline
    const h = header(feed);
    return {
      text: p.result?.description ?? '',
      tag: tagFor(p),
      scoring: !!p.about?.isScoringPlay,
      score: p.about?.isScoringPlay ? `${h.away.abbr} ${p.result.awayScore}, ${h.home.abbr} ${p.result.homeScore}` : undefined,
    };
  }
  return undefined;
}

// ------------------------------- play log -----------------------------------

export interface LogPA {
  idx: number;
  batter?: P;
  pitcher?: P;
  text: string;
  tag: Tag;
  scoring: boolean;
  rbi: number;
  awayScore: number;
  homeScore: number;
  outs: number;
  outRecorded: boolean;
  pitchCount: number;
  actions: { text: string; eventType?: string }[];
  complete: boolean;
}

export interface LogHalf {
  key: string;
  inning: number;
  isTop: boolean;
  label: string;
  team?: TeamInfo;
  pas: LogPA[];
  complete: boolean;
  summary?: { runs: number; hits: number; errors: number; lob: number; away: number; home: number };
}

export function playLog(feed: any, opts: { includeCurrent?: boolean } = {}): LogHalf[] {
  const plays: any[] = feed?.liveData?.plays?.allPlays ?? [];
  const ls = feed?.liveData?.linescore ?? {};
  const teams = feed?.gameData?.teams ?? {};
  const final = feed?.gameData?.status?.abstractGameState === 'Final';
  const halves: LogHalf[] = [];
  for (const p of plays) {
    const complete = !!p.about?.isComplete;
    if (!complete && !opts.includeCurrent) {
      // Still surface substitutions etc. that happened before the current at-bat finishes? They show in the at-bat panel.
      continue;
    }
    const inning = p.about?.inning ?? 0;
    const isTop = !!p.about?.isTopInning;
    const key = `${inning}${isTop ? 't' : 'b'}`;
    let h = halves[halves.length - 1];
    if (!h || h.key !== key) {
      h = { key, inning, isTop, label: halfLabel(isTop ? 'top' : 'bottom', inning), team: teams[isTop ? 'away' : 'home'] ? teamInfo(teams[isTop ? 'away' : 'home']) : undefined, pas: [], complete: false };
      halves.push(h);
    }
    const actions = (p.playEvents ?? [])
      .filter((e: any) => e.type === 'action' && !NOISE.has(e.details?.eventType) && e.details?.description)
      .map((e: any) => ({ text: e.details.description, eventType: e.details.eventType }));
    h.pas.push({
      idx: p.about?.atBatIndex,
      batter: person(feed, p.matchup?.batter?.id, p.matchup?.batter?.fullName),
      pitcher: person(feed, p.matchup?.pitcher?.id, p.matchup?.pitcher?.fullName),
      text: p.result?.description ?? '',
      tag: tagFor(p),
      scoring: !!p.about?.isScoringPlay,
      rbi: p.result?.rbi ?? 0,
      awayScore: p.result?.awayScore ?? 0,
      homeScore: p.result?.homeScore ?? 0,
      outs: p.count?.outs ?? 0,
      outRecorded: !!p.about?.hasOut,
      pitchCount: (p.playEvents ?? []).filter((e: any) => e.isPitch).length,
      actions,
      complete,
    });
  }
  // Half-inning summaries for halves that are over.
  const curKey = `${ls.currentInning}${ls.isTopInning ? 't' : 'b'}`;
  const curState = ls.inningState;
  halves.forEach((h, i) => {
    const later = i < halves.length - 1;
    const overNow = h.key === curKey && (curState === 'Middle' || curState === 'End');
    h.complete = later || overNow || final || (h.pas[h.pas.length - 1]?.outs ?? 0) >= 3;
    if (!h.complete) return;
    const inn = ls.innings?.find((x: any) => x.num === h.inning);
    const bat = h.isTop ? inn?.away : inn?.home;
    const fld = h.isTop ? inn?.home : inn?.away;
    const last = h.pas[h.pas.length - 1];
    h.summary = {
      runs: bat?.runs ?? 0, hits: bat?.hits ?? 0, errors: fld?.errors ?? 0, lob: bat?.leftOnBase ?? 0,
      away: last?.awayScore ?? 0, home: last?.homeScore ?? 0,
    };
  });
  return halves;
}

export function playByIndex(feed: any, idx: number): any {
  return (feed?.liveData?.plays?.allPlays ?? []).find((p: any) => p.about?.atBatIndex === idx);
}

// ------------------------- pitchers used today -------------------------------

export interface PitcherRow { p: P; ip: string; h: number; r: number; er: number; bb: number; k: number; pc: number; current: boolean; note?: string }

export function pitchersToday(feed: any, side: 'away' | 'home'): PitcherRow[] {
  const t = feed?.liveData?.boxscore?.teams?.[side];
  const cur = feed?.liveData?.linescore?.defense?.pitcher?.id;
  return (t?.pitchers ?? []).map((id: number) => {
    const pl = t.players?.[`ID${id}`];
    const s = pl?.stats?.pitching ?? {};
    return {
      p: person(feed, id, pl?.person?.fullName)!,
      ip: s.inningsPitched ?? '0.0', h: s.hits ?? 0, r: s.runs ?? 0, er: s.earnedRuns ?? 0,
      bb: s.baseOnBalls ?? 0, k: s.strikeOuts ?? 0, pc: s.numberOfPitches ?? s.pitchesThrown ?? 0,
      current: id === cur && feed?.gameData?.status?.abstractGameState === 'Live',
      note: s.note,
    };
  });
}

// ------------------------------ win probability ------------------------------

export interface WPPoint { idx: number; home: number; added: number; inning: number; isTop: boolean; li?: number }

export function wpSeries(wp: any[] | undefined, maxIdx = Infinity): WPPoint[] {
  return (wp ?? [])
    .filter((x) => x.atBatIndex <= maxIdx && typeof x.homeTeamWinProbability === 'number')
    .map((x) => ({
      idx: x.atBatIndex,
      home: x.homeTeamWinProbability,
      added: x.homeTeamWinProbabilityAdded ?? 0,
      inning: x.about?.inning ?? 0,
      isTop: x.about?.halfInning === 'top',
      li: x.leverageIndex,
    }));
}

/** Biggest swings in win probability, joined with play descriptions. */
export function keyPlays(feed: any, wp: WPPoint[], n = 3) {
  return [...wp]
    .sort((a, b) => Math.abs(b.added) - Math.abs(a.added))
    .slice(0, n)
    .map((w) => {
      const p = playByIndex(feed, w.idx);
      return { w, text: p?.result?.description ?? '', tag: tagFor(p), label: halfLabel(p?.about?.halfInning, p?.about?.inning, true), batter: person(feed, p?.matchup?.batter?.id) };
    });
}

export function scoringPlays(feed: any) {
  const all: any[] = feed?.liveData?.plays?.allPlays ?? [];
  const idx: number[] = feed?.liveData?.plays?.scoringPlays ?? all.filter((p) => p.about?.isScoringPlay).map((p) => p.about.atBatIndex);
  return idx.map((i) => all.find((p) => p.about?.atBatIndex === i)).filter(Boolean).map((p: any) => ({
    idx: p.about.atBatIndex,
    label: halfLabel(p.about.halfInning, p.about.inning, true),
    isTop: p.about.isTopInning,
    text: p.result?.description ?? '',
    away: p.result?.awayScore ?? 0,
    home: p.result?.homeScore ?? 0,
    tag: tagFor(p),
  }));
}

export function decisions(feed: any) {
  const d = feed?.liveData?.decisions ?? {};
  const line = (x: any) => {
    if (!x?.id) return undefined;
    const note = boxPlayer(feed, x.id)?.stats?.pitching?.note;
    return { p: person(feed, x.id, x.fullName)!, note: note ? String(note).replace(/[()]/g, '') : undefined };
  };
  return { winner: line(d.winner), loser: line(d.loser), save: line(d.save) };
}
