import { render } from 'preact';
import { App } from './App';
import { apply } from '../shared/theme';
import '../shared/base.css';
import './app.css';

import { MOCK } from './api/client';
import { setTransport } from './chat/transport';

apply();
const mount = () => render(<App />, document.getElementById('app')!);
// ?mock also swaps in simulated chat, before the dock subscribes to anything.
if (MOCK) import('./mock/mockChat').then((m) => { setTransport(new m.MockChatTransport()); mount(); }, mount);
else mount();
