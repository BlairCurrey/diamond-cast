import '../shared/base.css';
import './site.css';
import { apply, toggle, current, onThemeChange } from '../shared/theme';
import { getJSON } from '../app/api/client';
import { ep } from '../app/api/endpoints';
import { sbGame, isActive } from '../app/model/schedule';
import { baseballToday } from '../app/model/format';

apply();

const btn = document.getElementById('themeToggle')!;
const label = () => { btn.textContent = current() === 'dark' ? 'Light mode' : 'Dark mode'; };
label();
onThemeChange(label);
btn.addEventListener('click', () => toggle());

// Today's games ticker: real data, a quiet proof that the thing works. Hidden on any error.
async function ticker() {
  try {
    const s = await getJSON(ep.schedule(baseballToday()));
    const games = (s?.dates?.[0]?.games ?? []).map(sbGame);
    const box = document.getElementById('tickerGames')!;
    if (!games.length) return;
    box.innerHTML = '';
    for (const g of games.slice(0, 10)) {
      const a = document.createElement('a');
      a.href = `/app/#/game/${g.pk}`;
      a.className = `tk ${isActive(g.kind) ? 'live' : ''}`;
      const score = (t: typeof g.away) => (g.kind === 'preview' || g.kind === 'postponed' ? '' : String(t.runs ?? 0));
      a.innerHTML = `<span class="st"></span><b></b><span></span><b></b><span></span>`;
      const [st, a1, a2, h1, h2] = Array.from(a.children) as HTMLElement[];
      st.textContent = g.status;
      a1.textContent = g.away.abbr; a2.textContent = score(g.away);
      h1.textContent = g.home.abbr; h2.textContent = score(g.home);
      box.appendChild(a);
    }
    document.getElementById('ticker')!.hidden = false;
  } catch { /* stay hidden */ }
}
ticker();
setInterval(ticker, 60_000);
