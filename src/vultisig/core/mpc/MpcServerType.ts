import { rootApiUrl } from '../core/config'

export const mpcServerTypes = ['relay', 'local'] as const

export type MpcServerType = typeof mpcServerTypes[number]

export const mpcServerUrl: Record<MpcServerType, string> = {
  relay: `${rootApiUrl}/router`,
  local: 'http://127.0.0.1:18080'
}
