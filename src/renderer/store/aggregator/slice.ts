import { createSlice } from '@reduxjs/toolkit'
import { Aggregator } from '@xchainjs/xchain-aggregator'
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
import { State } from './types'

const initialState: State = {
  isLoading: false,

  aggregator: new Aggregator({
    protocols: ['Thorchain', 'Mayachain'],
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
    })
  }),
  quoteSwap: null
}

const slice = createSlice({
  name: 'aggregator',
  initialState,
  reducers: {}
})

export const { reducer, actions } = slice
