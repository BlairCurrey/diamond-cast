import { useEffect, useRef, useState, useCallback } from 'preact/hooks';
import { getJSON, peek, MOCK } from './client';
import { ep } from './endpoints';
import { applyPatch } from './jsonpatch';
import { toTimecode } from '../model/format';
import * as theme from '../../shared/theme';

export interface Loaded<T> {
  data?: T;
  error?: Error;
  loading: boolean;
  updatedAt: number;
  refresh: () => void;
}

/** True while the tab is visible; polling pauses when it isn't. */
export function useVisible(): boolean {
  const [v, setV] = useState(!document.hidden);
  useEffect(() => {
    const f = () => setV(!document.hidden);
    document.addEventListener('visibilitychange', f);
    return () => document.removeEventListener('visibilitychange', f);
  }, []);
  return v;
}

/**
 * Fetch `path` and optionally re-fetch every `intervalMs` while visible.
 * A cached copy (if any) paints immediately. Pass path=null to skip.
 */
export function usePoll<T = any>(path: string | null, intervalMs: number | null = null, maxAge = 0): Loaded<T> {
  const [state, setState] = useState<{ data?: T; error?: Error; loading: boolean; updatedAt: number }>(() => ({
    data: path ? peek<T>(path) : undefined, loading: !!path, updatedAt: 0,
  }));
  const visible = useVisible();
  const [nonce, setNonce] = useState(0);
  const refresh = useCallback(() => setNonce((n) => n + 1), []);
  const prevPath = useRef(path);

  useEffect(() => {
    if (!path) { setState({ loading: false, updatedAt: 0 }); return; }
    let alive = true;
    let timer: number | undefined;
    const cached = peek<T>(path);
    const samePath = prevPath.current === path;
    prevPath.current = path;
    // Never show the previous route's data under a new path (e.g. another date's games).
    setState((s) => ({ ...s, data: cached ?? (samePath ? s.data : undefined), error: samePath ? s.error : undefined, loading: true }));
    const run = async (age: number) => {
      try {
        const data = await getJSON<T>(path, age);
        if (alive) setState({ data, error: undefined, loading: false, updatedAt: Date.now() });
      } catch (e) {
        if (alive) setState((s) => ({ ...s, error: e as Error, loading: false }));
      }
      if (alive && intervalMs && visible) timer = window.setTimeout(() => run(0), intervalMs);
    };
    run(maxAge);
    return () => { alive = false; clearTimeout(timer); };
  }, [path, intervalMs, visible, nonce]);

  return { ...state, refresh };
}

/**
 * The live game feed. Full fetch first; then, while the game is live, cheap
 * diffPatch polls at the cadence the API suggests (metaData.wait, 5-15s).
 * Returns the same mutable feed object plus a version counter that bumps on change.
 */
export function useGameFeed(pk: number) {
  const feedRef = useRef<any>(peek(ep.feed(pk)));
  const [version, setVersion] = useState(0);
  const [error, setError] = useState<Error>();
  const [updatedAt, setUpdatedAt] = useState(0);
  const visible = useVisible();

  useEffect(() => {
    let alive = true;
    let timer: number | undefined;
    feedRef.current = peek(ep.feed(pk));
    setVersion((v) => v + 1);

    const full = async () => {
      feedRef.current = await getJSON(ep.feed(pk));
    };
    const tick = async () => {
      try {
        const f = feedRef.current;
        if (!f) await full();
        else {
          const since = f.metaData?.timeStamp;
          const res: any = since && !MOCK ? await getJSON(ep.feedDiff(pk, since)) : await getJSON(ep.feed(pk));
          if (Array.isArray(res)) {
            if (res.length) {
              try { res.forEach((r: any) => applyPatch(f, r.diff ?? [])); }
              catch { await full(); }
            }
          } else if (res && res.gameData) {
            feedRef.current = res;
          }
        }
        if (!alive) return;
        setError(undefined);
        setUpdatedAt(Date.now());
        setVersion((v) => v + 1);
      } catch (e) {
        if (alive) setError(e as Error);
      }
      const f = feedRef.current;
      const live = f?.gameData?.status?.abstractGameState === 'Live' ||
        (f?.gameData?.status?.abstractGameState === 'Preview' && f?.gameData?.status?.codedGameState === 'P');
      const pre = f?.gameData?.status?.abstractGameState === 'Preview';
      if (alive && visible) {
        const wait = Math.min(15, Math.max(5, Number(f?.metaData?.wait) || 10)) * 1000;
        if (live) timer = window.setTimeout(tick, wait);
        else if (pre) timer = window.setTimeout(tick, 60_000);
      }
    };
    tick();
    return () => { alive = false; clearTimeout(timer); };
  }, [pk, visible]);

  return { feed: feedRef.current, version, error, updatedAt };
}

