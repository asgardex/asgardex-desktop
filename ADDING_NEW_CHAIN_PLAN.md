# Adding a New Chain to Asgardex Desktop

This is the canonical reference for integrating a new blockchain into Asgardex Desktop. Every file that needs modification is listed below with its purpose. Use an existing chain (e.g., SOL/Solana or TRON) as a template.

**Validation:** After completing all steps, run `npx tsc --noEmit` and `yarn test`. Both must pass.

---

## Phase 1: Package & Shared Constants

| #   | What                                             | File                                     | Notes                                                                                                                                                                                                                            |
| --- | ------------------------------------------------ | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Install xchainjs SDK                             | `package.json`                           | `yarn add @xchainjs/xchain-{chain}`                                                                                                                                                                                              |
| 2   | `CHAIN_STRINGS` — human-readable name            | `src/shared/utils/chain.ts`              | e.g. `[XMRChain]: 'Monero'`                                                                                                                                                                                                      |
| 3   | `DEFAULT_ENABLED_CHAINS` — **enables the chain** | `src/shared/utils/chain.ts`              | Without this, `isSupportedChain()` returns `false` and the chain is invisible                                                                                                                                                    |
| 4   | `DefaultChainAttributes` — block reward/time     | `src/shared/utils/chain.ts`              | Used for estimated confirmation times                                                                                                                                                                                            |
| 5   | `DEX_CHAINS` — assign to THOR and/or MAYA        | `src/shared/utils/chain.ts`              | Determines which DEX can swap this chain's assets. THOR list is auto-derived from `DEFAULT_ENABLED_CHAINS` minus the MAYA-only exclusion list. If the chain is MAYA-only, add it to the MAYA array AND the THOR exclusion filter |
| 6   | `CHAIN_DECIMAL_MAP` — native asset decimals      | `src/renderer/services/chain/decimal.ts` | Import the decimal constant (e.g. `XMR_DECIMALS`) from the SDK. **Wrong decimals = balances off by orders of magnitude**                                                                                                         |
| 7   | `CHAIN_WEIGHTS_THOR` — display sort order        | `src/renderer/const.ts`                  | Higher number = lower in list. Import chain constant                                                                                                                                                                             |

## Phase 2: Chain Service Directory

Create `src/renderer/services/{chain}/` with 6 files. Copy an existing chain (e.g., `solana/` or `tron/`) and adapt:

| File             | Purpose                                                                          | Key exports                                                                                                        |
| ---------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `types.ts`       | Client, ClientState, SendTxParams, FeesService, TransactionService types         | `Client$`, `ClientState$`, `SendTxParams`, `FeesService`, `TransactionService`                                     |
| `common.ts`      | Client creation (keystore + read-only), `address$`, `addressUI$`, `explorerUrl$` | `client$`, `clientState$`, `readOnlyClient$`, `address$`, `addressUI$`, `explorerUrl$`                             |
| `balances.ts`    | Balance fetching with enhanced client (keystore/read-only switching)             | `balances$`, `reloadBalances`, `getBalanceByAddress$`, `reloadBalances$`, `resetReloadBalances`, `enhancedClient$` |
| `fees.ts`        | Fee estimation service                                                           | `createFeesService` returning `{ fees$, reloadFees }`                                                              |
| `transaction.ts` | Tx service with keystore/Ledger/Vultisig routing                                 | `createTransactionService` returning `{ ...common, sendTx }`                                                       |
| `index.ts`       | Re-exports everything, creates transaction + fee service instances               | All public exports                                                                                                 |

## Phase 3: Core Service Wiring

These files have switch statements or records that enumerate every chain. **All must be updated:**

| #   | What                                  | File                                          | What to add                                                                                         |
| --- | ------------------------------------- | --------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| 8   | `clientByChain$` switch (2 instances) | `src/renderer/services/chain/client.ts`       | `case {CHAIN}: return {MOD}.client$` in both `clientByChain$` and `clientByAsset$`                  |
| 9   | `addressByChain$` switch              | `src/renderer/services/chain/address.ts`      | `case {CHAIN}: return {MOD}.address$`                                                               |
| 10  | Import service module                 | `src/renderer/services/wallet/balances.ts`    | `import * as {MOD} from '../{chain}'`                                                               |
| 11  | `reloadBalances` batched function     | `src/renderer/services/wallet/balances.ts`    | Add `if (enabledChainsSet.has({CHAIN})) reloadFunctions.push(...)`                                  |
| 12  | `chainReloadBalances` record          | `src/renderer/services/wallet/balances.ts`    | Add `[{CHAIN}]: {MOD}.reloadBalances`                                                               |
| 13  | `getBalancesServiceByChain` switch    | `src/renderer/services/wallet/balances.ts`    | Add `case {CHAIN}:` returning `{ reloadBalances, resetReloadBalances, balances$, reloadBalances$ }` |
| 14  | Create `chainBalance$` observable     | `src/renderer/services/wallet/balances.ts`    | `const {chain}ChainBalance$ = createChainBalance$({ chain, addressUI$, walletBalanceType: 'all' })` |
| 15  | `chainBalanceObservables` record      | `src/renderer/services/wallet/balances.ts`    | Add `{CHAIN}: [{chain}ChainBalance$]` (add ledger observable too if Ledger supported)               |
| 16  | `ledgerBalanceObservables` record     | `src/renderer/services/wallet/balances.ts`    | Add `{CHAIN}: []` (empty if no Ledger support, or `[{chain}LedgerChainBalance$]` if supported)      |
| 17  | `DEFAULT_BALANCES_FILTER` record      | `src/renderer/services/wallet/const.ts`       | Add `[{CHAIN}]: 'all'`                                                                              |
| 18  | `getTxs$` switch                      | `src/renderer/services/wallet/transaction.ts` | Add `case {CHAIN}: return {MOD}.txs$({...})`                                                        |

