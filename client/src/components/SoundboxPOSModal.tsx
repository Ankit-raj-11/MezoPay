import React, { useState, useEffect } from 'react';
import { X, Volume2, QrCode, Sun, CheckCircle2, Copy } from 'lucide-react';
import QRCode from 'qrcode';
import { soundbox } from '../services/soundbox';
import { createMerchantPaymentIntent } from '../services/payment';
import { publicClient } from '../services/web3';
import { CONTRACT_ADDRESSES, PAYMENT_CORE_ABI } from '../config/contracts';

interface SoundboxPOSModalProps {
  isOpen: boolean;
  onClose: () => void;
  merchantWalletClient: any;
  merchantName: string;
}

export const SoundboxPOSModal: React.FC<SoundboxPOSModalProps> = ({
  isOpen,
  onClose,
  merchantWalletClient,
  merchantName,
}) => {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const [recentPaid, setRecentPaid] = useState<any | null>(null);

  // Generate dynamic QR upon opening or changing amount
  const handleGenerateQR = async () => {
    if (!merchantWalletClient) return;
    setIsGenerating(true);
    try {
      const intent = await createMerchantPaymentIntent(merchantWalletClient, amount, note);
      setPaymentUrl(intent.paymentUrl);

      const qr = await QRCode.toDataURL(intent.paymentUrl, {
        width: 320,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      });
      setQrDataUrl(qr);
    } catch (err) {
      console.warn('Failed to generate merchant QR:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      handleGenerateQR();
      soundbox.playChime(); // Warm up audio context on click
    }
  }, [isOpen]);

  // Screen Wake Lock Toggle
  const toggleWakeLock = async () => {
    if (wakeLockActive) {
      soundbox.releaseWakeLock();
      setWakeLockActive(false);
    } else {
      const ok = await soundbox.enableWakeLock();
      setWakeLockActive(ok);
    }
  };

  // Live Soundbox Watcher on Mezo Testnet
  useEffect(() => {
    if (!isOpen || !merchantWalletClient) return;

    const unwatch = publicClient.watchContractEvent({
      address: CONTRACT_ADDRESSES.PAYMENT_CORE,
      abi: PAYMENT_CORE_ABI,
      eventName: 'PaymentAnnounced',
      onLogs: (logs) => {
        for (const log of logs) {
          const args = (log as any).args;
          if (args && args.payee.toLowerCase() === merchantWalletClient.account.address.toLowerCase()) {
            const paidAmount = Number(args.amount) / 1e18;
            setRecentPaid({
              payer: args.payer,
              amount: paidAmount.toFixed(2),
              note: args.note,
              time: new Date().toLocaleTimeString(),
            });
            // Soundbox Trigger!
            soundbox.announcePayment(paidAmount.toFixed(2));
          }
        }
      },
    });

    return () => {
      unwatch();
    };
  }, [isOpen, merchantWalletClient]);

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
              background: 'rgba(247, 147, 26, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--btc-orange)'
            }}>
              <Volume2 size={18} />
            </div>
            <div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 700 }}>
                Merchant POS & Soundbox
              </h2>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                {merchantName} (0-Gas Dynamic Invoices)
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {/* Soundbox Controls Bar */}
        <div style={{
          display: 'flex',
          gap: '8px',
          background: 'rgba(255, 255, 255, 0.04)',
          borderRadius: 'var(--radius-md)',
          padding: '10px 14px',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '16px',
          border: '1px solid var(--border-subtle)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: 'var(--mezo-green)',
              boxShadow: '0 0 10px var(--mezo-green)'
            }} />
            <span style={{ fontSize: '13px', fontWeight: 600 }}>Soundbox Listening</span>
          </div>

          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={() => soundbox.announcePayment('15.00', 'alice')}
              className="badge badge-chain"
              style={{ cursor: 'pointer', padding: '4px 8px' }}
              title="Test audio chime & speech"
            >
              Test Chime 🔔
            </button>
            <button
              onClick={toggleWakeLock}
              className={`badge ${wakeLockActive ? 'badge-verified' : ''}`}
              style={{
                cursor: 'pointer',
                padding: '4px 8px',
                background: wakeLockActive ? 'rgba(0, 229, 153, 0.15)' : 'rgba(255, 255, 255, 0.06)',
                color: wakeLockActive ? 'var(--mezo-green)' : 'var(--text-muted)'
              }}
              title="Keeps screen awake for POS tablet"
            >
              <Sun size={12} /> {wakeLockActive ? 'Awake ON' : 'Keep Awake'}
            </button>
          </div>
        </div>

        {/* Recent Payment Alert Banner */}
        {recentPaid && (
          <div style={{
            background: 'rgba(0, 229, 153, 0.15)',
            border: '1px solid var(--mezo-green)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 14px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            animation: 'slideUp 0.3s ease'
          }}>
            <CheckCircle2 size={24} color="var(--mezo-green)" />
            <div>
              <div style={{ fontWeight: 700, color: '#fff', fontSize: '15px' }}>
                Payment Received: +{recentPaid.amount} MUSD!
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                From {recentPaid.payer.slice(0, 6)}...{recentPaid.payer.slice(-4)} at {recentPaid.time}
              </div>
            </div>
          </div>
        )}

        {/* QR Code Container */}
        <div style={{
          background: '#ffffff',
          borderRadius: 'var(--radius-lg)',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          boxShadow: 'var(--shadow-glow-amber)',
          margin: '0 auto 20px auto',
          maxWidth: '300px'
        }}>
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="Merchant QR" style={{ width: '100%', height: 'auto', display: 'block' }} />
          ) : (
            <div style={{ width: '240px', height: '240px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000' }}>
              Generating QR...
            </div>
          )}
          <div style={{ color: '#000', fontWeight: 800, fontSize: '20px', marginTop: '10px' }}>
            {amount} MUSD
          </div>
          <div style={{ color: '#666', fontSize: '12px', fontWeight: 600 }}>
            {note}
          </div>
        </div>

        {/* Invoice Config Controls */}
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
            <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>NOTE / ORDER ID</label>
            <input
              type="text"
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

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="btn-primary"
            style={{ flex: 1 }}
            onClick={handleGenerateQR}
            disabled={isGenerating}
          >
            <QrCode size={16} /> Update Signed QR
          </button>
          {paymentUrl && (
            <button
              className="btn-secondary"
              onClick={() => {
                navigator.clipboard.writeText(paymentUrl);
                alert('Copied payment link to clipboard!');
              }}
              style={{ padding: '0 16px' }}
            >
              <Copy size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
