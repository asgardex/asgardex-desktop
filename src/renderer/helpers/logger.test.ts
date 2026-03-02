import { logger, createScopedLogger } from './logger'

describe('helpers/logger', () => {
  // In the test env, $IS_DEV=true and $LOG=true, so loggers are active

  describe('logger', () => {
    it('has all log level methods', () => {
      expect(typeof logger.error).toBe('function')
      expect(typeof logger.warn).toBe('function')
      expect(typeof logger.info).toBe('function')
      expect(typeof logger.debug).toBe('function')
    })

    it('calls console with [ASGARDEX] prefix and timestamp', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
      logger.error('test message')
      expect(spy).toHaveBeenCalledOnce()
      expect(spy.mock.calls[0][0]).toMatch(/^\[ASGARDEX\]\[\d{4}-\d{2}-\d{2}T/)
      expect(spy.mock.calls[0][1]).toBe('test message')
      spy.mockRestore()
    })

    it('passes all arguments through', () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      logger.warn('msg', { key: 'value' }, 42)
      expect(spy.mock.calls[0][1]).toBe('msg')
      expect(spy.mock.calls[0][2]).toEqual({ key: 'value' })
      expect(spy.mock.calls[0][3]).toBe(42)
      spy.mockRestore()
    })

    it('maps levels to correct console methods', () => {
      const spies = {
        error: vi.spyOn(console, 'error').mockImplementation(() => {}),
        warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
        info: vi.spyOn(console, 'info').mockImplementation(() => {}),
        debug: vi.spyOn(console, 'debug').mockImplementation(() => {})
      }

      logger.error('e')
      logger.warn('w')
      logger.info('i')
      logger.debug('d')

      expect(spies.error).toHaveBeenCalledOnce()
      expect(spies.warn).toHaveBeenCalledOnce()
      expect(spies.info).toHaveBeenCalledOnce()
      expect(spies.debug).toHaveBeenCalledOnce()

      Object.values(spies).forEach((s) => s.mockRestore())
    })
  })

  describe('createScopedLogger', () => {
    it('prefixes with scope name', () => {
      const scoped = createScopedLogger('chainflip')
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
      scoped.error('test')
      expect(spy.mock.calls[0][0]).toMatch(/^\[ASGARDEX:chainflip\]\[/)
      spy.mockRestore()
    })
  })
})
