import { useMemo } from 'preact/hooks';
import {
  situation, atBat, headline, previousPlay, playLog, header, pitchersToday, wpSeries, scoringPlays,
  batterToday, batterSeason, pitcherToday, pitcherSeason, handOf, type Situation, type AtBatVM, type GameHeader,
} from '../../model/game';
import { relTime } from '../../model/format';
import { usePoll, useNow, useReplay } from '../../api/hooks';
import { ep } from '../../api/endpoints';
import { PlayerLink, Section, Tag, TeamLogo } from '../../components/common';
import { CountLights, Diamond, StrikeZone, SprayField, WinProbChart } from '../../components/graphics';
import { PlayLog } from './PlayLog';
import { PitchTable, HitLine } from './bits';

/**
 * The live window into a game. Three tiers, most important first:
 *   1. Now: what just happened (one sentence), the situation, the at-bat pitch by pitch.
 *   2. The story so far: completed plate appearances, newest first, grouped by half-inning.
 *   3. Context rail: win probability, pitchers used, scoring plays.
 * A finished game can be replayed through the same view via timecodes.
 */
export function Gamecast({ feed, version, replay }: { feed: any; version: number; replay?: ReturnType<typeof useReplay> }) {
  // For finished games GameView passes a replay controller; `feed` is then the frozen replay frame.
  if (replay && !replay.feed) {
    return (
      <div class="gamecast">
        <ReplayBar r={replay} />
        <div class="loading">Loading replay…</div>
      </div>
    );
  }
  return (
    <div class="gamecast">
      {replay && <ReplayBar r={replay} />}
      <GamecastBody feed={replay ? replay.feed : feed} version={replay ? replay.cursor : version} isReplay={!!replay} />
    </div>
  );
}

function GamecastBody({ feed, version, isReplay }: { feed: any; version: number; isReplay: boolean }) {
  const h = header(feed);
  const sit = useMemo(() => situation(feed), [feed, version]);
  const ab = useMemo(() => atBat(feed), [feed, version]);
  const hl = useMemo(() => headline(feed), [feed, version]);
  const prev = useMemo(() => previousPlay(feed), [feed, version]);
  const halves = useMemo(() => playLog(feed), [feed, version]);
  const abbr = { away: h.away.abbr, home: h.home.abbr };
  const final = h.kind === 'final';

  return (
    <div class="gc-cols">
      <div class="gc-main">
        <NowPanel feed={feed} h={h} sit={sit} ab={ab} hl={hl} prev={prev} isReplay={isReplay} />
        <Section title="Play by play" right={<span class="muted small">newest first · click a play for pitches</span>} flush>
          <PlayLog feed={feed} halves={halves} newestFirst abbr={abbr} markFresh limit={4} />
        </Section>
      </div>
      <aside class="gc-rail">
        <WinProbBox feed={feed} h={h} maxIdx={isReplay ? (feed?.liveData?.plays?.allPlays?.length ?? 0) - 1 : Infinity} live={!final && !isReplay} />
        <PitchersBox feed={feed} h={h} />
        <ScoringBox feed={feed} h={h} />
        <BattedBallsBox feed={feed} />
      </aside>
    </div>
  );
}

// ------------------------------- Now panel ------------------------------------

