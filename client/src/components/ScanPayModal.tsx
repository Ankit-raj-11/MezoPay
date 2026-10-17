import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, AlertTriangle, QrCode, ArrowRight, Zap } from 'lucide-react';
import confetti from 'canvas-confetti';
import { soundbox } from '../services/soundbox';
import { lookupAddress } from '../services/names';
import { CameraQRScanner } from './CameraQRScanner';
import { estimateGasFee } from '../services/payment';

interface ScanPayModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExecutePayment: (to: `0x${string}`, amount: string, note: string, refData?: any) => Promise<boolean>;
  initialPayload?: string;
  remainingDailySpend: string;
  allowance: string;
}

export const ScanPayModal: React.FC<ScanPayModalProps> = ({
  isOpen,
  onClose,
  onExecutePayment,
  initialPayload = '',
  remainingDailySpend,
  allowance,
}) => {
  const [scanMode, setScanMode] = useState<'camera' | 'manual'>('camera');
  const [payloadInput, setPayloadInput] = useState(initialPayload);
  const [parsedPayment, setParsedPayment] = useState<any | null>(null);
  const [customAmount, setCustomAmount] = useState('10.00');
  const [merchantName, setMerchantName] = useState<string | null>(null);
  const [gasFee, setGasFee] = useState<{ gasPriceGwei: string; estimatedFeeBTC: string; estimatedFeeUSD: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (initialPayload) {
      setPayloadInput(initialPayload);
      parsePayload(initialPayload);
    }
  }, [initialPayload]);

  const parsePayload = async (raw: string) => {
    setErrorMsg(null);
    setPaymentSuccess(false);

    try {
      let urlStr = raw.trim();
      if (!urlStr.startsWith('http://') && !urlStr.startsWith('https://')) {
        urlStr = 'https://mezopay.app/pay?' + urlStr;
      }

      const url = new URL(urlStr);
      const chain = url.searchParams.get('chain');
      const token = url.searchParams.get('token');
      const addr = url.searchParams.get('addr') as `0x${string}` | null;
      let amount = url.searchParams.get('amount');
      const exp = url.searchParams.get('exp');
      const salt = url.searchParams.get('salt');
      const sig = url.searchParams.get('sig');
      const note = url.searchParams.get('note') || 'Direct Mezo Payment';
      const handleParam = url.searchParams.get('handle');

      if (!addr) {
        setErrorMsg('Invalid QR: Missing recipient wallet address');
        setParsedPayment(null);
        return;
      }

      if (chain && chain !== '31611') {
        setErrorMsg(`Unsupported Chain (${chain}). This payment requires Mezo Testnet (31611).`);
        setParsedPayment(null);
        return;
      }

      if (token && token.toLowerCase() !== '0x118917a40faf1cd7a13db0ef56c86de7973ac503') {
        setErrorMsg('Invalid Token: Only official Mezo MUSD is accepted.');
        setParsedPayment(null);
        return;
      }

      // Check Expiry if dynamic QR
      if (exp) {
        const expiryTime = Number(exp);
        if (Math.floor(Date.now() / 1000) > expiryTime) {
          setErrorMsg('QR Expired: This payment invoice has timed out. Please ask recipient to regenerate.');
          setParsedPayment(null);
          return;
        }
      }

      const isPermanentQR = !amount || !sig;
      if (amount) {
        setCustomAmount(amount);
      } else {
        amount = customAmount || '10.00';
      }

      // Check remaining daily spend limit
      if (Number(amount) > Number(remainingDailySpend)) {
        setErrorMsg(`Payment of ${amount} MUSD exceeds your remaining daily limit of ${remainingDailySpend} MUSD.`);
      }

      // Look up registered handle on-chain
      let displayName = handleParam ? `@${handleParam}` : `${addr.slice(0, 6)}...${addr.slice(-4)}`;

      try {
        const onChainHandle = await lookupAddress(addr);
        if (onChainHandle) {
          displayName = `@${onChainHandle}`;
        }
      } catch {}

      setMerchantName(displayName);

      setParsedPayment({
        addr,
        amount,
        note,
        exp,
        salt,
        sig,
        isDynamic: Boolean(sig && salt && exp),
        isPermanentQR,
      });

      estimateGasFee().then(setGasFee).catch(() => null);
    } catch {
      setErrorMsg('Failed to parse QR payload. Please ensure it is a valid MezoPay link.');
      setParsedPayment(null);
    }
  };

  const handlePay = async () => {
    if (!parsedPayment) return;
    const effectiveAmount = parsedPayment.isPermanentQR ? customAmount : parsedPayment.amount;

    if (Number(effectiveAmount) > Number(remainingDailySpend)) {
      setErrorMsg(`Payment of ${effectiveAmount} MUSD exceeds your remaining daily limit (${remainingDailySpend} MUSD).`);
      return;
    }

    setIsProcessing(true);
    setErrorMsg(null);

    try {
      const ok = await onExecutePayment(
        parsedPayment.addr,
        effectiveAmount,
        parsedPayment.note,
        parsedPayment.isDynamic ? {
          exp: Number(parsedPayment.exp),
          salt: parsedPayment.salt,
          sig: parsedPayment.sig,
        } : undefined
      );

      if (ok) {
        setPaymentSuccess(true);
        soundbox.announcePayment(effectiveAmount, merchantName || undefined);
        confetti({
          particleCount: 90,
          spread: 80,
          origin: { y: 0.6 },
          colors: ['#00e599', '#f7931a', '#ffffff'],
        });
      } else {
        setErrorMsg('Transaction failed. Please check your balance and safety limits.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Payment execution failed');
    } finally {
      setIsProcessing(false);
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
              <QrCode size={18} />
            </div>
            <div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: 800 }}>
                Scan & Pay
              </h2>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>MezoPay Fast Instant Payment</span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {paymentSuccess ? (
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
              Payment Sent!
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '20px' }}>
              Paid <strong style={{ color: '#fff' }}>{parsedPayment?.isPermanentQR ? customAmount : parsedPayment?.amount} MUSD</strong> to {merchantName}
            </p>
            <button className="btn-primary" onClick={onClose}>
              Done
            </button>
          </div>
        ) : (
          <div>
            {/* Mode Switcher: Camera vs Paste/Presets */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <button
                className={`btn-secondary ${scanMode === 'camera' ? 'badge-verified' : ''}`}
                style={{ flex: 1, padding: '8px', fontSize: '12px' }}
                onClick={() => setScanMode('camera')}
              >
                📸 Mobile Camera
              </button>
              <button
                className={`btn-secondary ${scanMode === 'manual' ? 'badge-verified' : ''}`}
                style={{ flex: 1, padding: '8px', fontSize: '12px' }}
                onClick={() => setScanMode('manual')}
              >
                📋 Paste Link
              </button>
            </div>

            {scanMode === 'camera' && !parsedPayment && (
              <div style={{ marginBottom: '16px' }}>
                <CameraQRScanner onScan={(decodedText) => parsePayload(decodedText)} />
              </div>
            )}

            {scanMode === 'manual' && (
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  PASTE PAYMENT LINK OR QR PAYLOAD
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder="https://.../pay?addr=0x...&amount=12.50"
                    value={payloadInput}
                    onChange={(e) => {
                      setPayloadInput(e.target.value);
                      if (e.target.value.length > 10) {
                        parsePayload(e.target.value);
                      }
                    }}
                    style={{
                      flex: 1,
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '10px 14px',
                      color: '#fff',
                      fontSize: '13px',
                      fontFamily: 'var(--font-mono)'
                    }}
                  />
                  <button
                    className="btn-secondary"
                    onClick={() => parsePayload(payloadInput)}
                    style={{ padding: '10px 14px' }}
                  >
                    Parse
                  </button>
                </div>
              </div>
            )}

            {errorMsg && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: 'var(--radius-md)',
                padding: '12px',
                display: 'flex',
                gap: '8px',
                alignItems: 'center',
                color: '#fca5a5',
                fontSize: '13px',
                marginBottom: '16px'
              }}>
                <AlertTriangle size={18} />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Confirmation Card */}
            {parsedPayment && (
              <div className="glass-card" style={{ marginBottom: '20px', border: '1px solid var(--border-highlight)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.05em' }}>RECIPIENT</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                      <span style={{ fontSize: '18px', fontWeight: 800, color: '#fff' }}>
                        {merchantName}
                      </span>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.05em' }}>AMOUNT</div>
                    {parsedPayment.isPermanentQR ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                        <span style={{ fontSize: '18px', fontWeight: 800, color: 'var(--mezo-green)' }}>$</span>
                        <input
                          type="number"
                          step="0.01"
                          value={customAmount}
                          onChange={(e) => setCustomAmount(e.target.value)}
                          style={{
                            width: '90px',
                            background: 'rgba(255, 255, 255, 0.08)',
                            border: '1px solid var(--border-highlight)',
                            borderRadius: 'var(--radius-sm)',
                            color: 'var(--mezo-green)',
                            fontFamily: 'var(--font-display)',
                            fontSize: '20px',
                            fontWeight: 800,
                            padding: '2px 6px',
                            textAlign: 'right',
                            outline: 'none',
                          }}
                        />
                        <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>MUSD</span>
                      </div>
                    ) : (
                      <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--mezo-green)' }}>
                        {parsedPayment.amount} <span style={{ fontSize: '14px' }}>MUSD</span>
                      </div>
                    )}
                  </div>
                </div>

                <div style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '10px 12px',
                  fontSize: '13px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: '8px'
                }}>
                  <span style={{ color: 'var(--text-muted)' }}>Note / Item:</span>
                  <span style={{ fontWeight: 600, color: '#fff' }}>{parsedPayment.note}</span>
                </div>

                <div style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '10px 12px',
                  fontSize: '12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: '8px',
                  color: 'var(--text-muted)'
                }}>
                  <span>Payment Type:</span>
                  <span style={{ color: parsedPayment.isDynamic ? 'var(--mezo-green)' : 'var(--btc-orange)', fontWeight: 600 }}>
                    {parsedPayment.isDynamic ? 'Signed Request (payReference)' : 'Direct Transfer (payDirect)'}
                  </span>
                </div>

                <div style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '10px 12px',
                  fontSize: '12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: '8px',
                  color: 'var(--text-muted)'
                }}>
                  <span>Estimated Network Fee:</span>
                  <span style={{ color: '#fff', fontWeight: 600 }}>
                    {gasFee ? `${gasFee.estimatedFeeBTC} BTC (${gasFee.estimatedFeeUSD})` : 'Estimating...'}
                  </span>
                </div>

                <div style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '10px 12px',
                  fontSize: '12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  color: 'var(--text-muted)'
                }}>
                  <span>MUSD Allowance:</span>
                  <span style={{
                    color: Number(allowance) >= Number(parsedPayment.isPermanentQR ? customAmount : parsedPayment.amount) ? 'var(--mezo-green)' : 'var(--mezo-orange)',
                    fontWeight: 600
                  }}>
                    {Number(allowance) >= Number(parsedPayment.isPermanentQR ? customAmount : parsedPayment.amount) ? 'Approved' : 'Auto-approves on pay'}
                  </span>
                </div>
              </div>
            )}

            <button
              className="btn-primary"
              disabled={!parsedPayment || isProcessing}
              onClick={handlePay}
            >
              {isProcessing ? (
                <>Processing on Mezo Testnet...</>
              ) : (
                <>
                  <Zap size={18} />
                  Confirm 1-Tap Payment
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
