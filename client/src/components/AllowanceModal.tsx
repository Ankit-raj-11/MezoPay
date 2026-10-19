import React, { useState } from 'react';
import { X, ShieldAlert, CheckCircle2, RefreshCw, Zap, ArrowRight, AlertTriangle } from 'lucide-react';
import { parseUnits, maxUint256, formatUnits } from 'viem';
import { CONTRACT_ADDRESSES, ERC20_ABI } from '../config/contracts';
import { publicClient } from '../services/web3';

interface AllowanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentAllowance: string;
  requiredAmount?: string;
  walletClient: any;
  onAllowanceUpdated: (newAllowanceFormatted: string, newAllowanceRaw: bigint) => void;
}

export const AllowanceModal: React.FC<AllowanceModalProps> = ({
  isOpen,
  onClose,
  currentAllowance,
  requiredAmount,
  walletClient,
  onAllowanceUpdated,
}) => {
  const defaultAmount = requiredAmount && Number(requiredAmount) > 0 ? requiredAmount : '10';
  const [selectedType, setSelectedType] = useState<'preset' | 'custom' | 'unlimited'>('preset');
  const [presetValue, setPresetValue] = useState<string>(defaultAmount);
  const [customValue, setCustomValue] = useState<string>('');
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [acknowledgedUnlimitedRisk, setAcknowledgedUnlimitedRisk] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmationMessage, setConfirmationMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const getEffectiveAmount = (): { raw: bigint; label: string } => {
    if (selectedType === 'unlimited') {
      if (!acknowledgedUnlimitedRisk) {
        throw new Error('You must explicitly acknowledge the security risk before enabling Unlimited allowance.');
      }
      return { raw: maxUint256, label: 'Unlimited' };
    }
    const val = selectedType === 'preset' ? presetValue : customValue;
    const num = parseFloat(val);
    if (isNaN(num) || num <= 0) {
      throw new Error('Please enter a valid allowance amount greater than 0');
    }
    return { raw: parseUnits(val, 18), label: `${num.toFixed(2)} MUSD` };
  };

  const handleUpdateAllowance = async () => {
    if (!walletClient || !walletClient.account) {
      setErrorMessage('Wallet client not connected.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setConfirmationMessage(null);

    try {
      const { raw, label } = getEffectiveAmount();

      const txHash = await walletClient.writeContract({
        address: CONTRACT_ADDRESSES.MUSD,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [CONTRACT_ADDRESSES.PAYMENT_CORE, raw],
        account: walletClient.account,
      });

      await publicClient.waitForTransactionReceipt({ hash: txHash });

      const newFormatted = label === 'Unlimited' ? 'Unlimited' : formatUnits(raw, 18);
      onAllowanceUpdated(newFormatted, raw);

      setConfirmationMessage(`Allowance updated to ${label}! Visible on-chain (Tx: ${txHash.slice(0, 8)}...${txHash.slice(-6)})`);
      setTimeout(() => {
        onClose();
      }, 1800);
    } catch (err: any) {
      console.error('Allowance update failed:', err);
      setErrorMessage(err.shortMessage || err.message || 'Failed to update allowance transaction.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevoke = async () => {
    if (!walletClient || !walletClient.account) {
      setErrorMessage('Wallet client not connected.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setConfirmationMessage(null);

    try {
      const txHash = await walletClient.writeContract({
        address: CONTRACT_ADDRESSES.MUSD,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [CONTRACT_ADDRESSES.PAYMENT_CORE, 0n],
        account: walletClient.account,
      });

      await publicClient.waitForTransactionReceipt({ hash: txHash });
      onAllowanceUpdated('0.00', 0n);

      setConfirmationMessage(`Allowance revoked! Set to 0.00 MUSD (Tx: ${txHash.slice(0, 8)}...${txHash.slice(-6)})`);
      setTimeout(() => {
        onClose();
      }, 1800);
    } catch (err: any) {
      console.error('Allowance revoke failed:', err);
      setErrorMessage(err.shortMessage || err.message || 'Failed to revoke allowance.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="bottom-sheet" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
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
              <RefreshCw size={18} />
            </div>
            <div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: 700 }}>
                Refresh Allowance
              </h2>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Choose spending permission for MezoPaymentCore
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {/* Current status card */}
        <div className="glass-card" style={{ padding: '12px 14px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Current Active Allowance:</span>
            <span style={{ fontSize: '14px', fontWeight: 700, color: Number(currentAllowance) > 0 ? 'var(--mezo-green)' : 'var(--btc-orange)' }}>
              {currentAllowance} MUSD
            </span>
          </div>
          {requiredAmount && Number(requiredAmount) > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', paddingTop: '6px', borderTop: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Required for this payment:</span>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>
                {requiredAmount} MUSD
              </span>
            </div>
          )}
        </div>

        {/* Amount chooser presets */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
            SELECT ALLOWANCE AMOUNT:
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '10px' }}>
            {requiredAmount && Number(requiredAmount) > 0 && (
              <button
                type="button"
                className={`btn-secondary ${selectedType === 'preset' && presetValue === requiredAmount ? 'badge-active' : ''}`}
                style={{ padding: '8px 4px', fontSize: '11px', fontWeight: 700, borderColor: selectedType === 'preset' && presetValue === requiredAmount ? 'var(--mezo-green)' : 'var(--border-subtle)' }}
                onClick={() => {
                  setSelectedType('preset');
                  setPresetValue(requiredAmount);
                }}
              >
                Exact ({requiredAmount})
              </button>
            )}
            <button
              type="button"
              className={`btn-secondary ${selectedType === 'preset' && presetValue === '10' ? 'badge-active' : ''}`}
              style={{ padding: '8px 4px', fontSize: '12px', fontWeight: 600, borderColor: selectedType === 'preset' && presetValue === '10' ? 'var(--mezo-green)' : 'var(--border-subtle)' }}
              onClick={() => {
                setSelectedType('preset');
                setPresetValue('10');
              }}
            >
              10 MUSD (Min)
            </button>
            <button
              type="button"
              className={`btn-secondary ${selectedType === 'preset' && presetValue === '50' ? 'badge-active' : ''}`}
              style={{ padding: '8px 4px', fontSize: '12px', fontWeight: 600, borderColor: selectedType === 'preset' && presetValue === '50' ? 'var(--mezo-green)' : 'var(--border-subtle)' }}
              onClick={() => {
                setSelectedType('preset');
                setPresetValue('50');
              }}
            >
              50 MUSD
            </button>
            <button
              type="button"
              className={`btn-secondary ${selectedType === 'preset' && presetValue === '100' ? 'badge-active' : ''}`}
              style={{ padding: '8px 4px', fontSize: '12px', fontWeight: 600, borderColor: selectedType === 'preset' && presetValue === '100' ? 'var(--mezo-green)' : 'var(--border-subtle)' }}
              onClick={() => {
                setSelectedType('preset');
                setPresetValue('100');
              }}
            >
              100 MUSD
            </button>
            <button
              type="button"
              className={`btn-secondary ${selectedType === 'custom' ? 'badge-active' : ''}`}
              style={{ padding: '8px 4px', fontSize: '12px', fontWeight: 600, borderColor: selectedType === 'custom' ? 'var(--mezo-green)' : 'var(--border-subtle)' }}
              onClick={() => {
                setSelectedType('custom');
              }}
            >
              Custom Amount
            </button>
          </div>

          {selectedType === 'custom' && (
            <div style={{ marginTop: '8px', marginBottom: '10px' }}>
              <input
                type="number"
                step="any"
                min="0.01"
                placeholder="Enter custom MUSD amount"
                className="input-field"
                value={customValue}
                onChange={(e) => setCustomValue(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', fontSize: '14px' }}
              />
            </div>
          )}

          {/* Advanced / High-Risk Unlimited Option Accordion */}
          <div style={{ marginTop: '12px', borderTop: '1px solid var(--border-subtle)', paddingTop: '10px' }}>
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                fontSize: '11px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                padding: '4px 0',
              }}
            >
              <span>{showAdvanced ? '▾' : '▸'} Advanced Options</span>
            </button>

            {showAdvanced && (
              <div style={{
                marginTop: '8px',
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: 'var(--radius-sm)',
                padding: '10px',
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '10px' }}>
                  <AlertTriangle size={16} color="#ef4444" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div style={{ fontSize: '11px', color: '#fca5a5', lineHeight: 1.4 }}>
                    <strong>Security Warning:</strong> Unlimited allowance grants the contract permanent permission to spend all MUSD in your wallet. We strongly recommend approving only what is needed.
                  </div>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: '#fff', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={acknowledgedUnlimitedRisk}
                    onChange={(e) => {
                      setAcknowledgedUnlimitedRisk(e.target.checked);
                      if (e.target.checked) setSelectedType('unlimited');
                      else setSelectedType('preset');
                    }}
                  />
                  <span>I understand the security risks and require Unlimited allowance</span>
                </label>
              </div>
            )}
          </div>
        </div>

        {/* Visible confirmation toast */}
        {confirmationMessage && (
          <div style={{
            background: 'rgba(0, 229, 153, 0.12)',
            border: '1px solid var(--mezo-green)',
            borderRadius: 'var(--radius-sm)',
            padding: '10px 12px',
            fontSize: '12px',
            color: 'var(--mezo-green)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '14px'
          }}>
            <CheckCircle2 size={16} />
            <span>{confirmationMessage}</span>
          </div>
        )}

        {/* Visible error message */}
        {errorMessage && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid var(--color-danger)',
            borderRadius: 'var(--radius-sm)',
            padding: '10px 12px',
            fontSize: '12px',
            color: '#f87171',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '14px'
          }}>
            <AlertTriangle size={16} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button
            type="button"
            className="btn-primary"
            disabled={isSubmitting}
            onClick={handleUpdateAllowance}
          >
            {isSubmitting ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <RefreshCw size={16} className="spin" /> Confirming on Mezo Testnet...
              </span>
            ) : (
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Zap size={16} /> Confirm Allowance Refresh <ArrowRight size={16} />
              </span>
            )}
          </button>

          <button
            type="button"
            className="btn-secondary"
            style={{ color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.3)' }}
            disabled={isSubmitting || Number(currentAllowance) === 0}
            onClick={handleRevoke}
          >
            <ShieldAlert size={15} /> Revoke Allowance (Set to 0)
          </button>
        </div>
      </div>
    </div>
  );
};
