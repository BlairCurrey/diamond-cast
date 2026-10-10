import { MLB_API } from '../../shared/config';

// Thin fetch layer: in-memory cache with max-age, in-flight de-duplication,
// and a switch to the synthetic demo data (?mock in the URL) for offseason/dev use.

type Entry = { t: number; data?: unknown; p?: Promise<unknown> };
const cache = new Map<string, Entry>();

export const MOCK: boolean = (() => {
  try {
    const q = new URLSearchParams(location.search);
    if (q.has('mock')) sessionStorage.setItem('bp.mock', q.get('mock') === '0' ? '0' : '1');
    return sessionStorage.getItem('bp.mock') === '1';
  } catch { return false; }
})();

let mockFetch: ((path: string) => Promise<unknown>) | null = null;

async function rawFetch(path: string): Promise<unknown> {
  if (MOCK) {
    if (!mockFetch) { mockFetch = (await import('../mock/mockApi')).mockFetch; (window as any).__bpMock = mockFetch; }
    return mockFetch(path);
  }
  const res = await fetch(MLB_API + path, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new ApiError(`HTTP ${res.status} for ${path}`, res.status);
  return res.json();
}

export class ApiError extends Error {
  constructor(msg: string, public status = 0) { super(msg); }
}

/**
 * GET an API path. Results younger than maxAge ms come from memory.
 * maxAge 0 always refetches (but concurrent callers share one request).
 */
export async function getJSON<T = any>(path: string, maxAge = 0): Promise<T> {
  const now = Date.now();
  const hit = cache.get(path);
  if (hit?.p) return hit.p as Promise<T>;
  if (hit && hit.data !== undefined && now - hit.t < maxAge) return hit.data as T;
  const p = rawFetch(path).then(
    (data) => { cache.set(path, { t: Date.now(), data }); return data; },
    (err) => { cache.delete(path); throw err; },
  );
  cache.set(path, { t: hit?.t ?? 0, data: hit?.data, p });
  return p as Promise<T>;
}

/** Peek at a cached value without fetching (for instant paint while revalidating). */
export function peek<T = any>(path: string): T | undefined {
  return cache.get(path)?.data as T | undefined;
}
