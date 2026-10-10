import { usePoll } from '../api/hooks';
import { ep } from '../api/endpoints';
import { baseballToday, fmtDateShort, seasonOf } from '../model/format';
import { href } from '../router';
import { ErrorBox, Headshot, Loading, Section, TeamLink, TeamLogo } from '../components/common';
import { TEAMS } from '../../shared/teams';
import { useEffect } from 'preact/hooks';
import { SITE_NAME } from '../../shared/config';

const HIT_COLS: [string, string][] = [['gamesPlayed', 'G'], ['atBats', 'AB'], ['runs', 'R'], ['hits', 'H'], ['doubles', '2B'], ['triples', '3B'], ['homeRuns', 'HR'], ['rbi', 'RBI'], ['baseOnBalls', 'BB'], ['strikeOuts', 'K'], ['stolenBases', 'SB'], ['avg', 'AVG'], ['obp', 'OBP'], ['slg', 'SLG'], ['ops', 'OPS']];
const PIT_COLS: [string, string][] = [['wins', 'W'], ['losses', 'L'], ['era', 'ERA'], ['gamesPlayed', 'G'], ['gamesStarted', 'GS'], ['saves', 'SV'], ['inningsPitched', 'IP'], ['hits', 'H'], ['runs', 'R'], ['earnedRuns', 'ER'], ['homeRuns', 'HR'], ['baseOnBalls', 'BB'], ['strikeOuts', 'K'], ['whip', 'WHIP']];
const LOG_HIT: [string, string][] = [['atBats', 'AB'], ['hits', 'H'], ['homeRuns', 'HR'], ['rbi', 'RBI'], ['baseOnBalls', 'BB'], ['strikeOuts', 'K'], ['avg', 'AVG']];
const LOG_PIT: [string, string][] = [['inningsPitched', 'IP'], ['hits', 'H'], ['runs', 'R'], ['earnedRuns', 'ER'], ['baseOnBalls', 'BB'], ['strikeOuts', 'K'], ['era', 'ERA']];

