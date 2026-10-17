import React, { useState } from 'react';
import { X, Send, AlertTriangle, CheckCircle2, UserCheck, Zap } from 'lucide-react';
import confetti from 'canvas-confetti';
import { soundbox } from '../services/soundbox';
import { lookupName } from '../services/names';

interface SendNameModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSendDirect: (to: `0x${string}`, amount: string, note: string) => Promise<boolean>;
  remainingDailySpend: string;
}

export const SendNameModal: React.FC<SendNameModalProps> = ({
  isOpen,
  onClose,
  onSendDirect,
  remainingDailySpend,
}) => {
  const [handle, setHandle] = useState('');
  const [resolvedAddress, setResolvedAddress] = useState<`0x${string}` | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [amount, setAmount] = useState('10.00');
  const [note, setNote] = useState('Coffee on Mezo');
  const [isSending, setIsSending] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSearch = async (val: string) => {
    setHandle(val);
    setErrorMsg(null);
    setResolvedAddress(null);

    const clean = val.replace('@mezo', '').replace('@', '').toLowerCase().trim();
    if (clean.length >= 3) {
      setIsSearching(true);
      try {
        const addr = await lookupName(clean);
        setResolvedAddress(addr);
        if (!addr) {
          setErrorMsg(`Handle @${clean} is not registered on MezoNameRegistry`);
        }
      } catch {
        setErrorMsg('Resolution failed');
      } finally {
        setIsSearching(false);
      }
    }
  };

  const handleSend = async () => {
    if (!resolvedAddress) return;
    if (Number(amount) > Number(remainingDailySpend)) {
      setErrorMsg(`Amount exceeds your remaining daily spend limit (${remainingDailySpend} MUSD).`);
      return;
    }

    setIsSending(true);
    setErrorMsg(null);

    try {
      const ok = await onSendDirect(resolvedAddress, amount, note);
      if (ok) {
        setIsSuccess(true);
        soundbox.announcePayment(amount, `@${handle.replace('@', '')}`);
        confetti({
          particleCount: 70,
          spread: 60,
          origin: { y: 0.6 },
          colors: ['#00e599', '#f7931a', '#ffffff'],
        });
      } else {
        setErrorMsg('Payment failed. Please verify your allowance and daily limit.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Payment execution failed');
    } finally {
      setIsSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="bottom-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="drag-handle" />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'rgba(0, 229, 153, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--mezo-green)'
            }}>
              <Send size={18} />
            </div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 700 }}>
              Send to @name
            </h2>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {isSuccess ? (
          <div style={{ textAlign: 'center', padding: '24px 10px' }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'rgba(0, 229, 153, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px auto',
              color: 'var(--mezo-green)',
              boxShadow: 'var(--shadow-glow)'
            }}>
              <CheckCircle2 size={36} />
            </div>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 700, marginBottom: '6px' }}>
              Transfer Complete!
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '20px' }}>
              Sent <strong style={{ color: '#fff' }}>{amount} MUSD</strong> to @{handle.replace('@', '')}
            </p>
            <button className="btn-primary" onClick={onClose}>
              Done
            </button>
          </div>
        ) : (
          <div>
            {/* Handle Input with live resolution */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                RECIPIENT HANDLE
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  placeholder="alice or bob"
                  value={handle}
                  onChange={(e) => handleSearch(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: resolvedAddress ? '1px solid var(--mezo-green)' : '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '12px 14px',
                    color: '#fff',
                    fontSize: '15px',
                    fontWeight: 600
                  }}
                />
                {isSearching && (
                  <div style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontSize: '11px',
                    color: 'var(--text-muted)'
                  }}>
                    Resolving...
                  </div>
                )}
                {!isSearching && resolvedAddress && (
                  <div style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    color: 'var(--mezo-green)',
                    fontSize: '12px',
                    fontWeight: 600
                  }}>
                    <UserCheck size={16} /> Resolved
                  </div>
                )}
              </div>

              {/* Resolved Address Pill */}
              {resolvedAddress && (
                <div style={{
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-muted)',
                  marginTop: '6px',
                  padding: '4px 8px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  borderRadius: '4px'
                }}>
                  {resolvedAddress}
                </div>
              )}
            </div>

            {/* Quick Demo Handle Tags */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
              <button
                className="badge badge-chain"
                style={{ cursor: 'pointer', padding: '4px 8px' }}
                onClick={() => handleSearch('chaipoint')}
              >
                @chaipoint
              </button>
              <button
                className="badge badge-chain"
                style={{ cursor: 'pointer', padding: '4px 8px' }}
                onClick={() => handleSearch('bob')}
              >
                @bob
              </button>
              <button
                className="badge badge-chain"
                style={{ cursor: 'pointer', padding: '4px 8px' }}
                onClick={() => handleSearch('alice')}
              >
                @alice
              </button>
            </div>

            {/* Amount & Note Inputs */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '8px', marginBottom: '16px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>AMOUNT (MUSD)</label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '10px',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: '15px'
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>NOTE (MAX 140 CHARS)</label>
                <input
                  type="text"
                  maxLength={140}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '10px',
                    color: '#fff',
                    fontSize: '14px'
                  }}
                />
              </div>
            </div>

            {errorMsg && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: 'var(--radius-md)',
                padding: '10px 12px',
                display: 'flex',
                gap: '8px',
                alignItems: 'center',
                color: '#fca5a5',
                fontSize: '12px',
                marginBottom: '16px'
              }}>
                <AlertTriangle size={16} />
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              className="btn-primary"
              disabled={!resolvedAddress || isSending}
              onClick={handleSend}
            >
              {isSending ? (
                <>Sending on Mezo...</>
              ) : (
                <>
                  <Zap size={18} />
                  Send {amount} MUSD
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
