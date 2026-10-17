import React, { useState } from 'react';
import { X, ShieldAlert, Clock, ShieldCheck, RefreshCw } from 'lucide-react';
import type { AccountState } from '../services/payment';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  accountState: AccountState;
  onConfigureLimits: (daily: string, perTx: string) => Promise<boolean>;
  onExecutePending: () => Promise<boolean>;
  onCancelPending: () => Promise<boolean>;
  onRevokeAllowance: () => Promise<boolean>;
  onRefreshAllowance: () => Promise<boolean>;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  accountState,
  onConfigureLimits,
  onExecutePending,
  onCancelPending,
  onRevokeAllowance,
  onRefreshAllowance,
}) => {
  const [dailyCap, setDailyCap] = useState(accountState.dailyCap === '0.0' ? '100' : accountState.dailyCap);
  const [perTxCap, setPerTxCap] = useState(accountState.perTxCap === '0.0' ? '25' : accountState.perTxCap);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const hasPending = accountState.pendingDailyTimelock > 0 || accountState.pendingPerTxTimelock > 0;
  const now = Math.floor(Date.now() / 1000);
  const isDailyReady = accountState.pendingDailyTimelock > 0 && now >= accountState.pendingDailyTimelock;
  const isPerTxReady = accountState.pendingPerTxTimelock > 0 && now >= accountState.pendingPerTxTimelock;
  const canExecute = isDailyReady || isPerTxReady;

  const handleSaveLimits = async () => {
    setIsSubmitting(true);
    setStatusMsg(null);
    try {
      const ok = await onConfigureLimits(dailyCap, perTxCap);
      if (ok) {
        setStatusMsg('Limits updated! (Increases above ceilings queue into 24h timelock).');
      } else {
        setStatusMsg('Failed to update limits.');
      }
    } catch (err: any) {
      setStatusMsg(err.message || 'Error updating limits');
    } finally {
      setIsSubmitting(false);
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
              <ShieldCheck size={18} />
            </div>
            <div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 700 }}>
                Safety Limits & Revocation
              </h2>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Timelocked Protection Against Velocity Drains
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {/* Active Limits Info Card */}
        <div className="glass-card" style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '8px' }}>
            CURRENT ACTIVE SPENDING LIMITS
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Daily Limit:</span>
            <span style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>{accountState.dailyCap} MUSD</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Per-Payment Limit:</span>
            <span style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>{accountState.perTxCap} MUSD</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Spent Today:</span>
            <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--btc-orange)' }}>{accountState.spentToday} MUSD</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Remaining Today:</span>
            <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--mezo-green)' }}>
              {accountState.effectiveRemainingDailySpend} MUSD
            </span>
          </div>
        </div>

        {/* Pending Timelock Banner */}
        {hasPending && (
          <div style={{
            background: 'rgba(245, 158, 11, 0.12)',
            border: '1px solid var(--color-warning)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 14px',
            marginBottom: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fbbf24', fontWeight: 700, fontSize: '14px', marginBottom: '4px' }}>
              <Clock size={16} /> 24-Hour Timelock In Progress
            </div>
            {accountState.pendingDailyTimelock > 0 && (
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Proposed Daily Cap: {accountState.pendingDailyCap} MUSD (Unlocks in {Math.max(0, Math.round((accountState.pendingDailyTimelock - now) / 60))} mins)
              </div>
            )}
            {accountState.pendingPerTxTimelock > 0 && (
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Proposed Per-Tx Cap: {accountState.pendingPerTxCap} MUSD (Unlocks in {Math.max(0, Math.round((accountState.pendingPerTxTimelock - now) / 60))} mins)
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
              {canExecute && (
                <button
                  className="btn-primary"
                  style={{ padding: '8px 14px', fontSize: '13px' }}
                  onClick={onExecutePending}
                >
                  Apply Ready Increases
                </button>
              )}
              <button
                className="btn-danger"
                style={{ padding: '8px 14px', fontSize: '13px' }}
                onClick={onCancelPending}
              >
                Cancel Pending Hike
              </button>
            </div>
          </div>
        )}

        {/* Edit Limits Form */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>DAILY CAP (MUSD)</label>
            <input
              type="number"
              value={dailyCap}
              onChange={(e) => setDailyCap(e.target.value)}
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
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
              Initial max: 200 MUSD
            </div>
          </div>

          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>PER-TX CAP (MUSD)</label>
            <input
              type="number"
              value={perTxCap}
              onChange={(e) => setPerTxCap(e.target.value)}
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
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
              Initial max: 50 MUSD
            </div>
          </div>
        </div>

        <button
          className="btn-primary"
          style={{ marginBottom: '20px' }}
          onClick={handleSaveLimits}
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Updating...' : 'Save Safety Limits'}
        </button>

        {statusMsg && (
          <div style={{ fontSize: '12px', color: 'var(--mezo-green)', textAlign: 'center', marginBottom: '16px' }}>
            {statusMsg}
          </div>
        )}

        <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '16px' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#fff', marginBottom: '6px' }}>
            ALLOWANCE & CONTRACT ACCESS
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
            Current Allowance: <strong>{Number(accountState.allowance).toFixed(2)} MUSD</strong>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="btn-secondary"
              style={{ flex: 1 }}
              onClick={onRefreshAllowance}
            >
              <RefreshCw size={14} /> Refresh (500 MUSD)
            </button>
            <button
              className="btn-danger"
              style={{ flex: 1 }}
              onClick={onRevokeAllowance}
            >
              <ShieldAlert size={14} /> Revoke Access (0)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
