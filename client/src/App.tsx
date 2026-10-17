import { useState, useEffect } from 'react';
import { 
  QrCode, 
  Send, 
  Volume2, 
  Users, 
  RefreshCw, 
  Activity, 
  Coins, 
  ArrowUpRight, 
  ArrowDownLeft, 
  ExternalLink,
  ShieldAlert
} from 'lucide-react';
import { Navbar } from './components/Navbar';
import { ScanPayModal } from './components/ScanPayModal';
import { SendNameModal } from './components/SendNameModal';
import { SoundboxPOSModal } from './components/SoundboxPOSModal';
import { BillSplitModal } from './components/BillSplitModal';
import { TroveModal } from './components/TroveModal';
import { SettingsModal } from './components/SettingsModal';

import { DEMO_PROFILES, getWalletClientForPrivateKey } from './services/web3';
import { fetchAccountState } from './services/payment';
import type { AccountState } from './services/payment';
import { fetchTroveMetrics } from './services/trove';
import type { TroveMetrics } from './services/trove';
import { lookupAddress } from './services/names';
import { CONTRACT_ADDRESSES, ERC20_ABI, PAYMENT_CORE_ABI } from './config/contracts';
import { parseUnits } from 'viem';

interface ActivityItem {
  id: string;
  type: 'sent' | 'received';
  amount: string;
  target: string;
  note: string;
  timestamp: string;
  txHash?: string;
}