export function Player({ id }: { id: number }) {
  const season = seasonOf(baseballToday());
  const res = usePoll<any>(ep.person(id, season), null, 300_000);
  const post = usePoll<any>(ep.personPostseason(id, season), null, 300_000);
  const p = res.data?.people?.[0];
  useEffect(() => { if (p) document.title = `${p.fullName} — ${SITE_NAME}`; }, [p?.fullName]);

  if (!p) return <div class="page">{res.error ? <ErrorBox error={res.error} retry={res.refresh} /> : <Loading what="Loading player" />}</div>;

  const stats: any[] = p.stats ?? [];
  const groupsHave = (g: string) => stats.some((s) => s.group?.displayName === g && s.splits?.length);
  const isPitcher = p.primaryPosition?.code === '1';
  const groups = (isPitcher ? ['pitching', 'hitting'] : ['hitting', 'pitching']).filter(groupsHave)
    // a position player's occasional mop-up inning isn't worth a table, and vice versa
    .filter((g, i) => i === 0 || p.primaryPosition?.abbreviation === 'TWP');
  const find = (type: string, group: string) => stats.find((s) => s.type?.displayName === type && s.group?.displayName === group);
  const team = p.currentTeam;

  return (
    <div class="page player">
      <div class="player-head box">
        <Headshot id={p.id} size={90} />
        <div class="player-id">
          <h1>{p.fullName} {p.primaryNumber && <span class="muted">#{p.primaryNumber}</span>}</h1>
          <div class="player-team">
            {team?.id && <><TeamLogo id={team.id} size={18} /> <TeamLink team={{ ...team, abbr: TEAMS[team.id]?.abbr }} show="name" /> · </>}
            {p.primaryPosition?.name ?? p.primaryPosition?.abbreviation}
          </div>
          <table class="kv small">
            <tbody>
              <tr><th>B/T</th><td>{p.batSide?.code}/{p.pitchHand?.code}</td><th>Ht/Wt</th><td>{p.height}, {p.weight} lb</td></tr>
              <tr><th>Born</th><td>{p.birthDate}{p.currentAge ? ` (age ${p.currentAge})` : ''}</td><th>From</th><td>{[p.birthCity, p.birthStateProvince, p.birthCountry].filter(Boolean).join(', ')}</td></tr>
              {p.mlbDebutDate && <tr><th>Debut</th><td>{p.mlbDebutDate}</td><th></th><td></td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {groups.length === 0 && <div class="empty">No major-league stats on file.</div>}

      {groups.map((g) => {
        const cols = g === 'pitching' ? PIT_COLS : HIT_COLS;
        const yby = find('yearByYear', g)?.splits ?? [];
        const career = find('career', g)?.splits?.[0]?.stat;
        const log = (find('gameLog', g)?.splits ?? []).slice(-10).reverse();
        const ps = post.data?.stats?.find((s: any) => s.group?.displayName === g)?.splits?.[0]?.stat;
        const cur = yby.filter((s: any) => s.season === String(season));
        return (
          <div>
            {(cur.length > 0 || ps) && (
              <Section title={`${season} ${g === 'pitching' ? 'pitching' : 'batting'}`} flush>
                <table class="stat num">
                  <thead><tr><th class="name"></th>{cols.map(([, l]) => <th>{l}</th>)}</tr></thead>
                  <tbody>
                    {cur.map((s: any) => <tr><td class="name">Regular season{cur.length > 1 && s.team ? ` (${TEAMS[s.team.id]?.abbr ?? s.team.name})` : ''}</td>{cols.map(([k]) => <td>{s.stat?.[k] ?? ''}</td>)}</tr>)}
                    {ps && <tr><td class="name">Postseason</td>{cols.map(([k]) => <td>{ps[k] ?? ''}</td>)}</tr>}
                  </tbody>
                </table>
              </Section>
            )}

            {log.length > 0 && (
              <Section title="Last 10 games" flush>
                <table class="stat num">
                  <thead><tr><th class="name">Date</th><th class="name">Opp</th>{(g === 'pitching' ? LOG_PIT : LOG_HIT).map(([, l]) => <th>{l}</th>)}</tr></thead>
                  <tbody>
                    {log.map((s: any) => (
                      <tr>
                        <td class="name">{s.game?.gamePk ? <a href={href.game(s.game.gamePk, 'box')}>{fmtDateShort(s.date)}</a> : fmtDateShort(s.date)}</td>
                        <td class="name">{s.isHome ? 'vs' : '@'} {s.opponent?.id ? <a href={href.team(s.opponent.id)}>{TEAMS[s.opponent.id]?.abbr ?? s.opponent.name}</a> : ''}</td>
                        {(g === 'pitching' ? LOG_PIT : LOG_HIT).map(([k]) => <td>{s.stat?.[k] ?? ''}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Section>
            )}

            <Section title={`Career ${g === 'pitching' ? 'pitching' : 'batting'}`} flush>
              <div class="scroll-x">
                <table class="stat num">
                  <thead><tr><th class="name">Year</th><th class="name">Team</th>{cols.map(([, l]) => <th>{l}</th>)}</tr></thead>
                  <tbody>
                    {yby.map((s: any) => (
                      <tr>
                        <td class="name">{s.season}</td>
                        <td class="name">{s.team?.id ? <a href={href.team(s.team.id)}>{TEAMS[s.team.id]?.abbr ?? s.team.name}</a> : <span class="muted">{s.numTeams ? `${s.numTeams} teams` : '—'}</span>}</td>
                        {cols.map(([k]) => <td>{s.stat?.[k] ?? ''}</td>)}
                      </tr>
                    ))}
                  </tbody>
                  {career && (
                    <tfoot><tr><td class="name">Career</td><td></td>{cols.map(([k]) => <td>{career[k] ?? ''}</td>)}</tr></tfoot>
                  )}
                </table>
              </div>
            </Section>
          </div>
        );
      })}
    </div>
  );
}
