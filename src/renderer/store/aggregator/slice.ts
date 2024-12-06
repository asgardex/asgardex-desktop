import { createSlice } from '@reduxjs/toolkit'
import { Aggregator } from '@xchainjs/xchain-aggregator'

import { ASGARDEX_AFFILIATE_FEE, ASGARDEX_THORNAME } from '../../../shared/const'
import { State } from './types'

// need to some how pass in the network here to use getAsgardexAffiliate(network)

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
    }
  }),
  quoteSwap: null
}

const slice = createSlice({
  name: 'aggregator',
  initialState,
  reducers: {}
})

export const { reducer, actions } = slice