function NowPanel({ feed, h, sit, ab, hl, prev, isReplay }: {
  feed: any; h: GameHeader; sit: Situation; ab?: AtBatVM; hl: ReturnType<typeof headline>;
  prev: ReturnType<typeof previousPlay>; isReplay: boolean;
}) {
  const now = useNow(5000);
  const pending = h.kind === 'preview' || h.kind === 'warmup';
  const over = h.kind === 'final' && !isReplay;
  const pitcher = sit.pitcher;
  const batter = sit.isBreak ? undefined : (ab && !ab.complete ? ab.batter : sit.batter);
  const pt = pitcherToday(feed, pitcher?.id);

  return (
    <section class="box now">
      <div class={`headline ${hl.kind} ${hl.pitchCls ?? ''}${hl.scoring ? ' scoring' : ''}`}>
        {hl.tag && <Tag tag={hl.tag} />}
        <span class="headline-text">{hl.text}</span>
        {hl.time && !isReplay && <span class="headline-time muted">{relTime(hl.time, now)}</span>}
      </div>
      {prev && hl.kind !== 'status' && (
        <div class="prevline">
          <span class="muted">Previous:</span> <Tag tag={prev.tag} /> {prev.text}
          {prev.score && <b class="prev-score"> {prev.score}</b>}
        </div>
      )}

      {pending && <div class="now-empty muted">The gamecast starts with the first pitch. See the Preview tab for lineups and probable pitchers.</div>}

      {!pending && !over && (
        <div class="now-grid">
          <div class="now-sit">
            <div class="now-inning">
              {sit.battingTeam && <TeamLogo id={sit.battingTeam.id} size={18} />}
              <b>{sit.label}</b>
            </div>
            <Diamond sit={sit} />
            <CountLights balls={sit.balls} strikes={sit.strikes} outs={sit.outs} />
          </div>

          {!sit.isBreak && ab ? (
            <>
              <div class="now-zone">
                <StrikeZone pitches={ab.pitches} szTop={ab.szTop} szBot={ab.szBot} bats={ab.bats} />
                <div class="zone-legend small">
                  <span><i class="pdot ball" /> Ball</span>
                  <span><i class="pdot strike" /> Strike</span>
                  <span><i class="pdot inplay" /> In play</span>
                  <span class="muted">Catcher's view</span>
                </div>
              </div>
              <div class="now-ab">
                <div class="matchup">
                  <div class="mu-row">
                    <span class="mu-role">Pitching</span>
                    <span class="mu-name"><PlayerLink p={pitcher} full /> <span class="muted">({handOf(feed, pitcher?.id, 'pitch')}HP)</span></span>
                    <span class="mu-pc num" title="Pitches thrown today">{pt.pitches} P</span>
                    <span class="mu-today">{pt.line}</span>
                    <span class="mu-season muted">{pitcherSeason(feed, pitcher?.id)}</span>
                  </div>
                  <div class="mu-row">
                    <span class="mu-role">At bat</span>
                    <span class="mu-name"><PlayerLink p={batter} full /> <span class="muted">({ab.bats || handOf(feed, batter?.id, 'bat')})</span></span>
                    <span class="mu-pc" />
                    <span class="mu-today">Today: {batterToday(feed, batter?.id)}</span>
                    <span class="mu-season muted">{batterSeason(feed, batter?.id)}</span>
                  </div>
                  <div class="mu-next small">
                    <span class="muted">On deck:</span> <PlayerLink p={sit.onDeck} />
                    {'  '}<span class="muted">In the hole:</span> <PlayerLink p={sit.inHole} />
                  </div>
                </div>
                <PitchTable events={ab.complete ? ab.events : ab.events} newestFirst />
                {ab.complete && ab.hit && (
                  <div class="now-hit">
                    <SprayField hits={[{ ...ab.hit, cls: ab.tag?.cls }]} size={120} />
                    <HitLine hit={ab.hit} />
                  </div>
                )}
              </div>
            </>
          ) : (
            <DueUp feed={feed} sit={sit} />
          )}
        </div>
      )}
    </section>
  );
}

