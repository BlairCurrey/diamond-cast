import { useMemo } from 'preact/hooks';
import { teamBox, gameInfo, type TeamBox } from '../../model/box';
import { header, decisions, keyPlays, wpSeries, scoringPlays, type GameHeader } from '../../model/game';
import { usePoll } from '../../api/hooks';
import { ep } from '../../api/endpoints';
import { PlayerLink, Section, Tag, TeamLogo } from '../../components/common';
import { WinProbChart } from '../../components/graphics';

export function BoxScore({ feed, version }: { feed: any; version: number }) {
  const h = header(feed);
  const away = useMemo(() => teamBox(feed, 'away'), [feed, version]);
  const home = useMemo(() => teamBox(feed, 'home'), [feed, version]);
  const info = useMemo(() => gameInfo(feed), [feed, version]);

  return (
    <div class="boxscore">
      {h.kind === 'final' && <Recap feed={feed} h={h} />}
      <div class="box-cols">
        <TeamBatting t={away} h={h} side="away" />
        <TeamBatting t={home} h={h} side="home" />
      </div>
      <div class="box-cols">
        <TeamPitching t={away} h={h} side="away" />
        <TeamPitching t={home} h={h} side="home" />
      </div>
      {info.length > 0 && (
        <Section title="Game notes">
          <div class="gameinfo">
            {info.map((i) => i.value ? <span><b>{i.label}:</b> {i.value}. </span> : <span class="muted">{i.label}. </span>)}
          </div>
        </Section>
      )}
    </div>
  );
}

function Recap({ feed, h }: { feed: any; h: GameHeader }) {
  const d = decisions(feed);
  const wp = usePoll<any[]>(ep.winProb(h.pk), null, 3_600_000);
  const pts = wpSeries(wp.data);
  const keys = keyPlays(feed, pts, 3);
  const sp = scoringPlays(feed);
  return (
    <div class="recap">
      <Section title="Final" class="recap-dec">
        <table class="stat">
          <tbody>
            {d.winner && <tr><th>Win</th><td><PlayerLink p={d.winner.p} full /></td><td class="muted">{d.winner.note}</td></tr>}
            {d.loser && <tr><th>Loss</th><td><PlayerLink p={d.loser.p} full /></td><td class="muted">{d.loser.note}</td></tr>}
            {d.save && <tr><th>Save</th><td><PlayerLink p={d.save.p} full /></td><td class="muted">{d.save.note}</td></tr>}
          </tbody>
        </table>
        {pts.length > 0 && (
          <div class="recap-wp">
            <WinProbChart points={pts} homeAbbr={h.home.abbr} awayAbbr={h.away.abbr} />
          </div>
        )}
      </Section>
      <Section title="Biggest plays" class="recap-key" flush>
        {keys.length === 0 ? <div class="pad muted small">—</div> : (
          <table class="stat">
            <tbody>
              {keys.map((k) => (
                <tr>
                  <td class="nowrap">{k.label}</td>
                  <td><Tag tag={k.tag} /> {k.text}</td>
                  <td class="nowrap num" title="Change in win probability">
                    {(k.w.added >= 0 ? h.home.abbr : h.away.abbr)} +{Math.abs(k.w.added).toFixed(0)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div class="sub-title">Scoring</div>
        {sp.length === 0 ? <div class="pad muted small">No runs scored.</div> : (
          <table class="stat">
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
    </div>
  );
}

function TeamBatting({ t, h, side }: { t: TeamBox; h: GameHeader; side: 'away' | 'home' }) {
  const team = h[side];
  return (
    <Section title={<><TeamLogo id={team.id} size={16} /> {team.name} — Batting</>} flush>
      <table class="stat num box-bat">
        <thead>
          <tr><th class="name">Batter</th><th>AB</th><th>R</th><th>H</th><th>RBI</th><th>BB</th><th>K</th><th>LOB</th><th>AVG</th><th>OPS</th></tr>
        </thead>
        <tbody>
          {t.batting.length === 0 && <tr><td colSpan={10} class="muted">Lineup not available yet.</td></tr>}
          {t.batting.map((b) => (
            <tr class={`${b.sub ? 'sub' : ''}${b.current ? ' current' : ''}`}>
              <td class="name">
                {b.note && <span class="muted">{b.note}</span>}
                <PlayerLink p={b.p} /> <span class="pos">{b.pos}</span>
              </td>
              <td>{b.ab}</td><td>{b.r}</td><td>{b.h}</td><td>{b.rbi}</td><td>{b.bb}</td><td>{b.k}</td><td>{b.lob}</td>
              <td class="muted">{b.avg}</td><td class="muted">{b.ops}</td>
            </tr>
          ))}
        </tbody>
        {t.batting.length > 0 && (
          <tfoot>
            <tr>
              <td class="name">Totals</td>
              <td>{t.battingTotals.ab}</td><td>{t.battingTotals.r}</td><td>{t.battingTotals.h}</td><td>{t.battingTotals.rbi}</td>
              <td>{t.battingTotals.bb}</td><td>{t.battingTotals.k}</td><td>{t.battingTotals.lob}</td><td></td><td></td>
            </tr>
          </tfoot>
        )}
      </table>
      {(t.notes.length > 0 || t.info.length > 0) && (
        <div class="box-notes">
          {t.notes.map((n) => <div>{n}</div>)}
          {t.info.map((blk) => (
            <div class="box-info">
              <div class="box-info-title">{blk.title}</div>
              {blk.items.map((i) => <div><b>{i.label}:</b> {i.value}</div>)}
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

function TeamPitching({ t, h, side }: { t: TeamBox; h: GameHeader; side: 'away' | 'home' }) {
  const team = h[side];
  return (
    <Section title={<><TeamLogo id={team.id} size={16} /> {team.name} — Pitching</>} flush>
      <table class="stat num box-pit">
        <thead>
          <tr><th class="name">Pitcher</th><th>IP</th><th>H</th><th>R</th><th>ER</th><th>BB</th><th>K</th><th>HR</th><th>PC-ST</th><th>ERA</th></tr>
        </thead>
        <tbody>
          {t.pitching.length === 0 && <tr><td colSpan={10} class="muted">No pitchers yet.</td></tr>}
          {t.pitching.map((p) => (
            <tr class={p.current ? 'current' : ''}>
              <td class="name"><PlayerLink p={p.p} />{p.note && <span class="muted"> {p.note}</span>}</td>
              <td>{p.ip}</td><td>{p.h}</td><td>{p.r}</td><td>{p.er}</td><td>{p.bb}</td><td>{p.k}</td><td>{p.hr}</td>
              <td>{p.pc}-{p.st}</td><td class="muted">{p.era}</td>
            </tr>
          ))}
        </tbody>
        {t.pitching.length > 1 && (
          <tfoot>
            <tr>
              <td class="name">Totals</td>
              <td>{t.pitchingTotals.ip}</td><td>{t.pitchingTotals.h}</td><td>{t.pitchingTotals.r}</td><td>{t.pitchingTotals.er}</td>
              <td>{t.pitchingTotals.bb}</td><td>{t.pitchingTotals.k}</td><td>{t.pitchingTotals.hr}</td><td>{t.pitchingTotals.pc}-{t.pitchingTotals.st}</td><td></td>
            </tr>
          </tfoot>
        )}
      </table>
    </Section>
  );
}
