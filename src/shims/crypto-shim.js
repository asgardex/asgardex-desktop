// Browser `crypto` polyfill for the renderer.
//
// `crypto-browserify` does not implement `timingSafeEqual` (a Node-only API).
// xchain-crypto >= 1.0.7 hardened `decryptFromKeystore` to compare the keystore
// MAC with `crypto.timingSafeEqual(...)` for a constant-time check. Without this
// shim the renderer throws "crypto.timingSafeEqual is not a function" and wallet
// unlock fails — while the test suite passes because Vitest runs in Node, which
// has the real API. See CLAUDE.md "Pinned crypto polyfills" gotcha.
//
// We augment the existing polyfill in place (preserving all of its original
// bindings) and re-export it as the renderer's `crypto` module via the alias in
// electron.vite.config.mjs.
import cryptoBrowserify from 'crypto-browserify'

if (typeof cryptoBrowserify.timingSafeEqual !== 'function') {
  cryptoBrowserify.timingSafeEqual = (a, b) => {
    if (a.length !== b.length) {
      throw new RangeError('Input buffers must have the same byte length')
    }
    // Constant-time comparison: never short-circuit on first mismatch.
    let diff = 0
    for (let i = 0; i < a.length; i++) {
      diff |= a[i] ^ b[i]
    }
    return diff === 0
  }
}

export * from 'crypto-browserify'
// Also expose it as a static named binding so `import * as crypto from 'crypto'`
// (namespace access) sees it, not only default-import access.
export const timingSafeEqual = cryptoBrowserify.timingSafeEqual
export default cryptoBrowserify
