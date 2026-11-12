import { createVaultManager } from './vaultManager'

describe('createVaultManager', () => {
  it('does not reject when the eager timer fires after window is gone', async () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'window')
    const rejections: unknown[] = []
    const onRejection = (reason: unknown) => {
      rejections.push(reason)
    }
    process.on('unhandledRejection', onRejection)

    try {
      Reflect.deleteProperty(globalThis, 'window')
      expect(typeof window).toBe('undefined')

      createVaultManager(() => undefined)
      await new Promise((resolve) => setTimeout(resolve, 200))

      expect(rejections).toEqual([])
    } finally {
      process.off('unhandledRejection', onRejection)
      if (descriptor) Object.defineProperty(globalThis, 'window', descriptor)
    }
  })
})