function DueUp({ feed, sit }: { feed: any; sit: Situation }) {
  const ups = [sit.batter, sit.onDeck, sit.inHole].filter(Boolean);
  return (
    <div class="dueup">
      <h3>Due up for {sit.battingTeam?.club ?? 'next half'}</h3>
      <table class="stat">
        <tbody>
          {ups.map((p) => (
            <tr>
              <td><PlayerLink p={p} full /></td>
              <td class="muted">{handOf(feed, p!.id, 'bat')}</td>
              <td>Today: {batterToday(feed, p!.id)}</td>
              <td class="muted">{batterSeason(feed, p!.id)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {sit.pitcher && (
        <p class="small">
          <span class="muted">Pitching for {sit.fieldingTeam?.club}:</span> <PlayerLink p={sit.pitcher} full />{' '}
          <span class="muted">({pitcherToday(feed, sit.pitcher.id).pitches} pitches so far)</span>
        </p>
      )}
    </div>
  );
}

// --------------------------------- rail ---------------------------------------

function WinProbBox({ feed, h, maxIdx, live }: { feed: any; h: GameHeader; maxIdx: number; live: boolean }) {
  const completed = (feed?.liveData?.plays?.allPlays ?? []).filter((p: any) => p.about?.isComplete).length;
  // Refetch when a plate appearance completes (completed count changes), not on every pitch.
  const wp = usePoll<any[]>(h.kind === 'preview' ? null : `${ep.winProb(h.pk)}${live ? `&_n=${completed}` : ''}`, null, live ? 0 : 3_600_000);
  const pts = wpSeries(wp.data, maxIdx);
  const last = pts[pts.length - 1];
  const fav = last ? (last.home >= 50 ? { t: h.home, v: last.home } : { t: h.away, v: 100 - last.home }) : undefined;
  return (
    <Section title="Win probability" right={fav && <span><b>{fav.t.abbr}</b> {fav.v.toFixed(1)}%</span>}>
      {h.kind === 'preview' ? <div class="muted small">Available once the game starts.</div> :
        <WinProbChart points={pts} homeAbbr={h.home.abbr} awayAbbr={h.away.abbr} />}
    </Section>
  );
}

function PitchersBox({ feed, h }: { feed: any; h: GameHeader }) {
  const block = (side: 'away' | 'home') => {
    const rows = pitchersToday(feed, side);
    return (
      <>
        <tr class="sub-head"><th colSpan={8} class="name"><TeamLogo id={h[side].id} size={14} /> {h[side].club}</th></tr>
        {rows.map((r) => (
          <tr class={r.current ? 'current' : ''}>
            <td class="name"><PlayerLink p={r.p} />{r.note && <span class="muted small"> {r.note}</span>}</td>
            <td>{r.ip}</td><td>{r.h}</td><td>{r.r}</td><td>{r.er}</td><td>{r.bb}</td><td>{r.k}</td><td>{r.pc}</td>
          </tr>
        ))}
      </>
    );
  };
  return (
    <Section title="Pitchers" flush>
      <table class="stat num tight">
        <thead><tr><th class="name"></th><th>IP</th><th>H</th><th>R</th><th>ER</th><th>BB</th><th>K</th><th>P</th></tr></thead>
        <tbody>{block('away')}{block('home')}</tbody>
      </table>
    </Section>
  );
}

function ScoringBox({ feed, h }: { feed: any; h: GameHeader }) {
  const sp = scoringPlays(feed);
  return (
    <Section title="Scoring plays" flush>
      {sp.length === 0 ? <div class="pad muted small">No runs yet.</div> : (
        <table class="stat scoring-plays">
          <tbody>
            {sp.map((s) => (
              <tr>
                <td class="nowrap"><TeamLogo id={s.isTop ? h.away.id : h.home.id} size={14} /> {s.label}</td>
                <td>{s.text}</td>
                <td class="nowrap num"><b>{s.away}-{s.home}</b></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Section>
  );
}

function BattedBallsBox({ feed }: { feed: any }) {
  const hits = useMemo(() => {
    const out: any[] = [];
    for (const p of feed?.liveData?.plays?.allPlays ?? []) {
      if (!p.about?.isComplete) continue;
      const hd = [...(p.playEvents ?? [])].reverse().find((e: any) => e.hitData?.coordinates)?.hitData;
      if (!hd) continue;
      const ev: string = p.result?.eventType ?? '';
      const cls = ev === 'home_run' ? 'hr' : ['single', 'double', 'triple'].includes(ev) ? 'hit' : p.result?.isOut ? 'out' : 'other';
      out.push({ x: hd.coordinates.coordX, y: hd.coordinates.coordY, cls, label: p.result?.description });
    }
    return out;
  }, [feed, feed?.liveData?.plays?.allPlays?.length]);
  if (!hits.length) return null;
  return (
    <Section title="Batted balls">
      <div class="spray-box">
        <SprayField hits={hits} size={210} />
        <div class="zone-legend small">
          <span><i class="pdot hit" /> Hit</span><span><i class="pdot hr" /> HR</span><span><i class="pdot out" /> Out</span>
        </div>
      </div>
    </Section>
  );
}

// ------------------------------- replay bar -----------------------------------

function ReplayBar({ r }: { r: ReturnType<typeof useReplay> }) {
  const n = r.timeline.length;
  const cur = r.timeline[r.cursor];
  if (!n) return null;
  return (
    <div class="replaybar">
      <b>Replay</b>
      <button class="btn" onClick={() => { r.setPlaying(false); r.setCursor(0); }} title="Back to first pitch">⏮</button>
      <button class="btn" onClick={() => { r.setPlaying(false); r.jumpPA(-1); }} title="Previous plate appearance">◀ PA</button>
      <button class="btn" onClick={() => { r.setPlaying(false); r.setCursor(Math.max(0, r.cursor - 1)); }} title="Previous pitch">◀</button>
      <button class="btn primary" onClick={() => r.setPlaying(!r.playing)}>{r.playing ? '❚❚ Pause' : '▶ Play'}</button>
      <button class="btn" onClick={() => { r.setPlaying(false); r.setCursor(Math.min(n - 1, r.cursor + 1)); }} title="Next pitch">▶</button>
      <button class="btn" onClick={() => { r.setPlaying(false); r.jumpPA(1); }} title="Next plate appearance">PA ▶</button>
      <button class="btn" onClick={() => { r.setPlaying(false); r.setCursor(n - 1); }} title="Jump to the end">⏭</button>
      <select value={r.speed} onChange={(e) => r.setSpeed(Number((e.target as HTMLSelectElement).value))} aria-label="Replay speed">
        <option value={1}>1× (real time)</option>
        <option value={4}>4×</option>
        <option value={16}>16×</option>
        <option value={60}>60×</option>
      </select>
      <input type="range" min={0} max={n - 1} value={r.cursor} class="replay-range" aria-label="Replay position"
        onInput={(e) => { r.setPlaying(false); r.setCursor(Number((e.target as HTMLInputElement).value)); }} />
      <span class="muted small num">{r.loading ? 'loading…' : `${r.cursor + 1}/${n}`}{cur ? ` · ${new Date(cur.time).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}` : ''}</span>
    </div>
  );
}
