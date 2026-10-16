import { useEffect } from 'preact/hooks';
import { useRoute, href } from './router';
import { Scoreboard } from './views/Scoreboard';
import { GameView } from './views/game/GameView';
import { Player } from './views/Player';
import { Team } from './views/Team';
import { Standings } from './views/Standings';
import { ChatDock } from './chat/ChatDock';
import { chatEnabled } from './chat/transport';
import { useTheme } from './api/hooks';
import { MOCK } from './api/client';
import * as theme from '../shared/theme';
import { SITE_NAME } from '../shared/config';

export function App() {
  const route = useRoute();
  const t = useTheme();

  useEffect(() => {
    if (route.name === 'scores' || route.name === 'standings') document.title = `${route.name === 'scores' ? 'Scoreboard' : 'Standings'} — ${SITE_NAME}`;
    window.scrollTo(0, 0);
  }, [route.name, (route as any).pk, (route as any).id, (route as any).date]);

  const section = route.name === 'standings' ? 'standings' : 'scores';

  return (
    <>
      {/* Deliberately minimal chrome: not the marketing site's nav/footer, just a way back. */}
      <header class="appbar">
        <div class="appbar-left">
          <a class="appbar-back" href={import.meta.env.BASE_URL} title={`Back to the ${SITE_NAME} home page`}>&lsaquo; Home</a>
          <a class="appbar-brand" href={href.scores()}><span class="appbar-mark">◆</span> {SITE_NAME}</a>
          <nav class="appbar-nav">
            <a href={href.scores()} class={section === 'scores' ? 'on' : ''}>Scores</a>
            <a href={href.standings()} class={section === 'standings' ? 'on' : ''}>Standings</a>
          </nav>
        </div>
        <div class="appbar-right">
          {MOCK && <a class="demo-badge" href="?mock=0#/" title="Showing simulated games. Click to switch to live MLB data.">DEMO DATA</a>}
          <button class="appbar-theme" onClick={() => theme.toggle()}>{t === 'dark' ? '☀ Light' : '☾ Dark'}</button>
        </div>
      </header>
      <main class="appmain">
        {route.name === 'scores' && <Scoreboard date={route.date} />}
        {route.name === 'game' && <GameView key={route.pk} pk={route.pk} tab={route.tab} />}
        {route.name === 'player' && <Player key={route.id} id={route.id} />}
        {route.name === 'team' && <Team key={route.id} id={route.id} />}
        {route.name === 'standings' && <Standings />}
        {route.name === 'notfound' && <div class="page empty">Page not found. <a href={href.scores()}>Go to today's scores</a>.</div>}
      </main>
      {chatEnabled() && <ChatDock />}
    </>
  );
}
