// ---------------------------------------------------------------------------
// Chat transport: the seam between the chat UI and whatever backend runs it.
//
// The UI only talks to this interface. The real backend is hobbychat
// (HobbyChatTransport, used when VITE_CHAT_SERVER is set); MockChatTransport drives
// the ?mock demo. With neither there is no chat at all: identity always comes from
// the backend, never from the browser. The shape follows
// hobbychat's model: anonymous server-assigned identity, history that is
// replaced on every (re)join, moderator deletions, and send errors matched to
// the failed send by clientId. Moderation, rate limiting, identity and
// retention belong to the backend.
// ---------------------------------------------------------------------------

export interface ChatMessage {
  id: string;
  channel: string;     // "global" | "game-<gamePk>"
  uid: string;         // stable sender identity: compare this, never the display name
  user: string;        // display name (not unique)
  text: string;        // plain text: render as text, never HTML
  ts: number;          // ms epoch
  clientId?: string;   // set on the echo of your own send
}

/** The current user, as the backend knows them. Names aren't unique; uid is. */
export interface ChatIdentity { uid: string; name: string }

export type ChatStatus = 'connecting' | 'open' | 'closed' | 'banned';

/** `queue_full`: a send made while disconnected that didn't fit in the reconnect queue. */
export type SendErrorCode = 'rate_limited' | 'too_long' | 'room_limit' | 'invalid' | 'queue_full';
/** A rejected send. `clientId` matches the value `send()` returned, when the error is about a post. */
export interface SendError { code: SendErrorCode; clientId?: string; message?: string }

/** What a channel subscriber hears. */
export interface ChannelHandlers {
  /** The channel's full message list: on join and again after every reconnect. Replaces, never merges. */
  reset(msgs: ChatMessage[]): void;
  message(m: ChatMessage): void;
  /** A moderator removed message `id`. */
  deleted(id: string): void;
  status(s: ChatStatus): void;
  error(e: SendError): void;
}

export interface ChatTransport {
  /** Human-readable label shown in the dock footer ("Live", "Demo chat: …"). */
  readonly label: string;
  /** The current user, or null until the backend has assigned one. */
  readonly me: ChatIdentity | null;
  /** Called with the identity once known (and again if it changes). Returns an unsubscribe function. */
  onIdentity(cb: (me: ChatIdentity) => void): () => void;
  /** Start receiving a channel. Returns an unsubscribe function. */
  subscribe(channel: string, handlers: ChannelHandlers): () => void;
  /** Post to a subscribed channel. Returns a clientId; a rejection arrives as `error` carrying it. */
  send(channel: string, text: string): string;
}

export const MAX_MESSAGE_LENGTH = 500;

// Set once at startup (main.tsx), before the app renders. Null means chat is off.
let transport: ChatTransport | null = null;
export const chatEnabled = () => transport !== null;
export function getTransport(): ChatTransport {
  if (!transport) throw new Error('Chat is off: no transport (set VITE_CHAT_SERVER or use ?mock)');
  return transport;
}
export function setTransport(t: ChatTransport) { transport = t; }
