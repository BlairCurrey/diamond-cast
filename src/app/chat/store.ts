import { useEffect, useState } from 'preact/hooks';

// Dock UI state, independent of routing: navigating the app never changes it.
// Only explicit user actions (picking a tab, "Game chat" buttons) switch channels.

export interface DockState {
  channel: string;             // active channel id
  joined: string[];            // game channels the user has opened, in tab order
  expanded: boolean;
  height: number;              // px, when expanded
  user: string;
}

const KEY = 'bp.chatdock';

function load(): DockState {
  // First visit: open on desktop so chat is noticed; collapsed on phones, where it would cover most of the screen.
  const wide = typeof matchMedia === 'function' && matchMedia('(min-width: 701px)').matches;
  const def: DockState = { channel: 'global', joined: [], expanded: wide, height: 260, user: `fan${Math.floor(1000 + Math.random() * 9000)}` };
  try { return { ...def, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return def; }
}

let state = load();
const subs = new Set<() => void>();

function set(p: Partial<DockState>) {
  state = { ...state, ...p };
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ }
  subs.forEach((f) => f());
}

export const dock = {
  get: () => state,
  select(channel: string) { set({ channel }); },
  /** Explicit "chat about this game": join (add a tab), select it, open the dock. */
  openGame(pk: number) {
    const ch = `game-${pk}`;
    set({ channel: ch, joined: state.joined.includes(ch) ? state.joined : [...state.joined, ch], expanded: true });
  },
  join(ch: string) { if (!state.joined.includes(ch)) set({ joined: [...state.joined, ch] }); set({ channel: ch }); },
  leave(ch: string) {
    set({ joined: state.joined.filter((c) => c !== ch), channel: state.channel === ch ? 'global' : state.channel });
  },
  /** Drop tabs for channels that no longer exist (archived games), but never the one being viewed. */
  prune(valid: Set<string>) {
    const joined = state.joined.filter((c) => valid.has(c) || c === state.channel);
    if (joined.length !== state.joined.length) set({ joined });
  },
  toggle(expanded = !state.expanded) { set({ expanded }); },
  setHeight(height: number) { set({ height: Math.max(160, Math.min(height, Math.round(innerHeight * 0.8))) }); },
  setUser(user: string) { const u = user.trim().slice(0, 24); if (u) set({ user: u }); },
};

export function useDock(): DockState {
  const [, setN] = useState(0);
  useEffect(() => { const f = () => setN((n) => n + 1); subs.add(f); return () => { subs.delete(f); }; }, []);
  return state;
}
