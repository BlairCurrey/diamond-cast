// Small formatting helpers shared by every view.

const pad = (n: number) => String(n).padStart(2, '0');

export function ymd(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseYmd(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d, 12); // noon avoids DST edge cases
}

export function addDays(s: string, n: number): string {
  const d = parseYmd(s);
  d.setDate(d.getDate() + n);
  return ymd(d);
}

/**
 * "Today" for baseball purposes: west-coast games run past midnight Eastern,
 * so until 4 AM local we keep showing the previous calendar day.
 */
export function baseballToday(now = new Date()): string {
  const d = new Date(now);
  if (d.getHours() < 4) d.setDate(d.getDate() - 1);
  return ymd(d);
}

export function isValidYmd(s: string | undefined): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(parseYmd(s).getTime());
}

export function fmtDateLong(s: string): string {
  return parseYmd(s).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

export function fmtDateShort(s: string): string {
  return parseYmd(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function fmtDateWeekday(s: string): string {
  return parseYmd(s).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export function fmtTime(iso: string | undefined): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function halfLabel(half: string | undefined, inning: number | undefined, short = false): string {
  if (!inning) return '';
  const h = (half || '').toLowerCase();
  const word = h.startsWith('t') ? (short ? 'Top' : 'Top') : h.startsWith('b') ? (short ? 'Bot' : 'Bottom') : half || '';
  return `${word} ${ordinal(inning)}`;
}

/** UTC timecode used by the feed's ?timecode= parameter: yyyyMMdd_HHmmss */
export function toTimecode(iso: string | number | Date): string {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}_` +
    `${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`;
}

export function relTime(iso: string | number | undefined, now = Date.now()): string {
  if (!iso) return '';
  const s = Math.round((now - new Date(iso).getTime()) / 1000);
  if (s < 20) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return `${h} hr ago`;
}

export function pct(n: number | undefined, digits = 0): string {
  if (n === undefined || n === null || isNaN(n)) return '—';
  return `${n.toFixed(digits)}%`;
}

/** "Freddie Freeman" -> "Freeman"; handles Jr./III suffixes. */
export function lastName(full: string | undefined): string {
  if (!full) return '';
  const parts = full.split(' ');
  let last = parts[parts.length - 1];
  if (/^(Jr\.?|Sr\.?|II|III|IV)$/i.test(last) && parts.length > 2) last = parts[parts.length - 2];
  return last;
}

export function seasonOf(ymdStr: string): number {
  return Number(ymdStr.slice(0, 4));
}
