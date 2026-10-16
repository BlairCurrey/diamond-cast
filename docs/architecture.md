# Layout

```
index.html                 marketing site (fixed 960px page, nav, footer)
app/index.html             the app (own slim top bar, no site nav/footer)
src/shared/                design tokens (base.css), light/dark theme, team table, config
src/site/                  marketing page CSS + tiny script (theme toggle, live ticker)
src/app/
  api/                     fetch + cache, endpoint list, polling hooks, JSON-Patch, replay
  model/                   pure functions: raw API JSON -> view models
  components/              logos, links, line score, SVG charts (zone, diamond, spray, WP)
  views/                   Scoreboard, game/ (Gamecast, BoxScore, Plays, Preview), Player, Team, Standings
  chat/                    dock UI, dock state, channel rules, transport interface
  mock/                    the simulated API used by ?mock
  app.css                  all app layout/styling
```

The split that matters for redesigns: **`model/` knows the API, views don't.** Views
render view models (`situation()`, `atBat()`, `playLog()`, `teamBox()`…), and all
layout lives in `app.css` + the view markup. A major layout rework means editing
views/CSS; the data layer stays put.
