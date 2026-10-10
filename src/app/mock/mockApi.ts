// ---------------------------------------------------------------------------
// Synthetic MLB Stats API (enabled with ?mock in the URL).
//
// Generates a full slate of fictional games and simulates them pitch by pitch,
// producing responses shaped like the real endpoints (schedule, feed/live with
// timecode, winProbability, people, standings, roster). Live games advance in
// real time, so the gamecast can be developed and demoed in the offseason.
// Player names are invented; teams are real only so logos/colors render.
// ---------------------------------------------------------------------------

import { TEAMS, DIVISIONS } from '../../shared/teams';
import { addDays, baseballToday, toTimecode, ymd, parseYmd } from '../model/format';

// ----------------------------- utilities ------------------------------------

function rngFrom(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
type Rng = () => number;
const hash = (s: string) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
const pick = <T,>(r: Rng, a: T[]) => a[Math.floor(r() * a.length)];
/** Deterministic Fisher-Yates (a random sort comparator is engine-dependent). */
const shuffle = <T,>(r: Rng, a: T[]): T[] => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const between = (r: Rng, lo: number, hi: number) => lo + (hi - lo) * r();
const gauss = (r: Rng) => { let u = 0; for (let i = 0; i < 6; i++) u += r(); return u - 3; };
const round = (n: number, d = 1) => Math.round(n * 10 ** d) / 10 ** d;
const ip = (outs: number) => `${Math.floor(outs / 3)}.${outs % 3}`;
const avgStr = (x: number) => (x >= 1 ? x.toFixed(3) : x.toFixed(3).slice(1));

const FIRST = ['Alex', 'Ben', 'Carlos', 'Danny', 'Eli', 'Felix', 'Gabe', 'Hank', 'Ivan', 'Jake', 'Kyle', 'Luis', 'Matt', 'Nico', 'Owen', 'Pete', 'Quinn', 'Rafael', 'Sam', 'Tyler', 'Victor', 'Wes', 'Xavier', 'Yuki', 'Zach', 'Andrés', 'Bryce', 'Cole', 'Dom', 'Evan', 'Gus', 'Jonah', 'Marco', 'Noah', 'Reid', 'Tomás', 'Brody', 'Cal', 'Joaquín', 'Miles'];
const LAST = ['Abbott', 'Barela', 'Calloway', 'Dunmore', 'Escobedo', 'Fairbanks', 'Garrison', 'Holloway', 'Ibarra', 'Jennings', 'Kowalski', 'Lindqvist', 'Merriweather', 'Navarro', 'Okafor', 'Pruitt', 'Quintero', 'Rasmus', 'Sandoval', 'Thibodeaux', 'Underhill', 'Valdés', 'Whitlock', 'Yarbrough', 'Zamora', 'Ashby', 'Brandt', 'Castellano', 'Delacroix', 'Ellison', 'Fontaine', 'Greer', 'Hadley', 'Iglesias', 'Kemper', 'Lockwood', 'Mancuso', 'Northcutt', 'Orozco', 'Pemberton', 'Rourke', 'Stroud', 'Tanaka', 'Voss', 'Wakefield', 'Yates', 'Albright', 'Beckham', 'Cordero', 'Dwyer', 'Espada', 'Gallo', 'Hollis', 'Mejía', 'Paddock', 'Renteria', 'Sorensen', 'Tolliver', 'Uribe', 'Vance'];
const POS = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'];
const POS_CODE: Record<string, string> = { P: '1', C: '2', '1B': '3', '2B': '4', '3B': '5', SS: '6', LF: '7', CF: '8', RF: '9', DH: '10' };
const POS_NAME: Record<string, string> = { P: 'pitcher', C: 'catcher', '1B': 'first baseman', '2B': 'second baseman', '3B': 'third baseman', SS: 'shortstop', LF: 'left fielder', CF: 'center fielder', RF: 'right fielder' };
const PITCHES: [string, string, number, number][] = [
  ['FF', 'Four-Seam Fastball', 93, 99], ['SI', 'Sinker', 92, 97], ['SL', 'Slider', 83, 89], ['ST', 'Sweeper', 81, 86],
  ['CU', 'Curveball', 76, 82], ['CH', 'Changeup', 84, 89], ['FC', 'Cutter', 88, 93], ['FS', 'Splitter', 85, 90],
];

// ------------------------------ rosters --------------------------------------

interface MPlayer { id: number; fullName: string; first: string; last: string; pos: string; bats: string; throws: string; num: number; avg: number; ops: number; hr: number; era: number; w: number; l: number; rep: number[]; sz: [number, number] }

const rosterCache = new Map<number, { hitters: MPlayer[]; pitchers: MPlayer[] }>();
function roster(teamId: number) {
  let r = rosterCache.get(teamId);
  if (r) return r;
  const g = rngFrom(teamId * 7919);
  const used = new Set<string>();
  const mk = (k: number, pos: string): MPlayer => {
    let first: string, last: string;
    do { first = pick(g, FIRST); last = pick(g, LAST); } while (used.has(last));
    used.add(last);
    const isP = pos === 'P';
    const rep = isP ? shuffle(g, [0, 1, 2, 3, 4, 5, 6, 7]).slice(0, 3 + Math.floor(g() * 2)) : [];
    if (isP && !rep.includes(0) && !rep.includes(1)) rep[0] = g() < 0.6 ? 0 : 1;
    const avg = between(g, 0.215, 0.305);
    return {
      id: teamId * 1000 + k, fullName: `${first} ${last}`, first, last, pos,
      bats: pick(g, ['R', 'R', 'L', 'L', 'S']), throws: pick(g, ['R', 'R', 'R', 'L']), num: 1 + Math.floor(g() * 98),
      avg, ops: avg * 2.6 + between(g, -0.05, 0.08), hr: Math.floor(between(g, 3, 38)),
      era: between(g, 2.4, 5.2), w: Math.floor(between(g, 2, 16)), l: Math.floor(between(g, 2, 12)), rep,
      sz: [round(between(g, 3.2, 3.55), 3), round(between(g, 1.5, 1.68), 3)],
    };
  };
  const hitters = POS.map((p, i) => mk(i + 1, p)).concat([mk(10, 'C'), mk(11, 'SS'), mk(12, 'LF'), mk(13, '1B')]);
  const pitchers = Array.from({ length: 13 }, (_, i) => mk(20 + i, 'P'));
  r = { hitters, pitchers };
  rosterCache.set(teamId, r);
  return r;
}
const playerById = (id: number): MPlayer | undefined => {
  const t = roster(Math.floor(id / 1000));
  return [...t.hitters, ...t.pitchers].find((p) => p.id === id);
};

// ------------------------------- slate ---------------------------------------

interface GameDef { pk: number; date: string; away: number; home: number; start: number; postponed?: boolean; seed: number; starters: [number, number] }

const slateCache = new Map<string, GameDef[]>();
function slate(date: string): GameDef[] {
  const hit = slateCache.get(date);
  if (hit) return hit;
  const r = rngFrom(hash(date));
  const ids = shuffle(r, Object.keys(TEAMS).map(Number));
  const today = baseballToday();
  const d0 = parseYmd(date); d0.setHours(0, 0, 0, 0);
  const now = Date.now();
  const games: GameDef[] = [];
  for (let i = 0; i < ids.length; i += 2) {
    const k = i / 2;
    let start: number;
    if (date === today) {
      // A spread around "now": 4 finished, 3 in progress, the rest later tonight.
      const offsetsMin = [-330, -300, -280, -250, -150, -95, -38, 25, 45, 70, 95, 120, 150, 180, 210];
      start = now + offsetsMin[k] * 60_000;
    } else {
      start = d0.getTime() + (13 + (k % 8) * 0.75 + (k > 7 ? 5 : 0)) * 3_600_000 + 5 * 60_000;
    }
    const starters: [number, number] = [20 + Math.floor(r() * 5), 20 + Math.floor(r() * 5)];
    games.push({
      pk: 900000 + (hash(date) % 50000) * 20 + k, date, away: ids[i], home: ids[i + 1], start,
      postponed: date === today && k === 14, seed: hash(`${date}-${k}`), starters,
    });
  }
  games.sort((a, b) => a.start - b.start);
  slateCache.set(date, games);
  return games;
}
function gameByPk(pk: number): GameDef | undefined {
  for (const g of slateCache.values()) { const f = g.find((x) => x.pk === pk); if (f) return f; }
  const today = baseballToday();
  for (let i = -7; i <= 7; i++) { const f = slate(addDays(today, i)).find((x) => x.pk === pk); if (f) return f; }
  return undefined;
}

// ---------------------------- the simulator ----------------------------------

interface Line { pa: number; ab: number; h: number; d: number; t: number; hr: number; rbi: number; r: number; bb: number; k: number; lob: number; sb: number; sf: number }
interface PLine { bf: number; outs: number; h: number; r: number; er: number; bb: number; k: number; hr: number; pc: number; st: number }
const newLine = (): Line => ({ pa: 0, ab: 0, h: 0, d: 0, t: 0, hr: 0, rbi: 0, r: 0, bb: 0, k: 0, lob: 0, sb: 0, sf: 0 });
const newPLine = (): PLine => ({ bf: 0, outs: 0, h: 0, r: 0, er: 0, bb: 0, k: 0, hr: 0, pc: 0, st: 0 });

const simCache = new Map<string, any>();

function simulate(g: GameDef, cutoff: number): any {
  if (g.postponed) cutoff = Math.min(cutoff, g.start - 2 * 3600_000);
  const key = `${g.pk}@${Math.floor(cutoff / 1000)}`;
  const c = simCache.get(key);
  if (c) return c;
  const r = rngFrom(g.seed);
  const sides = ['away', 'home'] as const;
  const teamIds = { away: g.away, home: g.home };
  const ros = { away: roster(g.away), home: roster(g.home) };
  const lineups = { away: shuffle(r, ros.away.hitters.slice(0, 9)), home: shuffle(r, ros.home.hitters.slice(0, 9)) };
  const bat: Record<number, Line> = {};
  const pit: Record<number, PLine> = {};
  const pitchersUsed = { away: [ros.away.pitchers[g.starters[0] - 20].id], home: [ros.home.pitchers[g.starters[1] - 20].id] };
  const bullpenIdx = { away: 5, home: 5 };
  const battersUsed = { away: [] as number[], home: [] as number[] };
  const lIdx = { away: 0, home: 0 };
  const score = { away: 0, home: 0 };
  const innings: any[] = [];
  const allPlays: any[] = [];
  const scoringPlays: number[] = [];
  let t = g.start + 7 * 60_000; // first pitch ~7 min after scheduled start
  let done = false, stopped = false;
  let state: 'pre' | 'live' | 'final' = cutoff < g.start - 30 * 60_000 ? 'pre' : 'live';
  let inningState = 'Top', curInning = 1, isTop = true;
  let outsNow = 0;
  let bases: (number | null)[] = [null, null, null];
  let offenseNext: { side: 'away' | 'home' } | null = null;
  let errorsBy = { away: 0, home: 0 };
  let lastPitcherOf = { away: 0, home: 0 };
  let decisions: any = {};
  let leadChange: { winnerP?: number; loserP?: number } = {};

  const P = (id: number) => playerById(id)!;
  const ref = (id: number) => ({ id, fullName: P(id).fullName, link: `/api/v1/people/${id}` });
  const fielder = (side: 'away' | 'home', pos: string): MPlayer =>
    pos === 'P' ? P(pitchersUsed[side][pitchersUsed[side].length - 1]) : (lineups[side].find((p) => p.pos === pos) ?? lineups[side][0]);

  if (cutoff < t) {
    stopped = true;
  }

  outer:
  for (let inning = 1; !stopped && !done; inning++) {
    for (const half of ['top', 'bottom'] as const) {
      const off = half === 'top' ? 'away' : 'home';
      const def = half === 'top' ? 'home' : 'away';
      if (inning >= 9 && half === 'bottom' && score.home > score.away) { done = true; break; }
      curInning = inning; isTop = half === 'top'; inningState = isTop ? 'Top' : 'Bottom';
      const inn = innings[inning - 1] ?? (innings[inning - 1] = { num: inning, ordinalNum: ord(inning), away: { runs: 0, hits: 0, errors: 0, leftOnBase: 0 }, home: { runs: 0, hits: 0, errors: 0, leftOnBase: 0 } });
      inn[off] = { runs: 0, hits: 0, errors: 0, leftOnBase: 0 };
      let outs = 0; outsNow = 0;
      bases = [null, null, null];
      while (outs < 3) {
        const batter = lineups[off][lIdx[off] % 9];
        // Pitching change at the start of a PA?
        const curP = pitchersUsed[def][pitchersUsed[def].length - 1];
        const pl = pit[curP] ?? (pit[curP] = newPLine());
        const events: any[] = [];
        const play: any = {
          result: { type: 'atBat' }, about: { atBatIndex: allPlays.length, halfInning: half, isTopInning: half === 'top', inning, startTime: new Date(t).toISOString(), isComplete: false, isScoringPlay: false, hasOut: false, captivatingIndex: 0 },
          count: { balls: 0, strikes: 0, outs }, matchup: {}, playEvents: events, runners: [],
        };
        let pitcherId = curP;
        const tired = pl.pc > 92 + r() * 15 || (pl.r >= 5) || (pitchersUsed[def].length > 1 && pl.bf >= 4 + r() * 4 && (inning >= 7));
        if (tired && bullpenIdx[def] < 13 && outs === 0 || (tired && pl.pc > 110)) {
          const newP = ros[def].pitchers[bullpenIdx[def]++].id;
          if (t > cutoff) { stopped = true; break outer; }
          events.push({
            details: { description: `Pitching Change: ${P(newP).fullName} replaces ${P(curP).fullName}.`, event: 'Pitching Substitution', eventType: 'pitching_substitution', awayScore: score.away, homeScore: score.home, isScoringPlay: false, isOut: false, hasReview: false },
            count: { balls: 0, strikes: 0, outs }, index: 0, startTime: new Date(t).toISOString(), endTime: new Date(t + 90_000).toISOString(), isPitch: false, type: 'action', player: { id: newP, link: '' }, position: { code: '1', abbreviation: 'P' }, isSubstitution: true, replacedPlayer: { id: curP },
          });
          t += 150_000;
          pitchersUsed[def].push(newP);
          pitcherId = newP;
          pit[newP] = newPLine();
        }
        const pitcher = P(pitcherId);
        lastPitcherOf[def] = pitcherId;
        play.matchup = {
          batter: ref(batter.id), batSide: { code: batter.bats === 'S' ? (pitcher.throws === 'R' ? 'L' : 'R') : batter.bats },
          pitcher: ref(pitcherId), pitchHand: { code: pitcher.throws },
          splits: { menOnBase: bases[1] || bases[2] ? 'RISP' : bases[0] ? 'Men_On' : 'Empty' },
        };
        if (!battersUsed[off].includes(batter.id)) battersUsed[off].push(batter.id);
        const bl = bat[batter.id] ?? (bat[batter.id] = newLine());
        const ppl = pit[pitcherId];
        let balls = 0, strikes = 0, pn = 0;
        let outcome = '';
        while (!outcome) {
          // Occasional stolen base attempt before the pitch.
          if (bases[0] && !bases[1] && outs < 2 && r() < 0.035) {
            const runner = bases[0];
            if (t > cutoff) { stopped = true; break; }
            const safe = r() < 0.78;
            bat[runner].sb += safe ? 1 : 0;
            events.push({
              details: { description: safe ? `${P(runner).fullName} steals (${1 + Math.floor(r() * 20)}) 2nd base.` : `${P(runner).fullName} caught stealing 2nd base, catcher ${fielder(def, 'C').fullName} to shortstop ${fielder(def, 'SS').fullName}.`, event: safe ? 'Stolen Base 2B' : 'Caught Stealing 2B', eventType: safe ? 'stolen_base_2b' : 'caught_stealing_2b', awayScore: score.away, homeScore: score.home, isScoringPlay: false, isOut: !safe, hasReview: false },
              count: { balls, strikes, outs: outs + (safe ? 0 : 1) }, index: events.length, startTime: new Date(t).toISOString(), endTime: new Date(t + 4000).toISOString(), isPitch: false, type: 'action', player: { id: runner },
            });
            bases[0] = null;
            if (safe) bases[1] = runner; else { outs++; ppl.outs++; if (outs >= 3) { outcome = 'CS_END'; break; } }
          }
          const pt = PITCHES[pick(r, pitcher.rep)];
          t += Math.round(between(r, 14_000, 28_000));
          if (t > cutoff) { stopped = true; break; }
          pn++; ppl.pc++;
          const two = strikes === 2;
          const x = r();
          let call: [string, string];
          let kind: 'ball' | 'called' | 'swing' | 'foul' | 'inplay' | 'hbp';
          if (x < 0.006) kind = 'hbp';
          else if (x < 0.365) kind = 'ball';
          else if (x < 0.53) kind = 'called';
          else if (x < 0.64) kind = 'swing';
          else if (x < 0.80) kind = 'foul';
          else kind = 'inplay';
          const [szT, szB] = batter.sz;
          let px: number, pz: number;
          if (kind === 'ball' || kind === 'hbp') {
            const side = r();
            if (side < 0.35) { px = between(r, 0.95, 1.7) * (r() < 0.5 ? -1 : 1); pz = between(r, szB - 0.3, szT + 0.3); }
            else if (side < 0.8) { px = between(r, -1.2, 1.2); pz = between(r, 0.4, szB - 0.15); }
            else { px = between(r, -1.0, 1.0); pz = between(r, szT + 0.15, szT + 0.9); }
          } else if (kind === 'called') { px = between(r, -0.78, 0.78); pz = between(r, szB + 0.05, szT - 0.05); }
          else { px = gauss(r) * 0.45; pz = (szT + szB) / 2 + gauss(r) * 0.45; }
          const mph = round(between(r, pt[2], pt[3]) - (pl.pc > 90 ? 0.8 : 0), 1);
          if (kind === 'ball') { balls++; call = ['B', 'Ball']; }
          else if (kind === 'hbp') { call = ['H', 'Hit By Pitch']; }
          else if (kind === 'called') { strikes++; call = ['C', 'Called Strike']; }
          else if (kind === 'swing') { strikes++; call = [r() < 0.15 ? 'W' : 'S', 'Swinging Strike']; if (call[0] === 'W') call[1] = 'Swinging Strike (Blocked)'; }
          else if (kind === 'foul') { if (!two) strikes++; call = ['F', 'Foul']; }
          else call = ['X', 'In play, out(s)'];
          if (kind !== 'ball' && kind !== 'hbp') ppl.st++;
          const ev: any = {
            details: {
              call: { code: call[0], description: call[1] }, description: call[1], code: call[0],
              isInPlay: kind === 'inplay', isStrike: kind === 'called' || kind === 'swing' || kind === 'foul', isBall: kind === 'ball' || kind === 'hbp',
              type: { code: pt[0], description: pt[1] }, isOut: false, hasReview: false,
            },
            count: { balls, strikes, outs },
            pitchData: {
              startSpeed: mph, endSpeed: round(mph * 0.91, 1), strikeZoneTop: szT, strikeZoneBottom: szB, strikeZoneWidth: 17, strikeZoneDepth: 8.5,
              coordinates: { pX: px, pZ: pz, pfxX: round(gauss(r) * 6, 2), pfxZ: round(gauss(r) * 6, 2) },
              breaks: { spinRate: Math.round(between(r, 1900, 2700)), breakVerticalInduced: round(between(r, -8, 19), 1), breakHorizontal: round(between(r, -15, 15), 1) },
              zone: Math.abs(px) < 0.83 && pz > szB && pz < szT ? 5 : 11,
            },
            index: events.length, playId: `${g.pk}-${allPlays.length}-${pn}`, pitchNumber: pn,
            startTime: new Date(t - 6000).toISOString(), endTime: new Date(t).toISOString(), isPitch: true, type: 'pitch',
          };
          // ~1 in 120 called pitches gets an ABS challenge
          if ((kind === 'ball' || kind === 'called') && r() < 0.008) {
            const over = r() < 0.5;
            ev.reviewDetails = { isOverturned: over, inProgress: false, reviewType: 'MJ', challengeTeamId: teamIds[r() < 0.5 ? off : def] };
          }
          events.push(ev);
          if (kind === 'hbp') outcome = 'HBP';
          else if (balls === 4) outcome = 'BB';
          else if (strikes === 3) { outcome = 'K'; ev.details.isOut = true; }
          else if (kind === 'inplay') outcome = 'BIP';
          play.count = { balls, strikes, outs };
        }
        if (stopped) {
          // Partial plate appearance: becomes currentPlay.
          if (events.length) { play.count = { ...play.count, outs }; allPlays.push(play); }
          outsNow = outs;
          break outer;
        }
        if (outcome === 'CS_END') {
          play.result = { type: 'atBat', event: 'Caught Stealing 2B', eventType: 'caught_stealing_2b', description: events[events.length - 1].details.description, rbi: 0, awayScore: score.away, homeScore: score.home, isOut: true };
          play.about.isComplete = true; play.about.hasOut = true; play.about.endTime = new Date(t).toISOString();
          play.count.outs = 3;
          allPlays.push(play);
          inn[off].leftOnBase = bases.filter(Boolean).length;
          break;
        }
        // ------------- resolve the plate appearance -------------
        const runnersBefore = [...bases];
        let desc = '';
        let event = '', eventType = '';
        let runs: number[] = [];
        let rbi = 0;
        let isHit = false, isAB = true, isOut = false, outsOnPlay = 0;
        const lastPitch = events[events.length - 1];
        const fName = (pos: string) => `${POS_NAME[pos]} ${fielder(def, pos).fullName}`;
        const adv = (n: number, batterTo: number | null) => {
          const nb: (number | null)[] = [null, null, null];
          for (let b = 2; b >= 0; b--) {
            const rid = bases[b];
            if (!rid) continue;
            const to = b + n;
            if (to >= 3) runs.push(rid); else nb[to] = rid;
          }
          if (batterTo !== null) { if (batterTo >= 3) runs.push(batter.id); else nb[batterTo] = batter.id; }
          bases = nb;
        };
        const force = () => {
          const nb = [...bases];
          if (nb[0]) { if (nb[1]) { if (nb[2]) runs.push(nb[2]); nb[2] = nb[1]; } nb[1] = nb[0]; }
          nb[0] = batter.id; bases = nb;
        };
        let hitData: any;
        const spray = (lo: number, hi: number, dist: number, la: number, ev: number, traj: string, loc: string) => {
          const ang = between(r, lo, hi) * Math.PI / 180;
          hitData = { launchSpeed: round(ev, 1), launchAngle: Math.round(la), totalDistance: Math.round(dist), trajectory: traj, hardness: ev > 100 ? 'hard' : ev > 85 ? 'medium' : 'soft', location: loc, coordinates: { coordX: round(125.42 + (dist / 2.5) * Math.sin(ang), 2), coordY: round(198.27 - (dist / 2.5) * Math.cos(ang), 2) } };
        };
        if (outcome === 'BB' || outcome === 'HBP') {
          isAB = false; force();
          event = outcome === 'BB' ? 'Walk' : 'Hit By Pitch'; eventType = outcome === 'BB' ? 'walk' : 'hit_by_pitch';
          desc = outcome === 'BB' ? `${batter.fullName} walks.` : `${batter.fullName} hit by pitch.`;
          bl.bb += outcome === 'BB' ? 1 : 0; ppl.bb += outcome === 'BB' ? 1 : 0;
        } else if (outcome === 'K') {
          isOut = true; outsOnPlay = 1;
          event = 'Strikeout'; eventType = 'strikeout';
          desc = lastPitch.details.code === 'C' ? `${batter.fullName} called out on strikes.` : `${batter.fullName} strikes out swinging.`;
          bl.k++; ppl.k++;
        } else {
          const y = r();
          const dirs: [number, number, string, string][] = [[-45, -27, 'LF', '7'], [-27, -9, 'LF', '78'], [-9, 9, 'CF', '8'], [9, 27, 'RF', '89'], [27, 45, 'RF', '9']];
          const [dlo, dhi, ofPos, ofLoc] = pick(r, dirs);
          const ifPos = dlo < -20 ? '3B' : dlo < 0 ? 'SS' : dlo < 15 ? '2B' : '1B';
          lastPitch.details.call = { code: 'X', description: 'In play, out(s)' };
          if (y < 0.17) { // single
            isHit = true; event = 'Single'; eventType = 'single';
            const ground = r() < 0.5;
            spray(dlo, dhi, ground ? between(r, 120, 180) : between(r, 160, 240), ground ? between(r, -5, 8) : between(r, 8, 18), between(r, 80, 104), ground ? 'ground_ball' : 'line_drive', ofLoc[0]);
            desc = `${batter.fullName} singles on a ${ground ? 'ground ball' : 'line drive'} to ${fName(ofPos)}.`;
            const r2 = bases[1], r3 = bases[2];
            if (r3) { runs.push(r3); bases[2] = null; }
            if (r2 && r() < 0.6) { runs.push(r2); bases[1] = null; }
            adv(1, 0);
          } else if (y < 0.22) {
            isHit = true; event = 'Double'; eventType = 'double';
            spray(dlo, dhi, between(r, 260, 360), between(r, 12, 28), between(r, 95, 110), 'line_drive', ofLoc);
            desc = `${batter.fullName} doubles on a line drive to ${fName(ofPos)}.`;
            adv(2, 1);
            if (bases[2] && runnersBefore[0] === bases[2] && r() < 0.4) { runs.push(bases[2]!); bases[2] = null; }
          } else if (y < 0.225) {
            isHit = true; event = 'Triple'; eventType = 'triple';
            spray(dlo, dhi, between(r, 330, 400), between(r, 15, 25), between(r, 98, 108), 'line_drive', ofLoc);
            desc = `${batter.fullName} triples on a line drive to ${fName(ofPos)}.`;
            adv(3, 2);
          } else if (y < 0.26) {
            isHit = true; event = 'Home Run'; eventType = 'home_run';
            spray(dlo, dhi, between(r, 375, 455), between(r, 23, 34), between(r, 101, 113), 'fly_ball', ofLoc);
            const field = ofPos === 'LF' ? 'left field' : ofPos === 'CF' ? 'center field' : 'right field';
            desc = `${batter.fullName} homers (${1 + Math.floor(r() * 30)}) on a fly ball to ${field}.`;
            adv(4, 4);
            ppl.hr++;
          } else if (y < 0.275) {
            event = 'Field Error'; eventType = 'field_error';
            spray(dlo, dhi, between(r, 60, 120), between(r, -10, 5), between(r, 70, 95), 'ground_ball', POS_CODE[ifPos]);
            desc = `${batter.fullName} reaches on a fielding error by ${fName(ifPos)}.`;
            adv(1, 0); errorsBy[def]++; inn[def].errors++;
          } else {
            isOut = true; outsOnPlay = 1;
            const k = r();
            if (k < 0.45) {
              spray(dlo, dhi, between(r, 60, 130), between(r, -18, 4), between(r, 65, 100), 'ground_ball', POS_CODE[ifPos]);
              if (bases[0] && outs < 2 && r() < 0.45) {
                event = 'Grounded Into DP'; eventType = 'grounded_into_double_play'; outsOnPlay = 2;
                const lead = bases[0];
                desc = `${batter.fullName} grounds into a double play, ${fName(ifPos)} to ${fName(ifPos === '2B' ? 'SS' : '2B')} to ${fName('1B')}.   ${P(lead).fullName} out at 2nd.`;
                bases[0] = null;
                if (outs + 2 < 3) { if (bases[2]) { runs.push(bases[2]); bases[2] = null; } if (bases[1]) { bases[2] = bases[1]; bases[1] = null; } }
              } else {
                event = 'Groundout'; eventType = 'field_out';
                desc = ifPos === '1B' ? `${batter.fullName} grounds out to ${fName('1B')}.` : `${batter.fullName} grounds out, ${fName(ifPos)} to ${fName('1B')}.`;
                if (outs < 2) { if (bases[2] && r() < 0.5) { runs.push(bases[2]); bases[2] = null; } if (bases[1] && !bases[2]) { bases[2] = bases[1]; bases[1] = null; } if (bases[0] && !bases[1]) { bases[1] = bases[0]; bases[0] = null; } }
              }
            } else if (k < 0.78) {
              spray(dlo, dhi, between(r, 250, 370), between(r, 25, 45), between(r, 85, 104), 'fly_ball', ofLoc[0]);
              if (bases[2] && outs < 2 && r() < 0.7) {
                event = 'Sac Fly'; eventType = 'sac_fly'; isAB = false; bl.sf++;
                desc = `${batter.fullName} out on a sacrifice fly to ${fName(ofPos)}.`;
                runs.push(bases[2]); bases[2] = null;
              } else {
                event = 'Flyout'; eventType = 'field_out';
                desc = `${batter.fullName} flies out to ${fName(ofPos)}.`;
              }
            } else if (k < 0.9) {
              spray(dlo, dhi, between(r, 150, 260), between(r, 8, 20), between(r, 90, 106), 'line_drive', r() < 0.5 ? ofLoc[0] : POS_CODE[ifPos]);
              event = 'Lineout'; eventType = 'field_out';
              desc = `${batter.fullName} lines out to ${fName(r() < 0.5 ? ofPos : ifPos)}.`;
            } else {
              spray(dlo / 2, dhi / 2, between(r, 60, 160), between(r, 50, 75), between(r, 60, 85), 'popup', POS_CODE[ifPos]);
              event = 'Pop Out'; eventType = 'field_out';
              desc = `${batter.fullName} pops out to ${fName(ifPos)}.`;
            }
          }
          lastPitch.details.description = isOut ? 'In play, out(s)' : runs.length ? 'In play, run(s)' : 'In play, no out';
          lastPitch.details.call.description = lastPitch.details.description;
          lastPitch.hitData = hitData;
        }
        // Runner descriptions
        const scoredNames = runs.filter((id) => id !== batter.id).map((id) => `${P(id).fullName} scores.`);
        const movedNames: string[] = [];
        [bases[1], bases[2]].forEach((rid, i) => {
          if (rid && rid !== batter.id && runnersBefore.indexOf(rid) !== i + 1) movedNames.push(`${P(rid).fullName} to ${i === 0 ? '2nd' : '3rd'}.`);
        });
        if (eventType !== 'home_run' || runs.length > 1) desc = [desc, ...scoredNames, ...movedNames].join('    ');
        // Stats
        outs += outsOnPlay; ppl.outs += outsOnPlay;
        if (eventType !== 'grounded_into_double_play' || true) rbi = eventType === 'grounded_into_double_play' || eventType === 'field_error' ? 0 : runs.length;
        bl.pa++; if (isAB) bl.ab++; if (isHit) bl.h++;
        if (eventType === 'double') bl.d++; if (eventType === 'triple') bl.t++; if (eventType === 'home_run') bl.hr++;
        bl.rbi += rbi; ppl.bf++; if (isHit) ppl.h++;
        for (const rid of runs) { (bat[rid] ?? (bat[rid] = newLine())).r++; ppl.r++; ppl.er++; }
        if (isHit) inn[off].hits++;
        const before = { ...score };
        score[off] += runs.length; inn[off].runs += runs.length;
        // Lead changes for decisions
        if (before[off] <= before[def] && score[off] > score[def]) leadChange = { winnerP: lastPitcherOf[off] || pitchersUsed[off][pitchersUsed[off].length - 1], loserP: pitcherId };
        if (isOut && outs >= 3) bl.lob += bases.filter(Boolean).length;
        play.result = { type: 'atBat', event, eventType, description: desc, rbi, awayScore: score.away, homeScore: score.home, isOut };
        play.about.isComplete = true;
        play.about.isScoringPlay = runs.length > 0;
        play.about.hasOut = isOut;
        play.about.endTime = new Date(t).toISOString();
        play.count = { balls, strikes, outs };
        play.runners = runs.map((id) => ({ movement: { originBase: null, start: null, end: 'score', outBase: null, isOut: false }, details: { event, eventType, runner: ref(id), isScoringEvent: true, rbi: rbi > 0, earned: true } }));
        if (runs.length) scoringPlays.push(play.about.atBatIndex);
        allPlays.push(play);
        lIdx[off]++;
        outsNow = outs;
        if (inning >= 9 && half === 'bottom' && score.home > score.away) { done = true; break; } // walk-off
      }
      inn[off].leftOnBase = bases.filter(Boolean).length;
      if (done) break;
      // Half-inning break (~2:15). If the cutoff lands in it, show Middle/End.
      t += 135_000;
      if (t > cutoff) {
        if (inning >= 9 && ((half === 'top' && score.home > score.away) || (half === 'bottom' && score.home !== score.away))) { done = true; break outer; }
        inningState = half === 'top' ? 'Middle' : 'End';
        offenseNext = { side: half === 'top' ? 'home' : 'away' };
        stopped = true; break outer;
      }
      if (inning >= 9 && half === 'bottom' && score.home !== score.away) { done = true; break; }
      if (inning >= 9 && half === 'top' && score.home > score.away) { done = true; break; }
    }
    if (inning >= 15) done = true; // sanity
  }
  if (done) state = 'final';
  else if (!allPlays.length && (cutoff < g.start + 7 * 60_000)) state = 'pre';
  if (state === 'final') {
    const winSide = score.away > score.home ? 'away' : 'home';
    const loseSide = winSide === 'away' ? 'home' : 'away';
    const wp = leadChange.winnerP && pitchersUsed[winSide].includes(leadChange.winnerP) ? leadChange.winnerP : pitchersUsed[winSide][0];
    const lp = leadChange.loserP && pitchersUsed[loseSide].includes(leadChange.loserP) ? leadChange.loserP : pitchersUsed[loseSide][0];
    const closer = pitchersUsed[winSide][pitchersUsed[winSide].length - 1];
    decisions = { winner: ref(wp), loser: ref(lp), ...(closer !== wp && score[winSide] - score[loseSide] <= 3 ? { save: ref(closer) } : {}) };
  }

  // ------------------------- assemble the feed -------------------------
  const curPlay = allPlays[allPlays.length - 1];
  const offSide: 'away' | 'home' = offenseNext?.side ?? (isTop ? 'away' : 'home');
  const defSide = offSide === 'away' ? 'home' : 'away';
  const idxNow = lIdx[offSide];
  const onBase = (i: number) => (bases[i] && !offenseNext && state === 'live' ? ref(bases[i]!) : undefined);
  const lineOf = (side: 'away' | 'home') => ({
    runs: score[side], hits: innings.reduce((a, i) => a + (i[side]?.hits ?? 0), 0), errors: errorsBy[side],
    leftOnBase: innings.reduce((a, i) => a + (i[side]?.leftOnBase ?? 0), 0),
  });
  const linescore: any = state === 'pre' ? { scheduledInnings: 9, innings: [], teams: { away: {}, home: {} } } : {
    currentInning: curInning, currentInningOrdinal: ord(curInning), inningState, inningHalf: isTop ? 'Top' : 'Bottom', isTopInning: isTop,
    scheduledInnings: 9, innings, teams: { away: lineOf('away'), home: lineOf('home') },
    defense: { pitcher: ref(pitchersUsed[defSide][pitchersUsed[defSide].length - 1]), team: { id: teamIds[defSide] } },
    offense: {
      batter: ref(lineups[offSide][idxNow % 9].id), onDeck: ref(lineups[offSide][(idxNow + 1) % 9].id), inHole: ref(lineups[offSide][(idxNow + 2) % 9].id),
      first: onBase(0), second: onBase(1), third: onBase(2), team: { id: teamIds[offSide] },
    },
    balls: curPlay?.about.isComplete ? 0 : curPlay?.count.balls ?? 0, strikes: curPlay?.about.isComplete ? 0 : curPlay?.count.strikes ?? 0, outs: offenseNext ? 3 : outsNow,
  };
  if (state === 'live' && curPlay && !curPlay.about.isComplete) {
    // offense.batter is the man at the plate
    linescore.offense.batter = ref(curPlay.matchup.batter.id);
    const i = lineups[offSide].findIndex((p) => p.id === curPlay.matchup.batter.id);
    linescore.offense.onDeck = ref(lineups[offSide][(i + 1) % 9].id);
    linescore.offense.inHole = ref(lineups[offSide][(i + 2) % 9].id);
  }

  const people: any = {};
  for (const side of sides) for (const p of [...ros[side].hitters, ...ros[side].pitchers]) {
    people[`ID${p.id}`] = { id: p.id, fullName: p.fullName, firstName: p.first, lastName: p.last, useName: p.first, boxscoreName: p.last, primaryNumber: String(p.num), batSide: { code: p.bats }, pitchHand: { code: p.throws }, primaryPosition: { abbreviation: p.pos === 'DH' ? 'DH' : p.pos } };
  }
  const posObj = (pos: string) => ({ code: POS_CODE[pos] ?? '10', name: pos, abbreviation: pos });
  const boxTeam = (side: 'away' | 'home') => {
    const players: any = {};
    const lineupIds = lineups[side].map((p) => p.id);
    for (const p of [...ros[side].hitters, ...ros[side].pitchers]) {
      const b = bat[p.id], pp = pit[p.id];
      const order = lineupIds.indexOf(p.id);
      players[`ID${p.id}`] = {
        person: { id: p.id, fullName: p.fullName }, jerseyNumber: String(p.num), position: posObj(p.pos), allPositions: [posObj(p.pos)],
        ...(order >= 0 && state !== 'pre' ? { battingOrder: String((order + 1) * 100) } : {}),
        stats: {
          batting: b ? { plateAppearances: b.pa, atBats: b.ab, hits: b.h, doubles: b.d, triples: b.t, homeRuns: b.hr, rbi: b.rbi, runs: b.r, baseOnBalls: b.bb, strikeOuts: b.k, leftOnBase: b.lob, stolenBases: b.sb, sacFlies: b.sf } : {},
          pitching: pp ? { battersFaced: pp.bf, outs: pp.outs, inningsPitched: ip(pp.outs), hits: pp.h, runs: pp.r, earnedRuns: pp.er, baseOnBalls: pp.bb, strikeOuts: pp.k, homeRuns: pp.hr, numberOfPitches: pp.pc, strikes: pp.st, ...(decisionNote(p.id)) } : {},
        },
        seasonStats: {
          batting: { avg: avgStr(p.avg), ops: avgStr(p.ops), homeRuns: p.hr },
          pitching: { era: p.era.toFixed(2), wins: p.w, losses: p.l },
        },
        gameStatus: { isCurrentBatter: state === 'live' && linescore.offense?.batter?.id === p.id, isCurrentPitcher: state === 'live' && linescore.defense?.pitcher?.id === p.id, isOnBench: !lineupIds.includes(p.id), isSubstitute: false },
      };
    }
    const sideBat = Object.entries(bat).filter(([id]) => Math.floor(Number(id) / 1000) === teamIds[side]);
    const tot = sideBat.reduce((a, [, b]) => ({ ab: a.ab + b.ab, r: a.r + b.r, h: a.h + b.h, rbi: a.rbi + b.rbi, bb: a.bb + b.bb, k: a.k + b.k, lob: a.lob + b.lob }), { ab: 0, r: 0, h: 0, rbi: 0, bb: 0, k: 0, lob: 0 });
    const doubles = sideBat.filter(([, b]) => b.d).map(([id, b]) => `${P(+id).last}${b.d > 1 ? ' ' + b.d : ''}`);
    const hrs = sideBat.filter(([, b]) => b.hr).map(([id, b]) => `${P(+id).last}${b.hr > 1 ? ' ' + b.hr : ''}`);
    const rbis = sideBat.filter(([, b]) => b.rbi).map(([id, b]) => `${P(+id).last}${b.rbi > 1 ? ' ' + b.rbi : ''}`);
    const info: any[] = [];
    const battingFields = [
      doubles.length && { label: '2B', value: doubles.join('; ') + '.' },
      hrs.length && { label: 'HR', value: hrs.join('; ') + '.' },
      rbis.length && { label: 'RBI', value: rbis.join('; ') + '.' },
      { label: 'Team LOB', value: String(lineOf(side).leftOnBase) + '.' },
    ].filter(Boolean);
    info.push({ title: 'BATTING', fieldList: battingFields });
    if (errorsBy[side]) info.push({ title: 'FIELDING', fieldList: [{ label: 'E', value: `${pick(rngFrom(side.length), lineups[side]).last} (${errorsBy[side]}).` }] });
    return {
      team: { id: teamIds[side], name: TEAMS[teamIds[side]].name },
      teamStats: { batting: { atBats: tot.ab, runs: tot.r, hits: tot.h, rbi: tot.rbi, baseOnBalls: tot.bb, strikeOuts: tot.k, leftOnBase: tot.lob } },
      players,
      batters: state === 'pre' ? [] : [...lineupIds, ...pitchersUsed[side]],
      pitchers: state === 'pre' ? [] : pitchersUsed[side],
      bench: ros[side].hitters.slice(9).map((p) => p.id),
      bullpen: ros[side].pitchers.map((p) => p.id).filter((id) => !pitchersUsed[side].includes(id)),
      battingOrder: (state !== 'pre' || cutoff > g.start - 3 * 3600_000) ? lineupIds : [],
      info,
      note: [],
    };
  };
  function decisionNote(id: number) {
    if (decisions.winner?.id === id) return { note: `(W, ${P(id).w + 1}-${P(id).l})` };
    if (decisions.loser?.id === id) return { note: `(L, ${P(id).w}-${P(id).l + 1})` };
    if (decisions.save?.id === id) return { note: '(S, 1)' };
    return {};
  }
  const statusFor = () => {
    if (g.postponed) return { abstractGameState: 'Final', codedGameState: 'D', detailedState: 'Postponed', statusCode: 'DR', reason: 'Rain' };
    if (state === 'final') return { abstractGameState: 'Final', codedGameState: 'F', detailedState: 'Final', statusCode: 'F' };
    if (state === 'live') return cutoff < g.start + 7 * 60_000 ? { abstractGameState: 'Live', codedGameState: 'I', detailedState: 'Warmup', statusCode: 'PW' } : { abstractGameState: 'Live', codedGameState: 'I', detailedState: 'In Progress', statusCode: 'I' };
    return cutoff > g.start - 60 * 60_000 ? { abstractGameState: 'Preview', codedGameState: 'P', detailedState: 'Pre-Game', statusCode: 'P' } : { abstractGameState: 'Preview', codedGameState: 'S', detailedState: 'Scheduled', statusCode: 'S' };
  };
  const rec = (id: number) => { const s = standingFor(id); return { wins: s.w, losses: s.l, pct: (s.w / (s.w + s.l)).toFixed(3).slice(1) }; };
  const dur = Math.round((t - g.start - 7 * 60_000) / 60_000);
  const feed = {
    gamePk: g.pk,
    metaData: { wait: 10, timeStamp: toTimecode(Math.min(cutoff, Date.now())), gameEvents: [], logicalEvents: [] },
    gameData: {
      game: { pk: g.pk, type: 'R', season: g.date.slice(0, 4) },
      datetime: { dateTime: new Date(g.start).toISOString(), officialDate: g.date, dayNight: 'night' },
      status: statusFor(),
      teams: Object.fromEntries(sides.map((s) => [s, { id: teamIds[s], name: TEAMS[teamIds[s]].name, abbreviation: TEAMS[teamIds[s]].abbr, teamName: TEAMS[teamIds[s]].club, record: { leagueRecord: rec(teamIds[s]) } }])),
      players: people,
      venue: { id: teamIds.home, name: `${TEAMS[teamIds.home].club} Park` },
      weather: { condition: pick(rngFrom(g.seed), ['Clear', 'Partly Cloudy', 'Cloudy', 'Sunny']), temp: String(55 + (g.seed % 30)), wind: `${g.seed % 15} mph, Out To CF` },
      probablePitchers: { away: ref(ros.away.pitchers[g.starters[0] - 20].id), home: ref(ros.home.pitchers[g.starters[1] - 20].id) },
      gameInfo: { firstPitch: new Date(g.start + 7 * 60_000).toISOString(), attendance: 25000 + (g.seed % 20000), gameDurationMinutes: state === 'final' ? dur : undefined },
    },
    liveData: {
      plays: { allPlays, currentPlay: curPlay, scoringPlays },
      linescore,
      boxscore: {
        teams: { away: boxTeam('away'), home: boxTeam('home') },
        info: state === 'final' ? [
          { label: 'Pitches-strikes', value: Object.entries(pit).map(([id, p]) => `${P(+id).last} ${p.pc}-${p.st}`).join('; ') + '.' },
          { label: 'Umpires', value: 'HP: Ray Calder. 1B: Tom Whitby. 2B: Nate Ruiz. 3B: Joe Pratt.' },
          { label: 'Weather', value: `${55 + (g.seed % 30)} degrees, Partly Cloudy.` },
          { label: 'Wind', value: `${g.seed % 15} mph, Out To CF.` },
          { label: 'T', value: `${Math.floor(dur / 60)}:${String(dur % 60).padStart(2, '0')}.` },
          { label: 'Att', value: (25000 + (g.seed % 20000)).toLocaleString('en-US') + '.' },
          { label: 'Venue', value: `${TEAMS[teamIds.home].club} Park.` },
        ] : [],
      },
      decisions,
    },
  };
  simCache.set(key, feed);
  if (simCache.size > 400) simCache.delete(simCache.keys().next().value!);
  return feed;
}
const ord = (n: number) => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };

