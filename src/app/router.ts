import { useEffect, useState } from 'preact/hooks';

// Hash routing (/app/#/game/123) so the app runs on any static host with zero config.

export type Route =
  | { name: 'scores'; date?: string }
  | { name: 'game'; pk: number; tab?: string }
  | { name: 'player'; id: number }
  | { name: 'team'; id: number }
  | { name: 'standings' }
  | { name: 'notfound' };

export function parse(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const [a, b, c] = parts;
  if (!a || a === 'scores') return { name: 'scores', date: b };
  if (a === 'game' && b) return { name: 'game', pk: Number(b), tab: c };
  if (a === 'player' && b) return { name: 'player', id: Number(b) };
  if (a === 'team' && b) return { name: 'team', id: Number(b) };
  if (a === 'standings') return { name: 'standings' };
  return { name: 'notfound' };
}

export function useRoute(): Route {
  const [r, setR] = useState(() => parse(location.hash));
  useEffect(() => {
    const f = () => { setR(parse(location.hash)); };
    addEventListener('hashchange', f);
    return () => removeEventListener('hashchange', f);
  }, []);
  return r;
}

export const href = {
  scores: (date?: string) => (date ? `#/scores/${date}` : '#/'),
  game: (pk: number, tab?: string) => `#/game/${pk}${tab ? '/' + tab : ''}`,
  player: (id: number) => `#/player/${id}`,
  team: (id: number) => `#/team/${id}`,
  standings: () => '#/standings',
};
