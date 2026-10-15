import { MAX_MESSAGE_LENGTH, type ChannelHandlers, type ChatIdentity, type ChatMessage, type ChatTransport } from '../chat/transport';

// Demo chat for ?mock: every room opens with some backlog and simulated fans keep
// posting every few seconds, so the dock can be judged with real content. It's a
// demo fixture, not a chat: you post as a fixed "you", and your messages live in
// memory only (gone on reload).

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
    const user = USERS[Math.floor(r() * USERS.length)];
    return { id: `mock-${ch}-${i}`, channel: ch, uid: `mock-${user}`, user, text: lines[Math.floor(r() * lines.length)], ts: Math.min(ts, SESSION_START - 5_000) };
  });
}

export class MockChatTransport implements ChatTransport {
  readonly label = 'Demo chat: simulated fans; your messages vanish on reload';
  readonly me: ChatIdentity = { uid: 'mock-you', name: 'you' };
  private subs = new Map<string, Set<ChannelHandlers>>();
  private sent = new Map<string, ChatMessage[]>();
  private live = new Map<string, { refs: number; timer?: number }>();
  private seq = 0;

  onIdentity(cb: (me: ChatIdentity) => void) {
    queueMicrotask(() => cb(this.me));
    return () => {};
  }

  subscribe(channel: string, h: ChannelHandlers) {
    let set = this.subs.get(channel);
    if (!set) this.subs.set(channel, (set = new Set()));
    set.add(h);
    queueMicrotask(() => {
      if (!set!.has(h)) return;
      h.status('open');
      h.reset([...backlog(channel), ...(this.sent.get(channel) ?? [])].sort((a, b) => a.ts - b.ts));
    });
    this.start(channel);
    return () => { set!.delete(h); this.stop(channel); };
  }

  send(channel: string, text: string) {
    const clientId = `mock-send-${++this.seq}`;
    if (text.length > MAX_MESSAGE_LENGTH) {
      queueMicrotask(() => this.subs.get(channel)?.forEach((h) => h.error({ code: 'too_long', clientId })));
      return clientId;
    }
    const m: ChatMessage = { id: `mock-you-${this.seq}`, channel, uid: this.me.uid, user: this.me.name, text, ts: Date.now(), clientId };
    this.sent.set(channel, [...(this.sent.get(channel) ?? []), m]);
    this.deliver(m);
    return clientId;
  }

  private deliver(m: ChatMessage) {
    this.subs.get(m.channel)?.forEach((h) => h.message(m));
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
        const user = USERS[Math.floor(r() * USERS.length)];
        this.deliver({ id: `mock-live-${ch}-${++this.seq}`, channel: ch, uid: `mock-${user}`, user, text: lines[Math.floor(r() * lines.length)], ts: Date.now() });
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
