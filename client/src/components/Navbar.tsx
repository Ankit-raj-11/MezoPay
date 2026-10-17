import React, { useState } from 'react';
import { Radio, QrCode, Lock, Settings, Copy, Check } from 'lucide-react';

interface NavbarProps {
  currentProfile: any;
  registeredName: string | null;
  onOpenSettings: () => void;
  onOpenMyQR: () => void;
  onLockApp: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentProfile,
  registeredName,
  onOpenSettings,
  onOpenMyQR,
  onLockApp,
}) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [copied, setCopied] = useState(false);

  const cleanHandle = registeredName
    ? registeredName.replace('@mezo', '').replace('@', '').toLowerCase().trim()
    : '';

  const address = currentProfile?.address || '';
  const displayHandle = cleanHandle
    ? `@${cleanHandle}`
    : address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : 'Not Connected';

  const handleCopyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

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
                background: 'var(--mezo-green)',
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
          </button>

          {showDropdown && (
            <div
              style={{
                position: 'absolute',
                top: '125%',
                right: 0,
                width: '240px',
                background: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-highlight)',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-lg)',
                padding: '10px',
                zIndex: 100,
              }}
            >
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '6px' }}>
                CONNECTED ACCOUNT
              </div>

              <div
                style={{
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'rgba(255, 255, 255, 0.04)',
                  fontSize: '12px',
                  marginBottom: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                <span>{address ? `${address.slice(0, 8)}...${address.slice(-6)}` : 'None'}</span>
                {address && (
                  <button
                    onClick={handleCopyAddress}
                    style={{ background: 'transparent', border: 'none', color: 'var(--mezo-green)', cursor: 'pointer' }}
                  >
                    {copied ? <Check size={13} /> : <Copy size={13} />}
                  </button>
                )}
              </div>

              <div
                onClick={() => {
                  setShowDropdown(false);
                  onOpenSettings();
                }}
                style={{
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  fontSize: '13px',
                  color: 'var(--text-secondary)',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
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
                  fontSize: '13px',
                  color: 'var(--color-danger)',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
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
