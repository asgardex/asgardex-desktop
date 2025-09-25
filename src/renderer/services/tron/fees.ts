import { TRONChain } from '@xchainjs/xchain-tron'

import * as C from '../clients'
import { Client$ } from './types'

export const createFeesService = (client$: Client$) => {
  return C.createFeesService({ client$, chain: TRONChain })
}
