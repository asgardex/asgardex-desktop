# Monero (XMR) in ASGARDEX — receive-only, keystore mode

XMR is an **opt-in, receive-only** chain: you can receive, see incoming payments and the amount received. You cannot
send, swap, or use Ledger / Vultisig. Tracking issue: #1282.

## Opt-in

XMR is a supported chain (`SUPPORTED_CHAINS`) but not part of `DEFAULT_ENABLED_CHAINS` (`OPT_IN_CHAINS = [XMR]` in
`src/shared/utils/chain.ts`). Until the user enables it: **no node or light-wallet server is contacted** and no address
is shown (`services/monero/clientState.ts` creates no client while `enabled$` is false). After enabling, a receive-only
dialog has to be acknowledged (per wallet + network) before the address is shown.

What this does **not** mean: that nothing is derived. The view-only keys are derived locally from the keystore phrase
whenever the wallet is unlocked (`viewKeys$` in `services/monero/common.ts`, no network involved), whether or not XMR
is enabled. The guarantee is "no node access until enabled", not "no derivation".

## Key derivation (exact scheme)

Implemented in `src/renderer/services/monero/derivation.ts` (no `@xchainjs/xchain-monero` `Client` involved):

1. `seed = BIP-39 seed of the keystore phrase` (64 bytes, empty passphrase).
2. `node = SLIP-10 (ed25519)` master key of `seed`, derived along `m/44'/128'/0'` (coin type 128 = Monero, hardened).
3. `spend = sc_reduce32(node.privateKey)` — private spend key (mod the ed25519 group order `l`).
4. `view = sc_reduce32(keccak256(spend))` — private view key, exactly as Monero derives it.
5. `B = spend·G`, `A = view·G` (public spend / view key).
6. `address = base58_monero(prefix ‖ B ‖ A ‖ keccak256(prefix ‖ B ‖ A)[0..4])`; prefix `0x12` (mainnet) / `0x18`
   (stagenet; testnet maps to stagenet).

This is **not** a Monero 25-word seed. Other Monero wallets will not derive this wallet from the BIP-39 phrase. To use
the funds elsewhere, export the keys (Wallet settings → Monero → Export private keys, keystore password required) and
restore from keys (e.g. `monero-wallet-cli --generate-from-spend-key`). Only account / index 0 is supported.
The scheme is pinned by a known-answer test for the BIP-39 test phrase (`derivation.test.ts`).

## Key handling

- The client (`ViewOnlyXmrClient`) never receives the phrase or the private spend key, only `XmrViewKeys` (private view
  key + public spend key + address). `transfer`, `broadcastTx`, `setPhrase` and the wallet-rpc calls throw.
  `walletRpcUrls` and `lwsUrls` of the SDK client are always empty.
- The private spend key only exists inside `derivation.ts` while deriving (and is zeroed), and for the password-gated
  export.
- The phrase is still read in the renderer to derive keys. This is receive-only by construction, not a process boundary.
- **The password gate is UI-only.** The keystore password is asked before the key export and before an LWS is
  confirmed (`WalletPasswordConfirmationModal`), but the check protects the buttons, not the data: code running in the
  renderer while the wallet is unlocked can call `deriveXmrExportKeys` / `createLwsConfirmation` directly. The LWS
  confirmation tag is keyed from the view key (so it cannot be forged from storage alone), not from a password-derived
  key: the renderer does not keep the password after unlocking, so a password-bound tag is not feasible here.
- The exported keys modal closes by itself after 60 seconds. If a key was copied, the clipboard is cleared again after
  30 seconds (unless something else was copied meanwhile; `services/monero/clipboard.ts`).

## Balance: "Received", not "Balance"

Spends are detected with key images, which need the private spend key. With view-only keys they are invisible, so the
amount is **total received** and does not drop when funds are spent elsewhere. The UI says so wherever the XMR balance
appears ("Received (spends not tracked)", `XmrBalanceNote`).

- XMR is **never added to portfolio / wallet totals** (`isExcludedFromTotals`, `filterChainBalancesForTotals`): a
  "received" figure is not a balance and must not be summed into one.
- A light-wallet server's `total_sent` is **not subtracted**. Without the spend key the server cannot tell real spends
  from decoys (ring members), so its number can be far off. If a server reports it, the UI shows it on a separate line
  "Server-reported spends (unverified, may include decoys)". The received amount from an LWS is labelled "as reported
  by your light-wallet server (unverified)".

## Amount verification (local scan)

