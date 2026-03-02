const NOOP = (..._args: unknown[]): void => {}

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 } as const
type LogLevel = keyof typeof LEVELS

const activeLevel: number = $IS_DEV && $LOG_LEVEL ? (LEVELS[$LOG_LEVEL as LogLevel] ?? -1) : -1

const createLogger = (level: LogLevel, prefix: string) => {
  if (LEVELS[level] > activeLevel) return NOOP
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
