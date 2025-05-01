import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import svgr from 'vite-plugin-svgr';
import babel from 'vite-plugin-babel';
import { NodeGlobalsPolyfillPlugin } from '@esbuild-plugins/node-globals-polyfill';
import { NodeModulesPolyfillPlugin } from '@esbuild-plugins/node-modules-polyfill';


const gitRevision = new GitRevisionPlugin();
const { version } = require('./package.json');

export default defineConfig({
  plugins: [
    react(),
    tsconfigPaths(),
    svgr(),
    babel({
      filter: /\.js$/,
      babelConfig: {
        presets: ['@babel/preset-env'],
      },
    }),
    NodeGlobalsPolyfillPlugin({ process: true, buffer: true }),
    NodeModulesPolyfillPlugin(),
    gitRevision,
  ],
  define: {
    $COMMIT_HASH: JSON.stringify(gitRevision.commithash()),
    $VERSION: JSON.stringify(version),
    $IS_DEV: JSON.stringify(process.env.NODE_ENV !== 'production'),
    'process.env': {},
  },
  resolve: {
    alias: {
      stream: 'stream-browserify',
      crypto: 'crypto-browserify',
      os: 'os-browserify/browser',
      path: 'path-browserify',
      fs: 'browserify-fs',
      assert: 'assert',
      process: 'process/browser',
    },
  },
  build: {
    outDir: 'build',
    minify: 'terser', // Use Terser instead of esbuild
    terserOptions: {
      mangle: false, // Disable mangling
    },
    sourcemap: 'hidden',
  },
  server: {
    port: 3000,
  },
});
