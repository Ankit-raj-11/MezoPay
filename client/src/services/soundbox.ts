import { NativeBridge } from './native';

class SoundboxService {
  private audioCtx: AudioContext | null = null;
  private wakeLock: any = null;

  private initAudio() {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  /**
   * Plays a crisp, digital POS payment success chime using Web Audio oscillators.
   */
  public playChime() {
    try {
      this.initAudio();
      if (!this.audioCtx) return;

      const now = this.audioCtx.currentTime;

      // Note 1: D5 (587.33 Hz)
      const osc1 = this.audioCtx.createOscillator();
      const gain1 = this.audioCtx.createGain();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(587.33, now);
      gain1.gain.setValueAtTime(0.2, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc1.connect(gain1);
      gain1.connect(this.audioCtx.destination);
      osc1.start(now);
      osc1.stop(now + 0.3);

      // Note 2: A5 (880 Hz)
      const osc2 = this.audioCtx.createOscillator();
      const gain2 = this.audioCtx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880, now + 0.1);
      gain2.gain.setValueAtTime(0.25, now + 0.1);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc2.connect(gain2);
      gain2.connect(this.audioCtx.destination);
      osc2.start(now + 0.1);
      osc2.stop(now + 0.45);

      // Note 3: D6 (1174.66 Hz) - bright harmonic accent
      const osc3 = this.audioCtx.createOscillator();
      const gain3 = this.audioCtx.createGain();
      osc3.type = 'sine';
      osc3.frequency.setValueAtTime(1174.66, now + 0.22);
      gain3.gain.setValueAtTime(0.3, now + 0.22);
      gain3.gain.exponentialRampToValueAtTime(0.0001, now + 0.65);
      osc3.connect(gain3);
      gain3.connect(this.audioCtx.destination);
      osc3.start(now + 0.22);
      osc3.stop(now + 0.65);
    } catch (err) {
      console.warn('Web Audio playback failed:', err);
    }
  }

  /**
   * Speaks the payment notification in natural voice (TTS).
   * E.g. "Payment of 15 MUSD received from alice"
   */
  public speakPayment(amount: string, senderName?: string) {
    const text = senderName 
      ? `Payment of ${amount} MUSD received from ${senderName}`
      : `Payment of ${amount} MUSD received on Mezo`;

    // Try native TTS bridge first
    NativeBridge.speak(text).catch(() => {});

    // Also run web TTS if not on native platform or as immediate fallback
    if (!NativeBridge.isNative() && 'speechSynthesis' in window) {
      setTimeout(() => {
        try {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.rate = 1.05;
          utterance.pitch = 1.0;
          utterance.volume = 1.0;
          window.speechSynthesis.speak(utterance);
        } catch (err) {
          console.warn('Speech synthesis error:', err);
        }
      }, 450);
    }
  }

  /**
   * Plays the full POS announcement sequence: chime + TTS.
   */
  public announcePayment(amount: string, senderName?: string) {
    this.playChime();
    this.speakPayment(amount, senderName);
  }

  /**
   * Requests Screen Wake Lock to keep merchant POS screen active without dimming.
   */
  public async enableWakeLock(): Promise<boolean> {
    NativeBridge.setKeepAwake(true).catch(() => {});

    if ('wakeLock' in navigator) {
      try {
        this.wakeLock = await (navigator as any).wakeLock.request('screen');
        this.wakeLock.addEventListener('release', () => {
          this.wakeLock = null;
        });
        return true;
      } catch (err) {
        console.warn('Screen wake lock request failed:', err);
      }
    }
    return true;
  }

  public releaseWakeLock() {
    NativeBridge.setKeepAwake(false).catch(() => {});
    if (this.wakeLock) {
      this.wakeLock.release().catch(() => {});
      this.wakeLock = null;
    }
  }
}

export const soundbox = new SoundboxService();

