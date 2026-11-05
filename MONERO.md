# Monero (XMR) in ASGARDEX — receive-only, keystore mode

XMR is an **opt-in, receive-only** chain: you can receive, see incoming payments and the amount received. You cannot
send, swap, or use Ledger / Vultisig. Tracking issue: #1282.

## Opt-in

XMR is a supported chain (`SUPPORTED_CHAINS`) but not part of `DEFAULT_ENABLED_CHAINS` (`OPT_IN_CHAINS = [XMR]` in
`src/shared/utils/chain.ts`). Until the user enables it: no Monero keys are exposed, no address is shown and no node or
light-wallet server is contacted (`services/monero/clientState.ts` creates no client while `enabled$` is false).
After enabling, a receive-only dialog has to be acknowledged (per wallet + network) before the address is shown.

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

## Balance: "Received", not "Balance"

Spends are detected with key images, which need the private spend key. With view-only keys they are invisible, so the
amount is **total received** and does not drop when funds are spent elsewhere. The UI says so wherever the XMR balance
appears ("Received (spends not tracked)", `XmrBalanceNote`). If a confirmed light-wallet server reports `total_sent`,
it is subtracted and the label changes to "Received minus spends reported by your light-wallet server (unverified)":
the app cannot verify the server's spend report without the spend key.

## Light-wallet server (LWS), opt-in

- No LWS by default. Balances and history come from a local block scan against a public daemon; the view key stays on
  the device.
- An LWS receives the **private view key**, sees ALL incoming payments and amounts and your IP; registration is
  permanent. A server is only contacted after an in-app confirmation (dialog + keystore password) of exactly that URL.
  The confirmation is an HMAC over `network | address | url` keyed from the view key (`lwsConfirmation.ts`); changing
  `lwsUrl`, or a URL that arrives via storage, invalidates it and the server is not used until confirmed again.
- Endpoints must be `https://`; `http://` only for loopback (`localhost`, `127.0.0.0/8`, `::1`). No credentials, query or
  fragment. URLs are parsed with `URL` (`localhost.evil.com`, `localhost@evil.com`, `localhost%2eevil.com`, LAN http are
  rejected). LWS URLs are never logged (the path can be a secret).

## Scan window

The scan state (found outputs, start and last scanned height) is stored per network + address
(`asgardex-xmr-scan:v1:*`). First use starts at `tip − 720` (or the restore height set by the user); after each
successfully read chunk the stored height advances, so a restart continues where it stopped (minus a 10 block reorg
overlap) instead of re-scanning the same window. One scan covers at most 5,000 blocks (about a week); a bigger gap is
never skipped silently: the UI shows how many blocks are missing and how to fix it (more recent restore height in the
Monero wallet settings, or an LWS). Blocks the daemon fails to return are treated as failure.

## Send / swap

XMR has no case in `sendTx$` (`services/chain/transaction/common.ts`), no THOR/MAYA swap list entry, and the send / swap
actions are hidden. `securityInvariants.test.ts` guards: `walletRpcUrls` is only set to an empty map, `sendTx$` has no
XMR case, no phrase/spend key in any outgoing request or persisted value.
