import { createAsyncThunk } from '@reduxjs/toolkit'
import { Aggregator, QuoteSwapParams } from '@xchainjs/xchain-aggregator'
import { Protocol } from '@xchainjs/xchain-aggregator/lib/types'
import { Client as ArbClient } from '@xchainjs/xchain-arbitrum'
import { Client as AvaxClient } from '@xchainjs/xchain-avax'
import { Client as BaseClient } from '@xchainjs/xchain-base'
import { Client as BscClient } from '@xchainjs/xchain-bsc'
import { Network } from '@xchainjs/xchain-client'
import { Client as EthClient } from '@xchainjs/xchain-ethereum'
import { Wallet } from '@xchainjs/xchain-wallet'

import { defaultArbParams } from '../../../shared/arb/const'
import { defaultAvaxParams } from '../../../shared/avax/const'
import { defaultBaseParams } from '../../../shared/base/const'
import { defaultBscParams } from '../../../shared/bsc/const'
import {
  ASGARDEX_AFFILIATE_FEE,
  ASGARDEX_THORNAME,
  ASGARDEX_BROKER_URL,
  ASGARDEX_AFFILIATE_BROKERS_ADDRESS
} from '../../../shared/const'
import { defaultEthParams } from '../../../shared/ethereum/const'

export const getEstimate = createAsyncThunk(
  'aggregator/estimate',
  async ({
    aggregator,
    protocols,
    params,
    useAffiliate,
    network
  }: {
    aggregator: Aggregator
    protocols: Protocol[]
    params: QuoteSwapParams
    useAffiliate: boolean
    network: Network
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

      // Validate broker URL - log warning instead of throwing
      const brokerUrl =
        !ASGARDEX_BROKER_URL || typeof ASGARDEX_BROKER_URL !== 'string' || ASGARDEX_BROKER_URL.trim() === ''
          ? (() => {
              console.warn(
                'Invalid or missing broker URL: ASGARDEX_BROKER_URL must be a non-empty string, using empty string'
              )
              return ''
            })()
          : ASGARDEX_BROKER_URL

      // Validate affiliate broker address pattern (Chainflip addresses start with 'cF')
      const isValidChainflipAddress = (address: string): address is `cF${string}` => {
        return typeof address === 'string' && address.length > 2 && address.startsWith('cF')
      }

      // Prepare affiliate brokers configuration
      const affiliateBrokers = []
      if (ASGARDEX_AFFILIATE_BROKERS_ADDRESS && isValidChainflipAddress(ASGARDEX_AFFILIATE_BROKERS_ADDRESS)) {
        affiliateBrokers.push({
          account: ASGARDEX_AFFILIATE_BROKERS_ADDRESS,
          commissionBps: useAffiliate ? ASGARDEX_AFFILIATE_FEE : 0
        })
      } else {
        console.warn('Invalid or missing affiliate broker address, skipping affiliate broker configuration')
      }

      // Fetch estimates for all selected protocols
      const config = {
        affiliate: {
          basisPoints: useAffiliate ? ASGARDEX_AFFILIATE_FEE : 0,
          affiliates: { Thorchain: ASGARDEX_THORNAME, Mayachain: ASGARDEX_THORNAME }
        },
        protocols,
        wallet,
        network,
        affiliateBrokers,
        ...(brokerUrl && { brokerUrl }) // Only include brokerUrl if it's non-empty
      }

      aggregator.setConfiguration(config)

      const estimate = await aggregator.estimateSwap(params)

      // Return all estimates
      return estimate
    } catch (error) {
      console.error(error)
      throw error
    }
  }
)