// ------------------------------ standings ------------------------------------

function standingFor(teamId: number) {
  const r = rngFrom(teamId * 31 + 7);
  const w = Math.floor(between(r, 62, 100));
  const l = 162 - w - 10;
  return { w, l, rs: Math.floor(between(r, 620, 860)), ra: Math.floor(between(r, 620, 860)), streak: `${pick(r, ['W', 'L'])}${1 + Math.floor(r() * 5)}`, l10: Math.floor(r() * 9) + 1 };
}

const DIV_OF: Record<number, number> = { 110: 201, 111: 201, 147: 201, 139: 201, 141: 201, 145: 202, 114: 202, 116: 202, 118: 202, 142: 202, 133: 200, 117: 200, 108: 200, 136: 200, 140: 200, 144: 204, 146: 204, 121: 204, 143: 204, 120: 204, 112: 205, 113: 205, 158: 205, 134: 205, 138: 205, 109: 203, 115: 203, 119: 203, 135: 203, 137: 203 };

function standings() {
  return {
    records: Object.keys(DIVISIONS).map((d) => {
      const teams = Object.entries(DIV_OF).filter(([, dv]) => dv === +d).map(([id]) => ({ id: +id, ...standingFor(+id) })).sort((a, b) => b.w - a.w);
      const lead = teams[0];
      return {
        division: { id: +d }, league: { id: DIVISIONS[+d].league === 'AL' ? 103 : 104 },
        teamRecords: teams.map((t, i) => ({
          team: { id: t.id, name: TEAMS[t.id].name, abbreviation: TEAMS[t.id].abbr, teamName: TEAMS[t.id].club },
          wins: t.w, losses: t.l, winningPercentage: (t.w / (t.w + t.l)).toFixed(3).slice(1),
          gamesBack: i === 0 ? '-' : String(((lead.w - t.w) + (t.l - lead.l)) / 2), wildCardGamesBack: '-',
          divisionRank: String(i + 1), streak: { streakCode: t.streak }, runsScored: t.rs, runsAllowed: t.ra, runDifferential: t.rs - t.ra,
          records: { splitRecords: [{ type: 'home', wins: Math.ceil(t.w / 2) + 3, losses: Math.floor(t.l / 2) - 3 }, { type: 'away', wins: Math.floor(t.w / 2) - 3, losses: Math.ceil(t.l / 2) + 3 }, { type: 'lastTen', wins: t.l10, losses: 10 - t.l10 }] },
        })),
      };
    }),
  };
}

