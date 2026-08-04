# Keep the architecture map updated

**Source of truth for the map**

| Artifact                                                     | Role                                                                   |
| ------------------------------------------------------------ | ---------------------------------------------------------------------- |
| [`asgardex-architecture.json`](./asgardex-architecture.json) | Canonical graph for agents (`nodes`, `edges`, `flows`, invariants)     |
| [`asgardex-architecture.html`](./asgardex-architecture.html) | Interactive view — keep in sync with the JSON (embedded `DATA` object) |
| [`README.md`](./README.md)                                   | Human index (flow table, open instructions)                            |

When architecture changes, **update JSON first**, then mirror the same ids/labels/flows into the HTML `DATA` block, then refresh the README flow index / stats if they changed.

---

## Who should update

- **Humans** shipping structural PRs (new chain, wallet mode, protocol, IPC surface)
- **Agents** finishing a task that matches a trigger below — treat map updates as part of the same change, not a follow-up chore

Do **not** update for pure bugfixes, copy/i18n, styling, or refactors that do not change components or call paths in the graph.

---

## Update when (triggers)

Update the map if the change does any of the following:

| Trigger                                                                        | What to touch                                                   |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| New or removed **chain service** (`src/renderer/services/[chain]/`)            | Node under chain infra; edges to balances/orchestrator/xchainjs |
| New **wallet mode** or change to `appWalletService` orchestration              | Wallet nodes, walletModes, related flows, invariants            |
| New **protocol** (swap/LP rail) or rename of THOR/MAYA/Chainflip/OneClick path | Protocol nodes, aggregator edges, new/updated flow              |
| New **main IPC API** or preload `window.api*` surface                          | Main-api / ipc nodes and edges                                  |
| New **critical invariant** (silent-bug class)                                  | `criticalInvariants` + HTML Invariants tab                      |
| Material change to a **documented flow** (swap, deposit, unlock, sign)         | That flow’s `steps` (order, nodeId, action)                     |
| New top-level **context / view** that owns a feature entrypoint                | context or ui-feature node + route edge                         |
| Path move of a mapped module                                                   | `path` + tooltip on the node (JSON + HTML)                      |

Skip map updates for: lint-only, dependency bumps with no API shape change, tests, docs-only elsewhere, single-file bugfixes inside an existing node.

---

## How to update (checklist)

1. **Edit** `asgardex-architecture.json`
   - Add/remove/rename `nodes` (stable `id`s; prefer kebab ids)
   - Fix `edges` (`source` / `target` must exist)
   - Update or add `flows[].steps` with real `nodeId`s
   - Adjust `criticalInvariants` / `walletModes` / `meta` if needed
   - Bump `meta.version` if it tracks app version
2. **Validate**
   ```bash
   python3 -c "
   import json
   d=json.load(open('docs/architecture/asgardex-architecture.json'))
   ids={n['id'] for n in d['nodes']}
   bad_e=[e for e in d['edges'] if e['source'] not in ids or e['target'] not in ids]
   bad_s=[(f['id'],s['nodeId']) for f in d['flows'] for s in f['steps'] if s['nodeId'] not in ids]
   assert not bad_e and not bad_s, (bad_e, bad_s)
   print(len(d['nodes']), 'nodes', len(d['edges']), 'edges', len(d['flows']), 'flows')
   "
   ```
3. **Mirror** into `asgardex-architecture.html` embedded `DATA` (nodes, edges, flows, invariants). Keep `id`s identical so flow highlight still works.
4. **Refresh** `README.md` stats and flow index table if counts or flows changed.
5. **Sanity-check** in browser: open HTML → select the changed flow → path highlights.

---

## Agent prompt (paste or follow)

> If this change adds/removes a service, wallet mode, protocol, IPC surface, or alters a documented user flow, update `docs/architecture/asgardex-architecture.json` and the embedded `DATA` in `asgardex-architecture.html` per `docs/architecture/MAINTENANCE.md`. Validate node ids. Skip for non-structural changes.

---

## Last review

| Field                   | Value                                                                 |
| ----------------------- | --------------------------------------------------------------------- |
| Map created             | 2026-08-04                                                            |
| App version at creation | 1.45.0                                                                |
| Review when             | After major wallet/protocol/chain PRs, or at least each minor release |

Update this table when you do a full pass.
