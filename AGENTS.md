# AGENTS.md

Guidance for AI coding agents (and humans) working in this repository.

## What this is

ASGARDEX Desktop is a cross-chain DeFi wallet built with Electron + React + TypeScript.
It talks to THORChain, MAYAChain and other protocols through `@xchainjs/*` clients.

- `src/main/` — Electron main process (`electron.ts`), preload (`preload.ts`), IPC and native APIs
- `src/renderer/` — React app: `services/` (per-chain and protocol services), `views/`, `components/`, `hooks/`, `i18n/`
- `src/shared/` — types and helpers used by both processes

## Read first

- Architecture map: [`docs/architecture/README.md`](docs/architecture/README.md).
  Structural changes (new chain, wallet mode, protocol, IPC surface) must update the map —
  see [`docs/architecture/MAINTENANCE.md`](docs/architecture/MAINTENANCE.md) for the triggers.
- [`BRANCHING_WORKFLOW.md`](BRANCHING_WORKFLOW.md) — OneFlow: feature branches come off `develop` and PRs target `develop`.
- [`ADDING_NEW_CHAIN_PLAN.md`](ADDING_NEW_CHAIN_PLAN.md) — step-by-step plan for adding a chain.
- [`RELEASE.md`](RELEASE.md) — release process.

## Checks (run before opening a PR)

| Command            | What it does                                                                                                             |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `yarn build`       | Builds and typechecks main + preload (`tsconfig.main.json`) and renderer (`tsconfig.json`); a type error fails the build |
| `yarn test`        | Vitest (`vite.test.config.ts`)                                                                                           |
| `yarn check:trunk` | Trunk lint/format checks, as run in CI                                                                                   |

`tsconfig.json` excludes all test files (`*.test.ts`, `*.test.tsx`). `tsconfig.main.json` excludes
only `src/shared/**/*.test.ts`, so tests under `src/main/` and any `src/shared/**/*.test.tsx` would be
typechecked by the build (none exist today). Vitest strips types, so type errors in renderer and
shared `*.test.ts` files are not caught by any check. Typecheck them by hand when you change them.

## House patterns

- Services are built with `fp-ts` (`Option`, `Either`, `pipe`) and RxJS observables.
  Follow the shape of a neighbouring service rather than introducing a new style.
- Styling uses Tailwind with the theme tokens defined in `src/renderer/index.css` (`@theme`);
  prefer existing tokens over hard-coded colours.
- i18n: every new message key must be added to **all** locales in `src/renderer/i18n/`
  (`de`, `en`, `es`, `fr`, `hi`, `ko`, `ru`). Message objects are typed, so a missing key
  fails the typecheck.
- Follow existing patterns. For a one-off fix, change the code in place — don't add new
  files, abstractions or patterns.
