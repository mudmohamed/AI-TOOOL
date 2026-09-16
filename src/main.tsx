import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { installDerivConnectionFix } from './services/derivConnectionFix';

// Deriv authentication/return transport only. Strategy, scanner, target and
// recovery decisions remain owned by the supplied Matrix system.
installDerivConnectionFix();

// Undo only the earlier injected 2.1x/Martingale migration if that exact
// migration was applied. Preserve the user's market, stake, target and limits.
try {
  const migrationKey = 'deriv_first_real_matches_engine_v1';
  if (localStorage.getItem(migrationKey)) {
    const raw = localStorage.getItem('deriv_auto_matches_config');
    if (raw) {
      const saved: Record<string, any> = JSON.parse(raw);
      if (
        saved.nextTradeCondition === 'MARTINGALE' &&
        Number(saved.martingaleFactor) === 2.1 &&
        saved.targetStrategy === 'MARKOV_TRANSITION'
      ) {
        localStorage.setItem(
          'deriv_auto_matches_config',
          JSON.stringify({
            ...saved,
            nextTradeCondition: 'RESET_ON_WIN',
            martingaleFactor: 1,
          }),
        );
      }
    }
    localStorage.removeItem(migrationKey);
  }
} catch {}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('Service worker registration failed:', err);
    });
  });
}