### Transaction Routing (REQUIRED for sends to work)

Without these, wallet sends fail with "X is not supported for 'sendPoolTx$'":

| #   | What                                               | File                                                | What to add                                                                        |
| --- | -------------------------------------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 19  | `sendTx$` switch — direct send routing             | `src/renderer/services/chain/transaction/common.ts` | `case {CHAIN}: return {MOD}.sendTx({...})`. Import chain constant + service module |
| 20  | `sendPoolTx$` fallthrough — delegates to `sendTx$` | `src/renderer/services/chain/transaction/common.ts` | Add `case {CHAIN}:` to the fallthrough list before the `return sendTx$(...)` call  |
| 21  | `txStatusByChain$` switch — tx status polling      | `src/renderer/services/chain/transaction/common.ts` | `case {CHAIN}: return {MOD}.txStatus$(txHash, O.none)`                             |

### Optional: Advanced Service Wiring

These files have per-chain switch statements with fallback/default handlers. Add for full support:

| #   | What                                                          | File                                         |
| --- | ------------------------------------------------------------- | -------------------------------------------- |
| 22  | `poolInboundFee$` switch — fee estimation for pool operations | `src/renderer/services/chain/fees/common.ts` |
| 23  | `standaloneLedgerFees$` / `reloadStandaloneLedgerFees`        | `src/renderer/services/chain/fees/common.ts` |
| 24  | Derivation path                                               | `src/shared/utils/derivationPath.ts`         |

## Phase 4: React & UI Integration

| #   | What                                                      | File                                                                | Notes                                                                                                                                                                                        |
| --- | --------------------------------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 25  | Create Context + Provider + `use{Chain}Context` hook      | `src/renderer/contexts/{Chain}Context.tsx`                          | Follow pattern from `SolContext.tsx`                                                                                                                                                         |
| 26  | Wire Provider into component tree                         | `src/renderer/App.tsx`                                              | Import provider, wrap in JSX hierarchy                                                                                                                                                       |
| 27  | `chainAssets` record — native asset mapping               | `src/renderer/helpers/chainHelper.ts`                               | Add `{CHAIN}: Asset{TICKER}`                                                                                                                                                                 |
| 28  | `is{Chain}Chain` helper function                          | `src/renderer/helpers/chainHelper.ts`                               | `export const is{Chain}Chain = (chain: Chain): boolean => eqChain.equals(chain, {CHAIN})`                                                                                                    |
| 29  | `getChain` switch                                         | `src/renderer/helpers/chainHelper.ts`                               | Add `case '{CHAIN}': return {CHAIN}`                                                                                                                                                         |
| 30  | `chainPrefixLengthFunctions` record                       | `src/renderer/helpers/addressHelper.ts`                             | Address truncation prefix length                                                                                                                                                             |
| 31  | SVG icon file                                             | `src/renderer/assets/svg/asset-{chain}.svg`                         | Source from cryptologos.cc or similar                                                                                                                                                        |
| 32  | Icon import + export                                      | `src/renderer/components/icons/index.ts`                            | Import SVG, add to exports                                                                                                                                                                   |
| 33  | `chainIconMap` switch                                     | `src/renderer/components/uielements/assets/chainIcon/ChainIcon.tsx` | Map chain to icon (used in wallet header, settings)                                                                                                                                          |
| 34  | `is{Chain}Asset` helper                                   | `src/renderer/helpers/assetHelper.ts`                               | `export const is{Chain}Asset = (asset) => asset.chain === {Asset}.chain && asset.symbol.toUpperCase() === {Asset}.symbol.toUpperCase()`                                                      |
| 35  | Asset icon check in `AssetIcon.tsx`                       | `src/renderer/components/uielements/assets/assetIcon/AssetIcon.tsx` | Add `if (is{Chain}Asset(asset)) return {chain}Icon` in the useMemo block. Import helper + icon. **Without this, the asset shows a colored circle with text instead of the icon**             |
| 36  | `initialMap` record                                       | `src/renderer/components/settings/WalletSettings.tsx`               | Add `[{CHAIN}]: 0`                                                                                                                                                                           |
| 37  | WalletSettingsView — context, clients, accounts, handlers | `src/renderer/views/wallet/WalletSettingsView.tsx`                  | Add: `use{Chain}Context()` for addressUI$, `useObservableState(clientByChain$({CHAIN}))`, wallet account observable, `filterEnabledChains`entry,`clickAddressLinkHandler` case, useMemo deps |

