import path from 'path'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@ledgerhq/evm-tools/': path.resolve(__dirname, 'node_modules/@ledgerhq/evm-tools/lib/selectors'),
      '@ledgerhq/domain-service/': path.resolve(__dirname, 'node_modules/@ledgerhq/domain-service/lib/signers'),
      '@ledgerhq/cryptoassets/': path.resolve(__dirname, 'node_modules/@ledgerhq/cryptoassets/lib/data/evm')
    }
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./setup.vitest.js', './src/setupTests.ts'],
    include: ['src/**/*.{test,spec}.{js,ts,jsx,tsx}'],
    exclude: ['node_modules', 'build'],
    css: false,
    alias: {
      '\\.(css|less)$': './__mocks__/styleMock.js'
    },
    deps: {
      optimizer: {
        web: {
          include: [
            'uuid',
            'axios',
            '@xchainjs/',
            '@metaplex-foundation/',
            '@ledgerhq/domain-service',
            '@ledgerhq/hw-app-eth',
            '@cosmjs/tendermint-rpc',
            '@bitcoin-js/tiny-secp256k1-asmjs',
            'uint8array-tools'
          ]
        }
      }
    }
  }
})