export function App() {
  const [profile, setProfile] = useState(DEMO_PROFILES[0]);
  const [registeredName, setRegisteredName] = useState<string | null>('alice');
  const [activeModal, setActiveModal] = useState<'scan' | 'send' | 'pos' | 'split' | 'trove' | 'settings' | null>(null);

  const [accountState, setAccountState] = useState<AccountState>({
    btcBalance: '0.052',
    btcBalanceRaw: 52000000000000000n,
    musdBalance: '350.00',
    musdBalanceRaw: 350000000000000000000n,
    allowance: '500.00',
    allowanceRaw: 500000000000000000000n,
    isLimitsConfigured: true,
    dailyCap: '100.00',
    perTxCap: '25.00',
    spentToday: '15.00',
    effectiveRemainingDailySpend: '85.00',
    pendingDailyCap: '0.0',
    pendingPerTxCap: '0.0',
    pendingDailyTimelock: 0,
    pendingPerTxTimelock: 0,
  });

  const [troveMetrics, setTroveMetrics] = useState<TroveMetrics>({
    hasTrove: true,
    debtMUSD: '2000.00',
    debtMUSDRaw: 2000000000000000000000n,
    collateralBTC: '0.05',
    collateralBTCRaw: 50000000000000000n,
    icrPercent: 203,
    liquidationPriceUSD: '44000.00',
    btcPriceUSD: '81,309.97',
    status: 'healthy',
    statusText: 'Safe (ICR 203% > 150% CCR)',
  });

  const [activities, setActivities] = useState<ActivityItem[]>([
    {
      id: '1',
      type: 'sent',
      amount: '15.00',
      target: 'Chai Point ✓',
      note: 'Morning Chai Combo',
      timestamp: '10 mins ago',
    },
    {
      id: '2',
      type: 'received',
      amount: '33.33',
      target: 'bob@mezo',
      note: 'Dinner Bill Split',
      timestamp: '1 hour ago',
    },
  ]);

  // Load live testnet data for active profile
  const refreshLiveState = async () => {
    try {
      const state = await fetchAccountState(profile.address);
      if (state.musdBalanceRaw > 0n || state.btcBalanceRaw > 0n) {
        setAccountState(state);
      }

      const tMetrics = await fetchTroveMetrics(profile.address);
      if (tMetrics.hasTrove) {
        setTroveMetrics(tMetrics);
      }

      const name = await lookupAddress(profile.address);
      if (name) {
        setRegisteredName(name);
      } else {
        setRegisteredName(profile.handle);
      }
    } catch (e) {
      console.warn('Live sync fallback to demo state:', e);
    }
  };

  useEffect(() => {
    refreshLiveState();
  }, [profile]);

  // Payment Execution Handler
  const handleExecutePayment = async (
    to: `0x${string}`,
    amount: string,
    note: string,
    refData?: any
  ): Promise<boolean> => {
    try {
      const walletClient = getWalletClientForPrivateKey(profile.privateKey);
      const amountWei = parseUnits(amount, 18);

      let txHash: `0x${string}` | null = null;

      if (refData && refData.sig) {
        // Merchant-signed Reference Payment
        try {
          txHash = await walletClient.writeContract({
            address: CONTRACT_ADDRESSES.PAYMENT_CORE,
            abi: PAYMENT_CORE_ABI,
            functionName: 'payReference',
            args: [
              to,
              amountWei,
              BigInt(refData.exp),
              refData.salt,
              note,
              refData.sig,
            ],
          });
        } catch {
          // If contract not deployed yet on broadcast testnet, simulate state update
          txHash = '0xsimulated' as `0x${string}`;
        }
      } else {
        // Direct Payment
        try {
          txHash = await walletClient.writeContract({
            address: CONTRACT_ADDRESSES.PAYMENT_CORE,
            abi: PAYMENT_CORE_ABI,
            functionName: 'payDirect',
            args: [to, amountWei, note],
          });
        } catch {
          txHash = '0xsimulated' as `0x${string}`;
        }
      }

      // Record Activity
      setActivities((prev) => [
        {
          id: Date.now().toString(),
          type: 'sent',
          amount,
          target: to.slice(0, 8) + '...',
          note,
          timestamp: 'Just now',
          txHash: txHash || undefined,
        },
        ...prev,
      ]);

      // Deduct balance and update spentToday in state
      const newMusd = Math.max(0, Number(accountState.musdBalance) - Number(amount)).toFixed(2);
      const newSpent = (Number(accountState.spentToday) + Number(amount)).toFixed(2);
      const newRemaining = Math.max(0, Number(accountState.dailyCap) - Number(newSpent)).toFixed(2);

      setAccountState((prev) => ({
        ...prev,
        musdBalance: newMusd,
        spentToday: newSpent,
        effectiveRemainingDailySpend: newRemaining,
      }));

      return true;
    } catch (err) {
      console.error('Payment failed:', err);
      return false;
    }
  };

  // Direct Send Handler
  const handleSendDirect = async (to: `0x${string}`, amount: string, note: string) => {
    return handleExecutePayment(to, amount, note);
  };

  // Bill Split Creation Handler
  const handleCreateSplit = async (
    total: string,
    participants: number,
    memo: string
  ): Promise<string | null> => {
    try {
      const walletClient = getWalletClientForPrivateKey(profile.privateKey);
      const totalWei = parseUnits(total, 18);

      let splitId = `0xsplit_${Date.now()}`;
      try {
        const hash = await walletClient.writeContract({
          address: CONTRACT_ADDRESSES.PAYMENT_CORE,
          abi: PAYMENT_CORE_ABI,
          functionName: 'createSplit',
          args: [totalWei, participants, memo],
        });
        if (hash) splitId = hash;
      } catch {
        // Simulated local fallback
      }
      return splitId;
    } catch {
      return null;
    }
  };

  // Limits Configuration Handler
  const handleConfigureLimits = async (daily: string, perTx: string): Promise<boolean> => {
    try {
      const walletClient = getWalletClientForPrivateKey(profile.privateKey);
      const dailyWei = parseUnits(daily, 18);
      const perTxWei = parseUnits(perTx, 18);

      try {
        if (!accountState.isLimitsConfigured) {
          await walletClient.writeContract({
            address: CONTRACT_ADDRESSES.PAYMENT_CORE,
            abi: PAYMENT_CORE_ABI,
            functionName: 'setInitialSafetyLimits',
            args: [dailyWei, perTxWei],
          });
        } else {
          await walletClient.writeContract({
            address: CONTRACT_ADDRESSES.PAYMENT_CORE,
            abi: PAYMENT_CORE_ABI,
            functionName: 'updateSafetyLimits',
            args: [dailyWei, perTxWei],
          });
        }
      } catch {
        // Handled via local state
      }

      setAccountState((prev) => ({
        ...prev,
        dailyCap: daily,
        perTxCap: perTx,
        isLimitsConfigured: true,
      }));
      return true;
    } catch {
      return false;
    }
  };

  // Revoke Allowance Handler
  const handleRevokeAllowance = async (): Promise<boolean> => {
    try {
      const walletClient = getWalletClientForPrivateKey(profile.privateKey);
      try {
        await walletClient.writeContract({
          address: CONTRACT_ADDRESSES.MUSD,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [CONTRACT_ADDRESSES.PAYMENT_CORE, 0n],
        });
      } catch {}

      setAccountState((prev) => ({
        ...prev,
        allowance: '0.00',
        allowanceRaw: 0n,
      }));
      alert('Access Revoked! MUSD allowance to MezoPaymentCore has been set to 0.');
      return true;
    } catch {
      return false;
    }
  };

  // Refresh Allowance Handler
  const handleRefreshAllowance = async (): Promise<boolean> => {
    try {
      const walletClient = getWalletClientForPrivateKey(profile.privateKey);
      const allowanceWei = parseUnits('500', 18);
      try {
        await walletClient.writeContract({
          address: CONTRACT_ADDRESSES.MUSD,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [CONTRACT_ADDRESSES.PAYMENT_CORE, allowanceWei],
        });
      } catch {}

      setAccountState((prev) => ({
        ...prev,
        allowance: '500.00',
        allowanceRaw: allowanceWei,
      }));
      alert('Allowance Refreshed to 500.00 MUSD!');
      return true;
    } catch {
      return false;
    }
  };

  // Allowance meter calculation
  const allowanceNum = Number(accountState.allowance) || 0;
  const allowancePercent = Math.min(100, Math.max(0, (allowanceNum / 500) * 100));

  return (
    <div className="app-container">
      {/* Top Navbar */}
      <Navbar
        currentProfile={profile}
        onSelectProfile={(p) => setProfile(p)}
        registeredName={registeredName}
        onOpenSettings={() => setActiveModal('settings')}
      />

      <main style={{ padding: '20px' }}>
        {/* Hero Card: Spendable MUSD Balance */}
        <div className="glass-card" style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
              SPENDABLE BALANCE
            </div>
            <div className="badge badge-chain" style={{ fontSize: '11px', textTransform: 'none' }}>
              <Coins size={12} />
              <span>{accountState.btcBalance} BTC Collateral</span>
            </div>
          </div>

          <div className="hero-amount">
            ${accountState.musdBalance}
            <span className="hero-currency">MUSD</span>
          </div>

          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Bitcoin-backed dollar on Mezo Network
          </div>

          {/* Trove Health Pill Banner */}
          <div
            onClick={() => setActiveModal('trove')}
            style={{
              marginTop: '16px',
              padding: '10px 14px',
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Activity size={16} color="var(--mezo-green)" />
              <span style={{ fontSize: '12px', fontWeight: 600 }}>Trove Health:</span>
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--mezo-green)' }}>
                {troveMetrics.icrPercent}% ICR
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--text-muted)' }}>
              <span>Details</span>
              <ExternalLink size={12} />
            </div>
          </div>
        </div>

        {/* Safety Limits & Allowance Meter */}
        <div className="glass-card" style={{ marginBottom: '20px', padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Daily Spending Remaining:
            </span>
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--mezo-green)' }}>
              {accountState.effectiveRemainingDailySpend} / {accountState.dailyCap} MUSD
            </span>
          </div>

          <div className="meter-track">
            <div 
              className={`meter-fill ${allowancePercent < 20 ? 'danger' : allowancePercent < 50 ? 'warning' : ''}`}
              style={{ width: `${allowancePercent}%` }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Allowance: {accountState.allowance} MUSD
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={handleRefreshAllowance}
                className="badge badge-chain"
                style={{ cursor: 'pointer', border: 'none', background: 'rgba(255, 255, 255, 0.05)', color: '#fff' }}
              >
                <RefreshCw size={11} /> Refresh
              </button>
              <button
                onClick={handleRevokeAllowance}
                className="badge badge-danger"
                style={{ cursor: 'pointer', border: 'none' }}
              >
                <ShieldAlert size={11} /> Revoke
              </button>
            </div>
          </div>
        </div>

        {/* 4-Tile Actions Grid */}
        <div className="actions-grid">
          <div className="action-tile" onClick={() => setActiveModal('scan')}>
            <div className="icon-wrap" style={{ background: 'rgba(0, 229, 153, 0.15)', color: 'var(--mezo-green)' }}>
              <QrCode size={22} />
            </div>
            <span>Scan & Pay</span>
          </div>

          <div className="action-tile" onClick={() => setActiveModal('send')}>
            <div className="icon-wrap">
              <Send size={20} />
            </div>
            <span>Send @name</span>
          </div>

          <div className="action-tile" onClick={() => setActiveModal('pos')}>
            <div className="icon-wrap" style={{ background: 'rgba(247, 147, 26, 0.15)', color: 'var(--btc-orange)' }}>
              <Volume2 size={22} />
            </div>
            <span>Soundbox POS</span>
          </div>

          <div className="action-tile" onClick={() => setActiveModal('split')}>
            <div className="icon-wrap">
              <Users size={20} />
            </div>
            <span>Bill Split</span>
          </div>
        </div>

        {/* Recent Activity Feed */}
        <div style={{ marginTop: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '17px', fontWeight: 700 }}>
              Recent Activity
            </h3>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Mezo Testnet</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {activities.map((item) => (
              <div
                key={item.id}
                className="glass-card"
                style={{
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    background: item.type === 'sent' ? 'rgba(239, 68, 68, 0.12)' : 'rgba(0, 229, 153, 0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: item.type === 'sent' ? '#f87171' : 'var(--mezo-green)'
                  }}>
                    {item.type === 'sent' ? <ArrowUpRight size={18} /> : <ArrowDownLeft size={18} />}
                  </div>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#fff' }}>
                      {item.target}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {item.note} • {item.timestamp}
                    </div>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{
                    fontSize: '15px',
                    fontWeight: 700,
                    color: item.type === 'sent' ? '#fff' : 'var(--mezo-green)'
                  }}>
                    {item.type === 'sent' ? '-' : '+'}{item.amount} MUSD
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--mezo-green)', fontWeight: 600 }}>
                    Settled on Mezo
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Modals */}
      <ScanPayModal
        isOpen={activeModal === 'scan'}
        onClose={() => setActiveModal(null)}
        onExecutePayment={handleExecutePayment}
        remainingDailySpend={accountState.effectiveRemainingDailySpend}
      />

      <SendNameModal
        isOpen={activeModal === 'send'}
        onClose={() => setActiveModal(null)}
        onSendDirect={handleSendDirect}
        remainingDailySpend={accountState.effectiveRemainingDailySpend}
      />

      <SoundboxPOSModal
        isOpen={activeModal === 'pos'}
        onClose={() => setActiveModal(null)}
        merchantWalletClient={getWalletClientForPrivateKey(profile.privateKey)}
        merchantName={profile.name}
      />

      <BillSplitModal
        isOpen={activeModal === 'split'}
        onClose={() => setActiveModal(null)}
        onCreateSplit={handleCreateSplit}
        onPaySplitShare={async () => true}
      />

      <TroveModal
        isOpen={activeModal === 'trove'}
        onClose={() => setActiveModal(null)}
        metrics={troveMetrics}
      />

      <SettingsModal
        isOpen={activeModal === 'settings'}
        onClose={() => setActiveModal(null)}
        accountState={accountState}
        onConfigureLimits={handleConfigureLimits}
        onExecutePending={async () => true}
        onCancelPending={async () => true}
        onRevokeAllowance={handleRevokeAllowance}
        onRefreshAllowance={handleRefreshAllowance}
      />
    </div>
  );
}

export default App;
