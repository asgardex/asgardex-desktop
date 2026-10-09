'use strict'

// Loaded only if something require()s @polkadot/api. ASGARDEX does not.
// Fail loud so a future SDK that starts calling the real package is obvious.
throw new Error(
  '@polkadot/api is stubbed in ASGARDEX. Polkadot is not a supported chain. @vultisig/sdk bundles its own copy and does not load this package.'
)
