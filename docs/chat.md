# Chat

The dock lives outside the router, so navigation never changes the channel; only
the user does (tabs, the "+ Game room" picker, or a page's "Game chat" button).
Channels: `global` and `game-<gamePk>` for today's and yesterday's games; a game room
goes read-only/archived a couple of hours after the final (`chat/channels.ts`).

The backend is [hobbychat](https://github.com/BlairCurrey/hobbychat), a self-hosted
real-time chat server (npm: `hobbychat`). Point the app at one with an env var:

```
VITE_CHAT_SERVER=http://localhost:8787 pnpm dev
```

- `global` connects with app ID `diamondcast`; `game-<gamePk>` rooms use
  `diamondcast-games`, so the server can give game rooms shorter retention.
  The channel id is the hobbychat room name.
- One connection per channel, shared across the dock's subscribers (Global plus any
  joined game rooms, for unread counts) and closed when the last one leaves.
- Moderation (deletes, bans), identity, rate limits, message length and retention all
  live in hobbychat. Identity is anonymous and server-assigned (a name like
  `quiet-otter`, kept across visits); names aren't unique, so the UI compares `uid`.
- Archived game rooms are read-only in the client only; the server doesn't enforce it.

Without `VITE_CHAT_SERVER` there is no chat: no dock and no "Game chat" buttons.
Identity only ever comes from the server, never the browser. `?mock` shows
`MockChatTransport`, a demo with simulated fans (you post as "you", in memory only).

Both sit behind the `ChatTransport` interface in `chat/transport.ts`: history that
is *replaced* on every (re)join, live messages, moderator deletions, connection status
(including banned), and send errors matched to the failed send by `clientId`. The
transport is chosen in `src/app/main.tsx`.