// -------------------------------- people -------------------------------------

function personObj(id: number, season: number) {
  const p = playerById(id);
  if (!p) return { people: [] };
  const team = Math.floor(id / 1000);
  const r = rngFrom(id);
  const isP = p.pos === 'P';
  const years = Array.from({ length: 5 }, (_, i) => season - 4 + i);
  const hit = (games: number) => {
    const ab = Math.floor(games * between(r, 3.2, 4.1));
    const h = Math.floor(ab * p.avg * between(r, 0.9, 1.1));
    const hr = Math.floor(p.hr * games / 150);
    return { gamesPlayed: games, atBats: ab, runs: Math.floor(h * 0.55), hits: h, doubles: Math.floor(h * 0.2), triples: Math.floor(h * 0.02), homeRuns: hr, rbi: Math.floor(hr * 3 + h * 0.2), baseOnBalls: Math.floor(ab * 0.09), strikeOuts: Math.floor(ab * 0.22), stolenBases: Math.floor(r() * 15), avg: avgStr(h / Math.max(ab, 1)), obp: avgStr(p.avg + 0.07), slg: avgStr(p.ops - p.avg - 0.07), ops: avgStr(p.ops) };
  };
  const pitch = (games: number) => {
    const outs = Math.floor(games * between(r, 14, 17));
    return { gamesPlayed: games, gamesStarted: games, wins: p.w, losses: p.l, era: p.era.toFixed(2), inningsPitched: ip(outs), hits: Math.floor(outs / 3 * 0.9), runs: Math.floor(outs / 3 * p.era / 9 * 1.08), earnedRuns: Math.floor(outs / 3 * p.era / 9), homeRuns: Math.floor(outs / 3 / 9), baseOnBalls: Math.floor(outs / 3 * 0.33), strikeOuts: Math.floor(outs / 3 * 1.05), whip: between(r, 1.0, 1.35).toFixed(2), saves: 0 };
  };
  const group = isP ? 'pitching' : 'hitting';
  const mkStat = isP ? pitch : hit;
  const yby = years.map((y) => ({ season: String(y), team: { id: team, name: TEAMS[team].name }, stat: mkStat(isP ? 28 + Math.floor(r() * 5) : 120 + Math.floor(r() * 40)) }));
  const log = Array.from({ length: 12 }, (_, i) => {
    const date = addDays(baseballToday(), -i - 1);
    const opp = slate(date).find((g) => g.away === team || g.home === team);
    const st = isP ? { inningsPitched: `${5 + Math.floor(r() * 3)}.${Math.floor(r() * 3)}`, hits: Math.floor(r() * 8), runs: Math.floor(r() * 5), earnedRuns: Math.floor(r() * 4), baseOnBalls: Math.floor(r() * 4), strikeOuts: Math.floor(r() * 10), era: p.era.toFixed(2) }
      : { atBats: 4, hits: Math.floor(r() * 3), homeRuns: r() < 0.15 ? 1 : 0, rbi: Math.floor(r() * 3), baseOnBalls: Math.floor(r() * 2), strikeOuts: Math.floor(r() * 3), avg: avgStr(p.avg) };
    return { date, isHome: opp?.home === team, opponent: { id: opp ? (opp.home === team ? opp.away : opp.home) : 0 }, game: { gamePk: opp?.pk }, stat: st };
  }).filter((x) => x.game.gamePk && (!isP || x.date.endsWith('1') || x.date.endsWith('6')));
  return {
    people: [{
      id, fullName: p.fullName, firstName: p.first, lastName: p.last, primaryNumber: String(p.num), birthDate: `${1990 + (id % 10)}-0${1 + (id % 9)}-1${id % 9}`,
      currentAge: 26 + (id % 10), birthCity: 'Springfield', birthCountry: 'USA', height: `6' ${id % 5}"`, weight: 185 + (id % 40),
      primaryPosition: { abbreviation: p.pos, name: isP ? 'Pitcher' : p.pos, code: POS_CODE[p.pos] ?? '10' },
      batSide: { code: p.bats, description: p.bats === 'R' ? 'Right' : p.bats === 'L' ? 'Left' : 'Switch' },
      pitchHand: { code: p.throws, description: p.throws === 'R' ? 'Right' : 'Left' },
      mlbDebutDate: `${season - 5}-04-0${1 + (id % 8)}`, currentTeam: { id: team, name: TEAMS[team].name },
      stats: [
        { type: { displayName: 'yearByYear' }, group: { displayName: group }, splits: yby },
        { type: { displayName: 'career' }, group: { displayName: group }, splits: [{ stat: mkStat(isP ? 150 : 700) }] },
        { type: { displayName: 'gameLog' }, group: { displayName: group }, splits: log },
      ],
    }],
  };
}

