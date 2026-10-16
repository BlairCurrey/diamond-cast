import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { usePoll } from '../api/hooks';
import { ep } from '../api/endpoints';
import { addDays, baseballToday } from '../model/format';
import { href } from '../router';
import { TeamLogo } from '../components/common';
import { dock, useDock } from './store';
import { channelsFrom, GLOBAL, type ChannelInfo } from './channels';
import { getTransport, MAX_MESSAGE_LENGTH, type ChatIdentity, type ChatMessage, type ChatStatus, type SendError } from './transport';

type ChannelSendError = SendError & { channel: string; seq: number };

/**
 * Chat docked to the bottom of the app. It lives outside the router, so moving
 * around the app never changes the channel. Collapsed it's a one-line bar showing
 * the latest message; expanded it's a resizable panel with channel tabs.
 */
export function ChatDock() {
  const s = useDock();
  const today = baseballToday();
  const t = usePoll<any>(ep.schedule(today), 60_000, 30_000);
  const y = usePoll<any>(ep.schedule(addDays(today, -1)), 300_000, 60_000);
  const all = useMemo(() => channelsFrom([y.data, t.data]), [t.data, y.data]);
  const byId = useMemo(() => new Map<string, ChannelInfo>([[GLOBAL.id, GLOBAL], ...all.map((c) => [c.id, c] as [string, ChannelInfo])]), [all]);
  const available = all.filter((c) => c.state !== 'archived');

  useEffect(() => {
    if (t.data && y.data) dock.prune(new Set(available.map((c) => c.id)));
  }, [all]);

  const [me, setMe] = useState<ChatIdentity | null>(() => getTransport().me);
  useEffect(() => getTransport().onIdentity(setMe), []);

  // Messages for global + joined channels (for unread counts), plus the active one.
  const watched = Array.from(new Set(['global', ...s.joined, s.channel]));
  const [msgs, setMsgs] = useState<Record<string, ChatMessage[]>>({});
  const [status, setStatus] = useState<Record<string, ChatStatus>>({});
  const [sendError, setSendError] = useState<ChannelSendError | null>(null);
  const [lastRead, setLastRead] = useState<Record<string, number>>(() => {
    try { return JSON.parse(localStorage.getItem('dc.chat.read') || '{}'); } catch { return {}; }
  });
  // Subscribe to channels as they're added and unsubscribe as they're removed, so changing
  // tabs never drops and reopens the connections of channels still being watched.
  const subs = useRef(new Map<string, () => void>());
  const errorSeq = useRef(0);
  useEffect(() => {
    const tr = getTransport();
    for (const [ch, off] of subs.current) {
      if (watched.includes(ch)) continue;
      off();
      subs.current.delete(ch);
      // Forget everything about the channel: a later re-subscribe starts from "connecting".
      setMsgs(({ [ch]: _, ...rest }) => rest);
      setStatus(({ [ch]: _, ...rest }) => rest);
    }
    for (const ch of watched) {
      if (subs.current.has(ch)) continue;
      subs.current.set(ch, tr.subscribe(ch, {
        reset: (list) => setMsgs((m) => ({ ...m, [ch]: list.slice(-300) })),
        message: (x) => setMsgs((m) => {
          const cur = m[ch] ?? [];
          return cur.some((y) => y.id === x.id) ? m : { ...m, [ch]: [...cur, x].slice(-300) };
        }),
        deleted: (id) => setMsgs((m) => (m[ch] ? { ...m, [ch]: m[ch].filter((y) => y.id !== id) } : m)),
        status: (st) => setStatus((v) => ({ ...v, [ch]: st })),
        error: (e) => setSendError({ ...e, channel: ch, seq: ++errorSeq.current }),
      }));
    }
  }, [watched.join('|')]);
  useEffect(() => () => { subs.current.forEach((off) => off()); subs.current.clear(); }, []);

  // Reading the active channel while expanded marks it read.
  const active = msgs[s.channel] ?? [];
  useEffect(() => {
    if (!s.expanded) return;
    const ts = active.length ? active[active.length - 1].ts : Date.now();
    if ((lastRead[s.channel] ?? 0) < ts) {
      const n = { ...lastRead, [s.channel]: ts };
      setLastRead(n);
      try { localStorage.setItem('dc.chat.read', JSON.stringify(n)); } catch { /* ignore */ }
    }
  }, [s.expanded, s.channel, active.length]);

  const unread = (ch: string) => (msgs[ch] ?? []).filter((m) => m.ts > (lastRead[ch] ?? 0) && m.uid !== me?.uid).length;
  const totalUnread = watched.reduce((a, ch) => a + unread(ch), 0);

  // Reserve room at the bottom of the page so the dock never covers content.
  useEffect(() => {
    document.body.classList.add('has-dock');
    return () => { document.body.classList.remove('has-dock'); };
  }, []);
  useEffect(() => {
    document.documentElement.style.setProperty('--dock-h', s.expanded ? `${s.height}px` : '30px');
  }, [s.expanded, s.height]);

  const info = byId.get(s.channel) ?? { id: s.channel, name: s.channel.replace('game-', 'Game '), state: 'archived' as const };
  const last = active[active.length - 1];

  if (!s.expanded) {
    return (
      <div class="dock collapsed" role="region" aria-label="Chat">
        <button class="dock-bar" onClick={() => dock.toggle(true)} aria-expanded="false">
          <span class="dock-toggle">▲ Chat</span>
          <span class="dock-chan">#{info.name}</span>
          <span class="dock-last muted">{last ? `${last.user}: ${last.text}` : 'No messages yet — say something'}</span>
          {totalUnread > 0 && <span class="dock-unread">{totalUnread}</span>}
        </button>
      </div>
    );
  }

  return (
    <div class="dock expanded" style={{ height: `${s.height}px` }} role="region" aria-label="Chat">
      <Resizer />
      <div class="dock-head">
        {/* Same label, same spot as the collapsed bar's, so the open/close control never moves. */}
        <button class="dock-toggle" onClick={() => dock.toggle(false)} aria-expanded="true" title="Minimize chat">▼ Chat</button>
        <div class="dock-tabs" role="tablist">
          {['global', ...s.joined].map((id) => {
            const c = byId.get(id) ?? { id, name: id.replace('game-', 'Game '), state: 'archived' as const };
            const u = id === s.channel ? 0 : unread(id);
            return (
              <span class={`dock-tab${id === s.channel ? ' on' : ''}${c.state === 'archived' ? ' archived' : ''}`} role="tab" aria-selected={id === s.channel}>
                <button onClick={() => dock.select(id)}>
                  {c.game && <TeamLogo id={c.game.away.id} size={12} />}
                  {c.game && <TeamLogo id={c.game.home.id} size={12} />}
                  #{c.name}
                  {c.game && (c.game.kind === 'live') && <span class="live-dot" />}
                  {u > 0 && <span class="dock-unread">{u}</span>}
                </button>
                {id !== 'global' && <button class="dock-x" title="Close tab" onClick={() => dock.leave(id)}>×</button>}
              </span>
            );
          })}
          <JoinMenu channels={available.filter((c) => !s.joined.includes(c.id))} />
        </div>
        <div class="dock-tools">
          {me && <span class="dock-me muted" title="Your chat name, assigned by the chat server">{me.name}</span>}
        </div>
      </div>
      <Messages msgs={active} me={me?.uid} info={info} />
      <Composer
        channel={s.channel} me={me} msgs={active} archived={info.state === 'archived'}
        status={status[s.channel] ?? 'connecting'} error={sendError} label={getTransport().label}
      />
    </div>
  );
}

