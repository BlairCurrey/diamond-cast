import { LOGOS_ENABLED } from './config';

// Static team table. The API returns names/abbreviations too, but having them locally
// means we can always render something (offline, fallback badges, logo alt text).
export interface TeamInfo { id: number; abbr: string; name: string; club: string; color: string; }

const T: [number, string, string, string, string][] = [
  [108, 'LAA', 'Los Angeles Angels', 'Angels', '#BA0021'],
  [109, 'AZ', 'Arizona Diamondbacks', 'D-backs', '#A71930'],
  [110, 'BAL', 'Baltimore Orioles', 'Orioles', '#DF4601'],
  [111, 'BOS', 'Boston Red Sox', 'Red Sox', '#BD3039'],
  [112, 'CHC', 'Chicago Cubs', 'Cubs', '#0E3386'],
  [113, 'CIN', 'Cincinnati Reds', 'Reds', '#C6011F'],
  [114, 'CLE', 'Cleveland Guardians', 'Guardians', '#00385D'],
  [115, 'COL', 'Colorado Rockies', 'Rockies', '#333366'],
  [116, 'DET', 'Detroit Tigers', 'Tigers', '#0C2340'],
  [117, 'HOU', 'Houston Astros', 'Astros', '#EB6E1F'],
  [118, 'KC', 'Kansas City Royals', 'Royals', '#004687'],
  [119, 'LAD', 'Los Angeles Dodgers', 'Dodgers', '#005A9C'],
  [120, 'WSH', 'Washington Nationals', 'Nationals', '#AB0003'],
  [121, 'NYM', 'New York Mets', 'Mets', '#002D72'],
  [133, 'ATH', 'Athletics', 'Athletics', '#003831'],
  [134, 'PIT', 'Pittsburgh Pirates', 'Pirates', '#27251F'],
  [135, 'SD', 'San Diego Padres', 'Padres', '#2F241D'],
  [136, 'SEA', 'Seattle Mariners', 'Mariners', '#0C2C56'],
  [137, 'SF', 'San Francisco Giants', 'Giants', '#FD5A1E'],
  [138, 'STL', 'St. Louis Cardinals', 'Cardinals', '#C41E3A'],
  [139, 'TB', 'Tampa Bay Rays', 'Rays', '#092C5C'],
  [140, 'TEX', 'Texas Rangers', 'Rangers', '#003278'],
  [141, 'TOR', 'Toronto Blue Jays', 'Blue Jays', '#134A8E'],
  [142, 'MIN', 'Minnesota Twins', 'Twins', '#002B5C'],
  [143, 'PHI', 'Philadelphia Phillies', 'Phillies', '#E81828'],
  [144, 'ATL', 'Atlanta Braves', 'Braves', '#CE1141'],
  [145, 'CWS', 'Chicago White Sox', 'White Sox', '#27251F'],
  [146, 'MIA', 'Miami Marlins', 'Marlins', '#00A3E0'],
  [147, 'NYY', 'New York Yankees', 'Yankees', '#0C2340'],
  [158, 'MIL', 'Milwaukee Brewers', 'Brewers', '#12284B'],
];

export const TEAMS: Record<number, TeamInfo> = Object.fromEntries(
  T.map(([id, abbr, name, club, color]) => [id, { id, abbr, name, club, color }]),
);

/** Merge static info with whatever the API gave us (API wins for names, e.g. All-Star teams). */
export function teamInfo(apiTeam: any): TeamInfo {
  const id = apiTeam?.id;
  const s = TEAMS[id];
  return {
    id,
    abbr: apiTeam?.abbreviation ?? s?.abbr ?? apiTeam?.teamCode?.toUpperCase() ?? '???',
    name: apiTeam?.name ?? s?.name ?? 'TBD',
    club: apiTeam?.teamName ?? apiTeam?.clubName ?? s?.club ?? apiTeam?.name ?? 'TBD',
    color: s?.color ?? '#666',
  };
}

/** Candidate logo URLs, best first. The <img> falls through the list on error, then to a text badge. */
export function logoUrls(teamId: number, theme: 'light' | 'dark'): string[] {
  if (!LOGOS_ENABLED || !teamId) return [];
  const base = 'https://www.mlbstatic.com/team-logos';
  return theme === 'dark'
    ? [`${base}/team-cap-on-dark/${teamId}.svg`, `${base}/${teamId}.svg`]
    : [`${base}/${teamId}.svg`, `${base}/team-cap-on-light/${teamId}.svg`];
}

export const DIVISIONS: Record<number, { name: string; short: string; league: 'AL' | 'NL' }> = {
  201: { name: 'American League East', short: 'AL East', league: 'AL' },
  202: { name: 'American League Central', short: 'AL Central', league: 'AL' },
  200: { name: 'American League West', short: 'AL West', league: 'AL' },
  204: { name: 'National League East', short: 'NL East', league: 'NL' },
  205: { name: 'National League Central', short: 'NL Central', league: 'NL' },
  203: { name: 'National League West', short: 'NL West', league: 'NL' },
};
