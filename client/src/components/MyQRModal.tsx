import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  QrCode, 
  Copy, 
  Check, 
  Share2, 
  Download, 
  Clock, 
  RefreshCw, 
  ShieldCheck, 
  CheckCircle2
} from 'lucide-react';
import QRCode from 'qrcode';
import confetti from 'canvas-confetti';
import { soundbox } from '../services/soundbox';
import { createMerchantPaymentIntent } from '../services/payment';
import { publicClient } from '../services/web3';
import { CONTRACT_ADDRESSES, PAYMENT_CORE_ABI } from '../config/contracts';

interface MyQRModalProps {
  isOpen: boolean;
  onClose: () => void;
  userAddress: `0x${string}`;
  userHandle: string;
  walletClient?: any;
  defaultTab?: 'permanent' | 'request';
}

export const MyQRModal: React.FC<MyQRModalProps> = ({
  isOpen,
  onClose,
  userAddress,
  userHandle,
  walletClient,
  defaultTab = 'permanent',
}) => {
  const [activeTab, setActiveTab] = useState<'permanent' | 'request'>(defaultTab);

  // Permanent QR State
  const [permanentQrUrl, setPermanentQrUrl] = useState<string | null>(null);
  const [copiedHandle, setCopiedHandle] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedAddr, setCopiedAddr] = useState(false);

  // Request Payment State
  const [requestAmount, setRequestAmount] = useState('10.00');
  const [requestNote, setRequestNote] = useState('Payment on Mezo');
  const [expiryMinutes, setExpiryMinutes] = useState(15);
  const [dynamicQrUrl, setDynamicQrUrl] = useState<string | null>(null);
  const [dynamicPaymentUrl, setDynamicPaymentUrl] = useState<string | null>(null);
  const [isGeneratingRequest, setIsGeneratingRequest] = useState(false);
  const [expiresAtTimestamp, setExpiresAtTimestamp] = useState<number | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);
  const [isExpired, setIsExpired] = useState(false);
  const [paymentReceived, setPaymentReceived] = useState<any | null>(null);

  const countdownIntervalRef = useRef<any>(null);

  const cleanHandle = userHandle.replace('@mezo', '').replace('@', '').toLowerCase().trim();
  const displayHandle = cleanHandle ? `${cleanHandle}@mezo` : `${userAddress.slice(0, 6)}...${userAddress.slice(-4)}`;

  // Generate Permanent QR
  useEffect(() => {
    if (!isOpen || !userAddress) return;

    const generatePermanentQR = async () => {
      try {
        const origin = window.location.origin;
        const permUrl = `${origin}/pay?addr=${userAddress}&handle=${encodeURIComponent(cleanHandle)}&mode=direct`;
        const qr = await QRCode.toDataURL(permUrl, {
          width: 320,
          margin: 2,
          color: {
            dark: '#07090e',
            light: '#ffffff',
          },
        });
        setPermanentQrUrl(qr);
      } catch (err) {
        console.warn('Failed to generate permanent QR:', err);
      }
    };

    generatePermanentQR();
  }, [isOpen, userAddress, cleanHandle]);

  // Generate Request QR with Custom Expiry
  const handleGenerateRequestQR = async () => {
    if (!userAddress) return;
    setIsGeneratingRequest(true);
    setIsExpired(false);
    setPaymentReceived(null);

    try {
      const nowSec = Math.floor(Date.now() / 1000);
      const expirySec = nowSec + (expiryMinutes * 60);
      setExpiresAtTimestamp(expirySec);
      setSecondsRemaining(expiryMinutes * 60);

      const origin = window.location.origin;

      if (walletClient && walletClient.account) {
        // Cryptographically signed intent
        try {
          const intent = await createMerchantPaymentIntent(walletClient, requestAmount, requestNote, origin);
          setDynamicPaymentUrl(intent.paymentUrl);
          const qr = await QRCode.toDataURL(intent.paymentUrl, {
            width: 320,
            margin: 2,
            color: { dark: '#07090e', light: '#ffffff' },
          });
          setDynamicQrUrl(qr);
          return;
        } catch {
          // Fallback to URL parameters if signing is rejected/unavailable
        }
      }

      // Universal standard payment URL
      const params = new URLSearchParams({
        chain: '31611',
        token: CONTRACT_ADDRESSES.MUSD,
        addr: userAddress,
        handle: cleanHandle,
        amount: requestAmount,
        exp: expirySec.toString(),
        note: requestNote,
      });

      const url = `${origin}/pay?${params.toString()}`;
      setDynamicPaymentUrl(url);

      const qr = await QRCode.toDataURL(url, {
        width: 320,
        margin: 2,
        color: { dark: '#07090e', light: '#ffffff' },
      });
      setDynamicQrUrl(qr);
    } catch (err) {
      console.warn('Failed to generate request QR:', err);
    } finally {
      setIsGeneratingRequest(false);
    }
  };

  // Timer Tick
  useEffect(() => {
    if (!expiresAtTimestamp) return;

    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
    }

    countdownIntervalRef.current = setInterval(() => {
      const now = Math.floor(Date.now() / 1000);
      const remaining = expiresAtTimestamp - now;

      if (remaining <= 0) {
        setSecondsRemaining(0);
        setIsExpired(true);
        clearInterval(countdownIntervalRef.current);
      } else {
        setSecondsRemaining(remaining);
      }
    }, 1000);

    return () => {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [expiresAtTimestamp]);

  // Initial request QR generation when switching to request tab
  useEffect(() => {
    if (activeTab === 'request' && !dynamicQrUrl && !isGeneratingRequest) {
      handleGenerateRequestQR();
    }
  }, [activeTab]);

  // Live Soundbox Watcher on Mezo Testnet for incoming payments
  useEffect(() => {
    if (!isOpen || !userAddress) return;

    try {
      const unwatch = publicClient.watchContractEvent({
        address: CONTRACT_ADDRESSES.PAYMENT_CORE,
        abi: PAYMENT_CORE_ABI,
        eventName: 'PaymentAnnounced',
        onLogs: (logs) => {
          for (const log of logs) {
            const { to, amount, payerHandle } = (log as any).args || {};
            if (to && to.toLowerCase() === userAddress.toLowerCase()) {
              const amountFormatted = (Number(amount) / 1e18).toFixed(2);
              soundbox.announcePayment(amountFormatted, 'MUSD');
              confetti({
                particleCount: 120,
                spread: 90,
                origin: { y: 0.6 },
                colors: ['#00e599', '#f7931a', '#ffffff'],
              });
              setPaymentReceived({
                amount: amountFormatted,
                payer: payerHandle || 'Customer',
                time: 'Just now',
              });
            }
          }
        },
      });

      return () => {
        unwatch();
      };
    } catch {
      // Ignored if RPC unwatch not available
    }
  }, [isOpen, userAddress]);

  // Format seconds to MM:SS
  const formatTime = (secs: number | null) => {
    if (secs === null) return '--:--';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleCopy = (text: string, type: 'handle' | 'link' | 'addr') => {
    navigator.clipboard.writeText(text);
    if (type === 'handle') {
      setCopiedHandle(true);
      setTimeout(() => setCopiedHandle(false), 2000);
    } else if (type === 'link') {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } else {
      setCopiedAddr(true);
      setTimeout(() => setCopiedAddr(false), 2000);
    }
  };

  const handleDownloadQR = (qrDataUrl: string, filename: string) => {
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `${filename}.png`;
    a.click();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div
        className="bottom-sheet"
        style={{
          maxWidth: '460px',
          padding: '24px 20px',
          background: 'linear-gradient(180deg, #101625 0%, #0a0e17 100%)',
          borderTop: '1px solid var(--border-highlight)',
        }}
      >
        {/* Top Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, rgba(0, 229, 153, 0.2), rgba(247, 147, 26, 0.2))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--mezo-green)',
              }}
            >
              <QrCode size={18} />
            </div>
            <div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: 800 }}>
                Receive Money
              </h2>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Mezo Testnet Network</span>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '6px',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Switcher: Permanent QR vs Request Custom Amount */}
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
            onClick={() => setActiveTab('permanent')}
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              background: activeTab === 'permanent' ? 'rgba(0, 229, 153, 0.2)' : 'transparent',
              color: activeTab === 'permanent' ? 'var(--mezo-green)' : 'var(--text-muted)',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.2s ease',
            }}
          >
            <ShieldCheck size={16} />
            <span>Permanent QR</span>
          </button>
          <button
            onClick={() => setActiveTab('request')}
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              background: activeTab === 'request' ? 'rgba(247, 147, 26, 0.2)' : 'transparent',
              color: activeTab === 'request' ? 'var(--btc-orange)' : 'var(--text-muted)',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.2s ease',
            }}
          >
            <Clock size={16} />
            <span>Request Amount (Expiring)</span>
          </button>
        </div>

        {/* Payment Received Alert Banner */}
        {paymentReceived && (
          <div
            style={{
              padding: '14px',
              background: 'rgba(0, 229, 153, 0.15)',
              border: '1px solid var(--mezo-green)',
              borderRadius: 'var(--radius-md)',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              animation: 'slideUp 0.3s ease',
            }}
          >
            <CheckCircle2 size={24} color="var(--mezo-green)" style={{ flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>
                +{paymentReceived.amount} MUSD Received!
              </div>
              <div style={{ fontSize: '11px', color: 'var(--mezo-green)' }}>
                Settled on Mezo Network • Audio Soundbox Chime Triggered
              </div>
            </div>
          </div>
        )}

        {/* TAB 1: PERMANENT QR CODE */}
        {activeTab === 'permanent' && (
          <div style={{ textAlign: 'center' }}>
            {/* GPay Profile Card */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '10px',
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-full)',
                padding: '6px 16px 6px 6px',
                marginBottom: '16px',
              }}
            >
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #00e599, #059669)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: '14px',
                  color: '#07090e',
                }}
              >
                {cleanHandle ? cleanHandle.charAt(0).toUpperCase() : 'M'}
              </div>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '13px', fontWeight: 800, color: '#fff' }}>
                  {displayHandle}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--mezo-green)', fontWeight: 600 }}>
                  Permanent Payment Identity
                </div>
              </div>
            </div>

            {/* QR Card Frame */}
            <div
              style={{
                background: '#ffffff',
                borderRadius: '24px',
                padding: '20px',
                display: 'inline-block',
                boxShadow: '0 12px 36px rgba(0, 0, 0, 0.7), 0 0 30px rgba(0, 229, 153, 0.15)',
                margin: '0 auto 16px auto',
              }}
            >
              {permanentQrUrl ? (
                <img
                  src={permanentQrUrl}
                  alt="Permanent MezoPay QR"
                  style={{ width: '240px', height: '240px', display: 'block', borderRadius: '12px' }}
                />
              ) : (
                <div style={{ width: '240px', height: '240px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <RefreshCw className="soundbox-radar" size={32} color="#000" />
                </div>
              )}

              <div
                style={{
                  marginTop: '10px',
                  paddingTop: '8px',
                  borderTop: '1px dashed #e2e8f0',
                  color: '#0f172a',
                  fontSize: '12px',
                  fontWeight: 700,
                  letterSpacing: '0.02em',
                }}
              >
                Scan to pay with any wallet
              </div>
            </div>

            {/* Wallet Address Link */}
            <div
              onClick={() => handleCopy(userAddress, 'addr')}
              style={{
                fontSize: '11px',
                color: 'var(--text-muted)',
                marginBottom: '20px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
            >
              <span>Linked to: {userAddress.slice(0, 8)}...{userAddress.slice(-6)}</span>
              {copiedAddr ? <Check size={12} color="var(--mezo-green)" /> : <Copy size={12} />}
            </div>

            {/* Actions Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <button
                onClick={() => handleCopy(displayHandle, 'handle')}
                className="btn-secondary"
                style={{ fontSize: '13px', padding: '12px' }}
              >
                {copiedHandle ? <Check size={16} color="var(--mezo-green)" /> : <Copy size={16} />}
                <span>{copiedHandle ? 'Copied ID!' : 'Copy Mezo ID'}</span>
              </button>

              <button
                onClick={() => {
                  if (permanentQrUrl) {
                    handleDownloadQR(permanentQrUrl, `MezoPay-${cleanHandle}-Permanent-QR`);
                  }
                }}
                className="btn-secondary"
                style={{ fontSize: '13px', padding: '12px' }}
              >
                <Download size={16} />
                <span>Save QR Image</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: REQUEST CUSTOM AMOUNT (WITH LIMITED EXPIRY TIME) */}
        {activeTab === 'request' && (
          <div>
            {/* Input Controls */}
            <div className="glass-card" style={{ padding: '16px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                    REQUEST AMOUNT (MUSD)
                  </label>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-md)',
                      padding: '8px 12px',
                    }}
                  >
                    <span style={{ fontSize: '18px', fontWeight: 800, color: 'var(--mezo-green)', marginRight: '6px' }}>$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.1"
                      value={requestAmount}
                      onChange={(e) => setRequestAmount(e.target.value)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        outline: 'none',
                        color: '#fff',
                        fontFamily: 'var(--font-display)',
                        fontSize: '18px',
                        fontWeight: 700,
                        width: '100%',
                      }}
                    />
                  </div>
                </div>

                <div style={{ width: '130px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                    EXPIRES IN
                  </label>
                  <select
                    value={expiryMinutes}
                    onChange={(e) => setExpiryMinutes(Number(e.target.value))}
                    style={{
                      width: '100%',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-md)',
                      padding: '11px 8px',
                      color: '#fff',
                      fontSize: '13px',
                      fontWeight: 600,
                      outline: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <option value={5} style={{ background: '#101625' }}>5 mins</option>
                    <option value={15} style={{ background: '#101625' }}>15 mins (Standard)</option>
                    <option value={30} style={{ background: '#101625' }}>30 mins</option>
                    <option value={60} style={{ background: '#101625' }}>1 hour</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                  PAYMENT MEMO / NOTE
                </label>
                <input
                  type="text"
                  placeholder="e.g. Lunch split, Coffee, Invoice #42"
                  value={requestNote}
                  onChange={(e) => setRequestNote(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: '8px 12px',
                    color: '#fff',
                    fontSize: '13px',
                    outline: 'none',
                  }}
                />
              </div>

              <button
                onClick={handleGenerateRequestQR}
                disabled={isGeneratingRequest || !requestAmount || Number(requestAmount) <= 0}
                className="btn-primary"
                style={{
                  marginTop: '12px',
                  padding: '10px',
                  fontSize: '13px',
                  background: 'linear-gradient(135deg, #f7931a 0%, #ea580c 100%)',
                }}
              >
                <RefreshCw size={14} className={isGeneratingRequest ? 'soundbox-radar' : ''} />
                <span>Update / Regenerate Request QR</span>
              </button>
            </div>

            {/* Expiring QR Display */}
            <div style={{ textAlign: 'center' }}>
              {/* Countdown Banner */}
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-full)',
                  background: isExpired
                    ? 'rgba(239, 68, 68, 0.15)'
                    : (secondsRemaining !== null && secondsRemaining < 120)
                    ? 'rgba(245, 158, 11, 0.15)'
                    : 'rgba(247, 147, 26, 0.15)',
                  border: isExpired
                    ? '1px solid rgba(239, 68, 68, 0.4)'
                    : '1px solid rgba(247, 147, 26, 0.4)',
                  marginBottom: '14px',
                }}
              >
                <Clock
                  size={14}
                  color={isExpired ? 'var(--color-danger)' : 'var(--btc-orange)'}
                  className={!isExpired ? 'soundbox-radar' : ''}
                />
                <span
                  style={{
                    fontSize: '13px',
                    fontWeight: 700,
                    color: isExpired ? 'var(--color-danger)' : 'var(--btc-orange)',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {isExpired ? 'EXPIRED' : `Expires in ${formatTime(secondsRemaining)}`}
                </span>
              </div>

              {/* QR Container */}
              <div
                style={{
                  background: '#ffffff',
                  borderRadius: '24px',
                  padding: '18px',
                  display: 'inline-block',
                  position: 'relative',
                  filter: isExpired ? 'grayscale(0.8) blur(2px)' : 'none',
                  opacity: isExpired ? 0.4 : 1,
                  transition: 'all 0.3s ease',
                  margin: '0 auto 12px auto',
                }}
              >
                {dynamicQrUrl ? (
                  <img
                    src={dynamicQrUrl}
                    alt="Dynamic Request Mezo QR"
                    style={{ width: '210px', height: '210px', display: 'block', borderRadius: '12px' }}
                  />
                ) : (
                  <div style={{ width: '210px', height: '210px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <RefreshCw className="soundbox-radar" size={28} color="#000" />
                  </div>
                )}

                <div
                  style={{
                    marginTop: '8px',
                    paddingTop: '6px',
                    borderTop: '1px dashed #e2e8f0',
                    color: '#0f172a',
                    fontSize: '14px',
                    fontWeight: 800,
                  }}
                >
                  Pay ${requestAmount} MUSD
                </div>
              </div>

              {/* Expired Overlay Button */}
              {isExpired && (
                <div style={{ marginBottom: '16px' }}>
                  <button
                    onClick={handleGenerateRequestQR}
                    className="btn-primary"
                    style={{
                      maxWidth: '260px',
                      margin: '0 auto',
                      background: 'linear-gradient(135deg, #f7931a 0%, #ea580c 100%)',
                    }}
                  >
                    <RefreshCw size={16} />
                    <span>Regenerate New QR</span>
                  </button>
                </div>
              )}

              {/* Quick Copy Link */}
              {dynamicPaymentUrl && !isExpired && (
                <button
                  onClick={() => handleCopy(dynamicPaymentUrl, 'link')}
                  className="btn-secondary"
                  style={{ maxWidth: '280px', margin: '0 auto 10px auto', fontSize: '12px', padding: '10px 14px' }}
                >
                  {copiedLink ? <Check size={14} color="var(--mezo-green)" /> : <Share2 size={14} />}
                  <span>{copiedLink ? 'Link Copied to Clipboard!' : 'Copy Payment Request Link'}</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