// ------------------------------- schedule ------------------------------------

function scheduleGame(g: GameDef) {
  const now = Date.now();
  const f = simulate(g, g.start > now ? now : g.date < baseballToday() ? g.start + 6 * 3600_000 : now);
  const ls = f.liveData.linescore;
  return {
    gamePk: g.pk, gameDate: new Date(g.start).toISOString(), officialDate: g.date, gameType: 'R', status: f.gameData.status,
    teams: Object.fromEntries((['away', 'home'] as const).map((s) => [s, {
      team: { id: f.gameData.teams[s].id, name: f.gameData.teams[s].name, abbreviation: f.gameData.teams[s].abbreviation, teamName: f.gameData.teams[s].teamName },
      leagueRecord: f.gameData.teams[s].record.leagueRecord, score: ls.teams?.[s]?.runs,
      isWinner: f.gameData.status.abstractGameState === 'Final' && ls.teams?.[s]?.runs > ls.teams?.[s === 'away' ? 'home' : 'away']?.runs,
      probablePitcher: f.gameData.probablePitchers[s],
    }])),
    linescore: ls, decisions: f.liveData.decisions, venue: f.gameData.venue,
    broadcasts: [
      { type: 'TV', name: pick(rngFrom(g.seed), ['BSN', 'TeamTV', 'MLB.TV']), isNational: false, language: 'en' },
      ...(['away', 'home'] as const).map((s) => ({ type: 'AM', name: `${f.gameData.teams[s].teamName} Radio ${s === 'away' ? 1080 : 760}`, homeAway: s, isNational: false, language: 'en' })),
      { type: 'AM', name: 'La Radio 1450', homeAway: 'home', isNational: false, language: 'es' },
    ],
    doubleHeader: 'N', gameNumber: 1,
  };
}

