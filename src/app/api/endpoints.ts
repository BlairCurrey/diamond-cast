// Every MLB Stats API call the app makes, in one place.
// Base: https://statsapi.mlb.com  (no key, CORS-enabled, undocumented but stable for years)

export const ep = {
  /** Day's games with line scores, probables, W/L/S, postseason series status, TV. */
  schedule: (date: string) =>
    `/api/v1/schedule?sportId=1&date=${date}` +
    `&hydrate=team,linescore,probablePitcher,decisions,seriesStatus,broadcasts(all)`,

  /** Full game feed: gameData (teams, players, venue, weather) + liveData (plays, linescore, boxscore). */
  feed: (pk: number) => `/api/v1.1/game/${pk}/feed/live`,

  /** The same feed frozen at a moment in time (UTC yyyyMMdd_HHmmss). Powers "replay". */
  feedAt: (pk: number, timecode: string) => `/api/v1.1/game/${pk}/feed/live?timecode=${timecode}`,

  /** JSON-Patch diffs since a timecode (cheap live polling). May return a full feed instead. */
  feedDiff: (pk: number, since: string) => `/api/v1.1/game/${pk}/feed/live/diffPatch?startTimecode=${since}`,

  /** Per-plate-appearance win probability, WPA and leverage. */
  winProb: (pk: number) =>
    `/api/v1/game/${pk}/winProbability?fields=atBatIndex,homeTeamWinProbability,awayTeamWinProbability,homeTeamWinProbabilityAdded,leverageIndex,about,inning,halfInning`,

  person: (id: number, season: number) =>
    `/api/v1/people/${id}?hydrate=currentTeam,stats(group=[hitting,pitching],type=[yearByYear,career,gameLog],season=${season},sportId=1)`,

  personPostseason: (id: number, season: number) =>
    `/api/v1/people/${id}/stats?stats=season&group=hitting,pitching&gameType=P&season=${season}`,

  /** Several people with season stats (used for probable pitchers). */
  peopleSeason: (ids: number[], season: number) =>
    `/api/v1/people?personIds=${ids.join(',')}&hydrate=stats(group=[pitching,hitting],type=[season],season=${season},sportId=1)`,

  standings: (season: number) =>
    `/api/v1/standings?leagueId=103,104&season=${season}&standingsTypes=regularSeason&hydrate=team`,

  teamSchedule: (teamId: number, start: string, end: string) =>
    `/api/v1/schedule?sportId=1&teamId=${teamId}&startDate=${start}&endDate=${end}&hydrate=team,linescore,decisions,seriesStatus`,

  /** Games between two dates, unhydrated: just what's scheduled. gameType 'W' is the World Series. */
  gamesBetween: (start: string, end: string, gameType?: string) =>
    `/api/v1/schedule?sportId=1&startDate=${start}&endDate=${end}` + (gameType ? `&gameType=${gameType}` : ''),

  roster: (teamId: number) => `/api/v1/teams/${teamId}/roster?rosterType=active&hydrate=person`,
};

export const headshot = (id: number, w = 120) =>
  `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_${w},q_auto:best/v1/people/${id}/headshot/67/current`;
