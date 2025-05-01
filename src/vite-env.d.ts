/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WALLET_PASSWORD: string;
  // Add other VITE_ variables from .env.sample
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
