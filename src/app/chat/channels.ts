import { sbGame, type SbGame } from '../model/schedule';

// Which game channels exist. A channel opens when the game appears on today's
// schedule and is archived a while after the game ends. Retention is really the
// backend's job; these constants just keep the UI consistent with it.

export const ESTIMATED_GAME_HOURS = 3.25;   // schedule has no end time, so estimate it
export const KEEP_AFTER_FINAL_HOURS = 2;    // postgame chatter window

export interface ChannelInfo {
  id: string;
  name: string;          // "TB @ CLE"
  game?: SbGame;
  state: 'open' | 'postgame' | 'archived';
}

export const GLOBAL: ChannelInfo = { id: 'global', name: 'Global', state: 'open' };

export function gameChannel(raw: any, now = Date.now()): ChannelInfo {
  const g = sbGame(raw);
  const start = Date.parse(raw.gameDate);
  let state: ChannelInfo['state'] = 'open';
  if (g.kind === 'final' || g.kind === 'postponed') {
    const end = start + ESTIMATED_GAME_HOURS * 3_600_000;
    state = now > end + KEEP_AFTER_FINAL_HOURS * 3_600_000 ? 'archived' : 'postgame';
  }
  return { id: `game-${g.pk}`, name: `${g.away.abbr} @ ${g.home.abbr}`, game: g, state };
}

/** Channel list from today's and yesterday's schedules (yesterday catches late games). */
export function channelsFrom(schedules: any[], now = Date.now()): ChannelInfo[] {
  const seen = new Set<string>();
  const out: ChannelInfo[] = [];
  for (const s of schedules) for (const d of s?.dates ?? []) for (const g of d.games ?? []) {
    const c = gameChannel(g, now);
    if (seen.has(c.id)) continue;
    seen.add(c.id);
    out.push(c);
  }
  return out;
}
