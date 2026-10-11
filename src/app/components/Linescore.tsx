import { TeamLogo } from './common';
import { href } from '../router';
import type { LineInning } from '../model/game';

interface LTeam { id: number; abbr: string; club: string; runs?: number; hits?: number; errors?: number; lob?: number; record?: string }

/**
 * Classic line score. `current` + `isTop` highlight the inning in progress.
 * Innings never played (home team not batting in a won bottom 9th) show "x".
 */
export function Linescore({ away, home, innings, current, isTop, final = false, live = false, showLob = false }: {
  away: LTeam; home: LTeam; innings: LineInning[]; current?: number; isTop?: boolean; final?: boolean; live?: boolean; showLob?: boolean;
}) {
  const cell = (inn: LineInning, side: 'away' | 'home') => {
    const v = inn[side];
    const isCur = live && current === inn.num && ((side === 'away') === !!isTop);
    if (v === undefined || v === null) {
      if (final && side === 'home' && inn.num >= innings.length && inn.away !== undefined) return <td class="x">x</td>;
      return <td class={isCur ? 'cur' : ''}></td>;
    }
    return <td class={isCur ? 'cur' : v > 0 ? 'scored' : ''}>{v}</td>;
  };
  const row = (t: LTeam, side: 'away' | 'home') => (
    <tr>
      <th class="ls-team"><div class="ls-teamcell">
        <a href={href.team(t.id)}><TeamLogo id={t.id} size={16} /> {t.abbr}</a>
        {t.record && <span class="muted small">{t.record}</span>}
      </div></th>
      {innings.map((i) => cell(i, side))}
      <td class="rhe r">{t.runs ?? ''}</td>
      <td class="rhe">{t.hits ?? ''}</td>
      <td class="rhe">{t.errors ?? ''}</td>
      {showLob && <td class="rhe lob">{t.lob ?? ''}</td>}
    </tr>
  );
  return (
    <div class="ls-wrap">
      <table class="linescore num">
        <thead>
          <tr>
            <th></th>
            {innings.map((i) => <th class={live && current === i.num ? 'cur' : ''}>{i.num}</th>)}
            <th class="rhe">R</th><th class="rhe">H</th><th class="rhe">E</th>
            {showLob && <th class="rhe lob">LOB</th>}
          </tr>
        </thead>
        <tbody>
          {row(away, 'away')}
          {row(home, 'home')}
        </tbody>
      </table>
    </div>
  );
}
