# ⚡ MezoPay
**"Spend your Bitcoin without selling it."**

MezoPay is a Web2-speed payment engine built natively on **Mezo Network** (Testnet Chain ID `31611`), allowing users to spend Bitcoin-backed stable dollars (**MUSD**) with human-readable handles (`@mezo`), 1-tap merchant payments, physical merchant soundbox announcements, and collaborative bill splitting.

---

## 🏆 Mezo Buildathon
* **Track:** Consumer Payments & Bitcoin Utility
* **Hackathon Waves:** Wave 1 (Oct 16 – 26, 2026) | Wave 2 (Nov 2 – 15, 2026)
* **Submission Portal:** [Akindo Mezo Wave Hack](https://app.akindo.io/wave-hacks/OVOO0gdrVU8379D10/)

---

## 🚀 Key Features

1. **Human-Readable Handles:** Register simple usernames (`alice@mezo`) resolved on-chain via `MezoNameRegistry.sol`.
2. **Instant Dynamic QRs (0ms Latency):** Merchants generate cryptographic, off-chain signed payment requests with zero upfront gas.
3. **1-Tap Scan & Pay:** No repetitive wallet popups for routine coffee/grocery purchases; backed by on-chain rate limits.
4. **Timelocked Safety Limits:** Instant initial caps; 24-hour on-chain timelock on limit increases to protect sessions against high-velocity draining.
5. **Physical Merchant Soundbox:** Browser-based POS soundbox using the Web Audio API and SpeechSynthesis TTS (*"Payment of 15 MUSD received from satoshi"*), backed by Screen Wake Lock.
6. **Collaborative Bill Splitting:** Open group splits with deterministic shares and creator dust-remainder absorption.
7. **Bitcoin Collateral Story:** Spend MUSD minted against native BTC collateral locked in Mezo troves, monitoring real-time health ratios (`TroveManager` & `PriceFeed`).
8. **1-Click Revocation:** Instant `approve(0)` to sever contract pull permissions at any time.

---

## 🛠️ Verified Mezo Testnet Parameters (Chain ID `31611`)

| Parameter | Value |
| :--- | :--- |
| **Network Name** | Mezo Testnet (Matsnet) |
| **EVM Chain ID** | `31611` (`0x7b7b`) |
| **RPC Endpoint** | `https://rpc.test.mezo.org` |
| **Block Explorer** | `https://explorer.test.mezo.org` |
| **Native Gas Token** | BTC (18 decimals) |
| **MUSD Token** | `0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503` (EIP-2612 Permit verified) |
| **BorrowerOperations** | `0xCdF7028ceAB81fA0C6971208e83fa7872994beE5` |
| **TroveManager** | `0xE47c80e8c23f6B4A1aE41c34837a0599D5D16bb0` (110% MCR, 150% CCR, 200 MUSD Gas Comp) |
| **PriceFeed Oracle** | `0x86bCF0841622a5dAC14A313a15f96A95421b9366` |
| **SortedTroves** | `0x722E4D24FD6Ff8b0AC679450F3D91294607268fA` |
| **HintHelpers** | `0x4e4cBA3779d56386ED43631b4dCD6d8EacEcBCF6` |

---

## 📂 Project Structure

```
mezoPay/
├── contracts/               # Foundry smart contracts
│   ├── src/                 # Solidity contracts (MezoNameRegistry, MezoPaymentCore)
│   ├── test/                # Invariant & adversarial Foundry tests
│   └── foundry.toml         # Foundry configuration with Mezo RPC
├── scripts/                 # Testnet verification & inspection scripts
│   ├── verify-testnet.cjs   # Live RPC validation for Chain ID, MUSD, and TroveManager
│   └── inspect-proxy.cjs    # ERC-1967 implementation slot inspector
├── IMPLEMENTATION_PLAN.md   # Complete engineering blueprint & threat model (Review 1.6)
└── QA_CHECKLIST.md          # 29-point manual QA testing checklist
```

---

## 🧪 Testing & Verification

Run the live testnet verification script:
```bash
node scripts/verify-testnet.cjs
```

Compile smart contracts:
```bash
cd contracts
forge build
forge test
```

---

## 📄 License
MIT License.
