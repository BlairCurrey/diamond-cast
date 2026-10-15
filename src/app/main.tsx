import { render } from 'preact';
import { App } from './App';
import { apply } from '../shared/theme';
import '../shared/base.css';
import './app.css';

import { MOCK } from './api/client';
import { setTransport } from './chat/transport';
import { CHAT_SERVER } from '../shared/config';

apply();
const mount = () => render(<App />, document.getElementById('app')!);
// Pick the chat transport before the app renders: ?mock gets simulated chat,
// VITE_CHAT_SERVER gets hobbychat, otherwise chat is off.
if (MOCK) import('./mock/mockChat').then((m) => { setTransport(new m.MockChatTransport()); mount(); }, mount);
else if (CHAT_SERVER) {
  const url = CHAT_SERVER;
  import('./chat/hobbychatTransport').then((m) => { setTransport(new m.HobbyChatTransport(url)); mount(); }, mount);
}
else mount();
