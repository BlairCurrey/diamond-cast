import { connect, type ChatClient, type Message } from 'hobbychat';
import type { ChannelHandlers, ChatIdentity, ChatMessage, ChatTransport } from './transport';

// The real chat backend: hobbychat (https://github.com/BlairCurrey/hobbychat).
// One hobbychat connection per channel (channel id = hobbychat room name),
// shared by every subscriber of that channel and closed when the last one leaves.
// hobbychat reconnects, heartbeats and queues sends on its own.

/** Game rooms use their own app ID so the server can give them shorter retention. */
const appFor = (channel: string) => (channel.startsWith('game-') ? 'diamondcast-games' : 'diamondcast');

const toChatMessage = (m: Message): ChatMessage => ({
  id: m.id, channel: m.room, uid: m.uid, user: m.name, text: m.body, ts: m.createdAt, clientId: m.clientId,
});

const KEEP = 300; // messages kept per channel for late subscribers

interface Connection {
  client: ChatClient;
  handlers: Set<ChannelHandlers>;
  /** Current message list, so a later subscriber starts from the same state. Null until joined. */
  messages: ChatMessage[] | null;
  off: (() => void)[];
}

export class HobbyChatTransport implements ChatTransport {
  readonly label = 'Live';
  private conns = new Map<string, Connection>();
  private identity: ChatIdentity | null = null;
  private identitySubs = new Set<(me: ChatIdentity) => void>();

  constructor(private url: string) {}

  get me() { return this.identity; }

  onIdentity(cb: (me: ChatIdentity) => void) {
    this.identitySubs.add(cb);
    if (this.identity) cb(this.identity);
    return () => { this.identitySubs.delete(cb); };
  }

  subscribe(channel: string, h: ChannelHandlers) {
    const c = this.conns.get(channel) ?? this.open(channel);
    c.handlers.add(h);
    h.status(c.client.status);
    if (c.messages) h.reset(c.messages);
    return () => {
      c.handlers.delete(h);
      if (c.handlers.size) return;
      c.off.forEach((f) => f());
      c.client.close();
      this.conns.delete(channel);
    };
  }

  send(channel: string, text: string) {
    const c = this.conns.get(channel);
    if (!c) throw new Error(`Not subscribed to ${channel}`);
    return c.client.send(text);
  }

  private open(channel: string): Connection {
    const client = connect({ url: this.url, app: appFor(channel), room: channel });
    const c: Connection = { client, handlers: new Set(), messages: null, off: [] };
    const each = (f: (h: ChannelHandlers) => void) => c.handlers.forEach(f);
    c.off.push(
      // Every (re)join: identity first (so "mine" is right for the history), then history replaces what we had.
      client.on('welcome', ({ you, history }) => {
        this.setIdentity(you);
        const msgs = history.map(toChatMessage).slice(-KEEP);
        c.messages = msgs;
        each((h) => h.reset(msgs));
      }),
      client.on('message', (m) => {
        const msg = toChatMessage(m);
        c.messages = [...(c.messages ?? []), msg].slice(-KEEP);
        each((h) => h.message(msg));
      }),
      client.on('deleted', (id) => {
        if (c.messages) c.messages = c.messages.filter((x) => x.id !== id);
        each((h) => h.deleted(id));
      }),
      client.on('status', (s) => each((h) => h.status(s))),
      client.on('error', (e) => each((h) => h.error({ code: e.code, clientId: e.clientId, message: e.message }))),
    );
    this.conns.set(channel, c);
    return c;
  }

  private setIdentity(you: ChatIdentity) {
    if (this.identity?.uid === you.uid && this.identity.name === you.name) return;
    this.identity = { uid: you.uid, name: you.name };
    this.identitySubs.forEach((f) => f(this.identity!));
  }
}
