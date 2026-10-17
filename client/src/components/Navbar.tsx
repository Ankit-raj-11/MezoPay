import React, { useState } from 'react';
import { ShieldCheck, ChevronDown, Radio, QrCode, Lock, Settings } from 'lucide-react';
import { DEMO_PROFILES } from '../services/web3';

interface NavbarProps {
  currentProfile: any;
  onSelectProfile: (profile: any) => void;
  registeredName: string | null;
  onOpenSettings: () => void;
  onOpenMyQR: () => void;
  onLockApp: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentProfile,
  onSelectProfile,
  registeredName,
  onOpenSettings,
  onOpenMyQR,
  onLockApp,
}) => {
  const [showDropdown, setShowDropdown] = useState(false);

  const cleanHandle = registeredName
    ? registeredName.replace('@mezo', '').replace('@', '').toLowerCase().trim()
    : (currentProfile.handle || '').replace('@mezo', '').replace('@', '').toLowerCase().trim();

  const displayHandle = cleanHandle ? `${cleanHandle}@mezo` : `${currentProfile.address.slice(0, 6)}...${currentProfile.address.slice(-4)}`;

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 18px',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: 'rgba(7, 9, 14, 0.9)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--border-subtle)',
      }}
    >
      {/* Brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #f7931a 0%, #00e599 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            fontSize: '17px',
            color: '#07090e',
            boxShadow: 'var(--shadow-glow)',
          }}
        >
          ⚡
        </div>
        <div>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: '17px',
              letterSpacing: '-0.02em',
              background: 'linear-gradient(90deg, #ffffff, #00e599)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            MezoPay
          </div>
        </div>
      </div>

      {/* Action shortcuts & Profile */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {/* Network Pill */}
        <div
          className="badge badge-chain"
          style={{ fontSize: '11px', textTransform: 'none', padding: '4px 8px' }}
        >
          <Radio size={10} className="soundbox-radar" />
          <span>Mezo 31611</span>
        </div>

        {/* My QR Shortcut Button (GPay Style) */}
        <button
          onClick={onOpenMyQR}
          title="Receive Money / My QR"
          style={{
            background: 'rgba(0, 229, 153, 0.12)',
            border: '1px solid rgba(0, 229, 153, 0.3)',
            borderRadius: 'var(--radius-full)',
            padding: '5px 9px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            color: 'var(--mezo-green)',
            fontSize: '12px',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <QrCode size={13} />
          <span>My QR</span>
        </button>

        {/* Profile Pill with Dropdown */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-full)',
              padding: '4px 8px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              color: 'var(--text-primary)',
              fontSize: '12px',
              fontWeight: 600,
            }}
          >
            <div
              style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                background: currentProfile.role === 'merchant' ? 'var(--btc-orange)' : 'var(--mezo-green)',
                color: '#07090e',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '10px',
                fontWeight: 800,
              }}
            >
              {cleanHandle ? cleanHandle.charAt(0).toUpperCase() : 'M'}
            </div>
            <span style={{ maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {displayHandle}
            </span>
            <ChevronDown size={12} color="var(--text-muted)" />
          </button>

          {showDropdown && (
            <div
              style={{
                position: 'absolute',
                top: '125%',
                right: 0,
                width: '250px',
                background: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-highlight)',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-lg)',
                padding: '6px',
                zIndex: 100,
              }}
            >
              <div style={{ padding: '6px 10px', fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
                SWITCH DEMO WALLET
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
                    fontSize: '13px',
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontWeight: 600,
                        color: currentProfile.id === p.id ? 'var(--mezo-green)' : 'var(--text-primary)',
                      }}
                    >
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
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Settings size={14} />
                <span>Limits & Safety Settings</span>
              </div>

              <div
                onClick={() => {
                  setShowDropdown(false);
                  onLockApp();
                }}
                style={{
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  fontSize: '12px',
                  color: 'var(--color-danger)',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Lock size={14} />
                <span>Lock MezoPay</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