function schedule(q: URLSearchParams) {
  const teamId = Number(q.get('teamId')) || 0;
  let dates: string[] = [];
  if (q.get('date')) dates = [q.get('date')!];
  else if (q.get('startDate')) { for (let d = q.get('startDate')!; d <= q.get('endDate')!; d = addDays(d, 1)) dates.push(d); }
  return {
    dates: dates.map((date) => ({
      date,
      games: slate(date).filter((g) => !teamId || g.away === teamId || g.home === teamId).map(scheduleGame),
    })).filter((d) => d.games.length),
  };
}

// --------------------------- win probability --------------------------------

function winProb(g: GameDef) {
  const f = simulate(g, Date.now());
  let prev = 50;
  return f.liveData.plays.allPlays.filter((p: any) => p.about.isComplete).map((p: any) => {
    const diff = p.result.homeScore - p.result.awayScore;
    const halvesLeft = Math.max(1, (9 - p.about.inning) * 2 + (p.about.isTopInning ? 2 : 1) - p.count.outs / 3);
    const home = Math.min(99.9, Math.max(0.1, 100 / (1 + Math.exp(-(diff * 1.7 + 0.15) / Math.sqrt(halvesLeft / 2)))));
    const added = home - prev; prev = home;
    return { atBatIndex: p.about.atBatIndex, homeTeamWinProbability: round(home, 1), awayTeamWinProbability: round(100 - home, 1), homeTeamWinProbabilityAdded: round(added, 1), leverageIndex: round(0.5 + Math.random() * 1.5, 2), about: { inning: p.about.inning, halfInning: p.about.halfInning } };
  });
}

