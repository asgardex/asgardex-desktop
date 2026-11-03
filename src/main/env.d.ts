/// <reference types="vite/client" />

// Main-process-only env vars. electron-vite exposes `MAIN_VITE_*` to the main bundle only —
// never to the renderer or preload bundles. Values are secrets: never log them.
interface ImportMetaEnv {
  readonly MAIN_VITE_LIQUIFY_MIDGARD_API_KEY?: string
  readonly MAIN_VITE_LIQUIFY_THORNODE_API_KEY?: string
  readonly MAIN_VITE_LIQUIFY_THORNODE_RPC_KEY?: string
}
