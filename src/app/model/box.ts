import { person, type P } from './game';

// Classic box score from liveData.boxscore (+ names from gameData.players).

export interface BatRow {
  p: P; pos: string; sub: boolean; note?: string;
  ab: number; r: number; h: number; rbi: number; bb: number; k: number; lob: number;
  avg: string; ops: string; current: boolean;
}
export interface PitRow {
  p: P; note?: string;
  ip: string; h: number; r: number; er: number; bb: number; k: number; hr: number; pc: number; st: number;
  era: string; current: boolean;
}
export interface InfoBlock { title: string; items: { label: string; value: string }[] }

export interface TeamBox {
  batting: BatRow[];
  battingTotals: { ab: number; r: number; h: number; rbi: number; bb: number; k: number; lob: number };
  notes: string[];
  info: InfoBlock[];
  pitching: PitRow[];
  pitchingTotals: { ip: string; h: number; r: number; er: number; bb: number; k: number; hr: number; pc: number; st: number };
}

export function teamBox(feed: any, side: 'away' | 'home'): TeamBox {
  const t = feed?.liveData?.boxscore?.teams?.[side] ?? {};
  const players = t.players ?? {};
  const live = feed?.gameData?.status?.abstractGameState === 'Live';

  const batIds: number[] = (t.batters ?? []).filter((id: number) => players[`ID${id}`]?.battingOrder);
  const batting: BatRow[] = batIds
    .map((id) => players[`ID${id}`])
    .sort((a: any, b: any) => Number(a.battingOrder) - Number(b.battingOrder))
    .map((pl: any) => {
      const s = pl.stats?.batting ?? {};
      const ss = pl.seasonStats?.batting ?? {};
      const pos = (pl.allPositions ?? [pl.position]).filter(Boolean).map((x: any) => x.abbreviation).join('-');
      return {
        p: person(feed, pl.person?.id, pl.person?.fullName)!,
        pos,
        sub: Number(pl.battingOrder) % 100 !== 0,
        note: s.note,
        ab: s.atBats ?? 0, r: s.runs ?? 0, h: s.hits ?? 0, rbi: s.rbi ?? 0,
        bb: s.baseOnBalls ?? 0, k: s.strikeOuts ?? 0, lob: s.leftOnBase ?? 0,
        avg: ss.avg ?? '', ops: ss.ops ?? '',
        current: live && !!pl.gameStatus?.isCurrentBatter,
      };
    });

  const tb = t.teamStats?.batting ?? {};
  const tp = t.teamStats?.pitching ?? {};

  const pitching: PitRow[] = (t.pitchers ?? []).map((id: number) => {
    const pl = players[`ID${id}`] ?? {};
    const s = pl.stats?.pitching ?? {};
    const ss = pl.seasonStats?.pitching ?? {};
    return {
      p: person(feed, id, pl.person?.fullName)!,
      note: s.note,
      ip: s.inningsPitched ?? '0.0', h: s.hits ?? 0, r: s.runs ?? 0, er: s.earnedRuns ?? 0,
      bb: s.baseOnBalls ?? 0, k: s.strikeOuts ?? 0, hr: s.homeRuns ?? 0,
      pc: s.numberOfPitches ?? s.pitchesThrown ?? 0, st: s.strikes ?? 0,
      era: ss.era ?? '',
      current: live && !!pl.gameStatus?.isCurrentPitcher,
    };
  });

  return {
    batting,
    battingTotals: {
      ab: tb.atBats ?? sum(batting, 'ab'), r: tb.runs ?? sum(batting, 'r'), h: tb.hits ?? sum(batting, 'h'),
      rbi: tb.rbi ?? sum(batting, 'rbi'), bb: tb.baseOnBalls ?? sum(batting, 'bb'), k: tb.strikeOuts ?? sum(batting, 'k'),
      lob: tb.leftOnBase ?? sum(batting, 'lob'),
    },
    notes: (t.note ?? []).map((n: any) => `${n.label}-${n.value}`.replace(/^-/, '')),
    info: (t.info ?? []).map((b: any) => ({
      title: b.title ?? '',
      items: (b.fieldList ?? []).map((f: any) => ({ label: f.label ?? '', value: f.value ?? '' })),
    })),
    pitching,
    pitchingTotals: {
      ip: tp.inningsPitched ?? '', h: tp.hits ?? sum(pitching, 'h'), r: tp.runs ?? sum(pitching, 'r'),
      er: tp.earnedRuns ?? sum(pitching, 'er'), bb: tp.baseOnBalls ?? sum(pitching, 'bb'),
      k: tp.strikeOuts ?? sum(pitching, 'k'), hr: tp.homeRuns ?? sum(pitching, 'hr'),
      pc: tp.numberOfPitches ?? sum(pitching, 'pc'), st: tp.strikes ?? sum(pitching, 'st'),
    },
  };
}

function sum<T>(rows: T[], k: keyof T): number {
  return rows.reduce((a, r) => a + (Number(r[k]) || 0), 0);
}

/** Game-level notes: "WP: ...", "Umpires: ...", "T: 2:58", "Att: 41,322", "Weather: ...". */
export function gameInfo(feed: any): { label: string; value: string }[] {
  return (feed?.liveData?.boxscore?.info ?? [])
    .filter((i: any) => i.label)
    .map((i: any) => ({ label: i.label, value: (i.value ?? '').replace(/\.$/, '') }));
}

/** Posted lineup (batting order ids) for previews. */
export function lineup(feed: any, side: 'away' | 'home'): { p: P; pos: string; bats: string }[] {
  const t = feed?.liveData?.boxscore?.teams?.[side];
  return (t?.battingOrder ?? []).map((id: number) => {
    const pl = t.players?.[`ID${id}`];
    return {
      p: person(feed, id, pl?.person?.fullName)!,
      pos: pl?.position?.abbreviation ?? '',
      bats: feed?.gameData?.players?.[`ID${id}`]?.batSide?.code ?? '',
    };
  });
}
