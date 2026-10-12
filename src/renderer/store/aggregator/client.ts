import type { Aggregator } from '@xchainjs/xchain-aggregator'
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
import {
  ASGARDEX_AFFILIATE_FEE,
  ASGARDEX_THORNAME,
  ASGARDEX_BROKER_URL,
  ASGARDEX_AFFILIATE_BROKERS_ADDRESS,
  ASGARDEX_ONECLICK_API_KEY
} from '../../../shared/const'
import { defaultEthParams } from '../../../shared/ethereum/const'
import { liquifyAggregatorConfig } from '../../helpers/liquifyEndpoints'
import { logger } from '../../helpers/logger'
import { getCurrentNetworkState } from '../../services/app/service'

const isValidChainflipAddress = (address: string): address is `cF${string}` =>
  typeof address === 'string' && address.length > 2 && address.startsWith('cF')

const getAffiliateBrokers = () => {
  if (ASGARDEX_AFFILIATE_BROKERS_ADDRESS && isValidChainflipAddress(ASGARDEX_AFFILIATE_BROKERS_ADDRESS)) {
    return [
      {
        account: ASGARDEX_AFFILIATE_BROKERS_ADDRESS,
        commissionBps: ASGARDEX_AFFILIATE_FEE
      }
    ]
  }
  logger.warn('Invalid or missing affiliate broker address in slice initialization, using empty array')
  return []
}

const getBrokerUrl = () => {
  if (!ASGARDEX_BROKER_URL || typeof ASGARDEX_BROKER_URL !== 'string' || ASGARDEX_BROKER_URL.trim() === '') {
    logger.warn('Invalid broker URL in slice initialization, using empty string')
    return ''
  }
  return ASGARDEX_BROKER_URL
}

let aggregatorPromise: Promise<Aggregator> | undefined

/**
 * One shared Aggregator. `estimateSwap` calls `setConfiguration` on it, and later
 * Chainflip / OneClick deposit calls must see that same instance.
 * The package root statically imports both AMM SDKs, so this stays a dynamic import.
 */
export const getAggregator = (): Promise<Aggregator> => {
  if (!aggregatorPromise) {
    const network = getCurrentNetworkState()
    aggregatorPromise = import('@xchainjs/xchain-aggregator')
      .then(
        ({ Aggregator: AggregatorClass }) =>
          new AggregatorClass({
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
            network,
            brokerUrl: getBrokerUrl(),
            affiliateBrokers: getAffiliateBrokers(),
            ...liquifyAggregatorConfig(network),
            ...(ASGARDEX_ONECLICK_API_KEY && { oneClickApiKey: ASGARDEX_ONECLICK_API_KEY }),
            oneClickReferral: 'asgardex'
          })
      )
      .catch((error) => {
        aggregatorPromise = undefined
        throw error
      })
  }
  return aggregatorPromise
}
