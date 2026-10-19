package org.mezo.pay;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.speech.tts.TextToSpeech;
import android.view.WindowManager;

import androidx.annotation.NonNull;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import androidx.security.crypto.EncryptedSharedPreferences;
import androidx.security.crypto.MasterKeys;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.Locale;
import java.util.concurrent.Executor;

@CapacitorPlugin(name = "MezoPayNative")
public class MezoPayNativePlugin extends Plugin {

    private TextToSpeech textToSpeech;
    private SharedPreferences securePrefs;

    @Override
    public void load() {
        super.load();

        // 1. Initialize Text-to-Speech
        try {
            textToSpeech = new TextToSpeech(getContext(), status -> {
                if (status == TextToSpeech.SUCCESS) {
                    textToSpeech.setLanguage(Locale.US);
                }
            });
        } catch (Exception e) {
            e.printStackTrace();
        }

        // 2. Initialize Hardware-backed EncryptedSharedPreferences
        try {
            String masterKeyAlias = MasterKeys.getOrCreate(MasterKeys.AES256_GCM_SPEC);
            securePrefs = EncryptedSharedPreferences.create(
                    "mezopay_secure_vault",
                    masterKeyAlias,
                    getContext(),
                    EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                    EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
            );
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    /**
     * Prevents screen capture, screenshots, and screen recording.
     * Crucial for protecting 12-word recovery seed phrase display.
     */
    @PluginMethod
    public void setScreenCaptureBlocked(PluginCall call) {
        boolean blocked = call.getBoolean("blocked", true);
        getActivity().runOnUiThread(() -> {
            if (blocked) {
                getActivity().getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
            } else {
                getActivity().getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
            }
            JSObject ret = new JSObject();
            ret.put("blocked", blocked);
            call.resolve(ret);
        });
    }

    /**
     * Biometric Unlock using Android BiometricPrompt (Fingerprint / Face ID).
     */
    @PluginMethod
    public void authenticateBiometric(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            BiometricManager biometricManager = BiometricManager.from(getContext());
            int canAuthenticate = biometricManager.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG | BiometricManager.Authenticators.BIOMETRIC_WEAK);

            if (canAuthenticate != BiometricManager.BIOMETRIC_SUCCESS) {
                call.reject("Biometrics not available or not enrolled on this device.");
                return;
            }

            Executor executor = ContextCompat.getMainExecutor(getContext());
            BiometricPrompt biometricPrompt = new BiometricPrompt(getActivity(), executor, new BiometricPrompt.AuthenticationCallback() {
                @Override
                public void onAuthenticationError(int errorCode, @NonNull CharSequence errString) {
                    super.onAuthenticationError(errorCode, errString);
                    call.reject("Biometric error: " + errString);
                }

                @Override
                public void onAuthenticationSucceeded(@NonNull BiometricPrompt.AuthenticationResult result) {
                    super.onAuthenticationSucceeded(result);
                    JSObject ret = new JSObject();
                    ret.put("authenticated", true);
                    call.resolve(ret);
                }

                @Override
                public void onAuthenticationFailed() {
                    super.onAuthenticationFailed();
                    // Biometric recognition rejected one attempt
                }
            });

            String title = call.getString("title", "Unlock MezoPay");
            String subtitle = call.getString("subtitle", "Authenticate to unlock your non-custodial wallet");

            BiometricPrompt.PromptInfo promptInfo = new BiometricPrompt.PromptInfo.Builder()
                    .setTitle(title)
                    .setSubtitle(subtitle)
                    .setNegativeButtonText("Use App Lock PIN")
                    .build();

            biometricPrompt.authenticate(promptInfo);
        });
    }

    /**
     * Hardware-backed Secure Key Storage (Set)
     */
    @PluginMethod
    public void secureSet(PluginCall call) {
        String key = call.getString("key");
        String value = call.getString("value");

        if (key == null || value == null) {
            call.reject("Key and value must not be null");
            return;
        }

        if (securePrefs == null) {
            call.reject("Secure storage initialization failed");
            return;
        }

        securePrefs.edit().putString(key, value).apply();
        JSObject ret = new JSObject();
        ret.put("success", true);
        call.resolve(ret);
    }

    /**
     * Hardware-backed Secure Key Storage (Get)
     */
    @PluginMethod
    public void secureGet(PluginCall call) {
        String key = call.getString("key");
        if (key == null) {
            call.reject("Key must not be null");
            return;
        }

        if (securePrefs == null) {
            call.reject("Secure storage initialization failed");
            return;
        }

        String value = securePrefs.getString(key, null);
        JSObject ret = new JSObject();
        ret.put("value", value);
        call.resolve(ret);
    }

    /**
     * Keeps screen awake on Merchant POS kiosk / soundbox display.
     */
    @PluginMethod
    public void setKeepAwake(PluginCall call) {
        boolean enabled = call.getBoolean("enabled", true);
        getActivity().runOnUiThread(() -> {
            if (enabled) {
                getActivity().getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            } else {
                getActivity().getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            }
            JSObject ret = new JSObject();
            ret.put("keepAwake", enabled);
            call.resolve(ret);
        });
    }

    /**
     * Native Text-to-Speech for Soundbox payment announcements.
     */
    @PluginMethod
    public void speak(PluginCall call) {
        String text = call.getString("text", "Payment received on MezoPay");
        if (textToSpeech != null) {
            textToSpeech.speak(text, TextToSpeech.QUEUE_FLUSH, null, "mezopay_tts");
            JSObject ret = new JSObject();
            ret.put("spoken", true);
            call.resolve(ret);
        } else {
            call.reject("Text to speech not initialized");
        }
    }

    /**
     * Native Haptics feedback.
     */
    @PluginMethod
    public void hapticFeedback(PluginCall call) {
        String type = call.getString("type", "medium");
        Vibrator vibrator = (Vibrator) getContext().getSystemService(Context.VIBRATOR_SERVICE);
        if (vibrator != null && vibrator.hasVibrator()) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                int effect = VibrationEffect.DEFAULT_AMPLITUDE;
                long duration = 30;
                if ("heavy".equals(type) || "success".equals(type)) {
                    duration = 60;
                } else if ("light".equals(type)) {
                    duration = 15;
                }
                vibrator.vibrate(VibrationEffect.createOneShot(duration, effect));
            } else {
                vibrator.vibrate(30);
            }
        }
        JSObject ret = new JSObject();
        ret.put("vibrated", true);
        call.resolve(ret);
    }

    @Override
    protected void handleOnDestroy() {
        if (textToSpeech != null) {
            textToSpeech.stop();
            textToSpeech.shutdown();
        }
        super.handleOnDestroy();
    }
}
