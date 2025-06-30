import path from 'path'

import inject from '@rollup/plugin-inject'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import svgr from 'vite-plugin-svgr'

export default defineConfig({
  plugins: [react(), svgr()],
  resolve: {
    alias: {
      assets: path.resolve(__dirname, 'src/renderer/assets'),
      components: path.resolve(__dirname, 'src/renderer/components'),
      contexts: path.resolve(__dirname, 'src/renderer/contexts'),
      helpers: path.resolve(__dirname, 'src/renderer/helpers'),
      hooks: path.resolve(__dirname, 'src/renderer/hooks'),
      i18n: path.resolve(__dirname, 'src/renderer/i18n'),
      routes: path.resolve(__dirname, 'src/renderer/routes'),
      services: path.resolve(__dirname, 'src/renderer/services'),
      settings: path.resolve(__dirname, 'src/renderer/settings'),
      store: path.resolve(__dirname, 'src/renderer/store'),
      types: path.resolve(__dirname, 'src/renderer/types'),
      views: path.resolve(__dirname, 'src/renderer/views'),

      process: 'process/browser',
      stream: 'stream-browserify',
      crypto: 'crypto-browserify',
      assert: 'assert',
      path: path.resolve(__dirname, 'empty.js'),
      url: path.resolve(__dirname, 'empty.js'),
      https: path.resolve(__dirname, 'empty.js'),
      http: path.resolve(__dirname, 'empty.js'),
      zlib: path.resolve(__dirname, 'empty.js'),
      fs: path.resolve(__dirname, 'empty.js')
    }
  },
  optimizeDeps: {
    include: ['process', 'buffer'],
    esbuildOptions: {
      inject: ['./src/shims/buffer-shim.js']
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          crypto: ['crypto-browserify', 'stream-browserify', 'readable-stream'],
          xchain: [
            '@xchainjs/xchain-wallet',
            '@xchainjs/xchain-doge',
            '@xchainjs/xchain-litecoin',
            '@xchainjs/xchain-bitcoin',
            '@xchainjs/xchain-ethereum',
            '@xchainjs/xchain-cosmos',
            '@xchainjs/xchain-thorchain',
            '@xchainjs/xchain-client',
            '@xchainjs/xchain-crypto',
            '@xchainjs/xchain-util'
          ]
        }
      },
      plugins: [
        inject({
          Buffer: ['buffer', 'Buffer']
        })
      ]
    },
    commonjsOptions: {
      transformMixedEsModules: false
    }
  },
  define: {
    'process.env': {},
    global: 'globalThis',
    $COMMIT_HASH: JSON.stringify(process.env.COMMIT_HASH || 'dev'),
    $VERSION: JSON.stringify(process.env.npm_package_version),
    $IS_DEV: JSON.stringify(process.env.NODE_ENV !== 'production')
  }
})
