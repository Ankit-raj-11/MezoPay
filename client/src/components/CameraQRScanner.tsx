import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, CameraOff } from 'lucide-react';
import { NativeBridge } from '../services/native';

interface CameraQRScannerProps {
  onScan: (decodedText: string) => void;
  onClose?: () => void;
}

export const CameraQRScanner: React.FC<CameraQRScannerProps> = ({ onScan }) => {
  const [hasCamera, setHasCamera] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    const scannerId = 'mezo-qr-reader';
    const scanner = new Html5Qrcode(scannerId);
    scannerRef.current = scanner;

    const startScanner = async () => {
      try {
        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 15,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
          },
          (decodedText) => {
            // Success callback
            scanner.stop().catch(() => {});
            NativeBridge.haptic('success').catch(() => {});
            onScan(decodedText);
          },
          () => {
            // Scanning in progress, ignore frame errors
          }
        );
      } catch (err: any) {
        console.warn('Camera start error:', err);
        setHasCamera(false);
        setErrorMsg(err.message || 'Unable to access mobile camera. Please ensure camera permissions are granted over HTTPS.');
      }
    };

    startScanner();

    return () => {
      if (scanner.isScanning) {
        scanner.stop().catch(() => {});
      }
    };
  }, [onScan]);

  return (
    <div style={{ position: 'relative', width: '100%', borderRadius: 'var(--radius-lg)', overflow: 'hidden', background: '#000' }}>
      <div id="mezo-qr-reader" style={{ width: '100%', minHeight: '260px' }} />

      {!hasCamera && (
        <div style={{
          padding: '24px 16px',
          textAlign: 'center',
          background: 'rgba(239, 68, 68, 0.1)',
          color: '#fca5a5',
          fontSize: '13px',
          borderRadius: 'var(--radius-md)',
          margin: '10px'
        }}>
          <CameraOff size={32} style={{ margin: '0 auto 8px auto', opacity: 0.8 }} />
          <div style={{ fontWeight: 600, marginBottom: '4px' }}>Camera Access Required</div>
          <p>{errorMsg}</p>
        </div>
      )}

      {hasCamera && (
        <div style={{
          position: 'absolute',
          bottom: '10px',
          left: '0',
          right: '0',
          textAlign: 'center',
          fontSize: '12px',
          color: 'rgba(255, 255, 255, 0.8)',
          background: 'rgba(0,0,0,0.5)',
          padding: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px'
        }}>
          <Camera size={14} color="var(--mezo-green)" />
          <span>Point camera at merchant MezoPay QR</span>
        </div>
      )}
    </div>
  );
};
