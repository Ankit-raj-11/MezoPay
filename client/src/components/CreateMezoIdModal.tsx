import React, { useState, useEffect } from 'react';
import { AtSign, CheckCircle2, AlertTriangle, ArrowRight, Sparkles, Loader2, X } from 'lucide-react';
import { checkNameAvailability, registerNameOnChain } from '../services/names';
import { soundbox } from '../services/soundbox';
import confetti from 'canvas-confetti';

interface CreateMezoIdModalProps {
  isOpen: boolean;
  onClose?: () => void;
  walletClient: any;
  userAddress: `0x${string}`;
  onSuccess: (registeredHandle: string) => void;
}

export const CreateMezoIdModal: React.FC<CreateMezoIdModalProps> = ({
  isOpen,
  onClose,
  walletClient,
  userAddress,
  onSuccess,
}) => {
  const [handleInput, setHandleInput] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Debounced live check
  useEffect(() => {
    const clean = handleInput.toLowerCase().trim().replace(/[^a-z0-9_]/g, '');
    if (clean.length < 3) {
      setIsAvailable(null);
      setSuggestions([]);
      setErrorMsg(clean.length > 0 ? 'Minimum 3 characters (a-z, 0-9, _)' : null);
      return;
    }

    if (clean.length > 20) {
      setIsAvailable(false);
      setErrorMsg('Maximum 20 characters');
      return;
    }

    const timer = setTimeout(async () => {
      setIsChecking(true);
      setErrorMsg(null);
      try {
        const available = await checkNameAvailability(clean);
        setIsAvailable(available);
        if (!available) {
          // Generate available suggestions
          const s1 = `${clean}_01`;
          const s2 = `${clean}_pay`;
          const s3 = `${clean}_btc`;
          setSuggestions([s1, s2, s3]);
        } else {
          setSuggestions([]);
        }
      } catch {
        setIsAvailable(null);
      } finally {
        setIsChecking(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [handleInput]);

  const handleRegister = async () => {
    const clean = handleInput.toLowerCase().trim().replace(/[^a-z0-9_]/g, '');
    if (!clean || !isAvailable || !walletClient) return;

    setIsRegistering(true);
    setErrorMsg(null);

    try {
      await registerNameOnChain(clean, walletClient);
      soundbox.playChime();
      confetti({
        particleCount: 100,
        spread: 80,
        origin: { y: 0.5 },
        colors: ['#00e599', '#f7931a', '#ffffff'],
      });
      onSuccess(clean);
    } catch (err: any) {
      setErrorMsg(err.message || 'Registration transaction failed. Ensure you have testnet BTC for gas.');
    } finally {
      setIsRegistering(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="bottom-sheet" style={{ maxWidth: '440px', padding: '28px 24px' }}>
        {onClose && (
          <button
            onClick={onClose}
            style={{ position: 'absolute', top: '16px', right: '16px', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        )}

        {/* GPay Header */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, rgba(0, 229, 153, 0.2), rgba(247, 147, 26, 0.2))',
            border: '1px solid var(--border-highlight)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 14px auto',
            color: 'var(--mezo-green)',
            boxShadow: 'var(--shadow-glow)'
          }}>
            <AtSign size={28} />
          </div>

          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: 800, marginBottom: '6px' }}>
            Choose your Mezo ID
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.5 }}>
            Your unique payment identity on Mezo Network. Friends and merchants pay you using this ID instead of complex wallet addresses.
          </p>
        </div>

        {/* Input Box with Fixed @mezo Suffix */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em', display: 'block', marginBottom: '8px' }}>
            ENTER UNIQUE USERNAME
          </label>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            background: 'rgba(255, 255, 255, 0.05)',
            border: isAvailable === true
              ? '1px solid var(--mezo-green)'
              : isAvailable === false
              ? '1px solid var(--color-danger)'
              : '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '4px 14px',
            transition: 'border-color 0.2s ease',
            boxShadow: isAvailable === true ? '0 0 16px rgba(0, 229, 153, 0.15)' : 'none'
          }}>
            <input
              type="text"
              placeholder="yourname"
              value={handleInput}
              autoFocus
              onChange={(e) => setHandleInput(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: '#ffffff',
                fontFamily: 'var(--font-display)',
                fontSize: '18px',
                fontWeight: 700,
                padding: '10px 0'
              }}
            />
            {/* Fixed Compulsory Suffix */}
            <span style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: '16px',
              color: 'var(--mezo-green)',
              paddingLeft: '4px'
            }}>
              @mezo
            </span>
          </div>

          {/* Availability Status Message */}
          <div style={{ minHeight: '22px', marginTop: '8px', fontSize: '12px' }}>
            {isChecking && (
              <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Loader2 size={13} className="soundbox-radar" /> Checking Mezo registry...
              </span>
            )}
            {!isChecking && isAvailable === true && (
              <span style={{ color: 'var(--mezo-green)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <CheckCircle2 size={14} /> @{handleInput.toLowerCase()} is available!
              </span>
            )}
            {!isChecking && isAvailable === false && (
              <span style={{ color: 'var(--color-danger)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <AlertTriangle size={14} /> @{handleInput.toLowerCase()} is already registered
              </span>
            )}
            {errorMsg && !isChecking && isAvailable === null && (
              <span style={{ color: 'var(--text-muted)' }}>{errorMsg}</span>
            )}
          </div>
        </div>

        {/* Suggestions if already taken */}
        {suggestions.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Sparkles size={12} color="var(--btc-orange)" /> AVAILABLE SUGGESTIONS:
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => setHandleInput(s)}
                  className="badge badge-chain"
                  style={{
                    cursor: 'pointer',
                    padding: '6px 12px',
                    fontSize: '12px',
                    textTransform: 'none',
                    fontWeight: 600
                  }}
                >
                  @{s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Address Link Note */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-sm)',
          padding: '10px 12px',
          fontSize: '11px',
          color: 'var(--text-muted)',
          marginBottom: '20px'
        }}>
          Linked to your wallet: <strong style={{ color: '#fff', fontFamily: 'var(--font-mono)' }}>{userAddress.slice(0, 8)}...{userAddress.slice(-6)}</strong>
        </div>

        {/* Submit Button */}
        <button
          className="btn-primary"
          disabled={!isAvailable || isRegistering}
          onClick={handleRegister}
        >
          {isRegistering ? (
            <>
              <Loader2 size={18} className="soundbox-radar" />
              Registering on Mezo Network...
            </>
          ) : (
            <>
              Create My Mezo ID
              <ArrowRight size={18} />
            </>
          )}
        </button>
      </div>
    </div>
  );
};
