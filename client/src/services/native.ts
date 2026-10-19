import { registerPlugin, Capacitor } from '@capacitor/core';

export interface MezoPayNativePluginType {
  setScreenCaptureBlocked(options: { blocked: boolean }): Promise<{ blocked: boolean }>;
  authenticateBiometric(options?: { title?: string; subtitle?: string }): Promise<{ authenticated: boolean }>;
  secureSet(options: { key: string; value: string }): Promise<{ success: boolean }>;
  secureGet(options: { key: string }): Promise<{ value: string | null }>;
  setKeepAwake(options: { enabled: boolean }): Promise<{ keepAwake: boolean }>;
  speak(options: { text: string }): Promise<{ spoken: boolean }>;
  hapticFeedback(options?: { type?: 'light' | 'medium' | 'heavy' | 'success' }): Promise<{ vibrated: boolean }>;
}

export const MezoPayNative = registerPlugin<MezoPayNativePluginType>('MezoPayNative');

export const NativeBridge = {
  isNative: () => Capacitor.isNativePlatform(),

  setScreenCaptureBlocked: async (blocked: boolean): Promise<boolean> => {
    if (!Capacitor.isNativePlatform()) return false;
    try {
      const res = await MezoPayNative.setScreenCaptureBlocked({ blocked });
      return res.blocked;
    } catch (e) {
      console.warn('Native setScreenCaptureBlocked failed:', e);
      return false;
    }
  },

  authenticateBiometric: async (title = 'Unlock MezoPay', subtitle = 'Verify your identity'): Promise<boolean> => {
    if (!Capacitor.isNativePlatform()) return false;
    try {
      const res = await MezoPayNative.authenticateBiometric({ title, subtitle });
      return !!res.authenticated;
    } catch (e) {
      console.warn('Native biometric failed:', e);
      return false;
    }
  },

  secureSet: async (key: string, value: string): Promise<boolean> => {
    if (!Capacitor.isNativePlatform()) {
      localStorage.setItem(`sec_${key}`, value);
      return true;
    }
    try {
      const res = await MezoPayNative.secureSet({ key, value });
      return !!res.success;
    } catch (e) {
      console.warn('Native secureSet failed, fallback to localStorage:', e);
      localStorage.setItem(`sec_${key}`, value);
      return false;
    }
  },

  secureGet: async (key: string): Promise<string | null> => {
    if (!Capacitor.isNativePlatform()) {
      return localStorage.getItem(`sec_${key}`);
    }
    try {
      const res = await MezoPayNative.secureGet({ key });
      return res.value ?? null;
    } catch (e) {
      console.warn('Native secureGet failed, fallback to localStorage:', e);
      return localStorage.getItem(`sec_${key}`);
    }
  },

  setKeepAwake: async (enabled: boolean): Promise<boolean> => {
    if (!Capacitor.isNativePlatform()) return false;
    try {
      const res = await MezoPayNative.setKeepAwake({ enabled });
      return !!res.keepAwake;
    } catch (e) {
      console.warn('Native setKeepAwake failed:', e);
      return false;
    }
  },

  speak: async (text: string): Promise<boolean> => {
    if (Capacitor.isNativePlatform()) {
      try {
        const res = await MezoPayNative.speak({ text });
        return !!res.spoken;
      } catch (e) {
        console.warn('Native speak failed, falling back to Web Speech API:', e);
      }
    }
    // Web Speech API fallback
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
      return true;
    }
    return false;
  },

  haptic: async (type: 'light' | 'medium' | 'heavy' | 'success' = 'medium'): Promise<boolean> => {
    if (Capacitor.isNativePlatform()) {
      try {
        const res = await MezoPayNative.hapticFeedback({ type });
        return !!res.vibrated;
      } catch (e) {
        console.warn('Native haptic failed:', e);
      }
    }
    // Web vibration fallback
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      const duration = type === 'heavy' || type === 'success' ? 60 : 30;
      navigator.vibrate(duration);
      return true;
    }
    return false;
  }
};