`scanBlocks` of `@xchainjs/xchain-monero` 0.2.9 decrypts the amount of an output from `rct_signatures.ecdhInfo` but
never checks it against the output commitment `outPk`, so a node could make an output look like any amount. Before an
output is counted, the app re-fetches its transaction and checks `C == mask·G + amount·H` itself
(`commitment.ts`, `verifyOutputs.ts`; `@noble/curves` ed25519, `H` = Monero's second generator, validated against a real
mainnet transaction in `commitment.test.ts`). `mask` and `amount` are derived from the view key and the tx public key
(compact RingCT format, type ≥ 4: Bulletproofs 2 / CLSAG / Bulletproofs+).

- A failing, missing or unreadable commitment, an `ecdhInfo` that does not match, coinbase and pre-RingCT / old-format
  outputs are **not counted** and are **not silently counted as 0**: they are kept as "rejected" (persisted with the
  scan state) and the balance note says how many were not counted.
- If the node withholds a transaction needed for the check, the scan fails; nothing is credited and the scan height
  does not advance.
- What this does **not** prove: that the transaction exists on chain or is valid (ring signatures, double spends), or
  that the node shows every payment. That still relies on the node you use. Use your own node for trust.
- Upstream: see `xchainjs-monero-commitment.md` (the SDK should verify this itself).

## Light-wallet server (LWS), opt-in

- No LWS by default. Balances and history come from a local block scan against a public daemon; the view key stays on
  the device.
- An LWS receives the **private view key**, sees ALL incoming payments and amounts and your IP; registration is
  permanent. A server is only contacted after an in-app confirmation (dialog + keystore password) of exactly that URL.
  The dialog names the server (scheme, host and port; the path is never shown or logged).
  The confirmation is an HMAC over `network | address | url` keyed from the view key (`lwsConfirmation.ts`); changing
  `lwsUrl`, or a URL that arrives via storage, invalidates it and the server is not used until confirmed again.
- **Confirmations are per wallet.** The tag binds network + address, so a confirmation made with wallet A is invalid for
  wallet B: B shows the server as "not confirmed" and does not use it until confirmed in B. Only one confirmation is
  stored (one slot in the connection settings), so confirming in B replaces the one of A.
- Endpoints must be `https://`; `http://` only for loopback (`localhost`, `127.0.0.0/8`, `::1`). No credentials, query or
  fragment. URLs are parsed with `URL` (`localhost.evil.com`, `localhost@evil.com`, `localhost%2eevil.com`, LAN http are
  rejected), and input with a backslash, whitespace or control characters is rejected (`http://127.0.0.1:80\@evil.com`
  parses as loopback in `URL` but not elsewhere). The stored (and confirmed) value is the canonical `new URL(x).href`
  without trailing slash. LWS URLs are never logged (the path can be a secret).
- All requests to the daemon and the LWS use `redirect: 'error'` (the SDK scanner's requests too, through a guard around
  its global `fetch`): a node must not forward the view key or the scan to another host.

## Scan window

The scan state (found outputs, rejected outputs, start and last scanned height) is stored per network + address
(`asgardex-xmr-scan:v2:*`; v1 caches held unverified amounts and are ignored). First use starts at `tip − 720` (or the
restore height set by the user). The start height is persisted only together with the first **successfully scanned and
verified** chunk (a failed first scan stores nothing, and a retry in the same session keeps the same start). After each
successfully read chunk the stored height advances, so a restart continues where it stopped (minus a 10 block reorg
overlap) instead of re-scanning the same window. One scan covers at most 5,000 blocks (about a week); a bigger gap is
never skipped silently: the UI shows how many blocks are missing and how to fix it (more recent restore height in the
Monero wallet settings, or an LWS). Blocks the daemon fails to return are treated as failure.

The node's tip is sanity-checked before it is used: on mainnet it must be within 3% of the height expected from the
clock (2 minute blocks since the 2016-03-22 reference point), and with a stored scan it must not be more than 100 blocks
below the last scanned height or further ahead than the chain can have grown since (2× the elapsed time + 2,000
blocks). A second daemon is **not** consulted; with a single node, the check only limits how far it can move the scan
window.

## SDK dependency

`@xchainjs/xchain-monero` is pinned to exactly `0.2.9`. The app relies on its `scanBlocks` output and on its console
lines (`[XMR scanner] … failed …`) to detect unreadable blocks, because it swallows daemon errors. `sdkContract.test.ts`
locks the pin, the log text and the mainnet / stagenet daemon defaults (mainnet resolves to its own https daemons,
never to the plain-http stagenet default). Re-read `scanner.ts`, `commitment.ts` and the upstream issue before
upgrading.

## Send / swap

XMR has no case in `sendTx$` (`services/chain/transaction/common.ts`), no THOR/MAYA swap list entry, and the send / swap
actions are hidden. `securityInvariants.test.ts` guards: `walletRpcUrls` is only set to an empty map, `sendTx$` has no
XMR case, no phrase/spend key in any outgoing request or persisted value.
