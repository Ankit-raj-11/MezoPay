# MezoPay — Manual QA & Verification Checklist
**Target Network:** Mezo Testnet (`31611`)  
**Scope:** Manual, end-to-end verification performed by developer on real devices (Desktop & Mobile).  
**Status:** In Progress (Tick off each item as verified)

---

## A. App and Wallet
- [ ] **App loads:** Open the app on desktop and mobile; refresh and check developer console for zero unhandled errors or bundle crashes.
- [ ] **Google/email login:** Log in via social/email, refresh the browser, and confirm the exact same embedded wallet address is restored.
- [ ] **Correct network:** Verify chain ID `31611` (`0x7b7b`) is displayed in the app header and active in the wallet provider.
- [ ] **BTC gas:** Confirm the wallet holds testnet BTC and that an on-chain transaction can be submitted successfully.
- [ ] **MUSD balance:** Compare the spendable MUSD balance displayed in the app with the token balance on `explorer.test.mezo.org`.

---

## B. QR Generation and Scanning
- [ ] **Static QR:** Generate a shop static QR code and scan it using a second phone camera or in-app scanner.
- [ ] **Dynamic QR:** Enter `15 MUSD`; confirm the QR payload contains the correct merchant address, amount, chain (`31611`), expiry timestamp, salt, and cryptographic merchant signature.
- [ ] **QR opens payment page:** Scan the QR using the phone's native camera; confirm it opens the HTTPS app route directly with all payment details pre-filled.
- [ ] **Payload tampering:** Change the recipient address or amount in a copied QR URL; confirm the transaction is rejected or reverts due to an invalid merchant signature.
- [ ] **Expired QR:** Use an invoice past its expiry timestamp; confirm the app displays a clear expiration error and blocks sending a transaction.
- [ ] **Wrong chain/token:** Manually modify the QR chain ID (e.g. to `1`) or token address; confirm the app detects the mismatch and rejects the payment.

---

## C. Actual Payments
- [ ] **Successful payment:** Pay a small amount (e.g. `1 MUSD`) between two test wallets and verify the confirmed transaction receipt and explorer link.
- [ ] **Merchant balance:** Confirm the merchant's MUSD balance on-chain increases by exactly the payment amount (zero fee leakage).
- [ ] **Duplicate invoice:** Pay an invoice once, then attempt to pay the exact same reference a second time; confirm the contract reverts on `isReferencePaid`.
- [ ] **Allowance:** Set an allowance lower than the payment amount; confirm the app proactively prompts "Refresh Allowance" rather than failing silently.
- [ ] **Revoke:** Tap "Revoke Access", confirm `approve(0)` executes on-chain, and verify `MezoPaymentCore` can no longer pull tokens.
- [ ] **Spending limits:** Attempt payments exceeding the per-transaction cap or the 24-hour daily cap; confirm the contract strictly reverts on-chain.

---

## D. Merchant Soundbox and History
- [ ] **Soundbox audio:** Tap "Start Soundbox 🔊", send a payment from another phone, and verify the 800Hz POS chime rings immediately.
- [ ] **Speech announcement:** Confirm the text-to-speech engine announces the correct amount and payer handle (e.g., *"Received 15 MUSD from satoshi"*).
- [ ] **Duplicate events:** Reconnect the Wi-Fi network or reload the merchant tab; confirm the same transaction does NOT chime or announce a second time (deduplicated by txHash & log index).
- [ ] **Incoming/outgoing history:** Verify both customer and merchant wallets show the transaction in their respective activity feeds with correct timestamp and amount.
- [ ] **Refresh recovery:** Reload the page; confirm cached history from `localStorage` renders instantly and newly confirmed blocks are queried incrementally.

---

## E. Names and Bill Splitting
- [ ] **Handle registration:** Register a valid handle (e.g. `satoshi`) and verify on-chain that `satoshi@mezo` resolves to the wallet address and vice versa.
- [ ] **Invalid handles:** Test uppercase letters, spaces, special symbols, reserved handles (`admin`, `mezo`), and names shorter than 3 characters; confirm contract reverts.
- [ ] **Handle transfer:** Transfer a handle to a secondary wallet and verify that both reverse and forward lookups update on-chain.
- [ ] **Split creation:** Create a 100 MUSD split for 3 friends (4 people total); confirm the app computes deterministic shares of exactly 25 MUSD each.
- [ ] **Split completion:** Have all 3 friends pay their share; verify the creator receives 75 MUSD total and status flips to *"3 of 3 paid (100%)"*.
- [ ] **Split cancellation:** Cancel an active split as creator, then attempt to pay from a friend wallet; confirm payment is rejected.

---

## F. Borrowing and Mobile Environment
- [ ] **Trove metrics:** Compare Debt, Collateral, and ICR displayed in the app with the live values returned directly by `TroveManager` and `PriceFeed`.
- [ ] **Add collateral:** Deposit native BTC into an existing trove and verify on-chain collateral increases and ICR health factor improves.
- [ ] **Partial repayment:** Repay a small amount of MUSD debt and verify total debt decreases and health factor improves.
- [ ] **Mobile camera:** Test camera QR scanning on the deployed HTTPS site (`https://<app>.vercel.app`) across both iOS Safari and Android Chrome.
- [ ] **Network interruption:** Disable Wi-Fi/mobile data during a pending transaction, reconnect, and confirm the UI polls receipts and does not report false success.
- [ ] **Fresh browser:** Open a clean private/incognito session and complete the entire flow: login, scan QR, pay, and view confirmed receipt.

---

**Execution Status:** Ready for manual verification.
