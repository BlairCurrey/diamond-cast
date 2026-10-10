import { header, person } from '../../model/game';
import { lineup } from '../../model/box';
import { fmtTime, fmtDateLong, seasonOf } from '../../model/format';
import { usePoll } from '../../api/hooks';
import { ep } from '../../api/endpoints';
import { sbGame } from '../../model/schedule';
import { Headshot, PlayerLink, Section, TeamLogo } from '../../components/common';

export function Preview({ feed }: { feed: any }) {
  const h = header(feed);
  const pp = feed?.gameData?.probablePitchers ?? {};
  const ids = [pp.away?.id, pp.home?.id].filter(Boolean) as number[];
  const season = seasonOf(h.date || new Date().toISOString().slice(0, 10));
  const people = usePoll<any>(ids.length ? ep.peopleSeason(ids, season) : null, null, 600_000);
  const sched = usePoll<any>(h.date ? ep.schedule(h.date) : null, null, 60_000);
  const sg = sched.data?.dates?.[0]?.games?.find((g: any) => g.gamePk === h.pk);
  const tv = sg ? sbGame(sg).tv : undefined;

  const pitcherCard = (side: 'away' | 'home') => {
    const ref = pp[side];
    const team = h[side];
    const p = ref ? person(feed, ref.id, ref.fullName) : undefined;
    const pr = people.data?.people?.find((x: any) => x.id === ref?.id);
    const st = pr?.stats?.find((s: any) => s.group?.displayName === 'pitching')?.splits?.slice(-1)[0]?.stat;
    const hand = feed?.gameData?.players?.[`ID${ref?.id}`]?.pitchHand?.code ?? pr?.pitchHand?.code;
    return (
      <div class="probable">
        <div class="probable-team"><TeamLogo id={team.id} size={18} /> {team.club} <span class="muted">{team.record}</span></div>
        {p ? (
          <div class="probable-body">
            <Headshot id={p.id} size={56} />
            <div>
              <div class="probable-name"><PlayerLink p={p} full /> {hand && <span class="muted">({hand}HP)</span>}</div>
              {st ? (
                <table class="stat num tight">
                  <thead><tr><th>W-L</th><th>ERA</th><th>IP</th><th>K</th><th>BB</th><th>WHIP</th></tr></thead>
                  <tbody><tr><td>{st.wins ?? 0}-{st.losses ?? 0}</td><td>{st.era ?? '-'}</td><td>{st.inningsPitched ?? '-'}</td><td>{st.strikeOuts ?? '-'}</td><td>{st.baseOnBalls ?? '-'}</td><td>{st.whip ?? '-'}</td></tr></tbody>
                </table>
              ) : <div class="muted small">{people.loading ? 'Loading stats…' : 'No season stats.'}</div>}
            </div>
          </div>
        ) : <div class="muted">Probable pitcher TBD</div>}
      </div>
    );
  };

  const lineupCol = (side: 'away' | 'home') => {
    const l = lineup(feed, side);
    return (
      <div>
        <div class="lineup-head"><TeamLogo id={h[side].id} size={16} /> {h[side].club}</div>
        {l.length === 0 ? <div class="muted small pad">Not posted yet. Lineups usually appear 2–4 hours before first pitch.</div> : (
          <table class="stat tight">
            <tbody>
              {l.map((x, i) => (
                <tr><td class="muted num">{i + 1}.</td><td><PlayerLink p={x.p} full /></td><td class="muted">{x.pos}</td><td class="muted">{x.bats}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    );
  };

  return (
    <div class="preview">
      <Section title="Game info">
        <table class="kv">
          <tbody>
            <tr><th>First pitch</th><td>{h.start ? `${fmtDateLong(h.date)}, ${fmtTime(h.start)}` : 'TBD'}</td></tr>
            {h.venue && <tr><th>Ballpark</th><td>{h.venue}</td></tr>}
            {tv && <tr><th>TV</th><td>{tv}</td></tr>}
            {h.weather && <tr><th>Weather</th><td>{h.weather}</td></tr>}
            {h.series && <tr><th>Series</th><td>{h.series}{h.seriesStatus ? ` — ${h.seriesStatus}` : ''}</td></tr>}
            <tr><th>Status</th><td>{h.detailed}</td></tr>
          </tbody>
        </table>
      </Section>
      <Section title="Probable pitchers">
        <div class="probables">{pitcherCard('away')}{pitcherCard('home')}</div>
      </Section>
      <Section title="Lineups">
        <div class="lineups">{lineupCol('away')}{lineupCol('home')}</div>
      </Section>
    </div>
  );
}
