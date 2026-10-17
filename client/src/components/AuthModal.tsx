import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Wallet,
  KeyRound,
  AlertCircle,
  Copy,
  Check,
  ArrowRight,
  RotateCcw,
} from 'lucide-react';
import { getInjectedWalletClient, getInAppWalletClient } from '../services/web3';
import {
  hasVault,
  getStoredVaultAddress,
  createVault,
  unlockVault,
  restoreVaultWithMnemonic,
  type UnlockedWallet,
} from '../services/walletVault';
import { mezoTestnet } from '../config/chains';

interface AuthModalProps {
  isOpen: boolean;
  onAuthenticated: (profile: any, walletClient: any, isMetaMask: boolean) => void;
}

type AuthMode = 'unlock' | 'create_pin' | 'show_phrase' | 'verify_phrase' | 'restore' | 'injected';

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onAuthenticated }) => {
  const [mode, setMode] = useState<AuthMode>('unlock');
  const [storedAddress, setStoredAddress] = useState<`0x${string}` | null>(null);

  // PIN inputs
  const [pinInput, setPinInput] = useState<string>('');
  const [newPinCandidate, setNewPinCandidate] = useState<string>('');
  const [confirmPinStep, setConfirmPinStep] = useState<boolean>(false);

  // Lockout after 5 failed attempts
  const [failedAttempts, setFailedAttempts] = useState<number>(0);
  const [lockoutUntil, setLockoutUntil] = useState<number>(0);
  const [lockoutRemaining, setLockoutRemaining] = useState<number>(0);

  // Recovery phrase flow
  const [generatedWallet, setGeneratedWallet] = useState<UnlockedWallet | null>(null);
  const [copiedPhrase, setCopiedPhrase] = useState(false);
  const [verifyIndices, setVerifyIndices] = useState<[number, number]>([2, 7]); // 1-indexed (e.g. Word 3 and 8)
  const [verifyWord1, setVerifyWord1] = useState('');
  const [verifyWord2, setVerifyWord2] = useState('');

  // Restore flow
  const [restoreMnemonicInput, setRestoreMnemonicInput] = useState('');

  // Status and feedback
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Initialize mode based on whether device already has an encrypted vault
  useEffect(() => {
    if (!isOpen) return;
    const exists = hasVault();
    if (exists) {
      setMode('unlock');
      setStoredAddress(getStoredVaultAddress());
    } else {
      setMode('create_pin');
      setStoredAddress(null);
    }
    setPinInput('');
    setConfirmPinStep(false);
    setErrorMsg(null);
  }, [isOpen]);

  // Lockout countdown timer
  useEffect(() => {
    if (lockoutUntil > Date.now()) {
      const interval = setInterval(() => {
        const remaining = Math.max(0, Math.ceil((lockoutUntil - Date.now()) / 1000));
        setLockoutRemaining(remaining);
        if (remaining <= 0) {
          clearInterval(interval);
          setFailedAttempts(0);
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [lockoutUntil]);

  if (!isOpen) return null;

  // Handle PIN Digit Entry for Unlock or Setup
  const handlePinDigit = async (digit: string) => {
    if (lockoutRemaining > 0 || isProcessing) return;
    if (pinInput.length >= 4) return;

    const nextPin = pinInput + digit;
    setPinInput(nextPin);
    setErrorMsg(null);

    if (nextPin.length === 4) {
      if (mode === 'unlock') {
        // Attempt decryption
        setIsProcessing(true);
        try {
          const unlocked = await unlockVault(nextPin);
          const client = getInAppWalletClient(unlocked.account);
          const profile = {
            id: 'in_app_wallet',
            name: 'Device Wallet',
            handle: '',
            address: unlocked.address,
            role: 'consumer' as const,
          };
          setPinInput('');
          setFailedAttempts(0);
          onAuthenticated(profile, client, false);
        } catch {
          const nextFailed = failedAttempts + 1;
          setFailedAttempts(nextFailed);
          setPinInput('');
          if (nextFailed >= 5) {
            const until = Date.now() + 30000;
            setLockoutUntil(until);
            setLockoutRemaining(30);
            setErrorMsg('Too many wrong attempts. App locked for 30 seconds.');
          } else {
            setErrorMsg(`Incorrect PIN (${nextFailed}/5 attempts)`);
          }
        } finally {
          setIsProcessing(false);
        }
      } else if (mode === 'create_pin') {
        if (!confirmPinStep) {
          // First pass of PIN entry
          setNewPinCandidate(nextPin);
          setPinInput('');
          setConfirmPinStep(true);
        } else {
          // Confirmation pass
          if (nextPin === newPinCandidate) {
            setIsProcessing(true);
            try {
              const wallet = await createVault(nextPin);
              setGeneratedWallet(wallet);
              // Pick 2 random distinct indices for backup verification (1 to 12)
              const idx1 = Math.floor(Math.random() * 6) + 1; // 1..6
              const idx2 = Math.floor(Math.random() * 6) + 7; // 7..12
              setVerifyIndices([idx1, idx2]);
              setMode('show_phrase');
              setPinInput('');
              setConfirmPinStep(false);
            } catch (err: any) {
              setErrorMsg(err.message || 'Failed to initialize wallet vault.');
              setPinInput('');
              setConfirmPinStep(false);
            } finally {
              setIsProcessing(false);
            }
          } else {
            setErrorMsg('PINs do not match. Please try again.');
            setPinInput('');
            setConfirmPinStep(false);
            setNewPinCandidate('');
          }
        }
      }
    }
  };

  const handleBackspace = () => {
    if (isProcessing || lockoutRemaining > 0) return;
    setPinInput((prev) => prev.slice(0, -1));
  };

  // Complete Word Verification and Launch App
  const handleVerifyWordsAndFinish = () => {
    if (!generatedWallet) return;
    const words = generatedWallet.mnemonic.split(' ');
    const expected1 = words[verifyIndices[0] - 1]?.toLowerCase().trim();
    const expected2 = words[verifyIndices[1] - 1]?.toLowerCase().trim();

    if (
      verifyWord1.toLowerCase().trim() === expected1 &&
      verifyWord2.toLowerCase().trim() === expected2
    ) {
      const client = getInAppWalletClient(generatedWallet.account);
      const profile = {
        id: 'in_app_wallet',
        name: 'Device Wallet',
        handle: '',
        address: generatedWallet.address,
        role: 'consumer' as const,
      };
      onAuthenticated(profile, client, false);
    } else {
      setErrorMsg(`Words do not match. Please check Word #${verifyIndices[0]} and Word #${verifyIndices[1]}.`);
    }
  };

  // Restore Wallet with Mnemonic
  const handleRestoreSubmit = async () => {
    const trimmed = restoreMnemonicInput.trim().toLowerCase();
    const wordList = trimmed.split(/\s+/);
    if (wordList.length !== 12 && wordList.length !== 24) {
      setErrorMsg('Please enter a valid 12-word recovery phrase.');
      return;
    }

    if (pinInput.length !== 4) {
      setErrorMsg('Please enter a 4-digit App lock PIN.');
      return;
    }

    setIsProcessing(true);
    setErrorMsg(null);
    try {
      const restored = await restoreVaultWithMnemonic(trimmed, pinInput);
      const client = getInAppWalletClient(restored.account);
      const profile = {
        id: 'in_app_wallet',
        name: 'Device Wallet',
        handle: '',
        address: restored.address,
        role: 'consumer' as const,
      };
      onAuthenticated(profile, client, false);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to restore wallet. Please verify your phrase.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Connect Injected Browser Wallet (MetaMask, Rabby, etc.)
  const handleConnectInjectedWallet = async () => {
    setIsProcessing(true);
    setErrorMsg(null);

    try {
      const ethereum = (window as any).ethereum;
      if (!ethereum) {
        setErrorMsg('MetaMask or Web3 wallet extension not detected.');
        setIsProcessing(false);
        return;
      }

      const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
      if (!accounts || accounts.length === 0) {
        setErrorMsg('No accounts found in wallet.');
        setIsProcessing(false);
        return;
      }

      const userAddress = accounts[0] as `0x${string}`;

      // Switch to Mezo Testnet (Chain ID 31611 / 0x7b7b)
      try {
        await ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0x7b7b' }],
        });
      } catch (switchError: any) {
        if (switchError.code === 4902 || switchError.message?.includes('4902')) {
          await ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: '0x7b7b',
                chainName: mezoTestnet.name,
                nativeCurrency: mezoTestnet.nativeCurrency,
                rpcUrls: mezoTestnet.rpcUrls.default.http,
                blockExplorerUrls: [mezoTestnet.blockExplorers.default.url],
              },
            ],
          });
        }
      }

      const injectedClient = getInjectedWalletClient(userAddress);
      const customProfile = {
        id: 'injected_wallet',
        name: 'Browser Wallet',
        handle: '',
        address: userAddress,
        role: 'consumer' as const,
      };

      onAuthenticated(customProfile, injectedClient, true);
    } catch (err: any) {
      console.warn('Wallet connection error:', err);
      setErrorMsg(err.message || 'Failed to connect wallet.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ alignItems: 'center' }}>
      <div
        className="glass-card"
        style={{
          width: '90%',
          maxWidth: '420px',
          padding: '28px 22px',
          borderRadius: 'var(--radius-xl)',
          textAlign: 'center',
          background: 'linear-gradient(180deg, #101625 0%, #080c14 100%)',
          border: '1px solid var(--border-highlight)',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.8), 0 0 30px rgba(0, 229, 153, 0.15)',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        {/* Header Icon */}
        <div style={{ position: 'relative', width: '60px', height: '60px', margin: '0 auto 12px auto' }}>
          <div
            style={{
              width: '100%',
              height: '100%',
              borderRadius: '18px',
              background: 'linear-gradient(135deg, #f7931a 0%, #00e599 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '28px',
              color: '#07090e',
              boxShadow: 'var(--shadow-glow)',
            }}
          >
            ⚡
          </div>
          <div
            style={{
              position: 'absolute',
              bottom: '-4px',
              right: '-4px',
              background: '#07090e',
              borderRadius: '50%',
              padding: '3px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ShieldCheck size={16} color="var(--mezo-green)" />
          </div>
        </div>

        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '22px',
            fontWeight: 800,
            marginBottom: '2px',
            letterSpacing: '-0.02em',
          }}
        >
          MezoPay
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '18px' }}>
          Mezo Testnet (Chain ID 31611)
        </p>

        {/* Top Navigation Tabs (Unlock / External Wallet) */}
        {(mode === 'unlock' || mode === 'injected') && (
          <div
            style={{
              display: 'flex',
              background: 'rgba(255, 255, 255, 0.05)',
              padding: '4px',
              borderRadius: 'var(--radius-md)',
              marginBottom: '20px',
            }}
          >
            <button
              onClick={() => {
                setMode('unlock');
                setErrorMsg(null);
              }}
              style={{
                flex: 1,
                padding: '8px',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                background: mode === 'unlock' ? 'rgba(0, 229, 153, 0.2)' : 'transparent',
                color: mode === 'unlock' ? 'var(--mezo-green)' : 'var(--text-muted)',
                fontWeight: 700,
                fontSize: '12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
            >
              <KeyRound size={14} /> App lock
            </button>
            <button
              onClick={() => {
                setMode('injected');
                setErrorMsg(null);
              }}
              style={{
                flex: 1,
                padding: '8px',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                background: mode === 'injected' ? 'rgba(0, 229, 153, 0.2)' : 'transparent',
                color: mode === 'injected' ? 'var(--mezo-green)' : 'var(--text-muted)',
                fontWeight: 700,
                fontSize: '12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
            >
              <Wallet size={14} /> External Wallet
            </button>
          </div>
        )}

        {/* 1. UNLOCK MODE (Keypad) */}
        {mode === 'unlock' && (
          <div>
            <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 600, marginBottom: '4px' }}>
              Enter App lock PIN
            </div>
            {storedAddress && (
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  marginBottom: '16px',
                }}
              >
                {storedAddress.slice(0, 8)}...{storedAddress.slice(-6)}
              </div>
            )}

            {/* PIN Dots */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '14px', marginBottom: '20px' }}>
              {[0, 1, 2, 3].map((idx) => (
                <div
                  key={idx}
                  style={{
                    width: '14px',
                    height: '14px',
                    borderRadius: '50%',
                    background: pinInput.length > idx ? 'var(--mezo-green)' : 'rgba(255, 255, 255, 0.15)',
                    border: pinInput.length > idx ? '2px solid var(--mezo-green)' : '2px solid transparent',
                    boxShadow: pinInput.length > idx ? 'var(--shadow-glow)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                />
              ))}
            </div>

            {/* Keypad */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '10px',
                maxWidth: '240px',
                margin: '0 auto',
              }}
            >
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                <button
                  key={digit}
                  onClick={() => handlePinDigit(digit)}
                  disabled={lockoutRemaining > 0 || isProcessing}
                  style={{
                    height: '48px',
                    borderRadius: '50%',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--border-subtle)',
                    color: '#fff',
                    fontSize: '18px',
                    fontWeight: 700,
                    cursor: lockoutRemaining > 0 ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {digit}
                </button>
              ))}
              <div />
              <button
                onClick={() => handlePinDigit('0')}
                disabled={lockoutRemaining > 0 || isProcessing}
                style={{
                  height: '48px',
                  borderRadius: '50%',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--border-subtle)',
                  color: '#fff',
                  fontSize: '18px',
                  fontWeight: 700,
                  cursor: lockoutRemaining > 0 ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                0
              </button>
              <button
                onClick={handleBackspace}
                disabled={lockoutRemaining > 0 || isProcessing}
                style={{
                  height: '48px',
                  borderRadius: '50%',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-muted)',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: lockoutRemaining > 0 ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                ⌫
              </button>
            </div>

            {/* Forgot PIN / Restore Link */}
            <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                onClick={() => {
                  setMode('restore');
                  setPinInput('');
                  setErrorMsg(null);
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--mezo-orange)',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                Forgot PIN? Restore with Recovery Phrase
              </button>
            </div>
          </div>
        )}

        {/* 2. CREATE PIN MODE (First Launch) */}
        {mode === 'create_pin' && (
          <div>
            <div style={{ fontSize: '14px', color: 'var(--text-primary)', fontWeight: 700, marginBottom: '6px' }}>
              {confirmPinStep ? 'Confirm your App lock PIN' : 'Create 4-digit App lock PIN'}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              {confirmPinStep
                ? 'Re-enter your 4-digit PIN to confirm.'
                : 'Encrypts your non-custodial wallet locally on this phone.'}
            </div>

            {/* PIN Dots */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '14px', marginBottom: '20px' }}>
              {[0, 1, 2, 3].map((idx) => (
                <div
                  key={idx}
                  style={{
                    width: '14px',
                    height: '14px',
                    borderRadius: '50%',
                    background: pinInput.length > idx ? 'var(--mezo-green)' : 'rgba(255, 255, 255, 0.15)',
                    border: pinInput.length > idx ? '2px solid var(--mezo-green)' : '2px solid transparent',
                    boxShadow: pinInput.length > idx ? 'var(--shadow-glow)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                />
              ))}
            </div>

            {/* Keypad */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '10px',
                maxWidth: '240px',
                margin: '0 auto',
              }}
            >
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                <button
                  key={digit}
                  onClick={() => handlePinDigit(digit)}
                  disabled={isProcessing}
                  style={{
                    height: '48px',
                    borderRadius: '50%',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--border-subtle)',
                    color: '#fff',
                    fontSize: '18px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {digit}
                </button>
              ))}
              <div />
              <button
                onClick={() => handlePinDigit('0')}
                disabled={isProcessing}
                style={{
                  height: '48px',
                  borderRadius: '50%',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--border-subtle)',
                  color: '#fff',
                  fontSize: '18px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                0
              </button>
              <button
                onClick={handleBackspace}
                disabled={isProcessing}
                style={{
                  height: '48px',
                  borderRadius: '50%',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-muted)',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                ⌫
              </button>
            </div>

            {/* Alternate Option: Restore or External Wallet */}
            <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                onClick={() => {
                  setMode('restore');
                  setPinInput('');
                  setErrorMsg(null);
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--mezo-green)',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                Already have a wallet? Restore with phrase
              </button>
              <button
                onClick={() => {
                  setMode('injected');
                  setErrorMsg(null);
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: '11px',
                  cursor: 'pointer',
                }}
              >
                Or use external browser wallet (MetaMask)
              </button>
            </div>
          </div>
        )}

        {/* 3. SHOW PHRASE MODE */}
        {mode === 'show_phrase' && generatedWallet && (
          <div style={{ textAlign: 'left' }}>
            <div style={{ textAlign: 'center', marginBottom: '14px' }}>
              <div style={{ fontSize: '15px', color: 'var(--text-primary)', fontWeight: 800 }}>
                12-Word Recovery Phrase
              </div>
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Write these 12 words down in order. Never share them with anyone.
              </p>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '8px',
                background: 'rgba(0, 0, 0, 0.4)',
                padding: '12px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                marginBottom: '14px',
              }}
            >
              {generatedWallet.mnemonic.split(' ').map((word, i) => (
                <div
                  key={i}
                  style={{
                    background: 'rgba(255, 255, 255, 0.04)',
                    padding: '6px 8px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '12px',
                    fontFamily: 'var(--font-mono)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>{i + 1}.</span>
                  <span style={{ fontWeight: 600 }}>{word}</span>
                </div>
              ))}
            </div>

            <button
              onClick={() => {
                navigator.clipboard.writeText(generatedWallet.mnemonic);
                setCopiedPhrase(true);
                setTimeout(() => setCopiedPhrase(false), 2000);
              }}
              style={{
                width: '100%',
                padding: '9px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
                background: 'rgba(255, 255, 255, 0.05)',
                color: copiedPhrase ? 'var(--mezo-green)' : 'var(--text-primary)',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                marginBottom: '16px',
              }}
            >
              {copiedPhrase ? <Check size={14} /> : <Copy size={14} />}
              {copiedPhrase ? 'Copied to Clipboard' : 'Copy Recovery Phrase'}
            </button>

            <button
              onClick={() => {
                setMode('verify_phrase');
                setErrorMsg(null);
              }}
              className="btn btn-primary"
              style={{ width: '100%', padding: '12px', fontWeight: 800, fontSize: '14px' }}
            >
              I Saved My Phrase <ArrowRight size={16} />
            </button>
          </div>
        )}

        {/* 4. VERIFY PHRASE MODE */}
        {mode === 'verify_phrase' && (
          <div style={{ textAlign: 'left' }}>
            <div style={{ textAlign: 'center', marginBottom: '14px' }}>
              <div style={{ fontSize: '15px', color: 'var(--text-primary)', fontWeight: 800 }}>
                Verify Your Phrase
              </div>
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Confirm 2 random words from your recovery phrase to ensure your backup is safe.
              </p>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                Enter Word #{verifyIndices[0]}
              </label>
              <input
                type="text"
                value={verifyWord1}
                onChange={(e) => setVerifyWord1(e.target.value.trim().toLowerCase())}
                placeholder={`Word #${verifyIndices[0]}`}
                className="input-field"
                style={{ width: '100%', padding: '10px', fontSize: '13px' }}
              />
            </div>

            <div style={{ marginBottom: '18px' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                Enter Word #{verifyIndices[1]}
              </label>
              <input
                type="text"
                value={verifyWord2}
                onChange={(e) => setVerifyWord2(e.target.value.trim().toLowerCase())}
                placeholder={`Word #${verifyIndices[1]}`}
                className="input-field"
                style={{ width: '100%', padding: '10px', fontSize: '13px' }}
              />
            </div>

            <button
              onClick={handleVerifyWordsAndFinish}
              disabled={!verifyWord1 || !verifyWord2}
              className="btn btn-primary"
              style={{ width: '100%', padding: '12px', fontWeight: 800, fontSize: '14px' }}
            >
              Verify & Enter MezoPay <ShieldCheck size={16} />
            </button>

            <button
              onClick={() => {
                setMode('show_phrase');
                setErrorMsg(null);
              }}
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                fontSize: '11px',
                marginTop: '12px',
                cursor: 'pointer',
                textAlign: 'center',
              }}
            >
              Back to Phrase View
            </button>
          </div>
        )}

        {/* 5. RESTORE WALLET MODE */}
        {mode === 'restore' && (
          <div style={{ textAlign: 'left' }}>
            <div style={{ textAlign: 'center', marginBottom: '14px' }}>
              <div style={{ fontSize: '15px', color: 'var(--text-primary)', fontWeight: 800 }}>
                Restore MezoPay Wallet
              </div>
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Enter your 12-word recovery phrase and choose a new 4-digit App lock PIN.
              </p>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                12-Word Recovery Phrase
              </label>
              <textarea
                value={restoreMnemonicInput}
                onChange={(e) => setRestoreMnemonicInput(e.target.value)}
                rows={3}
                placeholder="apple banana cherry dog elephant fox grape horse igloo jaguar kite lion"
                className="input-field"
                style={{ width: '100%', padding: '10px', fontSize: '12px', resize: 'none' }}
              />
            </div>

            <div style={{ marginBottom: '18px' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                New 4-Digit App lock PIN
              </label>
              <input
                type="password"
                maxLength={4}
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="••••"
                className="input-field"
                style={{ width: '100%', padding: '10px', fontSize: '16px', letterSpacing: '4px', textAlign: 'center' }}
              />
            </div>

            <button
              onClick={handleRestoreSubmit}
              disabled={isProcessing || !restoreMnemonicInput || pinInput.length !== 4}
              className="btn btn-primary"
              style={{ width: '100%', padding: '12px', fontWeight: 800, fontSize: '14px' }}
            >
              {isProcessing ? 'Restoring...' : 'Restore & Set New PIN'} <RotateCcw size={16} />
            </button>

            <button
              onClick={() => {
                if (hasVault()) {
                  setMode('unlock');
                } else {
                  setMode('create_pin');
                }
                setPinInput('');
                setErrorMsg(null);
              }}
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                fontSize: '11px',
                marginTop: '12px',
                cursor: 'pointer',
                textAlign: 'center',
              }}
            >
              Cancel
            </button>
          </div>
        )}

        {/* 6. EXTERNAL WALLET (MetaMask) */}
        {mode === 'injected' && (
          <div>
            <div style={{ padding: '20px 0' }}>
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '16px',
                  background: 'rgba(247, 147, 26, 0.1)',
                  border: '1px solid rgba(247, 147, 26, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 14px auto',
                  color: 'var(--mezo-orange)',
                }}
              >
                <Wallet size={28} />
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 600, marginBottom: '6px' }}>
                Connect Browser Web3 Wallet
              </p>
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
                Connect MetaMask, Rabby, or any browser extension provider configured for Mezo Testnet.
              </p>

              <button
                onClick={handleConnectInjectedWallet}
                disabled={isProcessing}
                className="btn btn-primary"
                style={{ width: '100%', padding: '12px', fontWeight: 800, fontSize: '14px' }}
              >
                {isProcessing ? 'Connecting...' : 'Connect MetaMask / Web3'}
              </button>
            </div>
          </div>
        )}

        {/* Error / Warning Alert */}
        {errorMsg && (
          <div
            style={{
              marginTop: '14px',
              padding: '10px 12px',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#ef4444',
              fontSize: '11px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            <AlertCircle size={14} />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>
    </div>
  );
};
