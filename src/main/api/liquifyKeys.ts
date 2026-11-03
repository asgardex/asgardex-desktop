import { LiquifyKeys, toLiquifyKeys } from './liquifyAuth'

/** Env values used to resolve the Liquify keys (all optional). */
export type LiquifyEnv = Partial<
  Record<
    'VITE_LIQUIFY_MIDGARD_API_KEY' | 'VITE_LIQUIFY_THORCHAIN_API_KEY' | 'VITE_LIQUIFY_THORCHAIN_RPC_KEY',
    string | undefined
  >
>

/** Maps env values to the Liquify keys (trimmed; empty / unsafe values become ''). */
export const resolveLiquifyKeys = (env: LiquifyEnv): LiquifyKeys =>
  toLiquifyKeys({
    midgard: env.VITE_LIQUIFY_MIDGARD_API_KEY,
    thornodeApi: env.VITE_LIQUIFY_THORCHAIN_API_KEY,
    thornodeRpc: env.VITE_LIQUIFY_THORCHAIN_RPC_KEY
  })

/**
 * Liquify portal keys, read from env vars at build time — read in the MAIN PROCESS ONLY.
 * Each `import.meta.env.X` below is replaced statically at build time, and only the main bundle
 * imports this module, so the values are not compiled into the renderer / preload bundles (nothing
 * else references these names and no code uses the whole `import.meta.env` object).
 * Empty / unset means "use the public, rate-limited gateway".
 *
 * Never log or return these values over IPC.
 */
export const getLiquifyKeys = (): LiquifyKeys =>
  resolveLiquifyKeys({
    VITE_LIQUIFY_MIDGARD_API_KEY: import.meta.env.VITE_LIQUIFY_MIDGARD_API_KEY,
    VITE_LIQUIFY_THORCHAIN_API_KEY: import.meta.env.VITE_LIQUIFY_THORCHAIN_API_KEY,
    VITE_LIQUIFY_THORCHAIN_RPC_KEY: import.meta.env.VITE_LIQUIFY_THORCHAIN_RPC_KEY
  })