/**
 * Replay a finished game as if it were live, using the feed's ?timecode= time-travel.
 * The timeline is every pitch/action end time in the final feed.
 */
export function useReplay(pk: number, finalFeed: any, enabled: boolean) {
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [feed, setFeed] = useState<any>();
  const [loading, setLoading] = useState(false);

  const timeline = useTimeline(finalFeed);

  useEffect(() => {
    if (!enabled || !timeline.length) return;
    let alive = true;
    const t = timeline[Math.min(cursor, timeline.length - 1)];
    setLoading(true);
    getJSON(ep.feedAt(pk, toTimecode(t.time + 1000)), 3_600_000)
      .then((f) => { if (alive) { setFeed(f); setLoading(false); } })
      .catch(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [enabled, cursor, timeline, pk]);

  useEffect(() => {
    if (!playing || !enabled) return;
    if (cursor >= timeline.length - 1) { setPlaying(false); return; }
    // Real gap to the next event, compressed by `speed`, clamped so it never stalls or races.
    const gap = (timeline[cursor + 1].time - timeline[cursor].time) / speed;
    const id = window.setTimeout(() => setCursor((c) => c + 1), Math.min(8000, Math.max(700, gap)));
    return () => clearTimeout(id);
  }, [playing, cursor, speed, enabled, timeline]);

  /** Jump to the end of the next / previous plate appearance. */
  const jumpPA = (dir: 1 | -1) => {
    if (dir === 1) {
      const j = timeline.findIndex((t, k) => k > cursor && t.endOfPa);
      setCursor(j >= 0 ? j : timeline.length - 1);
    } else {
      let k = cursor - 1;
      while (k > 0 && !timeline[k].endOfPa) k--;
      setCursor(Math.max(0, k));
    }
  };

  return { feed, cursor, setCursor, timeline, playing, setPlaying, speed, setSpeed, loading, jumpPA };
}

export interface TimelinePoint { time: number; pa: number; endOfPa: boolean; label: string }

function useTimeline(finalFeed: any): TimelinePoint[] {
  const ref = useRef<{ src: any; tl: TimelinePoint[] }>({ src: null, tl: [] });
  if (ref.current.src !== finalFeed) {
    const tl: TimelinePoint[] = [];
    for (const play of finalFeed?.liveData?.plays?.allPlays ?? []) {
      const evs = (play.playEvents ?? []).filter((e: any) =>
        e.isPitch || (e.type === 'action' && !['game_advisory', 'batter_timeout', 'mound_visit'].includes(e.details?.eventType)));
      evs.forEach((e: any, i: number) => {
        const t = Date.parse(e.endTime ?? e.startTime);
        if (!isNaN(t)) tl.push({ time: t, pa: play.about.atBatIndex, endOfPa: i === evs.length - 1, label: e.details?.description ?? '' });
      });
      const end = Date.parse(play.about?.endTime ?? play.playEndTime);
      if (!isNaN(end) && tl.length && tl[tl.length - 1].time < end) {
        tl.push({ time: end, pa: play.about.atBatIndex, endOfPa: true, label: play.result?.description ?? '' });
      }
    }
    tl.sort((a, b) => a.time - b.time);
    ref.current = { src: finalFeed, tl };
  }
  return ref.current.tl;
}

/** Re-render every `ms` (for "updated 5s ago" style labels). */
export function useNow(ms = 5000): number {
  const [n, setN] = useState(Date.now());
  useEffect(() => { const id = setInterval(() => setN(Date.now()), ms); return () => clearInterval(id); }, [ms]);
  return n;
}

export function useTheme(): 'light' | 'dark' {
  const [t, setT] = useState(theme.current());
  useEffect(() => { const off = theme.onThemeChange(setT); return () => { off(); }; }, []);
  return t;
}
