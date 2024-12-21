import { createSlice } from '@reduxjs/toolkit'
import { Aggregator } from '@xchainjs/xchain-aggregator'
import { Client as EthClient } from '@xchainjs/xchain-ethereum'
import { Wallet } from '@xchainjs/xchain-wallet'

import { ASGARDEX_AFFILIATE_FEE, ASGARDEX_THORNAME } from '../../../shared/const'
import { defaultEthParams } from '../../../shared/ethereum/const'
import { State } from './types'

const initialState: State = {
  isLoading: false,

  aggregator: new Aggregator({
    protocols: ['Thorchain', 'Mayachain', 'Chainflip'],
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
