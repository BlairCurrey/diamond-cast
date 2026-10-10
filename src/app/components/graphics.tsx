import type { PitchVM, Situation, HitVM, WPPoint, TagCls } from '../model/game';
import { PlayerLink } from './common';

// All charts are plain inline SVG, colored with CSS variables so both themes work.

/** Tiny base diamond for scoreboard cards. */
export function BasesMini({ bases, outs }: { bases: [boolean, boolean, boolean]; outs?: number }) {
  const b = (x: number, y: number, on: boolean) => (
    <rect x={x} y={y} width="7" height="7" transform={`rotate(45 ${x + 3.5} ${y + 3.5})`} class={on ? 'base on' : 'base'} />
  );
  return (
    <svg class="bases-mini" viewBox="0 0 34 24" width="34" height="24" aria-label={`Runners: ${['1st', '2nd', '3rd'].filter((_, i) => bases[i]).join(', ') || 'none'}`}>
      {b(13.5, 2, bases[1])}
      {b(22, 10.5, bases[0])}
      {b(5, 10.5, bases[2])}
      {outs !== undefined && [0, 1, 2].map((i) => <circle cx={11 + i * 6} cy="21.5" r="2" class={i < outs ? 'dot on' : 'dot'} />)}
    </svg>
  );
}

/** Count/outs as rows of lights: B ●●○  S ●○  O ●○ */
export function CountLights({ balls, strikes, outs }: { balls: number; strikes: number; outs: number }) {
  const row = (label: string, n: number, max: number, cls: string) => (
    <div class="lights">
      <span class="lights-lbl">{label}</span>
      {Array.from({ length: max }, (_, i) => <span class={i < n ? `light on ${cls}` : 'light'} />)}
    </div>
  );
  return (
    <div class="count-lights" aria-label={`${balls} balls, ${strikes} strikes, ${outs} outs`}>
      {row('B', balls, 3, 'ball')}
      {row('S', strikes, 2, 'strike')}
      {row('O', outs, 2, 'out')}
      <div class="count-big num">{balls}-{strikes}<span>, {outs} out{outs === 1 ? '' : 's'}</span></div>
    </div>
  );
}

/** Infield diamond with runner names next to occupied bases. */
export function Diamond({ sit }: { sit: Situation }) {
  const { first, second, third } = sit.runners;
  const base = (cx: number, cy: number, on: boolean) => (
    <rect x={cx - 8} y={cy - 8} width="16" height="16" transform={`rotate(45 ${cx} ${cy})`} class={on ? 'base on' : 'base'} />
  );
  return (
    <div class="diamond">
      <svg viewBox="0 0 160 112" width="160" height="112" aria-hidden="true">
        <path d="M80 100 L136 50 L80 6 L24 50 Z" class="infield" />
        {base(136, 50, !!first)}
        {base(80, 12, !!second)}
        {base(24, 50, !!third)}
        <path d="M74 100 h12 v4 l-6 5 l-6 -5 z" class="plate" />
      </svg>
      <div class="runner r2">{second && <PlayerLink p={second} />}</div>
      <div class="runner r1">{first && <PlayerLink p={first} />}</div>
      <div class="runner r3">{third && <PlayerLink p={third} />}</div>
    </div>
  );
}

const PLATE_HALF = 17 / 24; // half of 17 inches, in feet

/**
 * Strike zone from the catcher's / umpire's view (pX < 0 is the third-base side,
 * where a right-handed batter stands). Pitches are numbered in sequence.
 */
export function StrikeZone({ pitches, szTop, szBot, bats, size = 210, highlightLast = true }: {
  pitches: PitchVM[]; szTop: number; szBot: number; bats?: string; size?: number; highlightLast?: boolean;
}) {
  const W = 220, H = 250;
  const xMin = -2, xMax = 2, zMin = 0.3, zMax = 4.7;
  const sx = (x: number) => ((x - xMin) / (xMax - xMin)) * W;
  const sz = (z: number) => H - ((z - zMin) / (zMax - zMin)) * H;
  const r = 0.121 * (W / (xMax - xMin)) + 1.5;
  const zx = sx(-PLATE_HALF), zw = sx(PLATE_HALF) - zx, zy = sz(szTop), zh = sz(szBot) - zy;
  const shown = pitches.filter((p) => p.px !== undefined && p.pz !== undefined);
  const side = bats === 'R' ? 'left' : bats === 'L' ? 'right' : '';
  return (
    <svg class="zone" viewBox={`0 0 ${W} ${H}`} width={size} height={(size * H) / W} role="img" aria-label="Pitch locations">
      <rect x="0" y="0" width={W} height={H} class="zone-bg" />
      {side && (
        <text x={side === 'left' ? 8 : W - 8} y="18" class="zone-note" text-anchor={side === 'left' ? 'start' : 'end'}>
          {bats}HB
        </text>
      )}
      <rect x={zx} y={zy} width={zw} height={zh} class="zone-box" />
      {[1, 2].map((i) => <line x1={zx + (zw * i) / 3} x2={zx + (zw * i) / 3} y1={zy} y2={zy + zh} class="zone-grid" />)}
      {[1, 2].map((i) => <line y1={zy + (zh * i) / 3} y2={zy + (zh * i) / 3} x1={zx} x2={zx + zw} class="zone-grid" />)}
      <path d={`M${sx(-PLATE_HALF)} ${H - 14} h${zw} v5 l${-zw / 2} 7 l${-zw / 2} -7 z`} class="zone-plate" />
      {shown.map((p, i) => {
        const cx = Math.min(W - r, Math.max(r, sx(p.px!)));
        const cy = Math.min(H - r, Math.max(r, sz(p.pz!)));
        const last = highlightLast && i === shown.length - 1;
        return (
          <g class={`pitch ${p.cls}${last ? ' last' : ''}`}>
            <title>{`${p.n}. ${p.type}${p.mph ? ' ' + p.mph.toFixed(1) + ' mph' : ''}: ${p.call}`}</title>
            {last && <circle cx={cx} cy={cy} r={r + 4} class="pitch-ring" />}
            <circle cx={cx} cy={cy} r={r} />
            <text x={cx} y={cy + 3.5} text-anchor="middle">{p.n}</text>
          </g>
        );
      })}
    </svg>
  );
}