function Messages({ msgs, me, info }: { msgs: ChatMessage[]; me?: string; info: ChannelInfo }) {
  const ref = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  useEffect(() => {
    const el = ref.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [msgs.length, info.id]);
  return (
    <div class="dock-msgs" ref={ref} onScroll={(e) => {
      const el = e.currentTarget as HTMLDivElement;
      stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    }}>
      <div class="dock-intro muted">
        {info.id === 'global' ? 'Everyone, every game.' : info.game ? <>Chat for <a href={href.game(info.game.pk)}>{info.game.away.club} at {info.game.home.club}</a>.</> : null}
        {info.state === 'postgame' && ' This game is over; the room closes a couple of hours after the final out.'}
        {info.state === 'archived' && ' This room is closed.'}
      </div>
      {msgs.map((m, i) => {
        const prev = msgs[i - 1];
        // Every line carries its time; a date divider only appears when the day changes.
        const newDay = prev ? dayKey(prev.ts) !== dayKey(m.ts) : dayKey(m.ts) !== dayKey(Date.now());
        return (
          <>
            {newDay && <div class="dock-time muted">{new Date(m.ts).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</div>}
            <div class={`msg${me && m.uid === me ? ' mine' : ''}`}>
              <time class="msg-time" dateTime={new Date(m.ts).toISOString()} title={fullTime.format(m.ts)}>{shortTime(m.ts)}</time>
              <span><b class="msg-user">{m.user}</b> <span class="msg-text">{m.text}</span></span>
            </div>
          </>
        );
      })}
    </div>
  );
}

const dayKey = (ts: number) => new Date(ts).toDateString();
const fullTime = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit' });
const hm = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
/** "1:14" — the AM/PM marker is dropped to keep the column narrow; the tooltip has it. */
const shortTime = (ts: number) => hm.formatToParts(ts).filter((p) => p.type !== 'dayPeriod').map((p) => p.value).join('').trim();

const ERROR_TEXT: Record<SendError['code'], string> = {
  rate_limited: 'Slow down: too many messages. Try again in a moment.',
  too_long: `Too long: ${MAX_MESSAGE_LENGTH} characters max.`,
  room_limit: "This room can't take new messages right now.",
  invalid: "That message couldn't be sent.",
  queue_full: 'Not connected: message not sent. Try again once chat reconnects.',
};

const STATUS_TEXT: Partial<Record<ChatStatus, string>> = { connecting: 'Connecting…', closed: 'Reconnecting…', banned: 'Banned' };

function Composer({ channel, me, msgs, archived, status, error, label }: {
  channel: string; me: ChatIdentity | null; msgs: ChatMessage[]; archived: boolean;
  status: ChatStatus; error: ChannelSendError | null; label: string;
}) {
  const [text, setText] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  // Sends awaiting their echo, by clientId, so a rejected one can be put back in the box.
  const pending = useRef(new Map<string, string>());
  const banned = status === 'banned';
  const disabled = archived || banned;

  useEffect(() => {
    for (const m of msgs) if (m.clientId) pending.current.delete(m.clientId);
  }, [msgs.length]);

  useEffect(() => {
    if (!error || error.channel !== channel) return;
    const lost = error.clientId ? pending.current.get(error.clientId) : undefined;
    if (error.clientId) pending.current.delete(error.clientId);
    if (lost !== undefined) setText((cur) => (cur.trim() ? cur : lost)); // never silently drop the user's words
    setNotice(ERROR_TEXT[error.code]);
    const t = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(t);
  }, [error?.seq]);

  const send = (e: Event) => {
    e.preventDefault();
    const t = text.trim();
    if (!t || disabled) return;
    if (t.length > MAX_MESSAGE_LENGTH) { setNotice(ERROR_TEXT.too_long); return; }
    pending.current.set(getTransport().send(channel, t), t);
    setText('');
    setNotice(null);
  };

  const placeholder = banned ? "You've been banned from chat"
    : archived ? 'This room is closed'
    : me ? `Message as ${me.name}` : 'Message…';
  const footer = STATUS_TEXT[status] ?? label.split(' — ')[0];
  return (
    <>
      {(banned || notice) && (
        <div class="dock-notice" role="status">{banned ? 'A moderator has banned you from chat, so you can read but not post.' : notice}</div>
      )}
      <form class="dock-input" onSubmit={send}>
        <input
          value={text}
          onInput={(e) => setText((e.target as HTMLInputElement).value)}
          placeholder={placeholder}
          maxLength={MAX_MESSAGE_LENGTH}
          disabled={disabled}
          aria-label="Chat message"
        />
        <button class="btn primary" disabled={disabled || !text.trim()}>Send</button>
        <span class={`dock-transport muted${status === 'open' ? '' : ' warn'}`} title={label}>{footer}</span>
      </form>
    </>
  );
}

function JoinMenu({ channels }: { channels: ChannelInfo[] }) {
  if (!channels.length) return null;
  return (
    <select class="dock-join" value="" onChange={(e) => { const v = (e.target as HTMLSelectElement).value; if (v) dock.join(v); }} aria-label="Join a game channel">
      <option value="">+ Game room…</option>
      {channels.map((c) => <option value={c.id}>{c.name}{c.game?.kind === 'live' ? ' (live)' : c.state === 'postgame' ? ' (final)' : ''}</option>)}
    </select>
  );
}

function Resizer() {
  const onDown = (e: PointerEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startH = dock.get().height;
    const move = (ev: PointerEvent) => dock.setHeight(startH + (startY - ev.clientY));
    const up = () => { removeEventListener('pointermove', move); removeEventListener('pointerup', up); };
    addEventListener('pointermove', move);
    addEventListener('pointerup', up);
  };
  return <div class="dock-resize" onPointerDown={onDown} title="Drag to resize" />;
}
