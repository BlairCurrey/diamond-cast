import { useEffect } from 'preact/hooks';
import { usePoll } from '../api/hooks';
import { ep } from '../api/endpoints';
import { baseballToday, seasonOf } from '../model/format';
import { href } from '../router';
import { ErrorBox, Loading, Section, TeamLogo } from '../components/common';
import { DIVISIONS, teamInfo } from '../../shared/teams';
import { SITE_NAME } from '../../shared/config';

const ORDER = [201, 202, 200, 204, 205, 203];

export function Standings() {
  const season = seasonOf(baseballToday());
  const res = usePoll<any>(ep.standings(season), null, 300_000);
  useEffect(() => { document.title = `Standings — ${SITE_NAME}`; }, []);
  const recs: any[] = res.data?.records ?? [];
  const byDiv = new Map(recs.map((r) => [r.division?.id, r]));
  const split = (tr: any, type: string) => {
    const s = tr.records?.splitRecords?.find((x: any) => x.type === type);
    return s ? `${s.wins}-${s.losses}` : '';
  };
  return (
    <div class="page standings">
      <h1 class="page-title">{season} Regular Season Standings</h1>
      {res.error && !res.data && <ErrorBox error={res.error} retry={res.refresh} />}
      {!res.data && !res.error && <Loading />}
      <div class="standings-grid">
        {['AL', 'NL'].map((lg) => (
          <div>
            {ORDER.filter((d) => DIVISIONS[d].league === lg).map((d) => {
              const r = byDiv.get(d);
              if (!r) return null;
              return (
                <Section title={DIVISIONS[d].name} flush>
                  <table class="stat num">
                    <thead><tr><th class="name">Team</th><th>W</th><th>L</th><th>PCT</th><th>GB</th><th>L10</th><th>STRK</th><th>HOME</th><th>AWAY</th><th>DIFF</th></tr></thead>
                    <tbody>
                      {r.teamRecords.map((tr: any) => {
                        const t = teamInfo(tr.team);
                        return (
                          <tr>
                            <td class="name"><a href={href.team(t.id)}><TeamLogo id={t.id} size={16} /> {t.name}</a></td>
                            <td>{tr.wins}</td><td>{tr.losses}</td><td>{tr.winningPercentage}</td><td>{tr.gamesBack}</td>
                            <td>{split(tr, 'lastTen')}</td><td>{tr.streak?.streakCode ?? ''}</td>
                            <td>{split(tr, 'home')}</td><td>{split(tr, 'away')}</td>
                            <td class={tr.runDifferential > 0 ? 'pos-diff' : tr.runDifferential < 0 ? 'neg-diff' : ''}>{tr.runDifferential > 0 ? '+' : ''}{tr.runDifferential}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </Section>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
