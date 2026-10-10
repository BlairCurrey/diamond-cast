// ---------------------------------------------------------------------------
// Chat transport: the seam between the chat UI and whatever backend runs it.
//
// The UI only talks to this interface. Swap LocalTransport for a real one
// (Supabase Realtime, Firebase, Ably, Pusher, PartyKit, a WebSocket server…)
// by implementing the same three methods and calling setTransport() at startup.
// Moderation, rate limiting, identity and retention belong to that backend.
// ---------------------------------------------------------------------------

export interface ChatMessage {
  id: string;
  channel: string;     // "global" | "game-<gamePk>"
  user: string;        // display name
  text: string;
  ts: number;          // ms epoch
}

export interface ChatTransport {
  /** Human-readable label shown in the dock footer ("Local preview", "Live"). */
  readonly label: string;
  /**
   * Start receiving a channel. Call `onMessages` once with recent history, then
   * again with each new message. Returns an unsubscribe function.
   */
  subscribe(channel: string, onMessages: (msgs: ChatMessage[]) => void): () => void;
  send(channel: string, user: string, text: string): Promise<void>;
}

/**
 * Stand-in transport with no server: messages persist in localStorage and are
 * shared live between tabs of this browser via BroadcastChannel. Good enough to
 * build and test the UI; it is NOT multi-user.
 */
export class LocalTransport implements ChatTransport {
  readonly label = 'Local preview — messages stay in this browser';
  private bc = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('bp-chat') : null;
  private subs = new Map<string, Set<(m: ChatMessage[]) => void>>();

  constructor() {
    this.bc?.addEventListener('message', (e) => this.deliver(e.data as ChatMessage));
  }

  private key(ch: string) { return `bp.chat.${ch}`; }

  private history(ch: string): ChatMessage[] {
    try { return JSON.parse(localStorage.getItem(this.key(ch)) || '[]'); } catch { return []; }
  }

  private deliver(m: ChatMessage) {
    this.subs.get(m.channel)?.forEach((cb) => cb([m]));
  }

  subscribe(channel: string, cb: (m: ChatMessage[]) => void) {
    let set = this.subs.get(channel);
    if (!set) this.subs.set(channel, (set = new Set()));
    set.add(cb);
    queueMicrotask(() => cb(this.history(channel)));
    return () => { set!.delete(cb); };
  }

  async send(channel: string, user: string, text: string) {
    const m: ChatMessage = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, channel, user, text, ts: Date.now() };
    const h = [...this.history(channel), m].slice(-200);
    try { localStorage.setItem(this.key(channel), JSON.stringify(h)); } catch { /* quota */ }
    this.deliver(m);
    this.bc?.postMessage(m);
  }
}

let transport: ChatTransport = new LocalTransport();
export const getTransport = () => transport;
export function setTransport(t: ChatTransport) { transport = t; }
