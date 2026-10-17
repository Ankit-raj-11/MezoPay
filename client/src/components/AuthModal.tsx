import React, { useState } from 'react';
import { ShieldCheck, Wallet, Fingerprint, KeyRound, AlertCircle } from 'lucide-react';
import { DEMO_PROFILES, getInjectedWalletClient, getWalletClientForPrivateKey } from '../services/web3';
import { mezoTestnet } from '../config/chains';

interface AuthModalProps {
  isOpen: boolean;
  onAuthenticated: (profile: any, walletClient: any, isMetaMask: boolean) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onAuthenticated }) => {
  const [authMethod, setAuthMethod] = useState<'pin' | 'wallet' | 'profiles'>('pin');
  const [pin, setPin] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isConnectingWallet, setIsConnectingWallet] = useState(false);

  if (!isOpen) return null;

  // Handle PIN Unlock
  const handlePinDigit = (digit: string) => {
    if (pin.length < 4) {
      const nextPin = pin + digit;
      setPin(nextPin);
      setErrorMsg(null);

      if (nextPin.length === 4) {
        // Fast authenticate with primary profile or demo
        setTimeout(() => {
          const profile = DEMO_PROFILES[0];
          const wc = getWalletClientForPrivateKey(profile.privateKey);
          onAuthenticated(profile, wc, false);
        }, 200);
      }
    }
  };

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
  };

  // Connect Injected Browser Wallet (MetaMask, Rabby, etc.)
  const handleConnectInjectedWallet = async () => {
    setIsConnectingWallet(true);
    setErrorMsg(null);

    try {
      const ethereum = (window as any).ethereum;
      if (!ethereum) {
        setErrorMsg('MetaMask or Web3 wallet not detected. Please install MetaMask or use Fast Demo PIN unlock.');
        setIsConnectingWallet(false);
        return;
      }

      // Request accounts
      const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
      if (!accounts || accounts.length === 0) {
        setErrorMsg('No accounts found in wallet.');
        setIsConnectingWallet(false);
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
        // If chain is not added, add it
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

      const injectedClient = getInjectedWalletClient();
      const customProfile = {
        id: 'metamask',
        name: 'My Wallet',
        handle: '',
        privateKey: '' as `0x${string}`,
        address: userAddress,
        role: 'consumer' as const,
      };

      onAuthenticated(customProfile, injectedClient, true);
    } catch (err: any) {
      console.warn('Wallet connection error:', err);
      setErrorMsg(err.message || 'Failed to connect MetaMask. Please unlock MetaMask.');
    } finally {
      setIsConnectingWallet(false);
    }
  };

  // Select Demo Profile (Alice, Bob, Chai Point)
  const handleSelectDemoProfile = (p: typeof DEMO_PROFILES[0]) => {
    const wc = getWalletClientForPrivateKey(p.privateKey);
    onAuthenticated(p, wc, false);
  };

  return (
    <div className="modal-overlay" style={{ alignItems: 'center' }}>
      <div
        className="glass-card"
        style={{
          width: '90%',
          maxWidth: '420px',
          padding: '32px 24px',
          borderRadius: 'var(--radius-xl)',
          textAlign: 'center',
          background: 'linear-gradient(180deg, #101625 0%, #080c14 100%)',
          border: '1px solid var(--border-highlight)',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.8), 0 0 30px rgba(0, 229, 153, 0.15)',
        }}
      >
        {/* Brand Icon Header */}
        <div style={{ position: 'relative', width: '72px', height: '72px', margin: '0 auto 16px auto' }}>
          <div
            style={{
              width: '100%',
              height: '100%',
              borderRadius: '22px',
              background: 'linear-gradient(135deg, #f7931a 0%, #00e599 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '34px',
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
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ShieldCheck size={18} color="var(--mezo-green)" />
          </div>
        </div>

        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '24px',
            fontWeight: 800,
            marginBottom: '4px',
            letterSpacing: '-0.02em',
          }}
        >
          MezoPay
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '24px' }}>
          Protected by Mezo Network Security
        </p>

        {/* Tab Switcher */}
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
            onClick={() => setAuthMethod('pin')}
            style={{
              flex: 1,
              padding: '8px',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              background: authMethod === 'pin' ? 'rgba(0, 229, 153, 0.2)' : 'transparent',
              color: authMethod === 'pin' ? 'var(--mezo-green)' : 'var(--text-muted)',
              fontWeight: 700,
              fontSize: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.2s ease',
            }}
          >
            <KeyRound size={14} /> Screen PIN
          </button>
          <button
            onClick={() => setAuthMethod('wallet')}
            style={{
              flex: 1,
              padding: '8px',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              background: authMethod === 'wallet' ? 'rgba(0, 229, 153, 0.2)' : 'transparent',
              color: authMethod === 'wallet' ? 'var(--mezo-green)' : 'var(--text-muted)',
              fontWeight: 700,
              fontSize: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.2s ease',
            }}
          >
            <Wallet size={14} /> Web3 Wallet
          </button>
          <button
            onClick={() => setAuthMethod('profiles')}
            style={{
              flex: 1,
              padding: '8px',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              background: authMethod === 'profiles' ? 'rgba(0, 229, 153, 0.2)' : 'transparent',
              color: authMethod === 'profiles' ? 'var(--mezo-green)' : 'var(--text-muted)',
              fontWeight: 700,
              fontSize: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.2s ease',
            }}
          >
            ⚡ Demo
          </button>
        </div>

        {/* PIN Pad View */}
        {authMethod === 'pin' && (
          <div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Enter 4-digit PIN to authenticate (Demo: 1234)
            </div>

            {/* PIN Dots */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                gap: '16px',
                marginBottom: '24px',
              }}
            >
              {[0, 1, 2, 3].map((idx) => (
                <div
                  key={idx}
                  style={{
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    background: pin.length > idx ? 'var(--mezo-green)' : 'rgba(255, 255, 255, 0.15)',
                    border: pin.length > idx ? '2px solid var(--mezo-green)' : '2px solid transparent',
                    boxShadow: pin.length > idx ? 'var(--shadow-glow)' : 'none',
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
                gap: '12px',
                maxWidth: '260px',
                margin: '0 auto',
              }}
            >
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                <button
                  key={digit}
                  onClick={() => handlePinDigit(digit)}
                  style={{
                    height: '52px',
                    borderRadius: '50%',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--border-subtle)',
                    color: '#fff',
                    fontSize: '20px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {digit}
                </button>
              ))}
              <button
                onClick={() => {
                  const profile = DEMO_PROFILES[0];
                  const wc = getWalletClientForPrivateKey(profile.privateKey);
                  onAuthenticated(profile, wc, false);
                }}
                title="Quick Unlock"
                style={{
                  height: '52px',
                  borderRadius: '50%',
                  background: 'rgba(0, 229, 153, 0.1)',
                  border: '1px solid rgba(0, 229, 153, 0.3)',
                  color: 'var(--mezo-green)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Fingerprint size={22} />
              </button>
              <button
                onClick={() => handlePinDigit('0')}
                style={{
                  height: '52px',
                  borderRadius: '50%',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--border-subtle)',
                  color: '#fff',
                  fontSize: '20px',
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
                style={{
                  height: '52px',
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
          </div>
        )}

        {/* Web3 Wallet View */}
        {authMethod === 'wallet' && (
          <div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
              Connect your MetaMask or Edge/Chrome injected Web3 wallet to authenticate.
            </div>

            <button
              onClick={handleConnectInjectedWallet}
              disabled={isConnectingWallet}
              className="btn-primary"
              style={{
                marginBottom: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
              }}
            >
              <Wallet size={18} />
              <span>{isConnectingWallet ? 'Connecting Wallet...' : 'Connect MetaMask / Web3'}</span>
            </button>

            <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Automatically switches your wallet to Mezo Testnet (Chain ID 31611).
            </p>
          </div>
        )}

        {/* Demo Profiles View */}
        {authMethod === 'profiles' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
              Choose a pre-configured profile for instant testing:
            </div>

            {DEMO_PROFILES.map((p) => (
              <div
                key={p.id}
                onClick={() => handleSelectDemoProfile(p)}
                style={{
                  padding: '12px 16px',
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  textAlign: 'left',
                }}
              >
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>{p.name}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {p.address.slice(0, 10)}...{p.address.slice(-6)}
                  </div>
                </div>
                <div className="badge badge-chain" style={{ fontSize: '11px' }}>
                  {p.role}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error Notification */}
        {errorMsg && (
          <div
            style={{
              marginTop: '16px',
              padding: '10px 14px',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              borderRadius: 'var(--radius-md)',
              color: '#fca5a5',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              textAlign: 'left',
            }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>
    </div>
  );
};