## Phase 5: Ledger Support (Optional)

Only needed if the chain has Ledger hardware wallet support:

| #   | What                                      | File                                               |
| --- | ----------------------------------------- | -------------------------------------------------- |
| 38  | Ledger address handler                    | `src/main/api/ledger/{chain}/address.ts`           |
| 39  | Ledger transaction handler                | `src/main/api/ledger/{chain}/transaction.ts`       |
| 40  | Wire into `chainAddressFunctions`         | `src/main/api/ledger/address.ts`                   |
| 41  | Wire into `chainSendFunctions`            | `src/main/api/ledger/transaction.ts`               |
| 42  | `useLedger` hook in WalletSettingsView    | `src/renderer/views/wallet/WalletSettingsView.tsx` |
| 43  | Add/verify/remove Ledger address handlers | `src/renderer/views/wallet/WalletSettingsView.tsx` |
| 44  | Ledger chain balance observable           | `src/renderer/services/wallet/balances.ts`         |

---

## Common Pitfalls

1. **Missing from `DEFAULT_ENABLED_CHAINS`**: The chain will be completely invisible. `isSupportedChain()` returns false, all switch defaults return empty/none.

2. **Wrong decimals in `CHAIN_DECIMAL_MAP`**: Falls back to 18 decimals. If the chain uses 9 or 12 decimals, balances will be off by 10^6 to 10^9.

3. **Dead code**: Creating service files and contexts but not importing them anywhere. The new service directory must be `import * as {MOD} from '../{chain}'` in at least: `client.ts`, `address.ts`, `wallet/balances.ts`, `wallet/transaction.ts`.

4. **Missing `chainBalanceObservables` entry**: The chain won't show balances in the wallet view even if everything else is wired.

5. **Missing `CHAIN_WEIGHTS_THOR` entry**: Won't cause a crash (since `EnabledChain` resolves to `string`), but chain order in the UI will be unpredictable.

6. **Async address derivation**: Some SDKs only support `getAddressAsync()` and throw on sync `getAddress()`. The `addressUI$` helper in `clients/address.ts` already handles this by calling `getAddressAsync(0)`, so this should work out of the box. But verify the SDK's `getAddress()` and `getAddressAsync()` both work.

7. **Missing asset icon helper**: Without `is{Chain}Asset()` in `assetHelper.ts` and the corresponding check in `AssetIcon.tsx`, the chain icon shows in the wallet header but the _asset_ icon everywhere else falls back to a colored circle with text.

8. **Missing `sendTx$` / `sendPoolTx$` cases**: Without these in `transaction/common.ts`, wallet sends fail with "X is not supported for 'sendPoolTx$'". The send form always routes through `sendPoolTx$`, which must delegate to `sendTx$` for non-pool chains.

---

## Quick Reference: Files Changed Per Chain

A minimal chain integration touches **~20 files**. A full integration with Ledger support touches **~26 files**.

```
src/shared/utils/chain.ts                           # CHAIN_STRINGS, DEFAULT_ENABLED_CHAINS, DefaultChainAttributes
src/renderer/services/{chain}/*.ts                   # 6 new files (types, common, balances, fees, transaction, index)
src/renderer/services/chain/decimal.ts               # CHAIN_DECIMAL_MAP
src/renderer/services/chain/client.ts                # clientByChain$, clientByAsset$
src/renderer/services/chain/address.ts               # addressByChain$
src/renderer/services/wallet/balances.ts             # imports, reload, service, observables, records
src/renderer/services/wallet/const.ts                # DEFAULT_BALANCES_FILTER
src/renderer/services/wallet/transaction.ts          # getTxs$
src/renderer/services/chain/transaction/common.ts    # sendTx$, sendPoolTx$, txStatusByChain$
src/renderer/const.ts                                # CHAIN_WEIGHTS_THOR
src/renderer/contexts/{Chain}Context.tsx              # 1 new file
src/renderer/App.tsx                                 # Provider wiring
src/renderer/helpers/chainHelper.ts                  # chainAssets, isChain, getChain
src/renderer/helpers/assetHelper.ts                  # is{Chain}Asset (for asset icon resolution)
src/renderer/helpers/addressHelper.ts                # chainPrefixLengthFunctions
src/renderer/assets/svg/asset-{chain}.svg            # 1 new file
src/renderer/components/icons/index.ts               # icon import/export
src/renderer/components/uielements/.../ChainIcon.tsx # chainIconMap (chain icon in headers)
src/renderer/components/uielements/.../AssetIcon.tsx # is{Chain}Asset check (asset icon everywhere)
src/renderer/components/settings/WalletSettings.tsx  # initialMap
src/renderer/views/wallet/WalletSettingsView.tsx     # context, clients, accounts, handlers
```
