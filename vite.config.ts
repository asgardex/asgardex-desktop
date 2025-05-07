import { defineConfig, Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import svgr from 'vite-plugin-svgr'
import babel from 'vite-plugin-babel'
import { NodeGlobalsPolyfillPlugin } from '@esbuild-plugins/node-globals-polyfill'
import { NodeModulesPolyfillPlugin } from '@esbuild-plugins/node-modules-polyfill'
import { execSync } from 'child_process'

const { version } = require('./package.json')

const gitRevisionPlugin = (): Plugin => ({
  name: 'vite-plugin-git-revision',
  config: () => {
    const commitHash = execSync('git rev-parse --short HEAD').toString().trim()
    return {
      define: {
        $COMMIT_HASH: JSON.stringify(commitHash)
      }
    }
  }
})

export default defineConfig(async () => {
  const { default: tsconfigPaths } = await import('vite-tsconfig-paths')
  return {
    root: '.',
    publicDir: 'public',
    plugins: [
      react(),
      tsconfigPaths(),
      svgr({
        svgrOptions: {
          exportType: 'default' // Use default export for SVGs
        }
      }),
      babel({
        filter: /\.js$/,
        babelConfig: {
          presets: ['@babel/preset-env']
        }
      }),
      NodeGlobalsPolyfillPlugin({ process: true, buffer: true }),
      NodeModulesPolyfillPlugin(),
      gitRevisionPlugin()
    ],
    define: {
      $VERSION: JSON.stringify(version),
      $IS_DEV: JSON.stringify(process.env.NODE_ENV !== 'production'),
      'process.env': {}
    },
    resolve: {
      alias: {
        stream: 'stream-browserify',
        crypto: 'crypto-browserify',
        os: 'os-browserify/browser',
        path: 'path-browserify',
        fs: 'browserify-fs',
        assert: 'assert',
        process: 'process/browser'
      }
    },
    build: {
      outDir: 'build',
      minify: 'terser',
      terserOptions: {
        mangle: false
      },
      sourcemap: 'hidden'
    },
    server: {
      port: 3000
    }
  }
})
