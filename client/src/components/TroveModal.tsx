import React from 'react';
import { X, ShieldAlert, ShieldCheck, ExternalLink, Activity, Coins } from 'lucide-react';
import type { TroveMetrics } from '../services/trove';

interface TroveModalProps {
  isOpen: boolean;
  onClose: () => void;
  metrics: TroveMetrics;
}

export const TroveModal: React.FC<TroveModalProps> = ({
  isOpen,
  onClose,
  metrics,
}) => {
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
              <Coins size={18} />
            </div>
            <div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 700 }}>
                Bitcoin Collateral & Trove
              </h2>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Native Mezo TroveManager & PriceFeed Oracle
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {/* Health Status Banner */}
        <div style={{
          background: metrics.status === 'risky' || metrics.status === 'liquidatable'
            ? 'rgba(239, 68, 68, 0.15)'
            : 'rgba(0, 229, 153, 0.12)',
          border: `1px solid ${metrics.status === 'risky' || metrics.status === 'liquidatable' ? 'var(--color-danger)' : 'var(--mezo-green)'}`,
          borderRadius: 'var(--radius-md)',
          padding: '14px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '20px'
        }}>
          {metrics.status === 'risky' || metrics.status === 'liquidatable' ? (
            <ShieldAlert size={28} color="var(--color-danger)" />
          ) : (
            <ShieldCheck size={28} color="var(--mezo-green)" />
          )}
          <div>
            <div style={{ fontWeight: 700, fontSize: '16px', color: '#fff' }}>
              {metrics.hasTrove ? `Health Ratio: ${metrics.icrPercent}%` : 'No Trove Open'}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              {metrics.statusText}
            </div>
          </div>
        </div>

        {/* Metrics Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
          <div className="glass-card" style={{ padding: '14px' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>TOTAL DEBT</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#fff', marginTop: '4px' }}>
              {Number(metrics.debtMUSD).toFixed(2)} <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>MUSD</span>
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
              Includes 200 MUSD gas deposit
            </div>
          </div>

          <div className="glass-card" style={{ padding: '14px' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>LOCKED COLLATERAL</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--btc-orange)', marginTop: '4px' }}>
              {Number(metrics.collateralBTC).toFixed(4)} <span style={{ fontSize: '12px' }}>BTC</span>
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
              Native Bitcoin L2
            </div>
          </div>

          <div className="glass-card" style={{ padding: '14px' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>LIQUIDATION PRICE</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: metrics.status === 'risky' ? 'var(--color-danger)' : '#fff', marginTop: '4px' }}>
              ${metrics.liquidationPriceUSD}
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
              At 110% MCR threshold
            </div>
          </div>

          <div className="glass-card" style={{ padding: '14px' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>ORACLE BTC PRICE</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--mezo-green)', marginTop: '4px' }}>
              ${metrics.btcPriceUSD}
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
              Live PriceFeed
            </div>
          </div>
        </div>

        {/* Protocol Thresholds Explanation */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: '14px',
          marginBottom: '20px',
          fontSize: '12px',
          color: 'var(--text-secondary)',
          lineHeight: 1.6
        }}>
          <div style={{ fontWeight: 600, color: '#fff', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Activity size={14} color="var(--mezo-green)" /> Mezo Protocol Borrowing Rules:
          </div>
          • <strong>110% MCR:</strong> Individual troves liquidate if ICR falls below 110%.<br />
          • <strong>150% CCR:</strong> System enters Recovery Mode if total system ratio falls below 150%.<br />
          • <strong>200 MUSD Gas Comp:</strong> Automatically locked upon opening; refunded when fully closed.
        </div>

        {/* Link to Mezo Official Borrow UI */}
        <a
          href="https://mezo.org/feature/borrow"
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary"
          style={{ textDecoration: 'none', marginBottom: '8px' }}
        >
          <ExternalLink size={16} /> Open / Manage Trove on Official Mezo
        </a>
      </div>
    </div>
  );
};