const HOME_X = 125.42, HOME_Y = 198.27;
const CLS_FOR: Record<TagCls, string> = { hit: 'hit', hr: 'hr', out: 'out', k: 'out', walk: 'out', run: 'hit', other: 'other' };

/** Spray chart in Gameday hit-coordinate space (home plate near 125,198). */
export function SprayField({ hits, size = 180 }: { hits: (HitVM & { cls?: TagCls; label?: string })[]; size?: number }) {
  const pt = (ft: number, deg: number) => {
    const a = (deg * Math.PI) / 180;
    return [HOME_X + (ft / 2.5) * Math.sin(a), HOME_Y - (ft / 2.5) * Math.cos(a)];
  };
  const fence = [[-45, 330], [-30, 365], [-15, 385], [0, 400], [15, 385], [30, 365], [45, 330]].map(([d, f]) => pt(f, d));
  const [lf, rf] = [fence[0], fence[fence.length - 1]];
  const ib = [pt(90, 45), pt(127, 0), pt(90, -45)];
  return (
    <svg class="spray" viewBox="20 25 210 185" width={size} height={(size * 185) / 210} role="img" aria-label="Batted ball locations">
      <path d={`M${HOME_X} ${HOME_Y} L${lf[0]} ${lf[1]} ${fence.map((p) => `L${p[0]} ${p[1]}`).join(' ')} L${rf[0]} ${rf[1]} Z`} class="field-grass" />
      <path d={`M${HOME_X} ${HOME_Y} L${ib[0][0]} ${ib[0][1]} L${ib[1][0]} ${ib[1][1]} L${ib[2][0]} ${ib[2][1]} Z`} class="field-infield" />
      {hits.filter((h) => h.x !== undefined && h.y !== undefined).map((h, i, all) => (
        <circle cx={h.x} cy={h.y} r={i === all.length - 1 ? 4.2 : 3.2} class={`bip ${CLS_FOR[h.cls ?? 'other']}`}>
          {h.label && <title>{h.label}</title>}
        </circle>
      ))}
    </svg>
  );
}

/** Home-team win probability across the game. */
export function WinProbChart({ points, homeAbbr, awayAbbr }: { points: WPPoint[]; homeAbbr: string; awayAbbr: string }) {
  const W = 300, H = 100, padL = 30, padR = 6;
  if (!points.length) return <div class="muted small">Win probability appears after the first plate appearance.</div>;
  const n = Math.max(points.length, 70);
  const x = (i: number) => padL + (i / (n - 1)) * (W - padL - padR);
  const y = (v: number) => 4 + (1 - v / 100) * (H - 8);
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.home).toFixed(1)}`).join(' ');
  const fill = `${d} L${x(points.length - 1).toFixed(1)} ${y(50)} L${x(0)} ${y(50)} Z`;
  const innStarts: { i: number; inning: number }[] = [];
  points.forEach((p, i) => { if (p.isTop && (i === 0 || points[i - 1].inning !== p.inning)) innStarts.push({ i, inning: p.inning }); });
  const last = points[points.length - 1];
  return (
    <svg class="wp" viewBox={`0 0 ${W} ${H}`} role="img"
      aria-label={`${homeAbbr} win probability ${last.home.toFixed(0)}%`}>
      <line x1={padL} x2={W - padR} y1={y(50)} y2={y(50)} class="wp-mid" />
      {innStarts.map((s) => (
        <g>
          <line x1={x(s.i)} x2={x(s.i)} y1="4" y2={H - 4} class="wp-inn" />
          <text x={x(s.i) + 2} y={H - 6} class="wp-lbl">{s.inning}</text>
        </g>
      ))}
      <path d={fill} class="wp-fill" />
      <path d={d} class="wp-line" vector-effect="non-scaling-stroke" />
      <text x="2" y="12" class="wp-team">{homeAbbr}</text>
      <text x="2" y={H - 4} class="wp-team">{awayAbbr}</text>
      <circle cx={x(points.length - 1)} cy={y(last.home)} r="2.5" class="wp-dot" />
    </svg>
  );
}
