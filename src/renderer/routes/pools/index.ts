import * as baseRoutes from './base'
import * as depositRoutes from './deposit'
import * as poolDetailRoutes from './detail'
import * as swapRoutes from './swap'

export const base = baseRoutes.base
export const pending = baseRoutes.pending
export const active = baseRoutes.active
export const deposit = depositRoutes.deposit
export const { base: swapBase, swap } = swapRoutes
export const detail = poolDetailRoutes.poolDetail
