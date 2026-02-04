# Asgardex Desktop

## Active Workflow: Vultisig Integration

**Branch:** `feat/vultisig`
**Objective:** Integrate Vultisig MPC wallet as standalone third wallet mode

> **Primary Context: - Must read!** See **[docs/VULTISIG_CLAUDE.md](docs/VULTISIG_CLAUDE.md)** for current status, key files, and quick reference.
>
> **Full Plan:** See **[docs/VULTISIG_INTEGRATION_PLAN.md](docs/VULTISIG_INTEGRATION_PLAN.md)** for complete phase details.

---

## Project Overview

Asgardex Desktop is a cross-chain DeFi wallet application built with Electron, React, and TypeScript. It supports THORChain and MAYAChain for swaps, liquidity provision, and asset management.

---

## Project Structure

```text
src/
├── main/                      # Electron main process
│   ├── api/                   # IPC handlers
│   │   ├── mpc/               # Vultisig MPC SDK handlers (NEW)
│   │   ├── ledger/            # Ledger hardware wallet
│   │   └── url/               # URL handling
│   ├── electron.ts            # Main entry, IPC registration
│   └── preload.ts             # Context bridge (window.api, window.apiMpc)
│
├── renderer/                  # React frontend
│   ├── components/            # Reusable UI components
│   │   ├── header/            # App header (wallet dropdown, settings)
│   │   ├── wallet/            # Wallet-specific components
│   │   └── uielements/        # Base UI elements (buttons, inputs, etc.)
│   │
│   ├── contexts/              # React contexts (Midgard, Thorchain, etc.)
│   │
│   ├── hooks/                 # Custom React hooks
│   │
│   ├── i18n/                  # Internationalization (7 languages)
│   │
│   ├── routes/                # Route definitions
│   │   ├── app.ts             # App-level routes
│   │   ├── pools/             # Pool routes
│   │   └── wallet/            # Wallet routes
│   │
│   ├── services/              # Business logic & state management
│   │   ├── wallet/            # Wallet services
│   │   │   ├── appWallet.ts   # Main wallet orchestrator
│   │   │   ├── balances.ts    # Balance fetching
│   │   │   ├── standaloneVultisig.ts  # Vultisig mode service (NEW)
│   │   │   └── standaloneLedger.ts    # Ledger mode service
│   │   ├── clients/           # Chain client wrappers
│   │   ├── midgard/           # Midgard API service
│   │   ├── thorchain/         # THORChain service
│   │   └── [chain]/           # Per-chain services (bitcoin, ethereum, etc.)
│   │
│   └── views/                 # Page components
│       ├── wallet/            # Wallet views
│       │   ├── vultisig/      # Vultisig vault creation views (NEW)
│       │   ├── NoWalletView/  # No wallet screen
│       │   └── WalletAuth.tsx # Auth wrapper
│       └── pools/             # Pool views
│
└── shared/                    # Shared between main & renderer
    ├── api/                   # IPC message types
    │   ├── types.ts           # General types
    │   └── mpcTypes.ts        # Vultisig MPC types (NEW)
    └── wallet/
        └── types.ts           # WalletType enum
```

---

## Key Patterns

### Wallet Modes

The app supports three wallet modes, managed by `AppWalletService`:

- **Keystore** - Encrypted mnemonic stored locally
- **Ledger** - Hardware wallet via USB
- **Vultisig** - MPC wallet via SDK (NEW)

### State Management

- Uses RxJS Observables for reactive state
- `observableState` helper for creating state with getter/setter/observable
- fp-ts for functional programming (Option, Either, pipe)

### IPC Communication

- Main process handles SDK/system calls
- Renderer communicates via `window.api` / `window.apiMpc`
- Preload script bridges contexts securely

### Balance Fetching

- Each chain has its own balance service (`services/[chain]/balances.ts`)
- `getBalanceByAddress$` for address-based fetching (Ledger, Vultisig)
- `chainBalances$` aggregates all chain balances

---

## Commands

```bash
yarn dev      # Run development server
yarn build    # Build for production
yarn test     # Run tests
yarn lint     # Run linter
```

---

## Pre-Completion Checklist

Before declaring any task/PR complete, run these checks:

1. **TypeScript**: `yarn tsc --noEmit` - Ensure no type errors
2. **Prettier**: `npx prettier --check .` - Ensure code formatting is correct
3. **Lint**: `yarn lint` - Ensure no linting errors

If Prettier fails, fix with: `npx prettier --write <file-path>`

---

## Bug Handling Workflow

When a bug is reported, follow this test-first approach:

1. **Don't immediately try to fix it** - Resist the urge to jump into the code
2. **Write a test that reproduces the bug** - Create a failing test that demonstrates the issue
3. **Delegate the fix to subagents** - Have subagents attempt to fix the bug
4. **Prove the fix with a passing test** - The bug is only fixed when the test passes

This ensures bugs are properly documented with test coverage and fixes are verified.

---

## Key Gotchas

- **BigInt IPC**: Use `String(amount)` for serialization across IPC
- **SDK Import**: Vultisig SDK only in main process, use dynamic import
- **Type Guards**: Check for undefined before calling (e.g., `state && isVultisigMode(state)`)
- **Observable Subscriptions**: Always unsubscribe to prevent memory leaks

---

## Reference Files

| Purpose                  | File                                                 |
| ------------------------ | ---------------------------------------------------- |
| Wallet orchestrator      | `src/renderer/services/wallet/appWallet.ts`          |
| Vultisig service         | `src/renderer/services/wallet/standaloneVultisig.ts` |
| Ledger service (pattern) | `src/renderer/services/wallet/standaloneLedger.ts`   |
| IPC handlers             | `src/main/api/mpc/index.ts`                          |
| Wallet types             | `src/renderer/services/wallet/types.ts`              |
| MPC types                | `src/shared/api/mpcTypes.ts`                         |
| Wallet dropdown          | `src/renderer/components/header/lock/HeaderLock.tsx` |

---

## SDK Quick Reference

```typescript
// Available via window.apiMpc (renderer process)
await window.apiMpc.init() // Initialize SDK
await window.apiMpc.listVaults() // List all vaults
await window.apiMpc.getAddresses(vaultId) // Get vault addresses
await window.apiMpc.createFastVault(params) // Create fast vault
await window.apiMpc.createSecureVault(params) // Create 2-of-2 vault
```

Chain mapping defined in `src/shared/api/mpcTypes.ts`:

```typescript
ASGARDEX_TO_SDK_CHAIN = { BTC: 'Bitcoin', ETH: 'Ethereum', THOR: 'THORChain', ... }
```
