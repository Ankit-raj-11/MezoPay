import React, { useState } from 'react';
import { X, Users, PieChart, CheckCircle2, Copy, AlertTriangle, ArrowRight } from 'lucide-react';
import { soundbox } from '../services/soundbox';

interface BillSplitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateSplit: (totalAmount: string, participantCount: number, memo: string) => Promise<string | null>;
  onPaySplitShare?: (splitId: `0x${string}`) => Promise<boolean>;
}

export const BillSplitModal: React.FC<BillSplitModalProps> = ({
  isOpen,
  onClose,
  onCreateSplit,
}) => {
  const [totalAmount, setTotalAmount] = useState('');
  const [participantCount, setParticipantCount] = useState(2); // 2 friends + 1 creator = 3 people
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdSplitId, setCreatedSplitId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Split calculation
  const totalNum = Number(totalAmount) || 0;
  const totalPeople = participantCount + 1;
  const shareAmount = totalPeople > 0 ? (totalNum / totalPeople).toFixed(2) : '0.00';
  const creatorPortion = (totalNum - (participantCount * Number(shareAmount))).toFixed(2);

  const handleCreate = async () => {
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const splitId = await onCreateSplit(totalAmount, participantCount, description);
      if (splitId) {
        setCreatedSplitId(splitId);
        soundbox.playChime();
      } else {
        setErrorMsg('Split creation failed. Please check your network and account.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create bill split');
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
              background: 'rgba(99, 102, 241, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#818cf8'
            }}>
              <Users size={18} />
            </div>
            <div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 700 }}>
                Collaborative Bill Split
              </h2>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Deterministic Equal Shares & Remainder Dust Absorption
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {createdSplitId ? (
          <div style={{ textAlign: 'center', padding: '20px 10px' }}>
            <div style={{
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              background: 'rgba(0, 229, 153, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px auto',
              color: 'var(--mezo-green)',
              boxShadow: 'var(--shadow-glow)'
            }}>
              <CheckCircle2 size={32} />
            </div>

            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 700, marginBottom: '6px' }}>
              Split Bill Created!
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '16px' }}>
              Each participant pays exactly <strong style={{ color: '#fff' }}>{shareAmount} MUSD</strong> directly to your address.
            </p>

            <div style={{
              background: 'rgba(255, 255, 255, 0.04)',
              borderRadius: 'var(--radius-md)',
              padding: '12px',
              fontSize: '12px',
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-muted)',
              marginBottom: '16px',
              wordBreak: 'break-all'
            }}>
              Split ID: {createdSplitId}
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="btn-primary"
                onClick={() => {
                  navigator.clipboard.writeText(createdSplitId);
                  alert('Split ID copied to clipboard!');
                }}
              >
                <Copy size={16} /> Copy Split Link
              </button>
              <button className="btn-secondary" onClick={onClose}>
                Done
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '10px', marginBottom: '14px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>TOTAL BILL (MUSD)</label>
                <input
                  type="number"
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '10px',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: '16px'
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>FRIENDS (1-50)</label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={participantCount}
                  onChange={(e) => setParticipantCount(Math.max(1, Math.min(50, Number(e.target.value))))}
                  style={{
                    width: '100%',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '10px',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: '16px'
                  }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>DESCRIPTION / MEMO</label>
              <input
                type="text"
                maxLength={140}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
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

            {/* Math Breakdown Box */}
            <div className="glass-card" style={{ marginBottom: '16px', background: 'rgba(255, 255, 255, 0.02)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                <PieChart size={14} /> MATHEMATICAL SPLIT BREAKDOWN
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Total Group:</span>
                <span style={{ fontWeight: 600, color: '#fff' }}>{totalPeople} people (You + {participantCount} friends)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Each Friend Pays:</span>
                <span style={{ fontWeight: 700, color: 'var(--mezo-green)' }}>{shareAmount} MUSD</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-muted)' }}>
                <span>Creator Portion (Dust Absorbed):</span>
                <span>{creatorPortion} MUSD</span>
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
              disabled={isSubmitting || totalNum <= 0}
              onClick={handleCreate}
            >
              {isSubmitting ? (
                <>Creating Split Contract...</>
              ) : (
                <>
                  Create Split ({shareAmount} MUSD / person)
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
