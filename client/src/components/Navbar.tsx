import React from 'react';
import { ShieldCheck, ChevronDown, Radio } from 'lucide-react';
import { DEMO_PROFILES } from '../services/web3';

interface NavbarProps {
  currentProfile: typeof DEMO_PROFILES[0];
  onSelectProfile: (profile: typeof DEMO_PROFILES[0]) => void;
  registeredName: string | null;
  onOpenSettings: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentProfile,
  onSelectProfile,
  registeredName,
  onOpenSettings,
}) => {
  const [showDropdown, setShowDropdown] = React.useState(false);

  return (
    <header style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '16px 20px',
      position: 'sticky',
      top: 0,
      zIndex: 50,
      background: 'rgba(7, 9, 14, 0.85)',
      backdropFilter: 'blur(16px)',
      borderBottom: '1px solid var(--border-subtle)'
    }}>
      {/* Brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{
          width: '34px',
          height: '34px',
          borderRadius: '10px',
          background: 'linear-gradient(135deg, #f7931a 0%, #00e599 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 800,
          fontSize: '18px',
          color: '#07090e',
          boxShadow: 'var(--shadow-glow)'
        }}>
          ⚡
        </div>
        <div>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            fontSize: '18px',
            letterSpacing: '-0.02em',
            background: 'linear-gradient(90deg, #ffffff, #00e599)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            MezoPay
          </div>
        </div>
      </div>

      {/* Network & Profile Switcher */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {/* Network Pill */}
        <div className="badge badge-chain" style={{ fontSize: '11px', textTransform: 'none', padding: '5px 9px' }}>
          <Radio size={11} className="soundbox-radar" />
          <span>Mezo 31611</span>
        </div>

        {/* Account Selector Pill */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-full)',
              padding: '5px 10px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              color: 'var(--text-primary)',
              fontSize: '12px',
              fontWeight: 600
            }}
          >
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: currentProfile.role === 'merchant' ? 'var(--btc-orange)' : 'var(--mezo-green)'
            }} />
            <span>
              {registeredName ? `@${registeredName}` : currentProfile.name.split(' ')[0]}
            </span>
            <ChevronDown size={14} color="var(--text-muted)" />
          </button>

          {showDropdown && (
            <div style={{
              position: 'absolute',
              top: '120%',
              right: 0,
              width: '240px',
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-highlight)',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-lg)',
              padding: '6px',
              zIndex: 100
            }}>
              <div style={{ padding: '6px 10px', fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
                SELECT DEMO ACCOUNT
              </div>
              {DEMO_PROFILES.map((p) => (
                <div
                  key={p.id}
                  onClick={() => {
                    onSelectProfile(p);
                    setShowDropdown(false);
                  }}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    background: currentProfile.id === p.id ? 'rgba(0, 229, 153, 0.12)' : 'transparent',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '13px'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, color: currentProfile.id === p.id ? 'var(--mezo-green)' : 'var(--text-primary)' }}>
                      {p.name}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {p.address.slice(0, 6)}...{p.address.slice(-4)}
                    </div>
                  </div>
                  {currentProfile.id === p.id && <ShieldCheck size={16} color="var(--mezo-green)" />}
                </div>
              ))}
              
              <div style={{ borderTop: '1px solid var(--border-subtle)', margin: '6px 0' }} />
              <div
                onClick={() => {
                  setShowDropdown(false);
                  onOpenSettings();
                }}
                style={{
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  fontSize: '12px',
                  color: 'var(--text-secondary)',
                  fontWeight: 600
                }}
              >
                ⚙️ Limits & Revocation Settings
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
