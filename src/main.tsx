import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// One-time migration to the first real Matches setup supplied by the user.
// Keep the user's stake/profit/loss limits, but restore the real Markov target
// and 2.1x bounded recovery settings. No simulated results are created here.
try {
  const migrationKey = 'deriv_first_real_matches_engine_v1';
  if (!localStorage.getItem(migrationKey)) {
    let saved: Record<string, any> = {};
    try {
      const raw = localStorage.getItem('deriv_auto_matches_config');
      saved = raw ? JSON.parse(raw) : {};
    } catch {}

    const nextConfig: Record<string, any> = {
      market: saved.market || '1HZ10V',
      stake: Number(saved.stake) > 0 ? Number(saved.stake) : 0.35,
      winAmount: Number(saved.winAmount) > 0 ? Number(saved.winAmount) : (Number(saved.stake) > 0 ? Number(saved.stake) : 0.35),
      expectedProfit: Number(saved.expectedProfit) > 0 ? Number(saved.expectedProfit) : 20,
      maxAcceptableLoss: Number(saved.maxAcceptableLoss) > 0 ? Number(saved.maxAcceptableLoss) : 50,
      nextTradeCondition: 'MARTINGALE',
      martingaleFactor: 2.1,
      restartOnError: true,
      executionSpeed: 'FAST',
      targetStrategy: 'MARKOV_TRANSITION',
    };

    localStorage.setItem('deriv_auto_matches_config', JSON.stringify(nextConfig));
    localStorage.setItem(migrationKey, '1');
  }

  // Remove only legacy locally-simulated session keys from the original AI Studio build.
  // Real Deriv settlement history uses the v2 keys and is preserved.
  localStorage.removeItem('deriv_recovery_session_stats');
  localStorage.removeItem('deriv_recovery_trade_history');
} catch {}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('Service worker registration failed:', err);
    });
  });
}
