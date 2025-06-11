import path from 'path'

import inject from '@rollup/plugin-inject'
import typescript from '@rollup/plugin-typescript'
import react from '@vitejs/plugin-react'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import simpleGit from 'simple-git'
import svgr from 'vite-plugin-svgr'
import wasm from 'vite-plugin-wasm'

import pkg from './package.json'

const git = simpleGit()

export default defineConfig(async ({ mode }) => {
  const commitHash = (await git.revparse(['--short', 'HEAD'])).trim()
  return {
    main: {
      build: {
        sourcemap: mode === 'development',
        outDir: 'build/main',
        lib: { entry: 'src/main/electron.ts' }
      },
      resolve: {
        extensions: ['.ts', '.js']
      },
      plugins: [
        typescript({ tsconfig: './tsconfig.main.json' }),
        externalizeDepsPlugin({
          include: ['@ledgerhq/hw-transport-node-hid', '@ledgerhq/hw-transport', 'node-hid', 'usb']
        })
      ],
      define: {
        $COMMIT_HASH: JSON.stringify(commitHash || 'dev'),
        $VERSION: JSON.stringify(pkg.version),
        $IS_DEV: JSON.stringify(process.env.NODE_ENV !== 'production')
      }
    },

    preload: {
      build: {
        lib: { entry: 'src/main/preload.ts' },
        outDir: 'build/preload',
        sourcemap: mode === 'development'
      },
      plugins: [externalizeDepsPlugin()],
      resolve: {
        extensions: ['.ts', '.js']
      }
    },

    renderer: {
      input: 'src/renderer/index.html',
      assetsInclude: ['**/*.wasm'],
      build: {
        sourcemap: mode === 'development',
        outDir: 'build/renderer',
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
      resolve: {
        alias: {
          process: 'process/browser',
          stream: 'stream-browserify',
          crypto: 'crypto-browserify',
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
      plugins: [wasm(), react(), svgr(), typescript()],
      define: {
        'process.env': {}, // TODO: Fix from xchain
        global: 'globalThis',
        $COMMIT_HASH: JSON.stringify(commitHash || 'dev'),
        $VERSION: JSON.stringify(pkg.version),
        $IS_DEV: JSON.stringify(process.env.NODE_ENV !== 'production')
      },
      server: {
        port: 3000,
        host: true
      }
    }
  }
})
