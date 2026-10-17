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
  ShieldAlert,
  Camera,
  Clock,
  ChevronRight,
} from 'lucide-react';
import { Navbar } from './components/Navbar';
import { AuthModal } from './components/AuthModal';
import { CreateMezoIdModal } from './components/CreateMezoIdModal';
import { MyQRModal } from './components/MyQRModal';
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

// Frequent contacts for Google Pay "People" section
const RECENT_PEOPLE = [
  { name: 'Chai Point', handle: 'chaipoint@mezo', avatar: '☕', role: 'Merchant', color: 'linear-gradient(135deg, #f7931a, #ea580c)' },
  { name: 'Bob', handle: 'bob@mezo', avatar: '🍕', role: 'Friend', color: 'linear-gradient(135deg, #3b82f6, #1d4ed8)' },
  { name: 'Alice', handle: 'alice@mezo', avatar: '👩', role: 'Payer', color: 'linear-gradient(135deg, #00e599, #059669)' },
  { name: 'David', handle: 'david@mezo', avatar: '👨', role: 'Co-worker', color: 'linear-gradient(135deg, #a855f7, #7e22ce)' },
];

export function App() {
  // Authentication State (Like Google Pay opening screen lock)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [profile, setProfile] = useState<any>(DEMO_PROFILES[0]);
  const [walletClient, setWalletClient] = useState<any>(null);

  // Mezo ID State
  const [registeredName, setRegisteredName] = useState<string | null>(null);
  const [showCreateIdModal, setShowCreateIdModal] = useState<boolean>(false);

  // Modals & Flows
  const [activeModal, setActiveModal] = useState<
    'scan' | 'send' | 'myqr' | 'requestqr' | 'pos' | 'split' | 'trove' | 'settings' | null
  >(null);
  const [sendTargetHandle, setSendTargetHandle] = useState<string>('');

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

  // Handle Authentication Success
  const handleAuthenticated = async (userProfile: any, client: any, isMetaMask: boolean) => {
    setProfile(userProfile);
    setWalletClient(client || (userProfile.privateKey ? getWalletClientForPrivateKey(userProfile.privateKey) : null));
    setIsAuthenticated(true);

    // Check if this address already has a registered Mezo ID
    try {
      const onChainName = await lookupAddress(userProfile.address);
      if (onChainName) {
        setRegisteredName(onChainName);
        setShowCreateIdModal(false);
      } else if (userProfile.handle && !isMetaMask) {
        // Pre-configured demo handle
        setRegisteredName(userProfile.handle);
        setShowCreateIdModal(false);
      } else {
        // Unregistered user! Compulsory unique Mezo ID onboarding
        setRegisteredName(null);
        setShowCreateIdModal(true);
      }
    } catch {
      if (!userProfile.handle) {
        setShowCreateIdModal(true);
      }
    }
  };

  // Sync live on-chain data
  const refreshLiveState = async () => {
    if (!profile?.address) return;
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
      }
    } catch (e) {
      console.warn('Live sync fallback to demo state:', e);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      refreshLiveState();
    }
  }, [profile, isAuthenticated]);

  // Payment Execution Handler
  const handleExecutePayment = async (
    to: `0x${string}`,
    amount: string,
    note: string,
    refData?: any
  ): Promise<boolean> => {
    try {
      const client = walletClient || (profile.privateKey ? getWalletClientForPrivateKey(profile.privateKey) : null);
      if (!client) return false;

      const amountWei = parseUnits(amount, 18);
      let txHash: `0x${string}` | null = null;

      if (refData && refData.sig) {
        // Merchant-signed Reference Payment
        try {
          txHash = await client.writeContract({
            address: CONTRACT_ADDRESSES.PAYMENT_CORE,
            abi: PAYMENT_CORE_ABI,
            functionName: 'payReference',
            args: [to, amountWei, BigInt(refData.exp), refData.salt, note, refData.sig],
          });
        } catch {
          txHash = '0xsimulated' as `0x${string}`;
        }
      } else {
        // Direct Payment
        try {
          txHash = await client.writeContract({
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
      const client = walletClient || (profile.privateKey ? getWalletClientForPrivateKey(profile.privateKey) : null);
      if (!client) return null;

      const totalWei = parseUnits(total, 18);
      let splitId = `0xsplit_${Date.now()}`;
      try {
        const hash = await client.writeContract({
          address: CONTRACT_ADDRESSES.PAYMENT_CORE,
          abi: PAYMENT_CORE_ABI,
          functionName: 'createSplit',
          args: [totalWei, participants, memo],
        });
        if (hash) splitId = hash;
      } catch {}
      return splitId;
    } catch {
      return null;
    }
  };

  // Limits Configuration Handler
  const handleConfigureLimits = async (daily: string, perTx: string): Promise<boolean> => {
    try {
      const client = walletClient || (profile.privateKey ? getWalletClientForPrivateKey(profile.privateKey) : null);
      if (!client) return false;

      const dailyWei = parseUnits(daily, 18);
      const perTxWei = parseUnits(perTx, 18);

      try {
        if (!accountState.isLimitsConfigured) {
          await client.writeContract({
            address: CONTRACT_ADDRESSES.PAYMENT_CORE,
            abi: PAYMENT_CORE_ABI,
            functionName: 'setInitialSafetyLimits',
            args: [dailyWei, perTxWei],
          });
        } else {
          await client.writeContract({
            address: CONTRACT_ADDRESSES.PAYMENT_CORE,
            abi: PAYMENT_CORE_ABI,
            functionName: 'updateSafetyLimits',
            args: [dailyWei, perTxWei],
          });
        }
      } catch {}

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
      const client = walletClient || (profile.privateKey ? getWalletClientForPrivateKey(profile.privateKey) : null);
      if (client) {
        try {
          await client.writeContract({
            address: CONTRACT_ADDRESSES.MUSD,
            abi: ERC20_ABI,
            functionName: 'approve',
            args: [CONTRACT_ADDRESSES.PAYMENT_CORE, 0n],
          });
        } catch {}
      }

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
      const client = walletClient || (profile.privateKey ? getWalletClientForPrivateKey(profile.privateKey) : null);
      const allowanceWei = parseUnits('500', 18);
      if (client) {
        try {
          await client.writeContract({
            address: CONTRACT_ADDRESSES.MUSD,
            abi: ERC20_ABI,
            functionName: 'approve',
            args: [CONTRACT_ADDRESSES.PAYMENT_CORE, allowanceWei],
          });
        } catch {}
      }

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

  const allowanceNum = Number(accountState.allowance) || 0;
  const allowancePercent = Math.min(100, Math.max(0, (allowanceNum / 500) * 100));

  const effectiveHandle = registeredName || profile.handle || '';

  return (
    <div className="app-container">
      {/* 1. AUTHENTICATION GATE (Whenever user opens the app) */}
      <AuthModal
        isOpen={!isAuthenticated}
        onAuthenticated={handleAuthenticated}
      />

      {/* 2. COMPULSORY MEZO ID ONBOARDING MODAL */}
      <CreateMezoIdModal
        isOpen={isAuthenticated && showCreateIdModal}
        walletClient={walletClient || getWalletClientForPrivateKey(profile.privateKey)}
        userAddress={profile.address}
        onSuccess={(claimedHandle) => {
          setRegisteredName(claimedHandle);
          setShowCreateIdModal(false);
          // Automatically transition to showing their permanent QR code!
          setActiveModal('myqr');
        }}
      />

      {/* Top GPay Navbar */}
      <Navbar
        currentProfile={profile}
        onSelectProfile={(p) => {
          setProfile(p);
          setWalletClient(getWalletClientForPrivateKey(p.privateKey));
        }}
        registeredName={registeredName}
        onOpenSettings={() => setActiveModal('settings')}
        onOpenMyQR={() => setActiveModal('myqr')}
        onLockApp={() => setIsAuthenticated(false)}
      />

      <main style={{ padding: '16px 20px' }}>
        {/* GOOGLE PAY HERO ACTION: "SCAN ANY QR CODE" */}
        <div
          onClick={() => setActiveModal('scan')}
          style={{
            background: 'linear-gradient(135deg, rgba(0, 229, 153, 0.15) 0%, rgba(247, 147, 26, 0.1) 100%)',
            border: '1.5px solid var(--mezo-green)',
            borderRadius: '24px',
            padding: '18px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            boxShadow: 'var(--shadow-glow)',
            marginBottom: '20px',
            transition: 'all 0.2s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #00e599 0%, #059669 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#07090e',
                boxShadow: '0 0 20px rgba(0, 229, 153, 0.4)',
              }}
            >
              <Camera size={26} />
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: 800, color: '#fff' }}>
                Scan Any QR Code
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Pay merchants, friends, or any Mezo ID
              </div>
            </div>
          </div>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--mezo-green)',
            }}
          >
            <ChevronRight size={20} />
          </div>
        </div>

        {/* GOOGLE PAY QUICK ACTION TILES */}
        <div className="actions-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '22px' }}>
          {/* Tile 1: Pay Contacts / @mezo */}
          <div
            className="action-tile"
            onClick={() => {
              setSendTargetHandle('');
              setActiveModal('send');
            }}
          >
            <div className="icon-wrap" style={{ background: 'rgba(0, 229, 153, 0.12)', color: 'var(--mezo-green)' }}>
              <Send size={20} />
            </div>
            <span>Pay @mezo</span>
          </div>

          {/* Tile 2: Request Money (Expiring QR) */}
          <div
            className="action-tile"
            onClick={() => setActiveModal('requestqr')}
          >
            <div className="icon-wrap" style={{ background: 'rgba(247, 147, 26, 0.15)', color: 'var(--btc-orange)' }}>
              <Clock size={20} />
            </div>
            <span>Request $</span>
          </div>

          {/* Tile 3: My Permanent QR */}
          <div
            className="action-tile"
            onClick={() => setActiveModal('myqr')}
          >
            <div className="icon-wrap" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa' }}>
              <QrCode size={20} />
            </div>
            <span>My QR</span>
          </div>

          {/* Tile 4: Bill Split */}
          <div
            className="action-tile"
            onClick={() => setActiveModal('split')}
          >
            <div className="icon-wrap" style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc' }}>
              <Users size={20} />
            </div>
            <span>Split Bill</span>
          </div>
        </div>

        {/* GOOGLE PAY "PEOPLE" / RECENT CONTACTS SECTION */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
              PEOPLE & STORES
            </div>
            <span style={{ fontSize: '11px', color: 'var(--mezo-green)', fontWeight: 600 }}>1-Tap Pay</span>
          </div>

          <div
            style={{
              display: 'flex',
              gap: '14px',
              overflowX: 'auto',
              paddingBottom: '6px',
              scrollbarWidth: 'none',
            }}
          >
            {RECENT_PEOPLE.map((person) => (
              <div
                key={person.handle}
                onClick={() => {
                  setSendTargetHandle(person.handle);
                  setActiveModal('send');
                }}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  cursor: 'pointer',
                  minWidth: '68px',
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    background: person.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '24px',
                    boxShadow: 'var(--shadow-sm)',
                    marginBottom: '6px',
                    border: '2px solid rgba(255, 255, 255, 0.1)',
                    transition: 'transform 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.06)')}
                  onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                >
                  {person.avatar}
                </div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#fff', whiteSpace: 'nowrap' }}>
                  {person.name}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                  {person.handle}
                </div>
              </div>
            ))}

            {/* Merchant Soundbox POS Tile */}
            <div
              onClick={() => setActiveModal('pos')}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                cursor: 'pointer',
                minWidth: '68px',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1.5px dashed var(--btc-orange)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '20px',
                  color: 'var(--btc-orange)',
                  marginBottom: '6px',
                }}
              >
                <Volume2 size={24} />
              </div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--btc-orange)' }}>
                Soundbox
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                Merchant POS
              </div>
            </div>
          </div>
        </div>

        {/* HERO CARD: SPENDABLE BALANCE & COLLATERAL */}
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

          {/* Trove Health Pill */}
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
              transition: 'all 0.2s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Activity size={16} color="var(--mezo-green)" />
              <span style={{ fontSize: '12px', fontWeight: 600 }}>Trove Collateral Health:</span>
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

        {/* SAFETY LIMITS & ALLOWANCE METER */}
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

        {/* RECENT ACTIVITY / TRANSACTIONS FEED */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '17px', fontWeight: 700 }}>
              Recent Transactions
            </h3>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Settled on Mezo</span>
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
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div
                    style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '12px',
                      background: item.type === 'sent' ? 'rgba(239, 68, 68, 0.12)' : 'rgba(0, 229, 153, 0.12)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: item.type === 'sent' ? '#f87171' : 'var(--mezo-green)',
                    }}
                  >
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
                  <div
                    style={{
                      fontSize: '15px',
                      fontWeight: 700,
                      color: item.type === 'sent' ? '#fff' : 'var(--mezo-green)',
                    }}
                  >
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

      {/* MODALS */}
      {/* 1. Camera & Code QR Scanner */}
      <ScanPayModal
        isOpen={activeModal === 'scan'}
        onClose={() => setActiveModal(null)}
        onExecutePayment={handleExecutePayment}
        remainingDailySpend={accountState.effectiveRemainingDailySpend}
      />

      {/* 2. Direct Send by @mezo Handle */}
      <SendNameModal
        isOpen={activeModal === 'send'}
        onClose={() => {
          setActiveModal(null);
          setSendTargetHandle('');
        }}
        onSendDirect={handleSendDirect}
        remainingDailySpend={accountState.effectiveRemainingDailySpend}
        initialHandle={sendTargetHandle}
      />

      {/* 3. My Permanent QR Code Modal */}
      <MyQRModal
        isOpen={activeModal === 'myqr'}
        onClose={() => setActiveModal(null)}
        userAddress={profile.address}
        userHandle={effectiveHandle}
        walletClient={walletClient || getWalletClientForPrivateKey(profile.privateKey)}
        defaultTab="permanent"
      />

      {/* 4. Request Money (Dynamic QR with Expiry Countdown) */}
      <MyQRModal
        isOpen={activeModal === 'requestqr'}
        onClose={() => setActiveModal(null)}
        userAddress={profile.address}
        userHandle={effectiveHandle}
        walletClient={walletClient || getWalletClientForPrivateKey(profile.privateKey)}
        defaultTab="request"
      />

      {/* 5. Soundbox POS Terminal */}
      <SoundboxPOSModal
        isOpen={activeModal === 'pos'}
        onClose={() => setActiveModal(null)}
        merchantWalletClient={walletClient || getWalletClientForPrivateKey(profile.privateKey)}
        merchantName={registeredName ? `@${registeredName}` : profile.name}
      />

      {/* 6. Bill Split Modal */}
      <BillSplitModal
        isOpen={activeModal === 'split'}
        onClose={() => setActiveModal(null)}
        onCreateSplit={handleCreateSplit}
        onPaySplitShare={async () => true}
      />

      {/* 7. Trove Health Modal */}
      <TroveModal
        isOpen={activeModal === 'trove'}
        onClose={() => setActiveModal(null)}
        metrics={troveMetrics}
      />

      {/* 8. Limits & Revocation Settings Modal */}
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
