# Basepath

A static MLB site: a marketing home page at `/` and a single-page app at `/app/`
(scoreboard, live gamecast, box scores, play-by-play, player/team pages, standings,
and a docked chat). Data comes straight from the browser to MLB's public Stats API.
No backend.

```
pnpm install
pnpm dev              # http://localhost:5173/  and  /app/
pnpm build            # static output in dist/ — deploy anywhere (Netlify, Pages, S3…)
```

Add `?mock` to the app URL (`/app/?mock`) to run on a built-in simulated slate of
games (live games advance in real time). Useful in the offseason and for design work.
`?mock=0` switches back. The "DEMO DATA" badge in the app bar shows when it's on.

## Layout

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

## The gamecast, in one paragraph

The gamecast replaces watching, so it's ordered by how fast you need each thing.
**Now**: one sentence for the last thing that happened (each pitch, or the play
result), with the previous play underneath so a glance catches you up; then the
situation (inning, diamond with runners _by name_, count/outs lights), the strike
zone with numbered pitches, the matchup with today's lines, and the pitch list.
**The story so far**: every finished plate appearance as one plain-English line,
newest first, grouped by half-inning, with a run/hit/error/LOB summary as each half
ends; scoring plays are bold with the new score; new rows flash briefly; older
innings collapse; click any play for its pitches and batted-ball data.
**Context rail**: win probability, pitchers used, scoring plays, batted balls.
Detail decays with age — pitch-level only for the current at-bat, play-level for
the log, inning-level for the summaries. The same view replays finished games pitch
by pitch (the feed's `?timecode=`), with the header and line score showing the
replay moment so nothing is spoiled.

## Data notes (MLB Stats API, `https://statsapi.mlb.com`)

All calls are in `src/app/api/endpoints.ts`:

| What              | Endpoint                                                                                                          |
| ----------------- | ----------------------------------------------------------------------------------------------------------------- |
| Day's games       | `/api/v1/schedule?sportId=1&date=…&hydrate=team,linescore,probablePitcher,decisions,seriesStatus,broadcasts(all)` |
| Game feed         | `/api/v1.1/game/{pk}/feed/live` (gameData + liveData: plays, linescore, boxscore)                                 |
| Live diffs        | `/api/v1.1/game/{pk}/feed/live/diffPatch?startTimecode=…` (JSON Patch; falls back to full)                        |
| Time travel       | `/api/v1.1/game/{pk}/feed/live?timecode=yyyyMMdd_HHmmss` (replay)                                                 |
| Win prob          | `/api/v1/game/{pk}/winProbability`                                                                                |
| Player            | `/api/v1/people/{id}?hydrate=currentTeam,stats(…)`                                                                |
| Standings, roster | `/api/v1/standings`, `/api/v1/teams/{id}/roster`                                                                  |

Live polling follows `metaData.wait` (clamped 5–15s) and pauses in background tabs.
Pitch locations are `pitchData.coordinates.pX/pZ` (feet, catcher's view) against the
batter's `strikeZoneTop/Bottom`; batted balls are `hitData.coordinates.coordX/Y`
(home plate ≈ 125, 198). ABS challenges show from `reviewDetails`.

Set `VITE_MLB_API` to point at your own pass-through proxy if you ever need caching or
CORS insulation. Logos/headshots hot-link `mlbstatic.com`; `VITE_LOGOS=off` and
`VITE_HEADSHOTS=off` fall back to colored abbreviation badges.

## Chat

The dock lives outside the router, so navigation never changes the channel; only
the user does (tabs, the "+ Game room" picker, or a page's "Game chat" button).
Channels: `global` and `game-<gamePk>` for today's and yesterday's games; a game room
goes read-only/archived a couple of hours after the final (`chat/channels.ts`).

The backend is a black box behind `chat/transport.ts`:

```ts
interface ChatTransport {
  label: string;
  subscribe(channel, onMessages): () => void; // history first, then live
  send(channel, user, text): Promise<void>;
}
```

The shipped `LocalTransport` keeps messages in localStorage and syncs browser tabs
— a stand-in, not multi-user. Implement the interface over Supabase Realtime,
Firebase, Ably, PartyKit, etc., and call `setTransport()` in `src/app/main.tsx`.

## Legal

The Stats API is unofficial and its copyright notice limits use to individual,
non-commercial, non-bulk purposes. Team logos are MLB trademarks. Fine for a
personal/fan project; get a licensed data feed before charging money or running ads.
