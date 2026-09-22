from pathlib import Path

p = Path('src/App.tsx')
s = p.read_text()

replacements = [
(
"""  const handlePlaceTrade = useCallback((tradeData: TradeInput): boolean => {
    let account = accountInfoRef.current;
    if (!account.isAuthorized) {
      derivService.startVirtualPracticeSession(10000);
      account = derivService.getAccountInfo();
      accountInfoRef.current = account;
      setAccountInfo(account);
      showNotice('⚡ Instant $10,000 demo activated on real Deriv feed. Order sent!');
    }
""",
"""  const handlePlaceTrade = useCallback((tradeData: TradeInput): boolean => {
    const account = accountInfoRef.current;
    if (!account.isAuthorized || derivService.isVirtualPracticeMode()) {
      setIsConnectModalOpen(true);
      showNotice('Connect a genuine Deriv DEMO or REAL account before trading.');
      autoDispatchLockRef.current = false;
      return false;
    }

    if (!derivService.isTradingReady()) {
      const mode: AccountMode = account.isVirtual ? 'DEMO' : 'REAL';
      showNotice(`${mode} Deriv trading connection is reconnecting. No order was placed.`);
      autoDispatchLockRef.current = false;
      void derivService.connectTradingAccount(mode);
      return false;
    }
"""
),
(
"""        let account = accountInfoRef.current;
        if (!account.isAuthorized) {
          if (autoMatchesActiveRef.current || activeBotRef.current !== 'NONE') {
            derivService.startVirtualPracticeSession(10000);
            account = derivService.getAccountInfo();
            accountInfoRef.current = account;
            setAccountInfo(account);
          } else {
            return;
          }
        }
        if (!derivService.getConnectionState().connected) return;
""",
"""        const account = accountInfoRef.current;
        if (!account.isAuthorized || derivService.isVirtualPracticeMode()) return;
        if (!derivService.getConnectionState().connected) return;
        if (!derivService.isTradingReady()) return;
"""
),
(
"""  const requireAuthorizedBot = (bot: ActiveBotType): boolean => {
    if (!derivService.getConnectionState().connected) {
      derivService.connect();
    }
    if (!accountInfoRef.current.isAuthorized) {
      derivService.startVirtualPracticeSession(10000);
      const acc = derivService.getAccountInfo();
      accountInfoRef.current = acc;
      setAccountInfo(acc);
    }
    setActiveBotSafe(bot);
    return true;
  };
""",
"""  const requireAuthorizedBot = (bot: ActiveBotType): boolean => {
    if (!derivService.getConnectionState().connected) {
      derivService.connect();
    }

    const account = accountInfoRef.current;
    if (!account.isAuthorized || derivService.isVirtualPracticeMode()) {
      setIsConnectModalOpen(true);
      showNotice('Connect a genuine Deriv DEMO or REAL account before starting automated trading.');
      return false;
    }

    if (!derivService.isTradingReady()) {
      const mode: AccountMode = account.isVirtual ? 'DEMO' : 'REAL';
      void derivService.connectTradingAccount(mode);
      showNotice(`${mode} bot armed — reconnecting the authenticated Deriv trading socket.`);
    }

    setActiveBotSafe(bot);
    return true;
  };
"""
),
(
"""  const handleToggleAccountMode = async (requested: AccountMode) => {
    if (requested === 'REAL') {
      if (accountInfo.isAuthorized && !accountInfo.isVirtual) {
        showNotice(`Real Deriv Account Active (${accountInfo.loginId}).`);
        return;
      }
      const savedRealToken = typeof localStorage !== 'undefined' ? localStorage.getItem('deriv_token_real') : null;
      if (savedRealToken) {
        const ok = await derivService.authorize(savedRealToken);
        if (ok) {
          showNotice('Connected to Genuine Deriv Real Account.');
          return;
        }
      }
      setIsConnectModalOpen(true);
      showNotice('Please log in with your Deriv account to connect Real Trading.');
      return;
    }
    if (requested === 'DEMO') {
      derivService.startVirtualPracticeSession(10000);
      const acc = derivService.getAccountInfo();
      accountInfoRef.current = acc;
      setAccountInfo(acc);
      showNotice('Switched to Demo Practice Account ($10,000 USD).');
      return;
    }
  };
""",
"""  const handleToggleAccountMode = async (requested: AccountMode) => {
    if (requested === 'REAL') {
      if (accountInfoRef.current.isAuthorized && !accountInfoRef.current.isVirtual) {
        showNotice(`Real Deriv Account Active (${accountInfoRef.current.loginId}).`);
        return;
      }

      try {
        const oauthToken = localStorage.getItem('deriv_oauth_access_token_real') || '';
        const oauthExpiry = Number(localStorage.getItem('deriv_oauth_expires_at') || 0);
        if (oauthToken && oauthExpiry > Date.now() + 15000) {
          const ok = await derivService.connectOAuthAccount(oauthToken, 'REAL');
          if (ok) {
            showNotice('Connected to Genuine Deriv Real Account.');
            return;
          }
        }
      } catch {}

      const clientId = derivService.getStoredOAuthClientId();
      if (clientId) {
        await derivService.beginOAuthLogin(clientId, 'REAL');
      } else {
        setIsConnectModalOpen(true);
        showNotice('Deriv connection is not available on this deployment yet.');
      }
      return;
    }

    if (requested === 'DEMO') {
      if (accountInfoRef.current.isAuthorized && accountInfoRef.current.isVirtual && !derivService.isVirtualPracticeMode()) {
        showNotice(`Deriv Demo Account Active (${accountInfoRef.current.loginId}).`);
        return;
      }

      try {
        const oauthToken = localStorage.getItem('deriv_oauth_access_token_real') || '';
        const oauthExpiry = Number(localStorage.getItem('deriv_oauth_expires_at') || 0);
        if (oauthToken && oauthExpiry > Date.now() + 15000) {
          const ok = await derivService.connectOAuthAccount(oauthToken, 'DEMO');
          if (ok) {
            showNotice('Connected to Genuine Deriv Demo Account.');
            return;
          }
        }
      } catch {}

      const clientId = derivService.getStoredOAuthClientId();
      if (clientId) {
        await derivService.beginOAuthLogin(clientId, 'DEMO');
      } else {
        setIsConnectModalOpen(true);
        showNotice('Deriv connection is not available on this deployment yet.');
      }
      return;
    }
  };
"""
),
(
"""          const recoveryState = derivService.getRecoveryState(symbol);
          const calculatedStake = calculateNextStake(
            cfg.stake || 1,
            currentStats.cumulativeLoss,
            currentStats.consecutiveLosses,
            isMatchesMode ? 9.5 : 1.095,
            isMatchesMode ? 'X2_SUPER_RECOVERY' : 'MARTINGALE'
          );

          autoDispatchLockRef.current = true;
          lastDispatchTimeRef.current = Date.now();

          handlePlaceTradeRef.current({
            symbol,
            contractType,
            targetValue: targetDigit,
            stake: calculatedStake,
          });
""",
"""          const selectedStake = Math.max(0.35, Number(cfg.stake) || 0.35);

          autoDispatchLockRef.current = true;
          lastDispatchTimeRef.current = Date.now();

          handlePlaceTradeRef.current({
            symbol,
            contractType,
            targetValue: targetDigit,
            stake: selectedStake,
          });
"""
),
(
"""  const handleToggleAutoMatches = (running: boolean) => {
    if (running && !requireAuthorizedBot('AUTO_MATCHES')) return;
    if (running && sessionStatsRef.current.netProfit <= 0) {
      vaultedProfitRef.current = 0;
    }
    setAutoMatchesActive(running);
    autoMatchesActiveRef.current = running;
    if (!running) setActiveBotSafe('NONE');
  };
""",
"""  const handleToggleAutoMatches = (running: boolean) => {
    if (running && !requireAuthorizedBot('AUTO_MATCHES')) return;
    if (running && sessionStatsRef.current.netProfit <= 0) {
      vaultedProfitRef.current = 0;
    }
    if (running) setActiveTab('MATCHES');
    setAutoMatchesActive(running);
    autoMatchesActiveRef.current = running;
    if (!running) setActiveBotSafe('NONE');
  };
"""
),
(
"""              <button key={tab} onClick={() => setActiveTab(tab)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${activeTab === tab ? 'bg-emerald-500 text-slate-950' : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'}`}>
""",
"""              <button key={tab} onClick={() => {
                if (tab === 'SYSTEM') handleStopAllBots();
                setActiveTab(tab);
              }} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${activeTab === tab ? 'bg-emerald-500 text-slate-950' : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'}`}>
"""
),
(
"""                <div className="text-xs text-slate-300">Systems are in NO TRADES mode — live pattern monitoring only, zero orders executed.</div>
""",
"""                <div className="text-xs text-slate-300">Automated trading is active. Press STOP SCANNER or open SYSTEM to stop new orders.</div>
"""
),
]

for i, (old, new) in enumerate(replacements, 1):
    count = s.count(old)
    if count != 1:
        raise SystemExit(f'live patch {i} expected once, found {count}')
    s = s.replace(old, new)

if 'startVirtualPracticeSession(10000)' in s:
    raise SystemExit('local practice fallback still present in App.tsx')
if """          const recoveryState = derivService.getRecoveryState(symbol);
          const calculatedStake = calculateNextStake(
            cfg.stake || 1,""" in s:
    raise SystemExit('Auto Matches cumulative-loss recovery block still present')
if 'const selectedStake = Math.max(0.35, Number(cfg.stake) || 0.35);' not in s:
    raise SystemExit('fixed Auto Matches stake guard missing')

p.write_text(s)
print('live patch applied: genuine accounts + fixed Auto Matches stake + true SYSTEM no-trades guard')
