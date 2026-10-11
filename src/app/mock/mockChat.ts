import { LocalTransport, type ChatMessage } from '../chat/transport';

// Demo chat for ?mock: every room opens with some backlog and simulated fans keep
// posting every few seconds, so the dock can be judged with real content. Your own
// messages still go through LocalTransport (this browser only).

const USERS = ['dugout_dan', 'curveball_kate', 'bleacherbum', 'sabermetrix', 'rally_cap', 'nachos4life', 'fourseamer', 'twinbill', 'texas_leaguer', 'can_of_corn', 'seventh_stretch', 'golden_sombrero'];

const GLOBAL_LINES = [
  'anyone else bouncing between three games right now',
  'west coast games starting soon, coffee #2 incoming',
  'what a night for pitchers so far',
  'that box score from yesterday was something else',
  'standings are getting tight in the wild card',
  'who has the best broadcast booth? I say the home team every time',
  'just got home, what did I miss',
  'that diving catch is going to be on every highlight show',
  'ump zones have been wild today',
  'love the play log on this site, catching up is easy',
  'somebody please explain the infield fly rule to my roommate',
  'bullpens around the league look gassed',
  'this is the best part of the season',
  'checking in from the train, go team',
];

const GAME_LINES = [
  'that was a strike all day',
  'get the bullpen up',
  'ball four, finally',
  'how was that not a balk',
  'big spot here',
  'this lineup cannot hit a breaking ball today',
  'good pitch, swing and miss',
  'what a pickoff move',
  'run it out!!',
  'leave him in, he looks great',
  'pitch count is getting up there',
  'that ball was absolutely crushed',
  'two outs, nobody on, here comes the rally',
  'defense is carrying us tonight',
  'catcher framing that one beautifully',
  'need a double play ball right here',
  'every 3-2 pitch is a heart attack',
  'scoreboard watching already',
  'beautiful night for baseball',
  'one swing ties it',
];

const SESSION_START = Date.now();

function rng(seed: number) {
  return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
}
const hash = (s: string) => Array.from(s).reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const linesFor = (ch: string) => (ch === 'global' ? GLOBAL_LINES : GAME_LINES);

/** Stable backlog per channel (same ids/times on every subscribe within a session). */
function backlog(ch: string): ChatMessage[] {
  const r = rng(hash(ch));
  const lines = linesFor(ch);
  const n = 14 + Math.floor(r() * 10);
  let ts = SESSION_START - 25 * 60_000;
  return Array.from({ length: n }, (_, i) => {
    ts += 30_000 + r() * 90_000;
    return { id: `mock-${ch}-${i}`, channel: ch, user: USERS[Math.floor(r() * USERS.length)], text: lines[Math.floor(r() * lines.length)], ts: Math.min(ts, SESSION_START - 5_000) };
  });
}

export class MockChatTransport extends LocalTransport {
  override readonly label = 'Demo chat: simulated fans; your messages stay in this browser';
  private live = new Map<string, { refs: number; timer?: number }>();
  private seq = 0;

  override subscribe(channel: string, cb: (m: ChatMessage[]) => void) {
    let first = true;
    const off = super.subscribe(channel, (msgs) => {
      if (!first) return cb(msgs);
      first = false;
      cb([...backlog(channel), ...msgs].sort((a, b) => a.ts - b.ts));
    });
    this.start(channel);
    return () => { off(); this.stop(channel); };
  }

  private start(ch: string) {
    const st = this.live.get(ch) ?? { refs: 0 };
    st.refs++;
    this.live.set(ch, st);
    if (st.timer !== undefined) return;
    const r = rng(hash(ch) ^ 0x9e3779b9);
    const lines = linesFor(ch);
    const tick = () => {
      st.timer = window.setTimeout(() => {
        this.deliver({ id: `mock-live-${ch}-${++this.seq}`, channel: ch, user: USERS[Math.floor(r() * USERS.length)], text: lines[Math.floor(r() * lines.length)], ts: Date.now() });
        tick();
      }, (ch === 'global' ? 5_000 : 7_000) + r() * 9_000);
    };
    tick();
  }

  private stop(ch: string) {
    const st = this.live.get(ch);
    if (!st || --st.refs > 0) return;
    clearTimeout(st.timer);
    this.live.delete(ch);
  }
}
