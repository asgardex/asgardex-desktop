import { Chain } from '@xchainjs/xchain-util'

import { isThorChain } from '../helpers/chainHelper'
import { useMayachainContext } from './MayachainContext'
import { useThorchainContext } from './ThorchainContext'

export const useDexContext = (chain: Chain) => {
  const ThorchainContext = useThorchainContext()
  const MayachainContext = useMayachainContext()
  if (isThorChain(chain)) {
    return ThorchainContext
  } else {
    return MayachainContext
  }
}
