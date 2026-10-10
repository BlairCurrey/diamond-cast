import { useEffect } from 'preact/hooks';
import { useGameFeed, useNow, usePoll, useReplay } from '../../api/hooks';
import { ep } from '../../api/endpoints';
import { isActive, sbGame } from '../../model/schedule';
import { header, linescore, situation, type GameHeader } from '../../model/game';
import { fmtDateLong, fmtTime, relTime } from '../../model/format';
import { href } from '../../router';
import { ErrorBox, Loading, Tabs, TeamLogo } from '../../components/common';
import { Linescore } from '../../components/Linescore';
import { dock } from '../../chat/store';
import { Gamecast } from './Gamecast';
import { BoxScore } from './BoxScore';
import { Plays } from './Plays';
import { Preview } from './Preview';
import { SITE_NAME } from '../../../shared/config';

export function GameView({ pk, tab }: { pk: number; tab?: string }) {
  const { feed, version, error, updatedAt } = useGameFeed(pk);
  const fullH = feed?.gameData ? header(feed) : undefined;
  // Replaying a finished game: the whole page (score, line score) shows the replay
  // frame, never the final result, so nothing is spoiled.
  const isReplay = fullH?.kind === 'final' && (tab === 'gamecast');
  const replay = useReplay(pk, feed, !!isReplay);
  const shown = isReplay ? replay.feed : feed;
  const h = shown?.gameData ? header(shown) : fullH;
  useEffect(() => {
    if (h) document.title = `${h.away.abbr} ${h.kind === 'preview' ? '@' : h.away.runs + ' @'} ${h.home.abbr}${h.kind === 'preview' ? '' : ' ' + h.home.runs} — ${SITE_NAME}`;
  }, [h?.away.runs, h?.home.runs, h?.kind]);

  if (!feed?.gameData) {
    return <div class="page">{error ? <ErrorBox error={error} /> : <Loading what="Loading game" />}</div>;
  }
  const kind = fullH!.kind;
  const tabs = kind === 'preview' || kind === 'warmup' || kind === 'postponed'
    ? [{ key: 'preview', label: 'Preview' }, { key: 'gamecast', label: 'Gamecast' }]
    : kind === 'final'
      ? [{ key: 'box', label: 'Box Score' }, { key: 'plays', label: 'Play by Play' }, { key: 'gamecast', label: 'Replay' }]
      : [{ key: 'gamecast', label: 'Gamecast' }, { key: 'box', label: 'Box Score' }, { key: 'plays', label: 'Play by Play' }];
  const active = tabs.find((t) => t.key === tab)?.key ?? tabs[0].key;

  return (
    <div class="page game">
      <GameHead h={h!} feed={shown ?? feed} updatedAt={updatedAt} error={error} replay={isReplay} hideScore={isReplay && !replay.feed} />
      {kind !== 'preview' && kind !== 'postponed' && !(isReplay && !replay.feed) && (
        <Linescore
          {...linescore(shown)}
          away={h!.away}
          home={h!.home}
          final={h!.kind === 'final'}
          live={h!.kind === 'live'}
          showLob
        />
      )}
      <div class="tabrow">
        <Tabs items={tabs.map((t) => ({ ...t, href: href.game(pk, t.key) }))} active={active} />
        <button class="btn chat-btn" onClick={() => dock.openGame(pk)} title="Open this game's chat room in the dock">💬 Game chat</button>
      </div>
      {active === 'gamecast' && <Gamecast feed={feed} version={version} replay={isReplay ? replay : undefined} />}
      {active === 'box' && <BoxScore feed={feed} version={version} />}
      {active === 'plays' && <Plays feed={feed} version={version} />}
      {active === 'preview' && <Preview feed={feed} />}
    </div>
  );
}

function GameHead({ h, feed, updatedAt, error, replay = false, hideScore = false }: {
  h: GameHeader; feed: any; updatedAt: number; error?: Error; replay?: boolean; hideScore?: boolean;
}) {
  const now = useNow(5000);
  const sit = h.kind === 'live' ? situation(feed) : undefined;
  // Radio while the game is on: each team's flagship station (national if a team has none).
  const sched = usePoll<any>(isActive(h.kind) && !replay ? ep.schedule(h.date) : null, null, 600_000);
  const sg = sched.data?.dates?.[0]?.games?.find((g: any) => g.gamePk === h.pk);
  const radio = sg ? sbGame(sg).radio : undefined;
  const radioLine = radio && ([[h.away.abbr, radio.away[0]], [h.home.abbr, radio.home[0]]] as const)
    .filter(([, s]) => s).map(([who, s]) => `${who} ${s}`)
    .join(' · ') || radio?.national[0];
  const status = h.kind === 'live'
    ? `${sit!.label}${sit!.isBreak ? '' : ` · ${sit!.outs} out${sit!.outs === 1 ? '' : 's'}`}`
    : h.kind === 'final' ? (h.detailed === 'Game Over' ? 'Final' : h.detailed)
      : h.kind === 'preview' ? (h.start ? fmtTime(h.start) : h.detailed) : h.detailed;
  const side = (s: 'away' | 'home') => {
    const t = h[s];
    const showScore = h.kind !== 'preview' && h.kind !== 'postponed' && !hideScore;
    const won = h.kind === 'final' && t.runs > h[s === 'away' ? 'home' : 'away'].runs;
    return (
      <div class={`gh-team ${s}${won ? ' won' : ''}`}>
        <TeamLogo id={t.id} size={44} />
        <div class="gh-name">
          <a href={href.team(t.id)}>{t.name}</a>
          <span class="muted small">{t.record}</span>
        </div>
        {showScore && <div class="gh-score num">{t.runs}</div>}
      </div>
    );
  };
  return (
    <div class="gamehead">
      <div class="gh-top">
        <span class="muted">
          <a href={href.scores(h.date)}>&laquo; {fmtDateLong(h.date)}</a>
          {h.series && <> · <b>{h.series}</b>{h.seriesStatus ? ` (${h.seriesStatus})` : ''}</>}
        </span>
        <span class="muted small">
          {replay && <b class="replay-flag">REPLAY</b>}
          {!replay && h.kind === 'live' && (error ? <span class="warn">Connection trouble — retrying</span> : <>
            <span class="live-dot" /> Live · updated {relTime(updatedAt, now)}
          </>)}
        </span>
      </div>
      <div class="gh-main">
        {side('away')}
        <div class={`gh-status ${h.kind}`}>
          {h.kind === 'live' && !replay && <span class="live-dot" />}
          <b>{hideScore ? 'Replay' : status}</b>
          <div class="muted small">{[h.venue, h.weather].filter(Boolean).join(' · ')}</div>
          {radioLine && <div class="muted small gh-radio">Radio: {radioLine}</div>}
        </div>
        {side('home')}
      </div>
    </div>
  );
}
