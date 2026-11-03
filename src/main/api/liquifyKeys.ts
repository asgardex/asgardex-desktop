import { LiquifyKeys, toLiquifyKeys } from './liquifyAuth'

/**
 * Liquify portal keys, read from `MAIN_VITE_*` env vars at build time.
 * electron-vite only exposes `MAIN_VITE_*` to the MAIN bundle; the renderer / preload bundles
 * never see them. Empty / unset means "use the public, rate-limited gateway".
 *
 * Never log or return these values over IPC.
 */
export const getLiquifyKeys = (): LiquifyKeys =>
  toLiquifyKeys({
    midgard: import.meta.env.MAIN_VITE_LIQUIFY_MIDGARD_API_KEY,
    thornodeApi: import.meta.env.MAIN_VITE_LIQUIFY_THORNODE_API_KEY,
    thornodeRpc: import.meta.env.MAIN_VITE_LIQUIFY_THORNODE_RPC_KEY
  })