// --------------------------------- router ------------------------------------

function fromTimecode(tc: string): number {
  const m = tc.match(/(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/);
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) : Date.now();
}

export async function mockFetch(path: string): Promise<unknown> {
  await new Promise((r) => setTimeout(r, 60 + Math.random() * 120));
  const u = new URL(path, 'https://mock.local');
  const q = u.searchParams;
  let m: RegExpMatchArray | null;
  const season = Number(q.get('season')) || Number(ymd(new Date()).slice(0, 4));
  if (u.pathname === '/api/v1/schedule') return schedule(q);
  if ((m = u.pathname.match(/^\/api\/v1\.1\/game\/(\d+)\/feed\/live/))) {
    const g = gameByPk(+m[1]);
    if (!g) throw new Error('unknown game');
    const tc = q.get('timecode');
    return simulate(g, tc ? fromTimecode(tc) : (g.date < baseballToday() ? g.start + 8 * 3600_000 : Date.now()));
  }
  if ((m = u.pathname.match(/^\/api\/v1\/game\/(\d+)\/winProbability/))) { const g = gameByPk(+m[1]); return g ? winProb(g) : []; }
  if ((m = u.pathname.match(/^\/api\/v1\/people\/(\d+)\/stats/))) return { stats: [] };
  if ((m = u.pathname.match(/^\/api\/v1\/people\/(\d+)/))) return personObj(+m[1], season);
  if (u.pathname === '/api/v1/people') {
    const ids = (q.get('personIds') ?? '').split(',').map(Number);
    return { people: ids.map((id) => { const p = personObj(id, season).people[0] as any; if (!p) return null; const cs = p.stats[0].splits.at(-1); return { ...p, stats: [{ type: { displayName: 'season' }, group: p.stats[0].group, splits: [cs] }] }; }).filter(Boolean) };
  }
  if (u.pathname === '/api/v1/standings') return standings();
  if ((m = u.pathname.match(/^\/api\/v1\/teams\/(\d+)\/roster/))) {
    const t = roster(+m[1]);
    return { roster: [...t.pitchers, ...t.hitters].map((p) => ({ person: { id: p.id, fullName: p.fullName }, jerseyNumber: String(p.num), position: { abbreviation: p.pos, type: p.pos === 'P' ? 'Pitcher' : 'Hitter' }, status: { code: 'A', description: 'Active' } })) };
  }
  throw new Error(`mock: no route for ${path}`);
}
