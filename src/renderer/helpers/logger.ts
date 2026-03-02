const NOOP = (..._args: unknown[]): void => {}

const createLogger = (level: 'error' | 'warn' | 'info' | 'debug', prefix: string) => {
  if (!$IS_DEV || !$LOG) return NOOP
  return (...args: unknown[]): void => {
    const timestamp = new Date().toISOString()
    console[level](`[${prefix}][${timestamp}]`, ...args)
  }
}

export const logger = {
  error: createLogger('error', 'ASGARDEX'),
  warn: createLogger('warn', 'ASGARDEX'),
  info: createLogger('info', 'ASGARDEX'),
  debug: createLogger('debug', 'ASGARDEX')
}

export const createScopedLogger = (scope: string) => ({
  error: createLogger('error', `ASGARDEX:${scope}`),
  warn: createLogger('warn', `ASGARDEX:${scope}`),
  info: createLogger('info', `ASGARDEX:${scope}`),
  debug: createLogger('debug', `ASGARDEX:${scope}`)
})
