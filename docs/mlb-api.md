# MLB Stats API (`https://statsapi.mlb.com`)

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
