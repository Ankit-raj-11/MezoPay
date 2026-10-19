# MezoPay — Detailed Engineering Implementation Plan
**Pitch:** *"Spend your Bitcoin without selling it."*  
**Ecosystem:** Mezo Network (Testnet: Chain ID `31611`)  
**Currency:** MUSD (Native Dollar) & BTC (Collateral & Gas)  
**Hackathon:** Mezo Buildathon (Wave 1: Oct 16 – 26, 2026 | Wave 2: Nov 2 – 15, 2026)  
**Submission Portal:** [Akindo Mezo Wave Hack](https://app.akindo.io/wave-hacks/OVOO0gdrVU8379D10/)  
**Revision:** `Review 1.6`

---

## 1. System Architecture & Tech Stack

```
                        ┌────────────────────────────────────────────────────────┐
                        │                   MezoPay Web App                      │
                        │        (Vite + React + TypeScript + Viem/Wagmi)        │
                        │   PWA, Web Scanner, Web Audio & Speech API Soundbox    │
                        └──────────┬───────────────────────────────┬─────────────┘
                                   │                               │
                      User TXs     │                               │ Read Troves &
                      (Scoped Auth)│                               │ Deep-link/Borrow
                                   ▼                               ▼
       ┌───────────────────────────────────────────┐    ┌──────────────────────────────────┐
       │           MezoPay Smart Contracts         │    │      Mezo Native Protocol        │
       │           (ABI FROZEN AT END OF DAY 1)    │    │                                  │
       ├───────────────────────────────────────────┤    ├──────────────────────────────────┤
       │ 1. MezoNameRegistry.sol                   │    │ • MUSD Token (ERC-20 + Permit)   │
       │    • "alice" ↔ 0x123... (Display @mezo)   │    │   0x118917a40FAF1CD7a13dB0Ef... │
       │    • Alphanumeric on-chain validation     │    │ • BorrowerOperations & Troves    │
       │    • Pure registry (Frontend badge allow) │    │   (TroveManager, HintHelpers,    │
       │ 2. MezoPaymentCore.sol (Immutable)        │    │    SortedTroves, PriceFeed)      │
       │    • Direct & Merchant-Signed References  │    │ • x402 Payment Spec Compatibility│
       │    • Capped 1st Setup / 24h Hike Timelock │    │ • Native Gas Token (BTC, 18 dec) │
       │    • Instant Dynamic QRs & Open Splits    │    │ • Official Testnet Faucet        │
       │    • PaymentAnnounced Events (Soundbox)   │    └──────────────────────────────────┘
       └───────────────────────────────────────────┘
```

### Technology Matrix & Hard Architectural Requirements
| Layer | Choice | Rationale & Operational Constraints |
| :--- | :--- | :--- |
| **Blockchain** | Mezo Testnet (`31611`) | Native EVM-compatible Bitcoin L2; gas paid in native BTC (18 decimals). |
| **Smart Contracts** | Solidity `^0.8.24` + Foundry | Invariant testing, gas profiling, scriptable deployments. SafeERC20 + ReentrancyGuard + ECDSA. **No admin keys, no upgrade proxies. ABI frozen at Day 1 (20:00).** |
| **Client Framework** | Vite + React + TypeScript | Fast bundle time, mobile-first responsive viewport, installable PWA capability. **Deployed to Vercel on Day 2** (required for HTTPS camera access & auth domain whitelisting). |
| **Primary Auth & Signing** | **Privy** or **Dynamic** (Embedded Wallet) | **Baseline:** Standard visible confirmations work out of the box. **Enhancement:** Privy’s policy engine officially supports contract allowlists and calldata constraints; if Spike 1 confirms this on Mezo Testnet, automated silent signing is restricted strictly to payment selectors (`payDirect`, `payReference`, `paySplitShare`). High-leverage actions (`approve`, limits, borrowing) always require visible confirmations. |
| **Payment Standard Alignment** | **Mezo x402 Compatibility** | Aligns with Mezo's official `x402` payment and settlement facilitator architecture (future roadmap integration for gas-sponsored facilitator settlement), while delivering consumer UX: `@mezo` handles, 24h timelocked caps, soundbox announcements, and bill splitting. |
| **Secondary Auth (External)** | RainbowKit / Mezo Passport | Labeled as "Advanced / External Wallet". Users explicitly confirm each tx via their wallet popup. |
| **Web3 Client** | `viem` & `wagmi` | Lightweight, native BigInt support (`parseUnits`), typed contract events. |
| **History & Indexing** | LocalStorage Event Cache + Parallel Bounded Logs | Device-local client-side cache querying bounded 2,000-block windows from user registration block (or `DEPLOYMENT_BLOCK`). Queries `payer` and `payee` in parallel. |
| **Hardware & Native APIs** | • `@yudiel/react-qr-scanner`<br>• Web Audio API & `SpeechSynthesis`<br>• Screen Wake Lock API (`navigator.wakeLock`) | Camera QR scanning over HTTPS, physical soundbox chime & TTS on merchant device, keeps POS tablet screen active. |

---

## 2. Phase 0: Testnet Checklist & Day 1 Execution Schedule

### Verification Checklist (Phase 0 Live Verification Results)
- [x] **Mezo Testnet Network Parameters:**
  - Network Name: Mezo Testnet (Matsnet)
  - EVM Chain ID: `31611` (`0x7b7b`) — VERIFIED via live RPC (`https://rpc.test.mezo.org`)
  - RPC Endpoint (HTTPS): `https://rpc.test.mezo.org` — VERIFIED (Block time ~2-3s, Gas: 146 wei)
  - Native Gas Currency: BTC (18 decimals) — VERIFIED
  - Block Explorer: `https://explorer.test.mezo.org` — VERIFIED
- [x] **MUSD Token & Permit Verification:**
  - Token Address: `0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503` — VERIFIED (Code size: 6,437 bytes)
  - MUSD Decimals: Exactly `18` — VERIFIED
  - EIP-2612 `permit` support: VERIFIED (`DOMAIN_SEPARATOR: 0x6f9f5c5d441374bdc3939f5da85a145469d7ffbc96bfe0cce59e5de7d8f1474f`)
- [x] **Borrowing Contracts & Protocol Interfaces:**
  - `BorrowerOperations`: `0xCdF7028ceAB81fA0C6971208e83fa7872994beE5` — VERIFIED (Impl: `0xc05bf344...`)
  - `TroveManager`: `0xE47c80e8c23f6B4A1aE41c34837a0599D5D16bb0` — VERIFIED (Impl: `0x9aab5679...`, MCR: 110%, CCR: 150%, Gas Comp: 200 MUSD)
  - `PriceFeed`: `0x86bCF0841622a5dAC14A313a15f96A95421b9366` — VERIFIED (`fetchPrice()` returns live BTC price: $81,309.97 USD)
  - `SortedTroves`: `0x722E4D24FD6Ff8b0AC679450F3D91294607268fA` — VERIFIED
  - `HintHelpers`: `0x4e4cBA3779d56386ED43631b4dCD6d8EacEcBCF6` — VERIFIED
- [ ] **Privy Policy Engine Spike:**
  - Configure Privy policy allowlist for contract address and verify calldata constraint support on Mezo Testnet (`31611`).
- [ ] **Testnet Faucet Drip Capacity:**
  - Confirm official Mezo testnet faucet drip amount (verify if $\ge 0.15$ BTC total can be acquired).

### Day 1 First 6 Hours Execution Sprint (09:00 - 15:00)
*To de-risk dependencies and establish proven on-chain transactions before writing full contracts:*

* **Hour 1 (09:00 - 10:00) — Foundry & RPC Setup:**
  Initialize Foundry repository. Configure `foundry.toml` with Mezo Testnet RPC (`https://rpc.test.mezo.org`) and Chain ID `31611`. Run live RPC block query test script to confirm gas price and block time.
* **Hour 2 (10:00 - 11:00) — MUSD & Protocol Interface Validation:**
  Read MUSD token contract on testnet. Confirm 18 decimals, test a raw `approve` and `transfer` using testnet accounts. Inspect Mezo `BorrowerOperations`, `TroveManager`, and `PriceFeed` interfaces on explorer; record actual method signatures.
* **Hour 3 (11:00 - 12:00) — Wallet Policy Spike:**
  Set up Privy/Dynamic app. Deploy a 10-line `MockPaymentTarget.sol`. Test whether automated signing can be scoped strictly to specific function selectors (`payDirect`). Record outcome:
  - **Outcome A:** Silent & scoped to specific payment selectors.
  - **Outcome B:** Silent but unscoped (limits cap damage at contract layer).
  - **Outcome C:** Standard visible confirmation required (default robust fallback; no relayer complexity).
* **Hour 4 (12:00 - 13:00) — Master Trove Seeding via Web UI:**
  Open initial master trove using **Mezo's Official Web Borrow UI** (`https://mezo.org/feature/borrow`):
  - Deposit: $\ge 0.05$ BTC
  - Borrow: 1,800 MUSD (minted to wallet; 200 MUSD held by protocol as gas deposit; total initial debt $\ge 2,000$ MUSD).
  - Seed test accounts: User A (`300 MUSD`), User B (`200 MUSD`), Merchant `coffee` (`0 MUSD`).
* **Hour 5 (13:00 - 14:00) — Security-Critical Contract Implementation:**
  Write `MezoNameRegistry.sol` and `MezoPaymentCore.sol` with merchant-signed payment intents, capped first-time limits, 24h timelock, and split math.
* **Hour 6 (14:00 - 15:00) — Adversarial Invariant Testing:**
  Run Foundry tests for: tampered merchant/amount, expired intents, replayed signatures, daily rollover, reentrancy, and split rounding dust.
* **Hour 7-11 (15:00 - 20:00) — Contract Polish, Deploy & Freeze ABI:**
  Deploy contracts to Mezo Testnet (`31611`), verify on explorer, generate `deployments.json`, and **FREEZE CONTRACT ABI**.

---

## 3. Phase 1: Smart Contracts Architecture & Hardening

Two contracts deployed with **no owner, no admin keys, no upgradeability proxies**. They depend exclusively on Mezo's native protocol and MUSD token contracts. **The contract ABI is frozen at Day 1 (20:00).**

```
       ┌────────────────────────┐         ┌─────────────────────────┐
       │   MezoNameRegistry     │         │     MezoPaymentCore     │
       ├────────────────────────┤         ├─────────────────────────┤
       │ • nameToAddress        │         │ • SafeERC20 / Reentrancy│
       │ • addressToName        │         │ • Capped 1st Setup      │
       │ • reservedNames        │         │ • Separate Timelocks    │
       │ • alphanumeric check   │         │ • Merchant-Signed Ref   │
       │ • registerName()       │         │ • Open Bill Splits      │
       │ • transferName()       │         │ • View Helpers & Events │
       └────────────────────────┘         └─────────────────────────┘
```

### 1. `MezoNameRegistry.sol`
* **On-Chain Character & Length Validation:**
  - Names must be between 3 and 20 characters.
  - Allowed characters: lowercase `a-z`, digits `0-9`, and underscore `_`.
  - Reverts on invalid characters, spaces, or uppercase letters.
* **Clean Name Storage:** Names stored purely as lowercase alphanumeric strings without `@mezo` suffix. The `@mezo` suffix is appended by the frontend.
* **Log Readability:** Emit name as an **unindexed string** so indexers and UI can read plain text directly:
  ```solidity
  event NameRegistered(address indexed owner, string name);
  event NameTransferred(address indexed from, address indexed to, string name);
  ```
* **Reserved Names:** Immutable map of protected handles: `admin`, `mezo`, `support`, `system`, `faucet`, `treasury`, `mod`.
* **Transfer Rules:** Cannot transfer a name to a recipient address that already holds an active registered name.
* **Pure Zero-Admin Registry:** All display formatting and on-chain handle lookups resolve directly from `MezoNameRegistry.sol`. The contract contains zero hardcoded addresses.

### 2. `MezoPaymentCore.sol`
* **Security & Tokens:** `using SafeERC20 for IERC20;`, inheriting OpenZeppelin `ReentrancyGuard`.
* **Timelocked Safety Limits Module:**
  ```solidity
  struct SafetyLimit {
      uint256 dailyCap;            // Max MUSD allowed per 24 hours
      uint256 perTxCap;            // Max MUSD allowed per single payment
      uint256 spentToday;          // Accumulated spend in current epoch
      uint256 lastResetDay;        // block.timestamp / 1 days
      uint256 pendingDailyCap;     // Proposed new daily cap
      uint256 pendingPerTxCap;     // Proposed new per-tx cap
      uint256 pendingDailyTimelock; // Separate timelock expiry for daily cap
      uint256 pendingPerTxTimelock; // Separate timelock expiry for per-tx cap
      bool isConfigured;           // Payments revert until configured!
  }
  ```
  - **Capped First-Time Setup:**
    - Initial limits take effect **immediately** up to hard protocol ceilings: $\text{perTxCap} \le 50\text{ MUSD}$, $\text{dailyCap} \le 200\text{ MUSD}$.
    - If a user requests initial limits exceeding these ceilings, $\text{activeLimits} = \min(\text{requested}, \text{ceiling})$ immediately, and the excess queues into the 24-hour timelock.
  - **Payments Blocked Until Configured:** Calls to `payDirect`, `payReference`, and `paySplitShare` revert if `!safetyLimits[msg.sender].isConfigured`.
  - **Independent Timelock Timers:** `pendingDailyTimelock` and `pendingPerTxTimelock` are tracked independently. Raising daily cap does not reset the timer of a pending per-tx cap increase.
  - **Immediate Decreases & Timelocked Increases:** Lowering any limit applies immediately and **clears** any pending increase for that field. Increasing any limit queues into a 24-hour timelock.
  - **Cancellation:** The user can call `cancelPendingLimitIncrease()` at any time during the timelock window.
  - **Calendar Rollover Note:** Uses UTC calendar rollover (`block.timestamp / 1 days`). Spending resets at 00:00 UTC.
* **Frontend Read View Functions & Events:**
  - `getEffectiveRemainingDailySpend(address user) external view returns (uint256)`: Computes remaining daily spend considering UTC day rollover so UI never displays stale values.
  - `getPendingLimits(address user) external view returns (uint256, uint256, uint256, uint256)`: Returns pending caps and active countdown timestamps.
  - Events:
    - `LimitsUpdated(address indexed user, uint256 dailyCap, uint256 perTxCap)`
    - `LimitIncreaseQueued(address indexed user, uint256 pendingDailyCap, uint256 pendingPerTxCap, uint256 dailyTimelock, uint256 perTxTimelock)`
    - `LimitIncreaseCancelled(address indexed user)`
* **Cryptographically Authenticated Merchant Payment References (Signed Intents):**
  *Eliminates merchant on-chain transaction delays while guaranteeing full cryptographic authenticity of amount, merchant, and expiry:*
  ```solidity
  mapping(bytes32 => bool) public isReferencePaid;

  function payReference(
      address merchant,
      uint256 amount,
      uint64 expiry,
      bytes32 salt,
      string calldata note,
      bytes calldata merchantSignature
  ) external nonReentrant {
      require(block.timestamp <= expiry, "Reference expired");

      // Verify that the merchant cryptographically authorized this exact payment
      bytes32 ref = keccak256(abi.encodePacked(block.chainid, address(this), merchant, amount, expiry, salt));
      bytes32 ethSignedHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", ref));
      address signer = ECDSA.recover(ethSignedHash, merchantSignature);
      require(signer == merchant, "Invalid merchant signature");

      require(!isReferencePaid[ref], "Reference already paid");
      isReferencePaid[ref] = true;

      _enforceLimits(msg.sender, amount);
      musdToken.safeTransferFrom(msg.sender, merchant, amount);

      emit PaymentAnnounced(msg.sender, merchant, ref, amount, note, block.timestamp);
  }
  ```
  - **Zero Merchant Gas & 0ms Latency:** Merchant client signs the payment hash locally using their wallet and renders the dynamic QR instantly.
  - **Full Tamper Protection:** If an attacker alters the merchant address or amount in the QR payload, `signer != merchant` and the contract reverts!
  - Static shop QRs use `payDirect(to, amount, note)`.
* **Open Bill Splits Module (Strict Input Validation):**
  ```solidity
  struct BillSplit {
      bytes32 splitId;           // keccak256(creator, splitNonce++)
      address creator;
      uint256 totalAmount;       // Total bill including creator's portion
      uint256 collectedAmount;   // Sum collected from participants
      uint256 shareAmount;       // Deterministic amount per participant
      uint16 participantCount;   // Payers EXCLUDING creator (1 to 50)
      uint16 paidCount;
      bool isClosed;
  }
  mapping(address => uint256) public splitNonce;
  mapping(bytes32 => mapping(address => bool)) public splitHasPaid;
  ```
  - **Input Validation:**
    - `participantCount >= 1 && participantCount <= 50`
    - `totalAmount > 0`
    - `shareAmount > 0` (where $\text{shareAmount} = \lfloor \text{totalAmount} / (\text{participantCount} + 1) \rfloor$)
    - Reverts if creator attempts to pay their own split (`msg.sender != creator`).
  - **Deterministic Math & Creator Dust Absorption:**
    - Each friend pays the exact same fixed share: $\text{shareAmount}$.
    - The creator absorbs the rounding dust: $\text{creatorPortion} = \text{totalAmount} - (\text{participantCount} \times \text{shareAmount})$.
    - The UI button is always deterministic: `"Pay My Share (25.00 MUSD)"`.
  - **Immediate Settlement:** Payments route directly to creator. `cancelSplit(splitId)` sets `isClosed = true`.
* **Soundbox & History Event:**
  ```solidity
  event PaymentAnnounced(
      address indexed payer,
      address indexed payee,
      bytes32 indexed ref,
      uint256 amount,
      string note,
      uint256 timestamp
  );
  ```

### 3. Foundry Invariant & Unit Test Suite Checklist (To be ticked as tests pass)
- [ ] **Name Registry Validation:** Reverts on uppercase, symbols, or length $<3$ or $>20$.
- [ ] **Capped First-Time Setup:** Initial setup under ceilings applies immediately; initial setup over ceilings applies capped limits and queues excess.
- [ ] **Payments Blocked When Unconfigured:** `payDirect`, `payReference`, and `paySplitShare` revert if `!isConfigured`.
- [ ] **Independent Timelocks:** Raising daily cap does not reset `pendingPerTxTimelock`.
- [ ] **Decreases Clear Pending:** Lowering daily cap immediately clears `pendingDailyCap`.
- [ ] **View Helpers:** `getEffectiveRemainingDailySpend` returns accurate remaining spend across midnight UTC.
- [ ] **Universal Limit Checks:** Direct, reference, and split share payments all go through identical limit checks.
- [ ] **Allowance Exhaustion:** Custom revert when MUSD allowance is exhausted or insufficient.
- [ ] **Signature Authentication on Invoices:** Reverts if merchant signature is invalid, tampered, expired, or replayed.
- [ ] **Split Validation & Edge Cases:** Reverts if total is tiny (share rounds to 0), participant count out of bounds, or creator pays own split.
- [ ] **Non-Standard ERC-20:** SafeERC20 handles missing boolean return values gracefully.
- [ ] **Self-Payment Prevention:** Reverts if payer equals payee.
- [ ] **String Bounds:** Reverts if note exceeds 140 characters.

---

## 4. Phase 2: App Shell, Onboarding, Allowance, Send to @name & Vercel Deploy

**Target: 60 seconds to ready-to-pay for a user who already holds MUSD (or receives a transfer).**

### Screen Breakdown & UX Flow:
1. **Auth & Embedded Wallet (Privy/Dynamic):**
   - 1-click Google/Email social login.
   - Automatically provisions an embedded EVM account on Mezo Testnet (`31611`).
   - The user's embedded address is `msg.sender`.
   - **Baseline:** Standard visible confirmations work reliably for all transactions.
   - **Enhancement:** If Spike 1 proves scoped automated signing on custom chain, automated signing is restricted strictly to `payDirect`, `payReference`, and `paySplitShare`.
   - High-leverage actions (`MUSD.approve`, claiming handles, limits, depositing collateral) always require visible wallet popups.
2. **Day 2 Vercel Deployment (Crucial Milestone):**
   - Deploy frontend to Vercel on Day 2 afternoon to obtain live HTTPS URL (`https://<app>.vercel.app`).
   - Required immediately for:
     1. Whitelisting domain in Privy/Dynamic dashboard.
     2. Mobile camera access for QR scanning (browsers forbid camera on HTTP).
3. **Handle Claim (`@mezo`):**
   - Live availability check on `MezoNameRegistry`.
   - Free testnet mint for username (e.g. `satoshi` displayed as `satoshi@mezo`).
4. **Send to @name:**
   - Instant search bar resolving usernames on `MezoNameRegistry`.
   - Lookalike warning UI if a handle contains underscores or visually similar characters to common merchants.
   - Direct payment via `payDirect(to, amount, note)` with 1-tap confirmation.
5. **One-Time Spending Setup & Revoke Button:**
   - Default Configuration:
     - Spending Allowance: **500 MUSD** (out of the 1,800 MUSD minimum borrow; adjustable to 1,000 MUSD or custom). Requires a visible 1-time `approve` signature.
     - Daily Limit: `100 MUSD` (under the initial 200 MUSD ceiling; applies immediately).
     - Per-Payment Limit: `25 MUSD` (under the initial 50 MUSD ceiling; applies immediately).
   - **Revoke Access Button:** Added to Settings and Home: executes `MUSD.approve(MezoPaymentCore, 0)` with a visible confirmation, instantly severing contract pull access.
6. **Dashboard (Home Screen):**
   - **MUSD Spendable Balance:** Large hero font.
   - **Remaining Allowance Meter:** Dynamic progress bar showing remaining spendable allowance. Prompts "Refresh Allowance" when $< 20$ MUSD.
   - **BTC Collateral / Gas Balance:** Native BTC with live USD conversion labeled `"Estimated (Testnet)"`.
   - **Trove Health Banner (Active Monitor):** In-app warning banner appearing if ICR $< 150\%$ (Watch/Risky).
   - **Actions Grid:** [Scan & Pay] [Send to @name] [Receive / Merchant] [Top up / Borrow] [Split Bill].
   - **Recent Activity:** Paginated feed of incoming/outgoing `PaymentAnnounced` events.

---

## 5. Phase 3: Scan & Pay Engine (Milestone 1 — Core Deliverable)

### Universal QR Payload Standard
Constructed dynamically using `VITE_APP_URL` (e.g. `https://mezopay.vercel.app`):
```
https://<VITE_APP_URL>/pay?chain=31611&token=0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503&addr=0x70997970C51812dc3A010C7d01b50e0d17dc79C8&amount=12.50&exp=1729000000&salt=0x98f...&sig=0xabc...&note=ChaiPoint
```
- **Universal Link:** Native mobile camera opens browser and loads the app route `/pay`. For mobile reliability, the in-app scanner is used within a single browser context.
- **Validation & Sanitization:**
  - Verify `chain == 31611` and `token == official MUSD`.
  - Sanitize and length-limit `note` text (HTML entity encoded) before rendering in confirmation sheet.
  - Reverse-lookup `addr` on `MezoNameRegistry`. If registered, display label: `"coffee@mezo (Registered Name)"`.
- **Precision:** Parse all amounts using `viem.parseUnits(amountStr, 18)` (BigInt); zero floating point math.

### Scan & Confirmation State Machine
```
[Scan QR / Deep Link]
         │
         ▼
[Validate Chain, Token & Expiry] ──(Invalid)──► [Show Specific Error]
         │
         ▼
[Fetch Live Gas & Check Allowance]
         │
         ├─► If remaining allowance < amount ──► [Show "Refresh Allowance" CTA]
         │
         ▼
[Bottom Confirmation Sheet]
 • Payee: "coffee@mezo" (Registered Name)
 • Amount: 12.50 MUSD
 • Network Fee: 0.0000032 BTC (~$0.21) [Estimated at testnet oracle price]
 • Stale Protection: Gas auto-refreshes every 15s
         │
         ▼ (Tap "Confirm Payment")
[Signing via PaymentCore] ──(Silent or 1-Tap Prompt)──► [Success]
         │
         ▼
[Success Screen: Green Checkmark + POS Ka-Ching Audio + Shareable Explorer Receipt]
```

---

## 6. Phase 4: Mezo Borrowing & Loan Screen (Real Protocol Metrics)

Built on Day 3 afternoon by connecting directly to Mezo's deployed contracts:

### Exact Protocol Contracts & Interfaces:
* **`TroveManager`:**
  - `getTroveDebt(address _borrower) external view returns (uint256)`: Returns the live total debt (includes borrowed principal + 200 MUSD gas compensation + protocol borrow fee).
  - `getTroveColl(address _borrower) external view returns (uint256)`: Returns the live collateral amount in native BTC (18 decimals).
  - `getCurrentICR(address _borrower, uint256 _price) external view returns (uint256)`: Directly returns the Individual Collateralization Ratio using live price.
* **`PriceFeed`:**
  - `fetchPrice() external returns (uint256)`: Returns the active BTC/USD oracle price (18 decimals).
* **`BorrowerOperations` & `HintHelpers`:**
  - `BorrowerOperations.openTrove(uint256 _maxFeePercentage, uint256 _MUSDAmount, address _upperHint, address _lowerHint) external payable`
  - Utilizes `HintHelpers` & `SortedTroves` to compute insertion hints when opening positions.

### Real Thresholds & Live Formulas
* **110%:** Individual Trove Minimum Collateral Ratio (MCR) liquidation threshold.
* **150%:** System Critical Collateralization Ratio (CCR) triggering Mezo Recovery Mode (stricter borrowing requirements system-wide).
* **UI Buffer:** MezoPay uses 150% as a conservative in-app safety warning threshold, without falsely claiming individual troves liquidate at 150%.
* **Exact Liquidation Price Calculation:**
  $$\text{Liquidation Price} = \frac{\text{Total Debt (from TroveManager)} \times 1.10}{\text{Collateral (from TroveManager)}}$$

### Scope Triage (P0 vs P1 vs P2):
1. **P0 (Must Work for Submission):** Read and display live trove metrics (Debt, Collateral, ICR, Liquidation Price) directly from `TroveManager` and `PriceFeed`.
2. **P1 (Core Feature):** In-app partial repayment & "Add Collateral" (native BTC deposit) to rescue troves approaching 150%.
3. **P2 (Graceful Fallback):** For opening fresh troves or full loan closing, link out to **Mezo's Official Borrow UI** (`https://mezo.org/feature/borrow`). A clearly labeled official link-out is significantly more credible to judges than an unproven 1-day integration.

---

## 7. Phase 5: Merchant Mode & Web Soundbox (Hardware in Browser)

Turns any laptop, tablet, or phone into a physical merchant soundbox.

```
       ┌────────────────────────────────────────────────────────┐
       │              Merchant Soundbox Listener                │
       ├────────────────────────────────────────────────────────┤
       │ 1. Viem watchContractEvent (WebSocket WSS)            │
       │ 2. HTTP Polling every 2.5s (Backup against drop)       │
       │ 3. Filter: payee == merchantAddress                    │
       │ 4. Dedup Key: keccak256(txHash + ":" + logIndex)       │
       │ 5. Persist: lastProcessedBlock in localStorage         │
       └───────────────────────────┬────────────────────────────┘
                                   │ On Valid New Payment
                                   ▼
                   ┌──────────────────────────────────┐
                   │    Merchant Screen & Audio       │
                   ├──────────────────────────────────┤
                   │ • Kiosk Screen: flips to         │
                   │   "Paid ✓ (12.50 MUSD)"          │
                   │ • 800Hz POS Chime (Web Audio API)│
                   │ • Reverse-lookup payer handle    │
                   │ • SpeechSynthesis TTS:           │
                   │   "Received 12.50 MUSD from      │
                   │    satoshi" (or 0x70...9c)       │
                   │   (Fallback: Chime + Generic MP3)│
                   └──────────────────────────────────┘
```

### Dynamic Reference Generation & Soundbox Hardening:
- **Instant Dynamic QR:** Merchant types 15 MUSD $\rightarrow$ Client creates `salt`, signs the intent off-chain, and renders QR instantly. No gas, no block delay.
- **Audio Unlock Button:** Big `"Start Soundbox 🔊"` button initializes the browser `AudioContext` to comply with browser autoplay security policies.
- **Screen Wake Lock API:** `navigator.wakeLock.request('screen')`. Automatically re-requests wake lock on `document.addEventListener('visibilitychange')` when the merchant returns to the tab.
- **Background Tab Warning:** Notice banner: *"Please keep this tab in the foreground for real-time audio announcements."*
- **Reverse-Lookup Speech:** Soundbox reverse-resolves payer address on `MezoNameRegistry` to speak *"Received 12.50 MUSD from satoshi"*, falling back to truncated address *"from 0x70...9c"* if unhandled.
- **Voice Fallback:** Pre-rendered chime + on-screen visual confirmation + generic recorded audio snippet *"Payment received"* (no offline amount synthesis).

---

## 8. Phase 6: Collaborative Bill Splitting

### Open Bill Splitting Workflow:
- **Create Split:** Total Bill (e.g. 100 MUSD), number of friends (e.g. 3 friends + creator = 4 people), Description ("Dinner").
- **Share Link:** `https://<VITE_APP_URL>/split?id=0xabc...` with QR code.
- **Participation:**
  - Creator's share (25 MUSD) is part of total but retained (not collected from self).
  - Friends open link and tap "Pay My Share (25.00 MUSD)".
  - Rounding dust automatically absorbed by creator.
  - Live Reactive Status: `"3 of 3 paid (75.00 of 75.00 MUSD collected)"`.
  - Direct settlement to creator's address upon each share payment.

---

## 9. On-Chain History & Event Indexing Specification

Instead of scanning all blocks back to genesis on every load:
1. **Starting Block Determination:**
   $$\text{startBlock} = (\text{user.registrationBlock} > 0) \ ? \ \text{user.registrationBlock} \ : \ \text{DEPLOYMENT\_BLOCK}$$
2. **Parallel Bounded Queries:** Client requests events in parallel chunks of at most `2,000 blocks` from `startBlock` forward:
   - Filter A: `payer == userAddress` (Outgoing payments)
   - Filter B: `payee == userAddress` (Incoming payments)
3. **Local Cache (`localStorage`):**
   - Schema: `MezoPay_History_{userAddress} = { lastBlock: 124500, events: [...] }`
   - Cache key includes transaction hash, block number, and log index for complete deduplication.
   - Note: `localStorage` is device-local (per-browser cache).
4. **Incremental Refresh Flow:**
   - On screen load, instantly render cached events from `localStorage`.
   - Fetch delta blocks: `fromBlock = lastBlock + 1`, `toBlock = 'latest'`.
   - Append newly confirmed `PaymentAnnounced` events to state and persist back to `localStorage`.

---

## 10. Security Threat Model & User-Facing Error Matrix

### Threat Analysis & Mitigations
| Threat Considered | Attack Vector | Mitigation in MezoPay |
| :--- | :--- | :--- |
| **Compromised DApp Session** | Malicious script or unlocked phone attempts to drain MUSD via contract. | **Scoped Function Signer:** Signer policy restricts automated signing strictly to payment selectors (`payDirect`, `payReference`, `paySplitShare`). High-leverage actions (`approve`, borrow, limits) require visible confirmation.<br>**24h Timelock on Increases:** Limits cannot be raised immediately to drain balance.<br>**Capped First Setup:** Initial setup capped at $\le 50$ per-tx / $\le 200$ daily. |
| **Spoofed QR Code** | Attacker creates a QR with their address but a fake shop name. | App strictly ignores display text in QR and performs an on-chain reverse lookup on `MezoNameRegistry`. Flags lookalikes in UI. |
| **Tampered Reference QR** | Payer attempts to pay a different amount or after expiry. | Merchant signs intent off-chain. Contract verifies `ECDSA.recover(...) == merchant` and asserts $\text{block.timestamp} \le \text{expiry}$. Tampering with amount or merchant reverts with invalid signature! |
| **Soundbox Audio Dropping** | Testnet WebSocket drops connection during business hours. | Dual-channel listener: WebSockets supplemented by continuous 2.5s HTTP RPC polling fallback. |

### Quantified Worst-Case Risk & Protection Scope
* **Quantified Worst Case:** If a user's browser session is compromised, an attacker can drain at most **$\min(\text{dailyCap}, \text{remainingAllowance})$** (e.g. $100 MUSD max) in a 24-hour period, until the user hits **"Revoke Access"**.
* **DOES Protect Against:**
  - Accidental overspending at merchants (per-tx cap).
  - High-velocity draining through the app if session key is compromised (daily cap + 24h hike timelock + scoped signer).
  - Replay of merchant invoice references, fake merchants, or tampered amounts.
* **DOES NOT Protect Against:**
  - Direct private key theft from device root storage (if raw root keys are extracted, an attacker can call raw ERC-20 `transfer` directly, bypassing `MezoPaymentCore`).
  - Native Bitcoin market price collapse (users must monitor trove health to avoid liquidation).

### User-Facing Error-Handling Matrix
| Error State | Trigger Condition | Clear User-Facing UI Message & Action |
| :--- | :--- | :--- |
| **Insufficient Gas** | User BTC balance $< \text{Estimated Gas}$. | *"Low Bitcoin balance for network fee. Please get gas from the Mezo faucet."* [Get Testnet BTC] |
| **Insufficient MUSD** | User MUSD balance $< \text{Payment Amount}$. | *"Insufficient MUSD balance. Please borrow or top up your spending line."* [Top Up] |
| **Allowance Too Low** | Remaining allowance $< \text{Payment Amount}$. | *"Spending allowance reached ($X remaining). Please refresh allowance to continue."* [Refresh Allowance] |
| **Unconfigured Account** | User attempts payment before setup. | *"Please complete your one-time spending setup before making payments."* [Complete Setup] |
| **Tx Limit Exceeded** | `amount > perTxCap`. | *"Payment exceeds your per-payment limit ($X MUSD). Adjust limits in Settings (24h timelock applies)."* |
| **Daily Limit Exceeded** | `spentToday + amount > dailyCap`. | *"Daily spending limit reached ($Y / $Z MUSD). Limit resets at 00:00 UTC."* |
| **Limit Increase Pending** | User attempts to spend higher amount during timelock. | *"Your limit increase to $X is queued in timelock and activates in H hours."* |
| **Reference Expired** | `block.timestamp > expiry`. | *"This payment request has expired. Please ask the merchant to generate a new QR."* |
| **Reference Already Paid** | Reference `isReferencePaid == true`. | *"This invoice reference has already been paid."* [View Receipt] |
| **Invalid Merchant Signature** | QR payload tampered or forged. | *"Security Alert: Invalid merchant signature. This QR code has been altered."* |
| **Split Closed** | `split.isClosed == true`. | *"This bill split has been closed or cancelled by the creator."* |
| **Trove Risky Warning** | Active Trove ICR $< 150\%$. | In-App Banner: *"Warning: Trove health at X% (Risky). Add collateral or repay debt to avoid liquidation."* |
| **Camera Access Denied** | User blocks browser camera permission. | *"Camera access blocked. Please enable camera permissions in your browser settings to scan QRs."* |
| **Tx Pending / Stuck** | Transaction takes $> 30$ seconds. | *"Transaction confirming on Mezo... checking block receipts."* [View on Explorer] |
| **User Cancelled** | User dismisses payment modal. | *"Payment cancelled."* |
| **Network Mismatch** | QR `chain != 31611`. | *"Wrong network detected. This QR code is not valid for Mezo Testnet."* |
| **RPC Disconnected** | HTTP/WSS RPC times out. | Banner: *"Network lag detected. Reconnecting to Mezo RPC..."* (auto-switches to backup polling). |

---

## 11. Explicit Out of Scope / Future Roadmap

To prevent scope creep during the buildathon while providing judges with an ambitious future roadmap:

| Feature | Hackathon Build Status | Roadmap Phase (Post-Hackathon) |
| :--- | :--- | :--- |
| **Mezo x402 Facilitator Settlement** | **Out of Scope** (users pay native BTC gas) | Phase 2 Roadmap: Full integration with Mezo's `x402` payment spec for gas-sponsored facilitator settlement. |
| **Cross-Chain Swaps & Bridging** | **Out of Scope** (strictly MUSD & BTC on Mezo) | Phase 2 Roadmap: One-click bridge from Ethereum/Arbitrum straight into MezoPay. |
| **Auto-Renewable Allowances (ERC-5827)** | **Out of Scope** (manual 1-tap refresh) | Phase 3 Roadmap: Native ERC-5827 renewable spending allowances for subscriptions. |
| **Uncollateralized Credit / Microloans**| **Out of Scope** (strictly Mezo CDP troves) | Phase 3 Roadmap: Social trust-graph micro-lending. |
| **Multi-Token Payments** | **Out of Scope** (focus exclusively on MUSD) | Phase 2 Roadmap: Auto-swapping secondary tokens into MUSD at checkout. |

---

## 12. Buildathon Judging Criteria Alignment (Assumed / Anticipated)

| Buildathon Criterion | How MezoPay Meets It | Where It Appears in Code / App | Priority / Fallback Strategy |
| :--- | :--- | :--- | :--- |
| **1. Mezo Alignment & BTC Utility** | Core mechanism: Users lock native BTC into Mezo troves to mint MUSD, spending Bitcoin without selling it. Native BTC gas fees. | Phase 4 Loan screen, Trove collateral gauge, Add Collateral, BTC gas estimation sheet. | **P0 (Must Have):** Direct on-chain reads from `TroveManager` & `PriceFeed`. Official UI link-out fallback. |
| **2. UX & Real-World Usability** | 1-tap payments without signature popups, human-readable handles (`@mezo`), physical audio soundbox for shops. | Phase 2 Onboarding, Phase 3 Scan & Pay, Phase 5 Soundbox. | **P0 (Must Have):** Primary differentiator. Privy scoped silent signing is mandatory. |
| **3. Technical Execution & Security** | Invariant-tested Solidity, SafeERC20, capped 1st setup with 24h hike timelock, zero admin keys, cryptographic bound references. | `MezoPaymentCore.sol`, `MezoNameRegistry.sol`, Foundry test suite. | **P0 (Must Have):** Active contracts on Mezo explorer. ABI frozen Day 1. |
| **4. Merchant & Social Utility** | Physical soundbox chime & TTS; collaborative bill splitting with deterministic dust remainder handling. | Phase 5 Merchant POS kiosk, Phase 6 Bill Split shareable link. | **P1 (High):** Equal splits delivered. |

---

## 13. Strategic Execution Milestones & Rebalanced 5-Day Roadmap

```
================================================================================
MILESTONE 1 (P0 CORE): NameRegistry + PaymentCore + Scan & Pay on Mezo Testnet
MILESTONE 2 (P0 SOUNDBOX): Merchant Mode with Web Audio Chime + TTS Speech
MILESTONE 3 (P1 SOCIAL): Collaborative Open Bill Splitting (Deterministic Dust)
MILESTONE 4 (P1/P2 COLLATERAL): Live Trove Dashboard (TroveManager + PriceFeed)
================================================================================

Day 1: Verification, Spikes & Smart Contracts (ABI FROZEN AT 20:00)
 ├── [09:00 - 10:00] Hour 1: Foundry project + Mezo testnet RPC live check.
 ├── [10:00 - 11:00] Hour 2: MUSD token decimals/permit check + BorrowerOperations, TroveManager, PriceFeed interface read.
 ├── [11:00 - 12:00] Hour 3: MockPaymentTarget spike for Privy/Dynamic scoped function signing.
 ├── [12:00 - 13:00] Hour 4: Open master dev loan via Mezo web UI & seed test accounts (User A, User B, Merchant).
 ├── [13:00 - 17:30] Hour 5-8: Write MezoNameRegistry.sol & MezoPaymentCore.sol (Signed intents, capped limits).
 └── [17:30 - 20:00] Hour 9-11: Foundry adversarial tests, deploy to Mezo Testnet (31611), and FREEZE ABI.

Day 2: App Shell, Onboarding, Allowance, Send to @name & Vercel Deploy
 ├── [09:00 - 14:00] Phase 2: Setup Vite + Tailwind + PWA + Privy embedded auth.
 ├── [14:00 - 16:30] Phase 2: Handle claim (@mezo), Send to @name search bar, Allowance, Limits & Revoke UI.
 └── [16:30 - 20:00] Ops Milestone: Deploy frontend to Vercel (HTTPS live URL for camera access & Privy domain).

Day 3: Core Payment Engine (Milestone 1) & Live Mezo Borrowing (Milestone 4)
 ├── [09:00 - 14:00] Milestone 1: Complete Scan & Pay engine (@yudiel/react-qr-scanner), 1-tap confirmation sheet.
 └── [14:00 - 20:00] Milestone 4: Read live trove metrics from TroveManager & PriceFeed + Trove Health Gauge + Add Collateral + Partial Repay.

Day 4: Merchant Soundbox (Milestone 2) & Bill Splitting (Milestone 3)
 ├── [09:00 - 14:00] Milestone 2: Merchant Mode + Signed Dynamic QR + Dual-Channel Soundbox (Web Audio + SpeechSynthesis).
 └── [14:00 - 19:00] Milestone 3: Collaborative Open Bill Splitting (Deterministic shares + creator dust absorption).
 └── [19:00 - 21:00] Buffer: Audio voice tuning & end-to-end flow polish.

Day 5: Rehearsal, Walkthrough Video & Submission
 ├── [09:00 - 12:00] Multi-device dry run (Phone paying Laptop Soundbox). Prep backup video.
 ├── [12:00 - 15:30] Record 3-minute pitch presentation video + Loom walkthrough.
 └── [15:30 - 18:00] Final GitHub documentation, README threat model, live Vercel deployment.
```

---

## 14. Live Walkthrough Script & Hackathon Pitch (3 Minutes)

### Setup:
* **Device 1 (Laptop on Table):** Merchant POS Mode showing "Coffee Shop" with Soundbox active.
* **Device 2 (Phone in Hand):** Customer with pre-opened Bitcoin-backed spending line.
* **Backup Contingency:** Pre-recorded screen capture video + local mobile hotspot.

### Script Sequence:
1. **The Hook (0:00 - 0:30):**  
   *"Bitcoin is the world's best store of value, but nobody spends it because selling it means giving up your Bitcoin. MezoPay lets you spend your Bitcoin without selling it."*
2. **Onboarding & Safety Limits (0:30 - 0:55):**  
   *"Show rapid signup with social login. We claimed `satoshi@mezo`. We set our spending limits: $100 daily limit, with a 24-hour timelock on limit increases so compromised sessions can't be drained. High-leverage actions like approving tokens require a visible confirmation, but everyday merchant payments execute with zero popups. And you can revoke spending access at any time."*
3. **The Core Moment & Soundbox (0:55 - 1:40):**  
   *"I point my phone at the merchant's instant dynamic QR code. The merchant cryptographically signs the payment request off-chain, ensuring the amount and recipient can never be tampered with. Notice the fee: estimated and paid in native Bitcoin gas. I tap Pay once."*  
   *(Laptop Soundbox immediately rings 800Hz chime and speaks)*:  
   🔊 **"Payment of 5 MUSD received from satoshi!"**  
   *"Zero extra hardware. Any phone or laptop becomes a physical soundbox."*
4. **The Collateral Story & Loan Health (1:40 - 2:20):**  
   *"Where did those dollars come from? On our Loan Screen, the user opened their own spending line backed by native Bitcoin locked in Mezo. We show our real-time collateralization health calculated directly from Mezo's TroveManager and PriceFeed: 220% Safe. If Bitcoin falls near our liquidation price, MezoPay alerts us with an active in-app warning banner. We can add collateral or repay debt in one tap to protect our vault. Repaying the full loan releases 100% of our Bitcoin."*
5. **Bill Splitting (2:20 - 2:40):**  
   *"Going out with friends? Create an open split. Share the link in WhatsApp. Friends tap once to pay their share, dust is automatically handled by the creator, and the progress bar updates in real time."*
6. **Closing (2:40 - 3:00):**  
   *"MezoPay brings Web2-grade UPI and CashApp UX directly to Bitcoin's economic layer on Mezo."*

---

## 15. Manual QA Checklist & Verification
The complete developer QA checklist for manual testing across desktop and mobile devices is maintained in **[QA_CHECKLIST.md](file:///d:/Hackathons/mezoPay/QA_CHECKLIST.md)**. It covers:
* **Section A:** App and Wallet Loading & Sessions
* **Section B:** QR Generation, Tampering & Expiry Protection
* **Section C:** Payments, Balance Leakage, Allowance Pre-checks & Limit Enforcement
* **Section D:** Merchant Soundbox, TTS Announcements & Deduplication
* **Section E:** Handle Registration, Character Bounds & Deterministic Bill Splits
* **Section F:** Live Trove Health Metrics, Add Collateral, Mobile Camera & Network Interruption

---

Review 1.6
