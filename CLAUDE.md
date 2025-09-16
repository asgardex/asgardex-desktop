# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Core Development

- `yarn dev` - Start development with hot reload (builds main, preload, renderer in watch mode)
- `yarn build` - Production build (sets NODE_OPTIONS="--max-old-space-size=8192")
- `yarn build:dev` - Development build
- `yarn preview` - Preview production build

### Testing & Quality

- `yarn test` - Run unit tests with Vitest
- `yarn lint` - Run linting with Trunk (includes ESLint and Prettier)
- `yarn check:trunk` - Run all Trunk checks (recommended before commits)
- `yarn check:yarn-lock` - Validate yarn.lock file
- `yarn force-rebuild-native-deps` - Rebuild native dependencies (if needed)

### Packaging & Distribution

- `yarn package` - Build and package Electron app
- `yarn package:electron` - Package only (requires prior build)

### Development Tools

- `yarn storybook` - Start Storybook for component development
- `yarn build-storybook` - Build static Storybook
- `yarn analyze` - Bundle analysis with source-map-explorer

### ERC20 Asset Management

- `yarn generate:erc20whitelist` - Generate all ERC20 whitelists
- `yarn generate:etherc20whitelist` - Ethereum ERC20 whitelist
- `yarn generate:bscerc20whitelist` - BSC BEP20 whitelist
- `yarn generate:avaxerc20whitelist` - Avalanche ERC20 whitelist
- `yarn generate:arberc20whitelist` - Arbitrum ERC20 whitelist
- `yarn generate:baseErc20whitelist` - Base ERC20 whitelist

## Architecture Overview

ASGARDEX is an Electron-based desktop application for THORChain, MAYAChain, and Chainflip DEX interactions.

### Application Structure

**Electron Architecture:**

- `src/main/` - Electron main process (Node.js environment)
- `src/renderer/` - Electron renderer process (React web app)
- `src/shared/` - Shared code between main and renderer processes

### Key Directories

**Main Process (`src/main/`):**

- `api/` - Core APIs for keystore, Ledger, file storage, language, URLs
- `api/ledger/` - Ledger hardware wallet integration by chain (Bitcoin, Ethereum, Cosmos, etc.)
- `electron.ts` - Main entry point
- `menu/` - Native application menus
- `i18n/` - Internationalization for native menus

**Renderer Process (`src/renderer/`):**

- `components/` - React UI components organized by feature
- `contexts/` - React contexts providing global state via RxJS
- `services/` - RxJS-based data layer organized by blockchain (bitcoin/, ethereum/, thorchain/, etc.)
- `views/` - High-level page components
- `hooks/` - Custom React hooks
- `helpers/` - Utility functions and helpers
- `store/` - Redux Toolkit state management

**Shared (`src/shared/`):**

- `api/` - External API clients (BlockCypher, Etherscan, etc.)
- `utils/` - Shared utilities for assets, chains, wallets
- `[chain]/` - Chain-specific constants and types
- `mock/` - Mock data for testing

### State Management Architecture

**RxJS + React Context Pattern:**

- Services in `src/renderer/services/` use RxJS observables
- Contexts in `src/renderer/contexts/` consume services and provide React state
- Components use contexts via custom hooks

**Redux Toolkit:**

- Used for specific features like aggregator, app state, gecko price data
- Located in `src/renderer/store/`

### Chain Integration

Each supported blockchain has dedicated modules:

- **Bitcoin family:** bitcoin/, bitcoincash/, litecoin/, dash/, doge/
- **Ethereum family:** ethereum/, bsc/, avax/, arb/, base/
- **Cosmos family:** cosmos/, thorchain/, mayachain/, kuji/
- **Others:** cardano/, ripple/, solana/, radix/, zcash/

Each chain module typically includes:

- `balances.ts` - Balance queries
- `common.ts` - Client setup and common operations
- `fees.ts` - Fee estimation
- `transaction.ts` - Transaction building and broadcasting

### UI Component Organization

Components are organized hierarchically:

- `uielements/` - Basic reusable components (buttons, inputs, modals)
- `[feature]/` - Feature-specific components (swap/, deposit/, wallet/)
- `shared/` - Shared components across features

## Development Environment

### Prerequisites

- Node.js 22.14+ (matches Electron 35)
- Yarn package manager

### Environment Variables

Copy `.env.sample` to `.env` and customize. Key variables:

- `VITE_WALLET_PASSWORD` - Auto-unlock wallet during development

### Build Configuration

- **Electron:** Uses electron-vite for build system
- **Testing:** Vitest with happy-dom environment
- **Styling:** Styled Components + Tailwind CSS
- **Bundling:** Vite with custom polyfills for crypto/Node.js APIs

## Testing

### Framework

- **Unit Tests:** Vitest with custom matchers for fp-ts (Either/Option types)
- **Component Tests:** React Testing Library setup
- **Test Files:** `*.test.ts` and `*.spec.ts` patterns

### Custom Test Utilities

- `runObservable` - Global helper for testing RxJS observables
- Custom matchers: `toBeNone()`, `toBeLeft()` for fp-ts types
- Mock APIs for all main process APIs (keystore, storage, etc.)

### Running Tests

- `yarn test` - Run all tests
- Test files are co-located with source files

## Key Technologies

### Core Stack

- **Electron 35** - Desktop application framework
- **React 18** - UI library with TypeScript
- **RxJS 6** - Reactive programming for data layer
- **fp-ts** - Functional programming utilities
- **Styled Components** - CSS-in-JS styling

### Blockchain Libraries

- **@xchainjs/\*** - Multi-chain abstraction layer
- **@ledgerhq/\*** - Ledger hardware wallet integration
- **ethers** - Ethereum interactions

### Development Tools

- **Vite** - Build tool and dev server
- **Storybook** - Component development
- **ESLint + Prettier** - Code quality (managed by Trunk)

## Code Patterns

### Functional Programming

- Heavy use of fp-ts for type-safe error handling
- Either<Error, Success> for operations that can fail
- Option<T> for nullable values
- RxJS observables for async data streams

### State Management

- RxJS BehaviorSubjects in services for reactive state
- React contexts to bridge RxJS to React components
- Redux Toolkit for specific UI state (limited use)

### Error Handling

- Remote Data pattern with @devexperts/remote-data-ts
- Consistent error types across the application
- Type-safe error boundaries

## Multi-Chain Support

ASGARDEX supports 15+ blockchains with consistent APIs:

- Swap/trade across chains via THORChain and MAYAChain
- Liquidity provision and withdrawal
- Native wallet functionality for each chain
- Ledger hardware wallet support (where available)

The application uses XChain libraries to abstract blockchain differences while providing chain-specific optimizations where needed.
