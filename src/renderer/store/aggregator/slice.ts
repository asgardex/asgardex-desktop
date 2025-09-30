import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { Aggregator } from '@xchainjs/xchain-aggregator'
import { Protocol } from '@xchainjs/xchain-aggregator/lib/types'
import { Client as ArbClient } from '@xchainjs/xchain-arbitrum'
import { Client as AvaxClient } from '@xchainjs/xchain-avax'
import { Client as BaseClient } from '@xchainjs/xchain-base'
import { Client as BscClient } from '@xchainjs/xchain-bsc'
import { Client as EthClient } from '@xchainjs/xchain-ethereum'
import { Wallet } from '@xchainjs/xchain-wallet'

import { defaultArbParams } from '../../../shared/arb/const'
import { defaultAvaxParams } from '../../../shared/avax/const'
import { defaultBaseParams } from '../../../shared/base/const'
import { defaultBscParams } from '../../../shared/bsc/const'
import { ASGARDEX_AFFILIATE_FEE, ASGARDEX_THORNAME } from '../../../shared/const'
import { defaultEthParams } from '../../../shared/ethereum/const'
import { getProtocolFromStorage, setValueToStorage, StorageKey } from '../../helpers/storage'
import { getCurrentNetworkState } from '../../services/app/service'
import { State } from './types'

const AllProtocols: Protocol[] = ['Thorchain', 'Mayachain', 'Chainflip']

const initialState: State = {
  isLoading: false,
  protocols: JSON.parse(getProtocolFromStorage(JSON.stringify(AllProtocols))),
  aggregator: new Aggregator({
    affiliate: {
      basisPoints: ASGARDEX_AFFILIATE_FEE,
      affiliates: {
        Thorchain: ASGARDEX_THORNAME,
        Mayachain: ASGARDEX_THORNAME
      }
    },
    wallet: new Wallet({
      ETH: new EthClient({
        ...defaultEthParams
      }),
      BSC: new BscClient({
        ...defaultBscParams
      }),
      AVAX: new AvaxClient({
        ...defaultAvaxParams
      }),
      ARB: new ArbClient({
        ...defaultArbParams
      }),
      BASE: new BaseClient({
        ...defaultBaseParams
      })
    }),
    network: getCurrentNetworkState()
  }),
  quoteSwap: null
}

const slice = createSlice({
  name: 'aggregator',
  initialState,
  reducers: {
    setProtocol(state, { payload: { protocol, isActive } }: PayloadAction<{ protocol: Protocol; isActive: boolean }>) {
      if (isActive) {
        state.protocols = [...state.protocols, protocol]
      } else {
        const newProtocols = state.protocols.filter((item) => item !== protocol)

        if (newProtocols.length === 0) state.protocols = AllProtocols.filter((item) => item !== protocol)
        else state.protocols = newProtocols
      }

      setValueToStorage(StorageKey.Protocol, JSON.stringify(state.protocols))
    }
  }
})

export const { reducer, actions } = slice
