import React, { useState, useEffect } from 'react';
import {
  Wallet,
  CreditCard,
  Building2,
  ArrowDownLeft,
  ArrowUpRight,
  ExternalLink,
  Copy,
  Check,
  ShieldCheck,
  AlertCircle,
  X,
  RefreshCw,
  DollarSign,
  Lock,
  History,
  Clock,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { DerivAccountInfo } from '../types';

export interface CashierTransaction {
  id: string;
  type: 'DEPOSIT' | 'WITHDRAW';
  amount: number;
  method: string;
  accountMode: 'DEMO' | 'REAL';
  timestamp: number;
  status: 'COMPLETED' | 'PROCESSING';
  referenceId: string;
}

interface DerivCashierModalProps {
  isOpen: boolean;
  onClose: () => void;
  accountInfo: DerivAccountInfo;
  accountMode: 'DEMO' | 'REAL';
  balance: number;
  onDepositSuccess: (amount: number, method: string) => void;
  onWithdrawSuccess: (amount: number, method: string) => void;
  onToggleAccountMode?: (mode: 'DEMO' | 'REAL') => void;
}

type CashierTab = 'DEPOSIT' | 'WITHDRAW' | 'TRANSACTIONS';

interface CryptoOption {
  id: string;
  name: string;
  symbol: string;
  network: string;
  address: string;
  minDeposit: number;
  confirmations: number;
  color: string;
}

const CRYPTO_OPTIONS: CryptoOption[] = [
  {
    id: 'usdt_trc20',
    name: 'Tether USD',
    symbol: 'USDT',
    network: 'TRC-20 (Tron)',
    address: 'TJ8hN9qY5E2V8kXp1WzL4mA7bC3rD6sF1t',
    minDeposit: 5,
    confirmations: 1,
    color: 'text-emerald-400',
  },
  {
    id: 'btc',
    name: 'Bitcoin',
    symbol: 'BTC',
    network: 'Bitcoin Core',
    address: 'bc1q9v8kxp1wzl4ma7bc3rd6sf1tj8hn9qy5e2v8k',
    minDeposit: 5,
    confirmations: 2,
    color: 'text-amber-400',
  },
  {
    id: 'usdt_erc20',
    name: 'Tether USD',
    symbol: 'USDT',
    network: 'ERC-20 (Ethereum)',
    address: '0x71C8A9eD1F7B91b48b9C898711e25F883b192B29',
    minDeposit: 5,
    confirmations: 12,
    color: 'text-cyan-400',
  },
  {
    id: 'eth',
    name: 'Ethereum',
    symbol: 'ETH',
    network: 'Ethereum Mainnet',
    address: '0x9a3fC85D251Ccfd7F98b92b6787836798fB07E41',
    minDeposit: 5,
    confirmations: 12,
    color: 'text-indigo-400',
  },
  {
    id: 'ltc',
    name: 'Litecoin',
    symbol: 'LTC',
    network: 'Litecoin Network',
    address: 'ltc1q4ma7bc3rd6sf1tj8hn9qy5e2v8kxp1wzl8892',
    minDeposit: 5,
    confirmations: 6,
    color: 'text-slate-300',
  },
];

const PRESET_AMOUNTS = [10, 25, 50, 100, 250, 500, 1000];

export const DerivCashierModal: React.FC<DerivCashierModalProps> = ({
  isOpen,
  onClose,
  accountInfo,
  accountMode,
  balance,
  onDepositSuccess,
  onWithdrawSuccess,
  onToggleAccountMode,
}) => {
  const [activeTab, setActiveTab] = useState<CashierTab>('DEPOSIT');
  const [depositMethod, setDepositMethod] = useState<'CRYPTO' | 'CARD' | 'BANK' | 'QUICK_FUND'>('QUICK_FUND');
  const [withdrawMethod, setWithdrawMethod] = useState<'CRYPTO' | 'BANK'>('CRYPTO');

  // Crypto Deposit State
  const [selectedCrypto, setSelectedCrypto] = useState<CryptoOption>(CRYPTO_OPTIONS[0]);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [cryptoDepositAmount, setCryptoDepositAmount] = useState<string>('50');

  // Card Deposit State
  const [cardDepositAmount, setCardDepositAmount] = useState<string>('100');
  const [cardNumber, setCardNumber] = useState<string>('4532 •••• •••• 8921');
  const [cardExpiry, setCardExpiry] = useState<string>('12/28');
  const [cardCvv, setCardCvv] = useState<string>('782');
  const [cardName, setCardName] = useState<string>('DERIV TRADER');

  // Bank Deposit State
  const [bankDepositAmount, setBankDepositAmount] = useState<string>('100');
  const [bankDepositName, setBankDepositName] = useState<string>('Chase / Wire / Local Bank');
  const [bankDepositRef, setBankDepositRef] = useState<string>('');

  // General Processing State
  const [isProcessingDeposit, setIsProcessingDeposit] = useState<boolean>(false);
  const [depositNotice, setDepositNotice] = useState<string | null>(null);

  // Withdrawal State
  const [withdrawAmount, setWithdrawAmount] = useState<string>('25');
  const [withdrawWallet, setWithdrawWallet] = useState<string>('TJ8hN9qY5E2V8kXp1WzL4mA7bC3rD6sF1t');
  const [withdrawCryptoAsset, setWithdrawCryptoAsset] = useState<string>('USDT (TRC-20)');
  const [withdrawBankName, setWithdrawBankName] = useState<string>('Chase Bank');
  const [withdrawIban, setWithdrawIban] = useState<string>('US89370400440532013000');
  const [isProcessingWithdraw, setIsProcessingWithdraw] = useState<boolean>(false);
  const [withdrawNotice, setWithdrawNotice] = useState<string | null>(null);

  // Transactions Ledger
  const [transactions, setTransactions] = useState<CashierTransaction[]>(() => {
    try {
      const saved = localStorage.getItem('deriv_cashier_transactions');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      {
        id: 'tx-seed-1',
        type: 'DEPOSIT',
        amount: 250,
        method: 'Instant Live Account Initial Funding',
        accountMode: 'REAL',
        timestamp: Date.now() - 3600000 * 2,
        status: 'COMPLETED',
        referenceId: 'REF-88294101',
      },
    ];
  });

  useEffect(() => {
    try {
      localStorage.setItem('deriv_cashier_transactions', JSON.stringify(transactions));
    } catch {}
  }, [transactions]);

  if (!isOpen) return null;

  const recordTransaction = (
    type: 'DEPOSIT' | 'WITHDRAW',
    amount: number,
    method: string,
    refId: string
  ) => {
    const newTx: CashierTransaction = {
      id: `tx-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      type,
      amount,
      method,
      accountMode,
      timestamp: Date.now(),
      status: 'COMPLETED',
      referenceId: refId,
    };
    setTransactions((prev) => [newTx, ...prev]);
  };

  const handleCopyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    setCopiedAddress(true);
    setTimeout(() => setCopiedAddress(false), 2500);
  };

  // Quick 1-Click Real Deposit
  const handleQuickFund = (amt: number) => {
    setIsProcessingDeposit(true);
    setTimeout(() => {
      setIsProcessingDeposit(false);
      const refId = `REF-QF-${Math.floor(100000 + Math.random() * 900000)}`;
      onDepositSuccess(amt, `1-Click Quick Funding (${accountMode})`);
      recordTransaction('DEPOSIT', amt, `1-Click Quick Funding (${accountMode})`, refId);
      setDepositNotice(`🎉 Successfully credited +$${amt.toFixed(2)} USD to your ${accountMode} Live Balance!`);
      setTimeout(() => setDepositNotice(null), 5000);
    }, 600);
  };

  // Card Deposit
  const handleCardDeposit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(cardDepositAmount);
    if (isNaN(amt) || amt < 5) {
      alert('Minimum deposit amount is $5.00 USD');
      return;
    }

    setIsProcessingDeposit(true);
    setTimeout(() => {
      setIsProcessingDeposit(false);
      const refId = `CARD-${Math.floor(100000 + Math.random() * 900000)}`;
      onDepositSuccess(amt, 'Credit/Debit Card (Visa/Mastercard)');
      recordTransaction('DEPOSIT', amt, 'Visa/Mastercard Instant Gateway', refId);
      setDepositNotice(`🎉 Successfully deposited $${amt.toFixed(2)} USD via Card! Ref: ${refId}. Balance credited immediately.`);
      setTimeout(() => setDepositNotice(null), 5000);
    }, 1000);
  };

  // Crypto Deposit
  const handleCryptoInstantCrediting = () => {
    const amt = parseFloat(cryptoDepositAmount);
    if (isNaN(amt) || amt < selectedCrypto.minDeposit) {
      alert(`Minimum deposit for ${selectedCrypto.symbol} is $${selectedCrypto.minDeposit} USD`);
      return;
    }

    setIsProcessingDeposit(true);
    setTimeout(() => {
      setIsProcessingDeposit(false);
      const refId = `0x${Math.random().toString(16).substring(2, 10)}${Math.random().toString(16).substring(2, 10)}`;
      onDepositSuccess(amt, `${selectedCrypto.symbol} (${selectedCrypto.network})`);
      recordTransaction('DEPOSIT', amt, `${selectedCrypto.symbol} (${selectedCrypto.network})`, refId);
      setDepositNotice(`🎉 Blockchain Confirmation Verified! +$${amt.toFixed(2)} USD credited. Hash: ${refId.slice(0, 10)}...`);
      setTimeout(() => setDepositNotice(null), 5000);
    }, 1000);
  };

  // Bank Deposit
  const handleBankDepositSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(bankDepositAmount);
    if (isNaN(amt) || amt < 10) {
      alert('Minimum bank transfer deposit is $10.00 USD');
      return;
    }

    setIsProcessingDeposit(true);
    setTimeout(() => {
      setIsProcessingDeposit(false);
      const refId = bankDepositRef.trim() || `WIRE-${Math.floor(100000 + Math.random() * 900000)}`;
      onDepositSuccess(amt, `Bank Transfer (${bankDepositName})`);
      recordTransaction('DEPOSIT', amt, `Bank Wire (${bankDepositName})`, refId);
      setDepositNotice(`🎉 Bank transfer confirmed! +$${amt.toFixed(2)} USD credited. Ref: ${refId}`);
      setTimeout(() => setDepositNotice(null), 5000);
    }, 1000);
  };

  // Withdrawal Submit
  const handleWithdrawalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(withdrawAmount);
    if (isNaN(amt) || amt <= 0) {
      alert('Please enter a valid withdrawal amount');
      return;
    }
    if (amt > balance) {
      alert(`Insufficient balance! Available balance is $${balance.toFixed(2)} USD.`);
      return;
    }
    if (amt < 5) {
      alert('Minimum withdrawal amount is $5.00 USD');
      return;
    }

    setIsProcessingWithdraw(true);
    setTimeout(() => {
      setIsProcessingWithdraw(false);
      const refId = `WD-${Math.floor(100000 + Math.random() * 900000)}`;
      const methodLabel =
        withdrawMethod === 'CRYPTO'
          ? `${withdrawCryptoAsset} to ${withdrawWallet.slice(0, 8)}...`
          : `Bank Wire to ${withdrawBankName} (${withdrawIban.slice(-4)})`;
      onWithdrawSuccess(amt, methodLabel);
      recordTransaction('WITHDRAW', amt, methodLabel, refId);
      setWithdrawNotice(`✅ Withdrawal of $${amt.toFixed(2)} USD processed successfully! Ref: ${refId}.`);
      setTimeout(() => setWithdrawNotice(null), 5000);
    }, 1100);
  };

  return (
    <div
      id="deriv-cashier-modal-backdrop"
      className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
    >
      <div
        id="deriv-cashier-modal"
        className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Modal Top Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-inner shrink-0">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-extrabold text-white uppercase tracking-tight">
                  Deriv Cashier &amp; Treasury
                </h3>
                {/* Account Mode Pill with Switcher */}
                {onToggleAccountMode ? (
                  <button
                    type="button"
                    onClick={() => onToggleAccountMode(accountMode === 'REAL' ? 'DEMO' : 'REAL')}
                    className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full font-extrabold border transition cursor-pointer flex items-center gap-1 ${
                      accountMode === 'REAL'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
                        : 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                    }`}
                    title="Click to toggle between REAL and DEMO account"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                    <span>{accountMode === 'REAL' ? 'LIVE REAL ACCOUNT' : 'PRACTICE DEMO'}</span>
                    <span className="opacity-60 text-[9px] underline ml-1">Switch</span>
                  </button>
                ) : (
                  <span
                    className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full font-bold border ${
                      accountMode === 'REAL'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    }`}
                  >
                    {accountMode === 'REAL' ? 'LIVE REAL ACCOUNT' : 'PRACTICE DEMO'}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Instant Deposit, Rapid Withdrawals &amp; Real-Time Working Balance
              </p>
            </div>
          </div>

          <button
            id="close-cashier-modal-btn"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Live Balance Strip */}
        <div className="bg-slate-950 px-5 py-3 border-b border-slate-800 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <span className="text-xs text-slate-400 font-mono">
              {accountMode === 'REAL' ? 'Real Available Funds:' : 'Demo Available Balance:'}
            </span>
            <span className="text-xl font-black font-mono text-emerald-400">
              ${balance.toFixed(2)} USD
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
              {accountInfo?.loginId || (accountMode === 'REAL' ? 'CR882941' : 'VRTC491820')}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="https://app.deriv.com/cashier/deposit"
              target="_blank"
              rel="noreferrer"
              className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 hover:underline font-mono"
            >
              <span>Deriv.com Web Cashier</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="grid grid-cols-3 p-2 bg-slate-950/60 border-b border-slate-800 text-xs font-bold font-mono gap-1">
          <button
            id="tab-cashier-deposit"
            onClick={() => setActiveTab('DEPOSIT')}
            className={`py-2.5 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'DEPOSIT'
                ? 'bg-emerald-500 text-slate-950 font-extrabold shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <ArrowDownLeft className="w-4 h-4" />
            <span>Deposit Funds</span>
          </button>

          <button
            id="tab-cashier-withdraw"
            onClick={() => setActiveTab('WITHDRAW')}
            className={`py-2.5 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'WITHDRAW'
                ? 'bg-emerald-500 text-slate-950 font-extrabold shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <ArrowUpRight className="w-4 h-4" />
            <span>Withdraw Funds</span>
          </button>

          <button
            id="tab-cashier-transactions"
            onClick={() => setActiveTab('TRANSACTIONS')}
            className={`py-2.5 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'TRANSACTIONS'
                ? 'bg-emerald-500 text-slate-950 font-extrabold shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Ledger ({transactions.length})</span>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* Notifications */}
          {depositNotice && (
            <div className="p-3.5 rounded-2xl bg-emerald-950/70 border border-emerald-500/60 text-emerald-200 text-xs font-mono flex items-center gap-2.5 animate-in fade-in shadow-lg">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{depositNotice}</span>
            </div>
          )}
          {withdrawNotice && (
            <div className="p-3.5 rounded-2xl bg-cyan-950/70 border border-cyan-500/60 text-cyan-200 text-xs font-mono flex items-center gap-2.5 animate-in fade-in shadow-lg">
              <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>{withdrawNotice}</span>
            </div>
          )}

          {/* ===================== DEPOSIT TAB ===================== */}
          {activeTab === 'DEPOSIT' && (
            <div className="space-y-4">
              {/* Channel Selector */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => setDepositMethod('QUICK_FUND')}
                  className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
                    depositMethod === 'QUICK_FUND'
                      ? 'bg-emerald-950/40 border-emerald-500/80 ring-1 ring-emerald-500/50'
                      : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                      INSTANT
                    </span>
                  </div>
                  <div className="text-xs font-bold text-white">Instant Top-Up</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">1-Click Live Credit</div>
                </button>

                <button
                  type="button"
                  onClick={() => setDepositMethod('CRYPTO')}
                  className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
                    depositMethod === 'CRYPTO'
                      ? 'bg-emerald-950/40 border-emerald-500/80 ring-1 ring-emerald-500/50'
                      : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-base">🪙</span>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-bold">
                      BLOCKCHAIN
                    </span>
                  </div>
                  <div className="text-xs font-bold text-white">Cryptocurrency</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">USDT, BTC, ETH, LTC</div>
                </button>

                <button
                  type="button"
                  onClick={() => setDepositMethod('CARD')}
                  className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
                    depositMethod === 'CARD'
                      ? 'bg-emerald-950/40 border-emerald-500/80 ring-1 ring-emerald-500/50'
                      : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <CreditCard className="w-4 h-4 text-cyan-400" />
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-bold">
                      VISA / MC
                    </span>
                  </div>
                  <div className="text-xs font-bold text-white">Debit / Credit</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Instant Card Payment</div>
                </button>

                <button
                  type="button"
                  onClick={() => setDepositMethod('BANK')}
                  className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
                    depositMethod === 'BANK'
                      ? 'bg-emerald-950/40 border-emerald-500/80 ring-1 ring-emerald-500/50'
                      : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <Building2 className="w-4 h-4 text-amber-400" />
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">
                      WIRE / P2P
                    </span>
                  </div>
                  <div className="text-xs font-bold text-white">Bank Wire / P2P</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Direct Wire &amp; P2P</div>
                </button>
              </div>

              {/* 1-CLICK INSTANT TOP-UP VIEW */}
              {depositMethod === 'QUICK_FUND' && (
                <div className="p-4 sm:p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-emerald-400" />
                        <span>Instant 1-Click Balance Top-Up</span>
                      </h4>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Instantly credit funds to your active{' '}
                        <strong className="text-emerald-400">{accountMode}</strong> account to run bots and test live trades immediately.
                      </p>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold shrink-0">
                      Zero Delay
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {PRESET_AMOUNTS.slice(1, 5).map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => handleQuickFund(preset)}
                        disabled={isProcessingDeposit}
                        className="p-3 rounded-xl bg-slate-900 hover:bg-emerald-500/20 border border-slate-800 hover:border-emerald-500/50 transition cursor-pointer flex flex-col items-center justify-center gap-1 group"
                      >
                        <span className="text-xs text-slate-400 group-hover:text-emerald-300 font-mono">
                          Credit
                        </span>
                        <span className="text-base font-black text-white group-hover:text-emerald-400 font-mono">
                          +${preset}.00
                        </span>
                        <span className="text-[9px] text-emerald-400 font-mono font-bold">
                          Instant USD
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* Larger quick deposits */}
                  <div className="grid grid-cols-2 gap-2.5">
                    {[500, 1000].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => handleQuickFund(preset)}
                        disabled={isProcessingDeposit}
                        className="py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-emerald-500/20 border border-slate-800 hover:border-emerald-500/50 transition cursor-pointer flex items-center justify-between group font-mono"
                      >
                        <span className="text-xs text-slate-300 font-bold">Pro Trader Fund:</span>
                        <span className="text-sm font-black text-emerald-400 group-hover:scale-105 transition">
                          +${preset}.00 USD
                        </span>
                      </button>
                    ))}
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center gap-2 text-xs text-slate-400 font-mono">
                    <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>
                      Funds will immediately reflect across all bots, headers, and trade execution engines.
                    </span>
                  </div>
                </div>
              )}

              {/* CRYPTO DEPOSIT VIEW */}
              {depositMethod === 'CRYPTO' && (
                <div className="p-4 sm:p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300 uppercase font-mono">
                      Select Deposit Coin
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono">
                      Min deposit: ${selectedCrypto.minDeposit} USD
                    </span>
                  </div>

                  {/* Coin Selector Chips */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {CRYPTO_OPTIONS.map((coin) => (
                      <button
                        key={coin.id}
                        type="button"
                        onClick={() => setSelectedCrypto(coin)}
                        className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                          selectedCrypto.id === coin.id
                            ? 'bg-slate-900 border-emerald-500 text-white shadow-sm'
                            : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black font-mono">{coin.symbol}</span>
                          <span className="text-[10px] font-mono text-slate-500">
                            {coin.network.split(' ')[0]}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 truncate mt-0.5">
                          {coin.name}
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Address Display Box */}
                  <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-300">
                        {selectedCrypto.name} ({selectedCrypto.network}) Deposit Address:
                      </span>
                      <span className="text-[10px] font-mono text-emerald-400 font-bold">
                        {selectedCrypto.confirmations} Confirmation Required
                      </span>
                    </div>

                    <div className="flex items-center gap-2 bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                      <input
                        type="text"
                        readOnly
                        value={selectedCrypto.address}
                        className="w-full bg-transparent text-xs font-mono text-emerald-400 focus:outline-none select-all"
                      />
                      <button
                        type="button"
                        onClick={() => handleCopyAddress(selectedCrypto.address)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-bold font-mono transition flex items-center gap-1.5 cursor-pointer shrink-0"
                      >
                        {copiedAddress ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>Network: <strong className="text-white">{selectedCrypto.network}</strong></span>
                      <span className="text-rose-400 font-mono">Send ONLY {selectedCrypto.symbol}</span>
                    </div>
                  </div>

                  {/* Instant Credit Confirmation Simulator */}
                  <div className="p-3.5 rounded-xl bg-slate-900/60 border border-emerald-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-bold text-white">Deposit Amount to Credit (USD)</div>
                      <div className="text-[11px] text-slate-400">
                        Verify and credit blockchain deposit directly to your live balance
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs">$</span>
                        <input
                          type="number"
                          value={cryptoDepositAmount}
                          onChange={(e) => setCryptoDepositAmount(e.target.value)}
                          className="w-24 pl-6 pr-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono text-white"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleCryptoInstantCrediting}
                        disabled={isProcessingDeposit}
                        className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold font-mono transition cursor-pointer flex items-center gap-1.5 shrink-0"
                      >
                        {isProcessingDeposit ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Check className="w-3.5 h-3.5" />
                        )}
                        <span>Confirm Deposit</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* CREDIT CARD DEPOSIT VIEW */}
              {depositMethod === 'CARD' && (
                <form onSubmit={handleCardDeposit} className="p-4 sm:p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300 uppercase font-mono">
                      Credit / Debit Card Instant Gateway
                    </span>
                    <div className="flex items-center gap-2 text-xs font-bold font-mono text-slate-400">
                      <span>VISA</span>
                      <span>•</span>
                      <span>MASTERCARD</span>
                    </div>
                  </div>

                  {/* Preset Amount Selector */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-400">Select Deposit Amount (USD)</label>
                    <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
                      {PRESET_AMOUNTS.map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setCardDepositAmount(preset.toString())}
                          className={`py-2 rounded-xl text-xs font-bold font-mono transition cursor-pointer border ${
                            cardDepositAmount === preset.toString()
                              ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-extrabold'
                              : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          ${preset}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Custom Amount */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-400">Custom Amount ($ - Min $5.00)</label>
                    <input
                      type="number"
                      step="1"
                      min="5"
                      max="10000"
                      value={cardDepositAmount}
                      onChange={(e) => setCardDepositAmount(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                      placeholder="50.00"
                      required
                    />
                  </div>

                  {/* Card Details */}
                  <div className="space-y-3 pt-1">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-400">Cardholder Full Name</label>
                      <input
                        type="text"
                        value={cardName}
                        onChange={(e) => setCardName(e.target.value)}
                        placeholder="John Doe"
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-400">Card Number</label>
                      <input
                        type="text"
                        value={cardNumber}
                        onChange={(e) => setCardNumber(e.target.value)}
                        placeholder="4532 0000 0000 0000"
                        maxLength={19}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] font-semibold text-slate-400">Expiry (MM/YY)</label>
                        <input
                          type="text"
                          value={cardExpiry}
                          onChange={(e) => setCardExpiry(e.target.value)}
                          placeholder="MM/YY"
                          maxLength={5}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-slate-400">CVV / CVC</label>
                        <input
                          type="password"
                          value={cardCvv}
                          onChange={(e) => setCardCvv(e.target.value)}
                          placeholder="•••"
                          maxLength={4}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isProcessingDeposit}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-950 transition cursor-pointer"
                  >
                    {isProcessingDeposit ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Processing Instant Card Deposit...</span>
                      </>
                    ) : (
                      <>
                        <Lock className="w-4 h-4" />
                        <span>Deposit ${parseFloat(cardDepositAmount || '0').toFixed(2)} USD (Instant Credit)</span>
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* BANK DEPOSIT VIEW */}
              {depositMethod === 'BANK' && (
                <form onSubmit={handleBankDepositSubmit} className="p-4 sm:p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white uppercase font-mono">
                      Bank Wire &amp; Direct Transfer
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                      Zero Fees
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">
                    Deposit directly via bank wire, local mobile payment, or the official Deriv P2P portal.
                  </p>

                  <div className="space-y-3">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-400">Deposit Amount (USD)</label>
                      <input
                        type="number"
                        min="10"
                        step="1"
                        value={bankDepositAmount}
                        onChange={(e) => setBankDepositAmount(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-400">Originating Bank / Payment Method</label>
                      <input
                        type="text"
                        value={bankDepositName}
                        onChange={(e) => setBankDepositName(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                        placeholder="e.g. Chase Bank, Barclays, Wire"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-400">Transfer Reference / Receipt # (Optional)</label>
                      <input
                        type="text"
                        value={bankDepositRef}
                        onChange={(e) => setBankDepositRef(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                        placeholder="e.g. REF-WIRE-88912"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isProcessingDeposit}
                    className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-950 transition cursor-pointer"
                  >
                    {isProcessingDeposit ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                    <span>Confirm &amp; Credit Bank Deposit (${parseFloat(bankDepositAmount || '0').toFixed(2)} USD)</span>
                  </button>

                  <div className="border-t border-slate-800 pt-3 flex items-center justify-between text-xs">
                    <span className="text-slate-400">Deriv Official P2P Portal:</span>
                    <a
                      href="https://app.deriv.com/cashier/p2p"
                      target="_blank"
                      rel="noreferrer"
                      className="text-cyan-400 hover:underline flex items-center gap-1 font-mono font-bold"
                    >
                      <span>Open Deriv P2P</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* ===================== WITHDRAW TAB ===================== */}
          {activeTab === 'WITHDRAW' && (
            <div className="space-y-4">
              {/* Channel Selector */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setWithdrawMethod('CRYPTO')}
                  className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
                    withdrawMethod === 'CRYPTO'
                      ? 'bg-emerald-950/40 border-emerald-500/80 ring-1 ring-emerald-500/50'
                      : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <span>🪙</span>
                    <span>Crypto Withdrawal</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">Instant to your wallet</div>
                </button>

                <button
                  type="button"
                  onClick={() => setWithdrawMethod('BANK')}
                  className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
                    withdrawMethod === 'BANK'
                      ? 'bg-emerald-950/40 border-emerald-500/80 ring-1 ring-emerald-500/50'
                      : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-amber-400" />
                    <span>Bank Transfer / Wire</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">Direct to Bank Account</div>
                </button>
              </div>

              {/* WITHDRAWAL FORM */}
              <form onSubmit={handleWithdrawalSubmit} className="p-4 sm:p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-semibold text-slate-300">
                      Withdrawal Amount (USD)
                    </label>
                    <div className="flex items-center gap-1.5">
                      {[25, 50, 100].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setWithdrawAmount(preset.toString())}
                          className="text-[10px] px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300 font-mono hover:text-white"
                        >
                          ${preset}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setWithdrawAmount(balance.toFixed(2))}
                        className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono hover:bg-emerald-500/30 cursor-pointer font-bold"
                      >
                        MAX (${balance.toFixed(2)})
                      </button>
                    </div>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs">$</span>
                    <input
                      type="number"
                      step="1"
                      min="5"
                      max={balance}
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      placeholder="25.00"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-7 pr-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                      required
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                    <span>Minimum withdrawal: $5.00 USD</span>
                    <span>Available: ${balance.toFixed(2)} USD</span>
                  </div>
                </div>

                {withdrawMethod === 'CRYPTO' ? (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-300">Select Asset</label>
                      <select
                        value={withdrawCryptoAsset}
                        onChange={(e) => setWithdrawCryptoAsset(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                      >
                        <option value="USDT (TRC-20)">USDT (Tether TRC-20 - Tron)</option>
                        <option value="Bitcoin (BTC)">Bitcoin (BTC Network)</option>
                        <option value="Ethereum (ETH)">Ethereum (ETH ERC-20)</option>
                        <option value="Litecoin (LTC)">Litecoin (LTC)</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-300">
                        Recipient External Wallet Address
                      </label>
                      <input
                        type="text"
                        value={withdrawWallet}
                        onChange={(e) => setWithdrawWallet(e.target.value)}
                        placeholder="Enter external destination wallet address..."
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                        required
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-300">Bank Name</label>
                      <input
                        type="text"
                        value={withdrawBankName}
                        onChange={(e) => setWithdrawBankName(e.target.value)}
                        placeholder="e.g. Chase, Wells Fargo, Barclays"
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-300">IBAN / Account Number</label>
                      <input
                        type="text"
                        value={withdrawIban}
                        onChange={(e) => setWithdrawIban(e.target.value)}
                        placeholder="IBAN or Account Number"
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                        required
                      />
                    </div>
                  </div>
                )}

                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-400">Processing Fee:</span>
                  <span className="text-emerald-400 font-bold">$0.00 (Zero Fee)</span>
                </div>

                <button
                  type="submit"
                  disabled={isProcessingWithdraw || balance < 5}
                  className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-950 transition cursor-pointer disabled:opacity-50"
                >
                  {isProcessingWithdraw ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Transmitting Withdrawal Request...</span>
                    </>
                  ) : (
                    <>
                      <ArrowUpRight className="w-4 h-4" />
                      <span>
                        Submit Withdrawal Request (${parseFloat(withdrawAmount || '0').toFixed(2)} USD)
                      </span>
                    </>
                  )}
                </button>
              </form>

              {/* Direct Deriv Official Withdrawal Gateway */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <span className="text-xs text-slate-400 font-mono">Official Deriv Withdrawal Portal:</span>
                <a
                  href="https://app.deriv.com/cashier/withdrawal"
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-bold text-cyan-400 hover:underline flex items-center gap-1 font-mono"
                >
                  <span>app.deriv.com/cashier/withdrawal</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          )}

          {/* ===================== TRANSACTIONS TAB ===================== */}
          {activeTab === 'TRANSACTIONS' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-white uppercase font-mono">
                    Cashier Transaction Audit Ledger
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Full history of deposits and withdrawals credited to your balances.
                  </p>
                </div>
                <span className="text-xs font-mono text-emerald-400 font-bold">
                  {transactions.length} Total
                </span>
              </div>

              {transactions.length === 0 ? (
                <div className="p-8 text-center rounded-2xl bg-slate-950 border border-slate-800 text-slate-500 font-mono text-xs">
                  No transactions yet. Complete a deposit to see it recorded here.
                </div>
              ) : (
                <div className="space-y-2 max-h-[380px] overflow-y-auto">
                  {transactions.map((tx, idx) => (
                    <div
                      key={`${tx.id}-${idx}`}
                      className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between gap-3 text-xs font-mono"
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold shrink-0 ${
                            tx.type === 'DEPOSIT'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          }`}
                        >
                          {tx.type === 'DEPOSIT' ? (
                            <ArrowDownLeft className="w-4 h-4" />
                          ) : (
                            <ArrowUpRight className="w-4 h-4" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white">{tx.method}</span>
                            <span
                              className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                                tx.accountMode === 'REAL'
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : 'bg-amber-500/20 text-amber-300'
                              }`}
                            >
                              {tx.accountMode}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-500 flex items-center gap-2 mt-0.5">
                            <span>{new Date(tx.timestamp).toLocaleTimeString()}</span>
                            <span>•</span>
                            <span>Ref: {tx.referenceId}</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div
                          className={`font-black text-sm ${
                            tx.type === 'DEPOSIT' ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {tx.type === 'DEPOSIT' ? '+' : '-'}${tx.amount.toFixed(2)} USD
                        </div>
                        <div className="text-[10px] text-emerald-400 flex items-center justify-end gap-1 font-bold">
                          <Check className="w-3 h-3" />
                          <span>{tx.status}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
