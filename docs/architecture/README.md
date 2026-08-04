# ASGARDEX Desktop — Architecture Map

Interactive architecture diagram and machine-readable graph for the Electron + React + TypeScript wallet.

> **Keep this updated.** Structural code changes must refresh the map.  
> Full triggers, checklist, and agent instructions: **[MAINTENANCE.md](./MAINTENANCE.md)**.

## Files

| File | Description |
|------|-------------|
| [asgardex-architecture.html](./asgardex-architecture.html) | Self-contained interactive map (nodes, edges, flows, tooltips) |
| [asgardex-architecture.json](./asgardex-architecture.json) | Graph for AI agents: `{ nodes, edges, flows, walletModes, criticalInvariants }` |
| [MAINTENANCE.md](./MAINTENANCE.md) | When/how to update the map (humans + agents) |

## Open the diagram

No build step. From the repo root:

```bash
open docs/architecture/asgardex-architecture.html
```

Or open that file in any modern browser. Use:

- **Drag** — pan the canvas  
- **Scroll** — zoom  
- **Click a node** — detail panel (paths, connections)  
- **Flows tab** — select a flow to highlight its full path  
- **Search** — filter nodes by name/path/tag  
- **Clear / Fit / Layers** — reset selection, fit view, toggle layer bands  

## Graph stats

- **71** nodes across 11 layers  
- **98** edges  
- **16** flows (136 steps)  

## Layers (top → bottom)

1. **Runtime processes** — Electron main, preload, renderer, shared  
2. **Main process APIs** — keystore, ledger, MPC, file store, update, export  
3. **IPC surface** — `window.api*` bridge  
4. **UI shell** — App providers, routes, Redux (limited), i18n, theme  
5. **React contexts** — wallet, chain, midgard, protocols  
6. **Wallet services** — `appWalletService`, keystore, vault, ledger, balances  
7. **Chain infrastructure** — enhanced client, orchestrator, per-chain services  
8. **Protocol services** — Midgard, THOR/MAYA, Chainflip, OneClick, aggregator  
9. **Hooks & helpers** — swap hooks, `memoHelper`  
10. **Feature views** — swap, deposit, wallet, pools, bonds, portfolio, history  
11. **External systems** — xchainjs, Vultisig SDK, RPCs, nodes, hardware  

## Flow index

| ID | Name | Category | Steps |
|----|------|----------|------:|
| `flow-app-startup` | App Startup & Wallet Restore | lifecycle | 9 |
| `flow-keystore-unlock` | Keystore Unlock | wallet | 8 |
| `flow-ledger-standalone` | Standalone Ledger Connect | wallet | 9 |
| `flow-vultisig-vault` | Vultisig Vault Create / Unlock | wallet | 9 |
| `flow-balance-load` | Multi-Chain Balance Loading | wallet | 9 |
| `flow-thor-swap` | THORChain Swap | swap | 17 |
| `flow-maya-swap` | MAYAChain Swap | swap | 10 |
| `flow-chainflip-swap` | Chainflip Swap | swap | 10 |
| `flow-oneclick-swap` | OneClick Swap | swap | 8 |
| `flow-lp-deposit` | Symmetrical Liquidity Deposit | liquidity | 8 |
| `flow-lp-withdraw` | Liquidity Withdraw | liquidity | 6 |
| `flow-send-tx` | Send Transaction | transfer | 8 |
| `flow-erc20-approve` | EVM ERC20 Approve | transfer | 7 |
| `flow-bond-node` | Node Bond / Interact | ops | 6 |
| `flow-tx-status` | Transaction Status Tracking | ops | 6 |
| `flow-pools-browse` | Browse Pools | ui | 6 |

## JSON usage (agents)

```ts
import graph from './asgardex-architecture.json'

// Resolve a flow path
const flow = graph.flows.find((f) => f.id === 'flow-thor-swap')
const pathNodes = flow.steps.map((s) => graph.nodes.find((n) => n.id === s.nodeId))

// Neighbors of a component
const edgesFrom = graph.edges.filter((e) => e.source === 'svc-app-wallet')
```

Key top-level fields:

- `meta` — project overview, process model, path conventions  
- `nodes` / `edges` — architecture graph  
- `flows[].steps` — ordered `{ order, nodeId, action }`  
- `walletModes` — keystore / ledger / vultisig  
- `criticalInvariants` — non-negotiable rules (affiliate memo, IPC BigInt, `enhancedClient$`, etc.)  

## Related docs

- [CLAUDE.md](../../CLAUDE.md) — contributor guidance  
- [Wallet_Architecture.md](../Wallet_Architecture.md) — wallet mode depth  
- [VULTISIG_SDK_ARCHITECTURE.md](../VULTISIG_SDK_ARCHITECTURE.md) — MPC integration  
