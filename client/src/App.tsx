import { useState, useEffect } from 'react';
import { 
  QrCode, 
  Send, 
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
  AlertCircle
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

import { fetchAccountState } from './services/payment';
import type { AccountState } from './services/payment';
import { fetchTroveMetrics } from './services/trove';
import type { TroveMetrics } from './services/trove';
import { lookupAddress } from './services/names';
import { CONTRACT_ADDRESSES, ERC20_ABI, PAYMENT_CORE_ABI } from './config/contracts';
import { parseUnits, maxUint256 } from 'viem';
import { publicClient } from './services/web3';
import { fetchLiveActivity, type ActivityItem } from './services/history';

export function App() {
  // App Lock & Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [userProfile, setUserProfile] = useState<any>({
    id: 'unconnected',
    name: 'My Wallet',
    handle: '',
    address: '0x0000000000000000000000000000000000000000' as `0x${string}`,
    role: 'consumer',
  });
  const [walletClient, setWalletClient] = useState<any>(null);

  // Mezo ID State
  const [registeredName, setRegisteredName] = useState<string | null>(null);
  const [showCreateIdModal, setShowCreateIdModal] = useState<boolean>(false);
  const [isLoadingAccount, setIsLoadingAccount] = useState<boolean>(false);

  // Modals & Flows
  const [activeModal, setActiveModal] = useState<
    'scan' | 'send' | 'myqr' | 'requestqr' | 'pos' | 'split' | 'trove' | 'settings' | null
  >(null);
  const [sendTargetHandle, setSendTargetHandle] = useState<string>('');

  // Real Account State: Starts at real zeroes, never hardcoded numbers
  const [accountState, setAccountState] = useState<AccountState>({
    btcBalance: '0.0',
    btcBalanceRaw: 0n,
    musdBalance: '0.0',
    musdBalanceRaw: 0n,
    allowance: '0.0',
    allowanceRaw: 0n,
    isLimitsConfigured: false,
    dailyCap: '0.0',
    perTxCap: '0.0',
    spentToday: '0.0',
    effectiveRemainingDailySpend: '0.0',
    pendingDailyCap: '0.0',
    pendingPerTxCap: '0.0',
    pendingDailyTimelock: 0,
    pendingPerTxTimelock: 0,
  });

  // Real Trove State: Starts at hasTrove: false
  const [troveMetrics, setTroveMetrics] = useState<TroveMetrics>({
    hasTrove: false,
    debtMUSD: '0.0',
    debtMUSDRaw: 0n,
    collateralBTC: '0.0',
    collateralBTCRaw: 0n,
    icrPercent: 0,
    liquidationPriceUSD: '0.0',
    btcPriceUSD: '0.00',
    status: 'none',
    statusText: 'No Active Trove',
  });

  // Real Activity State: Starts empty
  const [activities, setActivities] = useState<ActivityItem[]>([]);

  // Real Contacts: Built only from live history, starts empty
  const [recentContacts, setRecentContacts] = useState<Array<{ handle: string; address: string }>>([]);

  // Handle Authentication Success
  const handleAuthenticated = async (profile: any, client: any, _isMetaMask: boolean) => {
    setUserProfile(profile);
    setWalletClient(client);
    setIsAuthenticated(true);

    if (profile.address && profile.address !== '0x0000000000000000000000000000000000000000') {
      try {
        const onChainName = await lookupAddress(profile.address);
        if (onChainName) {
          setRegisteredName(onChainName);
          setShowCreateIdModal(false);
        } else {
          // Unregistered user: Trigger compulsory handle onboarding
          setRegisteredName(null);
          setShowCreateIdModal(true);
        }
      } catch {
        setShowCreateIdModal(true);
      }
    }
  };

  // Sync live on-chain data
  const refreshLiveState = async () => {
    if (!userProfile?.address || userProfile.address === '0x0000000000000000000000000000000000000000') return;
    setIsLoadingAccount(true);

    try {
      const state = await fetchAccountState(userProfile.address);
      setAccountState(state);

      const tMetrics = await fetchTroveMetrics(userProfile.address);
      setTroveMetrics(tMetrics);

      const name = await lookupAddress(userProfile.address);
      if (name) {
        setRegisteredName(name);
      }

      // 4. Fetch Real On-Chain Activity & Recent Contacts from PaymentAnnounced event logs
      try {
        const { activities: liveActs, contacts: liveContacts } = await fetchLiveActivity(userProfile.address);
        setActivities(liveActs);
        setRecentContacts(liveContacts);
      } catch (err) {
        console.warn('Activity history log sync warning:', err);
      }
    } catch (e) {
      console.warn('Live sync error:', e);
    } finally {
      setIsLoadingAccount(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && userProfile.address && userProfile.address !== '0x0000000000000000000000000000000000000000') {
      refreshLiveState();
    }
  }, [userProfile, isAuthenticated]);

  // Payment Execution Handler
  const handleExecutePayment = async (
    to: `0x${string}`,
    amount: string,
    note: string,
    refData?: any
  ): Promise<boolean> => {
    try {
      if (!walletClient) return false;

      const amountWei = parseUnits(amount, 18);
      const account = userProfile.address || walletClient.account;

      // Ensure MUSD Allowance before payment
      if (accountState.allowanceRaw < amountWei) {
        const approveTx = await walletClient.writeContract({
          ...(account ? { account } : {}),
          address: CONTRACT_ADDRESSES.MUSD,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [CONTRACT_ADDRESSES.PAYMENT_CORE, maxUint256],
        });
        await publicClient.waitForTransactionReceipt({ hash: approveTx });
        setAccountState((prev) => ({
          ...prev,
          allowanceRaw: maxUint256,
          allowance: 'Unlimited',
        }));
      }

      let txHash: `0x${string}` | null = null;

      if (refData && refData.sig) {
        // Merchant-signed Reference Payment (payReference)
        txHash = await walletClient.writeContract({
          ...(account ? { account } : {}),
          address: CONTRACT_ADDRESSES.PAYMENT_CORE,
          abi: PAYMENT_CORE_ABI,
          functionName: 'payReference',
          args: [to, amountWei, BigInt(refData.exp), refData.salt, note, refData.sig],
        });
      } else {
        // Direct Payment (payDirect)
        txHash = await walletClient.writeContract({
          ...(account ? { account } : {}),
          address: CONTRACT_ADDRESSES.PAYMENT_CORE,
          abi: PAYMENT_CORE_ABI,
          functionName: 'payDirect',
          args: [to, amountWei, note],
        });
      }

      // Record Real Activity
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

      // Deduct balance from local live state
      const newMusd = Math.max(0, Number(accountState.musdBalance) - Number(amount)).toFixed(2);
      const newSpent = (Number(accountState.spentToday) + Number(amount)).toFixed(2);
      const newRemaining = Math.max(0, Number(accountState.dailyCap) - Number(newSpent)).toFixed(2);

      setAccountState((prev) => ({
        ...prev,
        musdBalance: newMusd,
        spentToday: newSpent,
        effectiveRemainingDailySpend: newRemaining,
      }));

      // Add to recent contacts
      setRecentContacts((prev) => {
        if (!prev.some((c) => c.address.toLowerCase() === to.toLowerCase())) {
          return [{ handle: '', address: to }, ...prev];
        }
        return prev;
      });

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
      if (!walletClient) return null;

      const totalWei = parseUnits(total, 18);
      const account = userProfile.address || walletClient.account;

      const hash = await walletClient.writeContract({
        ...(account ? { account } : {}),
        address: CONTRACT_ADDRESSES.PAYMENT_CORE,
        abi: PAYMENT_CORE_ABI,
        functionName: 'createSplit',
        args: [totalWei, participants, memo],
      });
      return hash;
    } catch (err) {
      console.error('Failed to create split:', err);
      return null;
    }
  };

  // Limits Configuration Handler
  const handleConfigureLimits = async (daily: string, perTx: string): Promise<boolean> => {
    try {
      if (!walletClient) return false;

      const dailyWei = parseUnits(daily, 18);
      const perTxWei = parseUnits(perTx, 18);
      const account = userProfile.address || walletClient.account;

      if (!accountState.isLimitsConfigured) {
        await walletClient.writeContract({
          ...(account ? { account } : {}),
          address: CONTRACT_ADDRESSES.PAYMENT_CORE,
          abi: PAYMENT_CORE_ABI,
          functionName: 'setInitialSafetyLimits',
          args: [dailyWei, perTxWei],
        });
      } else {
        await walletClient.writeContract({
          ...(account ? { account } : {}),
          address: CONTRACT_ADDRESSES.PAYMENT_CORE,
          abi: PAYMENT_CORE_ABI,
          functionName: 'updateSafetyLimits',
          args: [dailyWei, perTxWei],
        });
      }

      setAccountState((prev) => ({
        ...prev,
        dailyCap: daily,
        perTxCap: perTx,
        isLimitsConfigured: true,
      }));
      return true;
    } catch (err) {
      console.error('Configure limits failed:', err);
      return false;
    }
  };

  // Revoke Allowance Handler
  const handleRevokeAllowance = async (): Promise<boolean> => {
    try {
      if (!walletClient) return false;
      const account = userProfile.address || walletClient.account;

      await walletClient.writeContract({
        ...(account ? { account } : {}),
        address: CONTRACT_ADDRESSES.MUSD,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [CONTRACT_ADDRESSES.PAYMENT_CORE, 0n],
      });

      setAccountState((prev) => ({
        ...prev,
        allowance: '0.00',
        allowanceRaw: 0n,
      }));
      alert('Access Revoked! MUSD allowance to MezoPaymentCore set to 0.');
      return true;
    } catch {
      return false;
    }
  };

  // Refresh Allowance Handler
  const handleRefreshAllowance = async (): Promise<boolean> => {
    try {
      if (!walletClient) return false;
      const allowanceWei = parseUnits('500', 18);
      const account = userProfile.address || walletClient.account;

      await walletClient.writeContract({
        ...(account ? { account } : {}),
        address: CONTRACT_ADDRESSES.MUSD,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [CONTRACT_ADDRESSES.PAYMENT_CORE, allowanceWei],
      });

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

  const effectiveHandle = registeredName || '';

  return (
    <div className="app-container">
      {/* 1. AUTHENTICATION GATE (App Lock PIN) */}
      <AuthModal
        isOpen={!isAuthenticated}
        onAuthenticated={handleAuthenticated}
      />

      {/* 2. COMPULSORY MEZO ID ONBOARDING MODAL */}
      <CreateMezoIdModal
        isOpen={isAuthenticated && showCreateIdModal}
        walletClient={walletClient}
        userAddress={userProfile.address}
        onSuccess={(claimedHandle) => {
          setRegisteredName(claimedHandle);
          setShowCreateIdModal(false);
          setActiveModal('myqr');
        }}
      />

      {/* Top GPay Navbar */}
      <Navbar
        currentProfile={userProfile}
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
                Pay merchants, friends, or any registered handle
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
          {/* Tile 1: Pay Contacts / @name */}
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
            <span>Pay @name</span>
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

        {/* WORKSTREAM 3: EMPTY STATE GUIDE (When balances are 0) */}
        {accountState.btcBalance === '0.0' && accountState.musdBalance === '0.0' && !isLoadingAccount && (
          <div
            style={{
              padding: '16px',
              borderRadius: 'var(--radius-lg)',
              background: 'rgba(247, 147, 26, 0.08)',
              border: '1px solid rgba(247, 147, 26, 0.25)',
              marginBottom: '20px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <AlertCircle size={18} color="var(--btc-orange)" />
              <span style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>Get Started with MezoPay:</span>
            </div>
            <ol style={{ paddingLeft: '20px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              <li><strong>1. Get gas:</strong> Request testnet BTC from the official Mezo faucet.</li>
              <li><strong>2. Get MUSD:</strong> Borrow against BTC or receive from a friend.</li>
              <li><strong>3. Set up spending:</strong> Approve allowance and set safety limits.</li>
            </ol>
            <div style={{ marginTop: '12px', display: 'flex', gap: '10px' }}>
              <a
                href="https://faucet.test.mezo.org"
                target="_blank"
                rel="noreferrer"
                className="btn-primary"
                style={{ padding: '8px 14px', fontSize: '12px', textDecoration: 'none', width: 'auto' }}
              >
                Official Mezo Faucet <ExternalLink size={12} />
              </a>
              <button
                onClick={refreshLiveState}
                className="btn-secondary"
                style={{ padding: '8px 14px', fontSize: '12px' }}
              >
                <RefreshCw size={12} /> Check Balances
              </button>
            </div>
          </div>
        )}

        {/* CONTACTS / RECENT PEOPLE: Honest empty state */}
        {recentContacts.length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
                RECENT CONTACTS
              </div>
              <span style={{ fontSize: '11px', color: 'var(--mezo-green)', fontWeight: 600 }}>1-Tap Pay</span>
            </div>

            <div style={{ display: 'flex', gap: '14px', overflowX: 'auto', paddingBottom: '6px' }}>
              {recentContacts.map((c) => (
                <div
                  key={c.address}
                  onClick={() => {
                    setSendTargetHandle(c.handle || c.address);
                    setActiveModal('send');
                  }}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    cursor: 'pointer',
                    minWidth: '64px',
                    textAlign: 'center',
                  }}
                >
                  <div
                    style={{
                      width: '52px',
                      height: '52px',
                      borderRadius: '50%',
                      background: 'rgba(255, 255, 255, 0.08)',
                      border: '1px solid var(--border-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '16px',
                      color: 'var(--mezo-green)',
                      fontWeight: 700,
                      marginBottom: '6px',
                    }}
                  >
                    {c.handle ? c.handle.charAt(0).toUpperCase() : '0x'}
                  </div>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: '#fff' }}>
                    {c.handle ? `@${c.handle}` : `${c.address.slice(0, 4)}...`}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* HERO CARD: SPENDABLE BALANCE & COLLATERAL (100% Real On-Chain) */}
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

          {/* Trove Health Pill (Honest On-Chain Status) */}
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
              <Activity size={16} color={troveMetrics.hasTrove ? 'var(--mezo-green)' : 'var(--text-muted)'} />
              <span style={{ fontSize: '12px', fontWeight: 600 }}>Trove Collateral Health:</span>
              <span style={{ fontSize: '12px', fontWeight: 700, color: troveMetrics.hasTrove ? 'var(--mezo-green)' : 'var(--text-muted)' }}>
                {troveMetrics.hasTrove ? `${troveMetrics.icrPercent}% ICR` : 'No Active Trove'}
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
            <span style={{ fontSize: '13px', fontWeight: 700, color: accountState.isLimitsConfigured ? 'var(--mezo-green)' : 'var(--text-muted)' }}>
              {accountState.isLimitsConfigured
                ? `${accountState.effectiveRemainingDailySpend} / ${accountState.dailyCap} MUSD`
                : 'Not Configured'}
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

        {/* RECENT ACTIVITY: Honest empty state */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '17px', fontWeight: 700 }}>
              Recent Transactions
            </h3>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Mezo Testnet</span>
          </div>

          {activities.length === 0 ? (
            <div
              className="glass-card"
              style={{
                padding: '24px',
                textAlign: 'center',
                color: 'var(--text-muted)',
                fontSize: '13px',
              }}
            >
              No payments yet. Scan a QR code or pay a registered name to get started.
            </div>
          ) : (
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
          )}
        </div>
      </main>

      {/* MODALS */}
      <ScanPayModal
        isOpen={activeModal === 'scan'}
        onClose={() => setActiveModal(null)}
        onExecutePayment={handleExecutePayment}
        remainingDailySpend={accountState.effectiveRemainingDailySpend}
        allowance={accountState.allowance}
      />

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

      <MyQRModal
        isOpen={activeModal === 'myqr'}
        onClose={() => setActiveModal(null)}
        userAddress={userProfile.address}
        userHandle={effectiveHandle}
        walletClient={walletClient}
        defaultTab="permanent"
      />

      <MyQRModal
        isOpen={activeModal === 'requestqr'}
        onClose={() => setActiveModal(null)}
        userAddress={userProfile.address}
        userHandle={effectiveHandle}
        walletClient={walletClient}
        defaultTab="request"
      />

      <SoundboxPOSModal
        isOpen={activeModal === 'pos'}
        onClose={() => setActiveModal(null)}
        merchantWalletClient={walletClient}
        merchantName={registeredName ? `@${registeredName}` : 'Merchant'}
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
