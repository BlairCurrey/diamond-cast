import { render } from 'preact';
import { App } from './App';
import { apply } from '../shared/theme';
import '../shared/base.css';
import './app.css';

apply();
render(<App />, document.getElementById('app')!);
