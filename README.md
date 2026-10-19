# ⚡ MezoPay
**"Spend your Bitcoin without selling it."**

MezoPay is a high-speed, non-custodial payment engine built natively on **Mezo Network** (Testnet Chain ID `31611`), allowing users to spend Bitcoin-backed stable dollars (**MUSD**) with human-readable handles (`@mezo`), 1-tap merchant payments, physical merchant soundbox announcements, and collaborative bill splitting.

---

## 🏆 Mezo Buildathon
* **Track:** Consumer Payments & Bitcoin Utility
* **Hackathon Waves:** Wave 1 (Oct 16 – 26, 2026) | Wave 2 (Nov 2 – 15, 2026)
* **Submission Portal:** [Akindo Mezo Wave Hack](https://app.akindo.io/wave-hacks/OVOO0gdrVU8379D10/)

---

## 🏛️ System Architecture

MezoPay is designed as a three-tier decentralized architecture:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        MezoPay Client Applications                     │
│  ┌───────────────────────────────┐  ┌────────────────────────────────┐ │
│  │    Web PWA (React 19, Vite)   │  │   Android Native (Capacitor 8) │ │
│  │  • Viem typed contract calls  │  │  • Hardware KeyStore (AES-GCM) │ │
│  │  • 600k PBKDF2 WebCrypto Vault│  │  • BiometricPrompt unlock     │ │
│  │  • Web Audio POS Soundbox     │  │  • FLAG_SECURE Seed Shield     │ │
│  └──────────────┬────────────────┘  └───────────────┬────────────────┘ │
└─────────────────┼───────────────────────────────────┼──────────────────┘
                  │                                   │
                  ▼                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│               Mezo Testnet Layer (Chain ID 31611 / 0x7b7b)             │
│  ┌───────────────────────────────┐  ┌────────────────────────────────┐ │
│  │     MezoPaymentCore.sol       │  │      MezoNameRegistry.sol      │ │
│  │  • 1-tap direct payments      │  │  • Human handles (@alice)      │ │
│  │  • EIP-712 signed payReference│  │  • Normalized lowercase lookup │ │
│  │  • 24h timelocked spend limits│  │  • Reverse address mapping     │ │
│  │  • Dust-absorbing bill splits │  │  • Availability checks         │ │
│  └──────────────┬────────────────┘  └────────────────────────────────┘ │
│                 │                                                      │
│                 ▼                                                      │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │             Native Mezo Protocol Infrastructure                   │ │
│  │  • MUSD ERC-20 Token (0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503)│ │
│  │  • BorrowerOperations (0xCdF7028ceAB81fA0C6971208e83fa7872994beE5)│ │
│  │  • TroveManager & SortedTroves (0xE47c8... & 0x722E4...)          │ │
│  │  • PriceFeed Oracle (0x86bCF0841622a5dAC14A313a15f96A95421b9366) │ │
│  └───────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────┘
```

1. **Smart Contracts (Solidity 0.8.24 on Foundry):**
   * **`MezoPaymentCore.sol`**: Manages merchant payments via `payDirect` and cryptographically signed `payReference`, enforces spending limits with 24-hour timelocks on cap increases, and handles deterministic bill splitting.
   * **`MezoNameRegistry.sol`**: On-chain human-readable handles (`@name`) mapped 1-to-1 to addresses with reverse lookup and normalization.
2. **Client Layer (TypeScript, React 19, Viem):**
   * Direct JSON-RPC interaction over HTTP (`publicClient` and `walletClient`) with zero Wagmi/web3-react dependency bloat.
   * Universal URL payment scheme: `https://mezopay.vercel.app/pay?...` and `https://mezopay.vercel.app/split?...`.
3. **Android Native Layer (Capacitor 8, OpenJDK 21, Android SDK 34):**
   * **Screen Capture Shield:** Uses Android window `FLAG_SECURE` to prevent screenshots and screen-recording while displaying the 12-word seed phrase.
   * **Biometric Unlock:** Android `BiometricPrompt` with hardware-backed encryption.
   * **Keep-Awake & POS Soundbox:** Prevents screen dimming on merchant kiosks and utilizes native `TextToSpeech` with haptic confirmation.

---

## 🛠️ Verified Mezo Testnet Parameters (Chain ID `31611`)

All addresses, deployment blocks, and protocol references are centralized in [`client/src/config/contracts.ts`](file:///d:/Hackathons/mezoPay/client/src/config/contracts.ts):

| Parameter / Contract | Address / Value | Notes |
| :--- | :--- | :--- |
| **Network Name** | Mezo Testnet (Matsnet) | Official Mezo EVM testnet |
| **EVM Chain ID** | `31611` (`0x7b7b`) | Verified via live RPC call |
| **RPC Endpoint** | `https://rpc.test.mezo.org` | Primary testnet RPC |
| **Block Explorer** | `https://explorer.test.mezo.org` | Blockscout explorer |
| **Deployment Block** | `16241763` | Deployment start block for event indexing |
| **Native Gas Token** | Bitcoin (BTC) | 18 decimals |
| **MUSD Token** | `0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503` | Bitcoin-backed stable dollar |
| **MezoPaymentCore** | `0x05496Ed7957dE24E748F3C8a8c6313Cc402D2120` | Deployed block #16241763 |
| **MezoNameRegistry** | `0xF98A8473eF8DA5567cD56B919DfeA48315e15acb` | Deployed block #16241763 |
| **PriceFeed Oracle** | `0x86bCF0841622a5dAC14A313a15f96A95421b9366` | Live BTC/USD oracle price feed |
| **BorrowerOperations** | `0xCdF7028ceAB81fA0C6971208e83fa7872994beE5` | ERC-1967 Proxy to `0xc05bf...` |
| **TroveManager** | `0xE47c80e8c23f6B4A1aE41c34837a0599D5D16bb0` | 110% MCR, 150% CCR, 200 MUSD Gas Comp |
| **SortedTroves** | `0x722E4D24FD6Ff8b0AC679450F3D91294607268fA` | Sorted doubly linked list of Troves |
| **HintHelpers** | `0x4e4cBA3779d56386ED43631b4dCD6d8EacEcBCF6` | Generates insertion hints for openTrove |

---

## 🛡️ Threat Model

MezoPay was designed with defense-in-depth principles across the smart contract, network, and client execution layers:

### 1. Unauthorized Spending & High-Velocity Draining
* **Threat:** A compromised session, malicious DApp, or lost device tries to drain the user's MUSD balance.
* **Mitigation:**
  * **On-Chain Daily Spending Cap:** `MezoPaymentCore` strictly rejects any cumulative daily spend exceeding `dailyCap`.
  * **Per-Transaction Cap:** Routine purchases are capped to a user-configured single transaction ceiling.
  * **24-Hour Timelock on Increases:** Calling `requestDailyCapIncrease` requires 24 hours of on-chain delay before activation. Instant increases are rejected by the contract. Decreases take effect immediately.
  * **1-Click Revoke:** Users can execute `approve(MezoPaymentCore, 0)` at any time to sever pull permissions.

### 2. QR Replay & Merchant Spoofing
* **Threat:** A malicious actor intercepts a merchant QR request and replays it, or modifies the payment amount.
* **Mitigation:**
  * **Off-Chain Cryptographic Signatures:** Dynamic QR codes contain an EIP-712 / `personal_sign` signature over `keccak256(chainid, coreAddress, merchantAddress, amount, expiry, salt)`.
  * **Single-Use Salt Registry:** `MezoPaymentCore` tracks `usedSalts[salt]`. Replaying the same request is rejected with `SaltAlreadyUsed()`.
  * **Strict Expiration:** Requests expire after 30 minutes; verified on-chain via `block.timestamp <= expiry`.

### 3. Gas Estimation Failures & Front-Running
* **Threat:** Transactions fail silently in wallet or burn gas unnecessarily due to missing allowance or unconfigured limits.
* **Mitigation:**
  * Pre-flight simulation executes `publicClient.estimateContractGas` using exact call arguments.
  * Specific diagnostic warnings are displayed directly on the pay sheet:
    * `NO_BTC_FOR_GAS`: Identifies when the payer has insufficient native BTC to cover gas fees.
    * `ALLOWANCE_TOO_LOW`: Prompts user with "Refresh allowance" with exact needed amount.
    * `LIMITS_NOT_SET`: Prompts user to configure safety limits before paying.

---

## 🔐 Client-Side Encrypted Vault Security Model

MezoPay stores non-custodial wallet credentials directly on the client device using an encrypted Web Crypto vault. The vault key is derived from a user-chosen **minimum 6-digit App lock PIN** using **PBKDF2 (SHA-256, 600,000 iterations)** with a CSPRNG salt, and payload encryption is performed via **AES-GCM 256-bit** with a 96-bit initialization vector (IV).

### What the Vault DOES Protect Against (Tested Claims):
1. **Casual Physical Snooping:** Prevents bystanders or friends handed the phone from viewing private keys or signing unauthorized transactions.
2. **Plaintext Storage Leaks:** Private keys and 12-word seed phrases are never stored in plaintext on disk, `localStorage`, or in cookies.
3. **Screen Capture & Recording Theft:** On Android, window `FLAG_SECURE` blocks screenshots, system screen recording, and task switcher thumbnails while displaying the 12-word recovery seed phrase.
4. **Network Credential Exfiltration:** Private keys never leave the client device under any circumstances. All transaction payloads and off-chain intents are signed locally.
5. **Rapid Online Brute-Force:** Enforces a minimum 6-digit PIN space and a 30-second lockout after 5 consecutive incorrect attempts in the UI.
6. **Encrypted Storage at Rest:** On Android, cached credentials are encrypted using hardware-backed `EncryptedSharedPreferences` backed by the Android Keystore.

### What the Vault DOES NOT Protect Against:
1. **Rooted or Compromised Host Devices:** If the device has an active kernel keylogger, memory scraper, or root exploit running while the vault is unlocked in memory, credentials can be intercepted.
2. **Weak PINs Against Offline GPU Exhaustion:** If an attacker extracts the encrypted vault from storage, 6-digit purely numeric PINs have a keyspace of $10^6$ combinations. While 600,000 PBKDF2 iterations makes this computationally costly, it does not offer the entropy of a full passphrase or hardware enclave.
3. **Permanent Data Loss Without Backup:** If the user forgets their App lock PIN and has not written down their 12-word recovery phrase, the vault cannot be decrypted by anyone (no central recovery, no admin backdoors).
4. **Browser Data Clearing:** Clearing site data or resetting browser storage wipes the local ciphertext, requiring wallet restoration from the 12-word mnemonic.
5. **Biometric Unlock Classification:** Biometric authentication uses Android `BiometricPrompt` as an application-level convenience gatekeeper. Decryption of the mnemonic seed vault is anchored to the 600,000-iteration PBKDF2 App Lock PIN.

---

## 📱 Android Native App (Capacitor)

### Release Keystore & Backup Requirements
To build and maintain the production Android APK:
* **Keystore File:** `client/android/app/mezopay-release.keystore`
* **Keystore Properties:** `client/android/keystore.properties` (Contains store and key passwords; gitignored)
* **Template:** `client/android/keystore.properties.example`

> [!IMPORTANT]
> **Files You MUST Back Up Securely:**
> 1. `client/android/app/mezopay-release.keystore`: If this file is lost, future updates to the Android app cannot be signed with the same key.
> 2. `client/android/keystore.properties`: The password credentials for the release keystore.
> 3. Your 12-word BIP-39 recovery seed phrase: The master key for your non-custodial wallet.

### Build Signed Release APK:
```bash
# Set environment variables
$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-21.0.12.101-hotspot"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"

# Compile and sign release APK
cd client/android
.\gradlew.bat assembleRelease
```
The signed APK is generated at:
```
client/android/app/build/outputs/apk/release/app-release.apk
```
Signature verified with `apksigner`:
```
Verifies
Verified using v2 scheme (APK Signature Scheme v2): true
Number of signers: 1
```

---

## 🧪 Tester Instructions

### 1. Running the Web Application Locally
```bash
cd client
npm install
npm run dev
```
Open `http://localhost:5173` in your browser.

### 2. Testing App Lock Setup
1. On first launch, the app prompts you to create a **6-digit App lock PIN**.
2. Confirm the PIN.
3. Write down the 12-word recovery seed phrase displayed (screenshot capture is blocked on Android).
4. Complete the 2-word verification challenge to finish onboarding.

### 3. Claiming Handle & Testing 1-Tap Payments
1. Create a unique handle (e.g. `satoshi@mezo`). The app checks availability against `MezoNameRegistry.sol`.
2. Configure your daily spending limit in **Settings** (e.g. 50 MUSD).
3. Tap **Receive** to view your permanent QR code or generate a custom-amount payment request.
4. Tap **Scan & Pay** to scan a merchant QR code using the camera or paste a payment link.
5. Review the real contract gas estimate and simulated USD equivalent before confirming.

### 4. Testing Android Deep Links
With the signed APK installed on an Android phone or emulator:
```bash
# Test /pay link opening inside MezoPay
adb shell am start -W -a android.intent.action.VIEW -d "https://mezopay.vercel.app/pay?chain=31611&addr=0x0134820Adde870CF0e24b70D73C5E0a5DF589A35&amount=15.00&note=Coffee"

# Test /split link opening inside MezoPay
adb shell am start -W -a android.intent.action.VIEW -d "https://mezopay.vercel.app/split"
```

### 5. Running Verification Scripts
```bash
# Verify testnet parameters and RPC responsiveness
node scripts/verify-testnet.cjs

# Verify gas estimate failure diagnostics
node scripts/test-gas-estimate-diagnostics.cjs

# Run repo, dist, and git history security check
node scripts/repo-check.cjs
```

---

## 📄 License
MIT License.
