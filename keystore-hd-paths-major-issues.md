# Keystore HD paths — major issues

**PR:** [#1152](https://github.com/asgardex/asgardex-desktop/pull/1152) (`feat/keystore-hd-paths`)  
**Follow-up issue:** [#1153](https://github.com/asgardex/asgardex-desktop/issues/1153)  
**Reviewed HEAD:** `a25e16bdd` (after multi-chain expansion + pre-merge fixes)  
**Last updated:** 2026-08-06

This document lists **major** correctness, scope, and testing issues for keystore HD recovery (“Find my funds”). Hygiene / product polish tracked only in #1153 is summarized briefly at the end.

---

## Feature scope (intentional)

```
Settings → Find my funds (profile scan | custom path | index range)
        → setKeystoreChainHDSettings (per keystore id)
        → clients rebuild via getKeystoreDerivation
        → address / balance / most sends use that selection
```

| In scope (keystore only)                               | Out of scope                         |
| ------------------------------------------------------ | ------------------------------------ |
| EVM: ETH, BSC, AVAX, ARB, BASE                         | Vultisig                             |
| THOR, MAYA                                             | Ledger (own HD UI)                   |
| UTXO: BTC (`bc1q` / `bc1p`), LTC, BCH, DOGE, DASH, ZEC | BTC legacy `1…` / nested SegWit `3…` |
| Native-asset balance scan only                         | Token balance scan                   |
| Default index range 0–4 (user can widen)               | SOL, ADA, XRP, TRON, etc.            |

**Import / unlock** are intentionally unchanged. Untouched keystores stay on historical **index 0** defaults.

---

## Open major issues

### M1 — BTC (and other UTXO) keystore Send Max ignores `walletIndex`

|              |                                                                                                                           |
| ------------ | ------------------------------------------------------------------------------------------------------------------------- |
| **Severity** | Bug — fund-loss / wrong-UTXO class                                                                                        |
| **Status**   | **Fixed** — `walletIndex: params.walletIndex` on all UTXO keystore `transferMax` helpers (BTC, BCH, LTC, DOGE, DASH, ZEC) |
| **Where**    | `src/renderer/services/{bitcoin,bitcoincash,litecoin,doge,dash,zcash}/transaction.ts` — `sendKeystoreMaxTx`               |
| **Also**     | Cardano already passed index; left as reference                                                                           |

**Why it matters**

xchain composes:

```text
fullPath = rootDerivationPaths[network] + String(walletIndex)
```

Asgardex correctly puts the **prefix** in `rootDerivationPaths` and the trailing **index** in `walletIndex`. Address/balance streams pass the locked index. **Send Max does not** → xchain defaults to `0`.

**User impact**

| Situation                             | Impact                                                                             |
| ------------------------------------- | ---------------------------------------------------------------------------------- |
| Default index **0**                   | None (defaults match)                                                              |
| Locked index **N ≠ 0**, then Send Max | May sweep **index 0** UTXOs (or fail if UTXOs are from N) while UI shows address N |

**Fix direction**

Pass `walletIndex: params.walletIndex` into `transferMax` (Cardano already does this). Apply on all UTXO keystore max helpers.

**Test gate**

Do **not** exercise Send Max with real funds after locking a non-zero index until fixed.

---

### M2 — EVM pool / swap deposit ignores `walletIndex`

|              |                                                                                                     |
| ------------ | --------------------------------------------------------------------------------------------------- |
| **Severity** | Bug — wrong-from address on router deposits                                                         |
| **Status**   | **Fixed** — both `client.transfer` sites in `runSendPoolTx$` pass `walletIndex: params.walletIndex` |
| **Where**    | `src/renderer/services/evm/factory/transaction.ts` — `runSendPoolTx$`                               |
| **xchain**   | `@xchainjs/xchain-evm` defaults missing `walletIndex` to **0**                                      |

**Why it matters**

- Ordinary ETH/EVM **send** and **approve** pass `walletIndex` → OK.
- **Swap / LP / inbound router deposit** uses `runSendPoolTx$` → signs **index 0** while Receive/balances show the locked index.

**User impact**

| Situation                                     | Impact                                                         |
| --------------------------------------------- | -------------------------------------------------------------- |
| EVM index **0**                               | None                                                           |
| Locked EVM index **N ≠ 0**, then swap/deposit | Tx signed from **index 0** (empty account or unexpected funds) |

**Fix direction**

Include `walletIndex: params.walletIndex` on both `client.transfer` call sites inside `runSendPoolTx$`.

**Test gate**

Do **not** run real-size EVM swaps from a non-zero locked index until fixed. Plain send is the safe path for index wiring checks.

---

### M3 — BTC does not support legacy (`1…`) or nested SegWit (`3…`)

|              |                                                                                         |
| ------------ | --------------------------------------------------------------------------------------- |
| **Severity** | Product / scope gap (not a regression)                                                  |
| **Status**   | **By design** for this PR; tracked as future work (#1153 B3)                            |
| **Where**    | `UtxoHDMode = 'p2wpkh' \| 'p2tr'`; xchain-bitcoin `AddressFormat` = P2WPKH \| P2TR only |

**Address map**

| Prefix  | Script                        | Path family        | Supported? |
| ------- | ----------------------------- | ------------------ | ---------- |
| `1…`    | P2PKH legacy                  | BIP44 `m/44'/0'/…` | **No**     |
| `3…`    | P2SH (often nested SegWit)    | BIP49 `m/49'/0'/…` | **No**     |
| `bc1q…` | P2WPKH native SegWit (Bech32) | BIP84 `m/84'/0'/…` | **Yes**    |
| `bc1p…` | P2TR Taproot (Bech32m)        | BIP86 `m/86'/0'/…` | **Yes**    |

**Important nuance**

Entering a BIP44/BIP49 **path** as “custom” still derives a key and then **encodes as `bc1q`/`bc1p`**. That can “work” but is **wrong** for recovering funds that live on `1…`/`3…` (same key material, different script → different address).

**BIP16 vs BIP49**

- **BIP16** = P2SH soft fork (on-chain script hash → `3…` addresses).
- **BIP49** = HD path convention for nested SegWit (`m/49'/…`).
- There is no “BIP16 derivation path.”

**Fix direction (future)**

New address formats / clients (or providers) for P2PKH and P2SH-P2WPKH; scan profiles for BIP44/BIP49 — requires xchain and app work, not a one-line path fix.

---

### M4 — Vultisig wallets unsupported

|              |                                                                      |
| ------------ | -------------------------------------------------------------------- |
| **Severity** | Product / scope gap (intentional)                                    |
| **Status**   | **By design** for this PR                                            |
| **Where**    | `WalletSettings`: panel only when `!isVultisig && type === Keystore` |

Vult addresses come from the vault SDK; there is no keystore phrase for local HD scan; HD settings are keyed by **keystore id**, not vault id.

**Expectation:** no Find my funds / HD chips on Vult mode.

---

## Fixed since earlier review (do not re-open as blockers)

### F1 — BTC custom path applied to both SegWit and Taproot clients

|                  |                                                                                                                            |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **Was**          | Custom path forced onto P2WPKH **and** P2TR clients → Taproot throw on non-`86'` paths; wrong encoding on the other format |
| **Fixed in**     | `2782fd9a4` (`pathsForFormat` in `bitcoin/common.ts`)                                                                      |
| **Behavior now** | Path containing `86'` → Taproot client only; otherwise → SegWit client only; other format keeps BIP84/BIP86 formula        |

Worth a **smoke retest**; no longer a merge blocker if retest passes.

### F2 — Ledger Live vs MetaMask duplicate EVM scan cards

|              |                                                                           |
| ------------ | ------------------------------------------------------------------------- |
| **Was**      | Both cards scanned the same path family at account 0 (`m/44'/60'/0'/0/n`) |
| **Fixed in** | `2782fd9a4` — Ledger Live card dropped / merged with MetaMask-style path  |

---

## Lower priority (not major blockers)

| Item                                             | Notes                                                                             |
| ------------------------------------------------ | --------------------------------------------------------------------------------- |
| Apply-scan vs active keystore id                 | Architectural gap; modal focus trap makes realistic exploit unlikely → suggestion |
| Custom path stores `account/index` as 0/0        | Display chips can mislead; signing uses full path                                 |
| Shared BTC account/index across SegWit + Taproot | Product tradeoff                                                                  |
| `purgeClient()` after ephemeral scan clients     | #1153 A1 — hygiene                                                                |
| Panel typing nit                                 | #1153 A2                                                                          |
| Paste address → find path                        | #1153 B2                                                                          |
| Dead / unused i18n keys                          | Nit                                                                               |

---

## Testing implications (short)

**Safe / high value**

1. Default index **0** keystore: Receive + balance match known addresses (`bc1q`, ETH, etc.).
2. Find my funds on supported formats: scan index 0 matches Receive.
3. Small **non-max** send on index 0.
4. After update: custom BTC path SegWit vs Taproot (F1 retest); one extra chain you use (BSC / LTC / MAYA).
5. Optional Sparrow cross-check **only** for BIP84 / BIP86 (or EVM) on a test seed.

**Was blocked until M1/M2 fixed — now safe to retest with care**

- UTXO **Send Max** after locking index ≠ 0.
- EVM **swap / router deposit** after locking index ≠ 0.

**Do not expect to work**

- Recovering funds on BTC `1…` or `3…` (M3).
- Vult HD recovery (M4).

---

## Ship posture

| Goal                                                        | Recommendation                                                             |
| ----------------------------------------------------------- | -------------------------------------------------------------------------- |
| Daily keystores stay on default index 0 (`bc1q` / ETH0 / …) | Phase-0 regression is the main gate                                        |
| Ship multi-index Find my funds as trustworthy               | **M1 + M2 fixed** — retest Send Max + EVM swap at N≠0 before calling ready |
| Recover `1…` / `3…` or Vult                                 | Separate work; not this PR                                                 |

---

## Related links

- PR: https://github.com/asgardex/asgardex-desktop/pull/1152
- Follow-up: https://github.com/asgardex/asgardex-desktop/issues/1153
- Local review artifacts (ephemeral): `/tmp/grok-1000/grok-review-b18573ed.md`, `verify-bug*.md`
