import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { usePoll } from '../api/hooks';
import { ep } from '../api/endpoints';
import { addDays, baseballToday } from '../model/format';
import { href } from '../router';
import { TeamLogo } from '../components/common';
import { dock, useDock } from './store';
import { channelsFrom, GLOBAL, type ChannelInfo } from './channels';
import { getTransport, type ChatMessage } from './transport';

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

  // Messages for global + joined channels (for unread counts), plus the active one.
  const watched = Array.from(new Set(['global', ...s.joined, s.channel]));
  const [msgs, setMsgs] = useState<Record<string, ChatMessage[]>>({});
  const [lastRead, setLastRead] = useState<Record<string, number>>(() => {
    try { return JSON.parse(localStorage.getItem('bp.chat.read') || '{}'); } catch { return {}; }
  });
  useEffect(() => {
    const tr = getTransport();
    const offs = watched.map((ch) => tr.subscribe(ch, (incoming) => {
      setMsgs((m) => {
        const cur = m[ch] ?? [];
        const ids = new Set(cur.map((x) => x.id));
        const add = incoming.filter((x) => !ids.has(x.id));
        return add.length ? { ...m, [ch]: [...cur, ...add].slice(-300) } : m;
      });
    }));
    return () => offs.forEach((f) => f());
  }, [watched.join('|')]);

  // Reading the active channel while expanded marks it read.
  const active = msgs[s.channel] ?? [];
  useEffect(() => {
    if (!s.expanded) return;
    const ts = active.length ? active[active.length - 1].ts : Date.now();
    if ((lastRead[s.channel] ?? 0) < ts) {
      const n = { ...lastRead, [s.channel]: ts };
      setLastRead(n);
      try { localStorage.setItem('bp.chat.read', JSON.stringify(n)); } catch { /* ignore */ }
    }
  }, [s.expanded, s.channel, active.length]);

  const unread = (ch: string) => (msgs[ch] ?? []).filter((m) => m.ts > (lastRead[ch] ?? 0) && m.user !== s.user).length;
  const totalUnread = watched.reduce((a, ch) => a + unread(ch), 0);

  // Reserve room at the bottom of the page so the dock never covers content.
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
          <Nick user={s.user} />
        </div>
      </div>
      <Messages msgs={active} me={s.user} info={info} />
      <Composer channel={s.channel} user={s.user} disabled={info.state === 'archived'} label={getTransport().label} />
    </div>
  );
}

function Messages({ msgs, me, info }: { msgs: ChatMessage[]; me: string; info: ChannelInfo }) {
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
            <div class={`msg${m.user === me ? ' mine' : ''}`}>
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

function Composer({ channel, user, disabled, label }: { channel: string; user: string; disabled: boolean; label: string }) {
  const [text, setText] = useState('');
  const send = async (e: Event) => {
    e.preventDefault();
    const t = text.trim();
    if (!t || disabled) return;
    setText('');
    await getTransport().send(channel, user, t.slice(0, 500));
  };
  return (
    <form class="dock-input" onSubmit={send}>
      <input
        value={text}
        onInput={(e) => setText((e.target as HTMLInputElement).value)}
        placeholder={disabled ? 'This room is closed' : `Message as ${user}`}
        maxLength={500}
        disabled={disabled}
        aria-label="Chat message"
      />
      <button class="btn primary" disabled={disabled || !text.trim()}>Send</button>
      <span class="dock-transport muted" title={label}>{label.split(' — ')[0]}</span>
    </form>
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

function Nick({ user }: { user: string }) {
  const [editing, setEditing] = useState(false);
  if (!editing) return <button class="dock-nick" onClick={() => setEditing(true)} title="Change your display name">{user} ✎</button>;
  return (
    <form onSubmit={(e) => { e.preventDefault(); const v = (e.currentTarget.elements.namedItem('n') as HTMLInputElement).value; dock.setUser(v); setEditing(false); }}>
      <input name="n" class="dock-nick-in" defaultValue={user} maxLength={24} autoFocus onBlur={(e) => { dock.setUser((e.target as HTMLInputElement).value); setEditing(false); }} />
    </form>
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
