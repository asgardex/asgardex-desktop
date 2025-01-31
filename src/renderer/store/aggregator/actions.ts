import { createAsyncThunk } from '@reduxjs/toolkit'
import { Aggregator, QuoteSwapParams } from '@xchainjs/xchain-aggregator'
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

export const getEstimate = createAsyncThunk(
  'aggregator/estimate',
  async ({
    aggregator,
    params,
    useAffiliate
  }: {
    aggregator: Aggregator
    params: QuoteSwapParams
    useAffiliate: boolean
  }) => {
    try {
      const wallet = new Wallet({
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
      const protocols: Protocol[] = ['Thorchain', 'Mayachain']

      // Fetch estimates for all selected protocols
      const estimates = await Promise.allSettled(
        protocols.map(async (protocol) => {
          aggregator.setConfiguration({
            protocols: [protocol],
            affiliate: {
              basisPoints: useAffiliate ? ASGARDEX_AFFILIATE_FEE : 0,
              affiliates: { Thorchain: ASGARDEX_THORNAME, Mayachain: ASGARDEX_THORNAME }
            },
            wallet
          })

          const estimate = await aggregator.estimateSwap(params)
          return { protocol, estimate }
        })
      )

      // Return all estimates
      return {
        estimates
      }
    } catch (error) {
      console.error(error)
      throw error
    }
  }
)
