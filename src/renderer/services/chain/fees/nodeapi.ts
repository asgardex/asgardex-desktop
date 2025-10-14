import { FeeOption } from '@xchainjs/xchain-client'
import { baseAmount, Chain } from '@xchainjs/xchain-util'
import { function as FP, option as O, array as A } from 'fp-ts'

import { isChainOfMaya } from '../../../../shared/utils/chain'
import { liveData } from '../../../helpers/rx/liveData'
import { inboundAddressesShared$ as mayaInboundAddresses$ } from '../../mayachain'
import { InboundAddress as MayaInboundAddress } from '../../mayachain/types'
import { inboundAddressesShared$ as thorInboundAddresses$ } from '../../thorchain'
import { InboundAddress as ThorInboundAddress } from '../../thorchain/types'

export enum NodeProtocol {
  THORCHAIN = 'THORCHAIN',
  MAYACHAIN = 'MAYACHAIN'
}

type InboundAddress = ThorInboundAddress | MayaInboundAddress

/**
 * Determines which node protocol serves a given chain
 * Uses the centralized chain mapping from shared/utils/chain.ts
 */
export const getChainNodeProtocol = (chain: Chain): NodeProtocol => {
  return isChainOfMaya(chain) ? NodeProtocol.MAYACHAIN : NodeProtocol.THORCHAIN
}

export type ChainFeeData = {
  chain: Chain
  gas_rate: string
  gas_rate_units?: string
  outbound_fee: string
  outbound_tx_size?: string
}

/**
 * Converts gas rate from THORNode/MAYANode format to the appropriate unit for each chain
 * @param chain The blockchain chain
 * @param gasRate The gas rate value from the API
 * @param gasRateUnits The gas rate units from the API
 * @returns The converted gas rate for the chain's native unit
 */
export const convertNodeGasRate = (chain: Chain, gasRate: number, gasRateUnits?: string): number => {
  switch (chain) {
    case 'AVAX':
      // nAVAX = nano AVAX = 10^-9 AVAX = gwei equivalent
      // Already in the right unit for EVM client
      if (gasRateUnits && gasRateUnits !== 'nAVAX') {
        console.warn(`Unexpected gas_rate_units for AVAX: ${gasRateUnits}`)
      }
      return gasRate

    case 'ETH':
      // Already in gwei, which is what EVM client expects
      if (gasRateUnits && gasRateUnits !== 'gwei') {
        console.warn(`Unexpected gas_rate_units for ETH: ${gasRateUnits}`)
      }
      return gasRate

    case 'BSC':
      // Already in gwei, which is what EVM client expects
      if (gasRateUnits && gasRateUnits !== 'gwei') {
        console.warn(`Unexpected gas_rate_units for BSC: ${gasRateUnits}`)
      }
      return gasRate

    case 'BASE':
      // BASE returns mwei (10^-3 wei), but EVM client expects gwei (10^-9 wei)
      // Need to convert: mwei to gwei = divide by 10^6
      if (gasRateUnits === 'mwei') {
        return gasRate / 1e3
      }
      console.warn(`Unexpected gas_rate_units for BASE: ${gasRateUnits}`)
      return gasRate

    case 'ARB':
      // ARB returns centigwei (10^-2 gwei = 0.01 gwei), but EVM client expects gwei
      // Need to convert: centigwei to gwei = divide by 100
      if (gasRateUnits === 'centigwei') {
        return gasRate / 100
      }
      console.warn(`Unexpected gas_rate_units for ARB: ${gasRateUnits}`)
      return gasRate

    case 'BTC':
    case 'BCH':
    case 'LTC':
    case 'DOGE':
      // UTXO chains return satsperbyte, which is what clients expect
      if (gasRateUnits && gasRateUnits !== 'satsperbyte') {
        console.warn(`Unexpected gas_rate_units for ${chain}: ${gasRateUnits}`)
      }
      return gasRate

    case 'DASH':
    case 'ZEC':
      // Assuming satsperbyte like other UTXO chains
      return gasRate

    case 'GAIA':
      // Returns uatom (micro atom), which is the smallest unit
      if (gasRateUnits && gasRateUnits !== 'uatom') {
        console.warn(`Unexpected gas_rate_units for GAIA: ${gasRateUnits}`)
      }
      return gasRate

    case 'THOR':
    case 'MAYA':
    case 'KUJI':
      // Cosmos-based chains return in smallest unit
      return gasRate

    case 'XRP':
      // Returns in drops (smallest unit)
      if (gasRateUnits && gasRateUnits !== 'drop') {
        console.warn(`Unexpected gas_rate_units for XRP: ${gasRateUnits}`)
      }
      return gasRate

    case 'SOL':
      // Solana returns in lamports (smallest unit)
      return gasRate

    case 'XRD':
      // Radix returns in smallest unit
      return gasRate

    default:
      console.warn(`Unknown chain ${chain} with gas_rate_units: ${gasRateUnits}`)
      return gasRate
  }
}

/**
 * Extracts fee data for a specific chain from inbound addresses response
 */
export const getChainFeeData = (inboundAddresses: InboundAddress[], chain: Chain): O.Option<ChainFeeData> => {
  const chainData = A.findFirst((item: InboundAddress) => item.chain === chain)(inboundAddresses)

  return FP.pipe(
    chainData,
    O.chain((data) =>
      data.gas_rate
        ? O.some({
            chain,
            gas_rate: data.gas_rate,
            gas_rate_units: data.gas_rate_units,
            outbound_fee: data.outbound_fee || '0',
            outbound_tx_size: data.outbound_tx_size
          })
        : O.none
    )
  )
}

/**
 * Gets gas prices for a chain using THORNode or MAYANode inbound addresses
 */
export const getNodeGasPrices$ = (
  chain: Chain,
  protocol: NodeProtocol = NodeProtocol.THORCHAIN,
  decimals: number = 18
) => {
  const inboundAddresses$ = protocol === NodeProtocol.THORCHAIN ? thorInboundAddresses$ : mayaInboundAddresses$
  const nodeName = protocol === NodeProtocol.THORCHAIN ? 'THORNode' : 'MAYANode'

  return FP.pipe(
    inboundAddresses$,
    liveData.map((inboundAddresses) => {
      const oChainFeeData = getChainFeeData(inboundAddresses, chain)

      return FP.pipe(
        oChainFeeData,
        O.fold(
          () => {
            throw new Error(`No fee data available for chain ${chain} from ${nodeName}`)
          },
          (feeData) => {
            const gasRateNum = Number(feeData.gas_rate)
            const convertedRate = convertNodeGasRate(chain, gasRateNum, feeData.gas_rate_units)

            // For EVM chains, convertedRate is in gwei and we need to convert to smallest unit (wei)
            // For UTXO chains, the rate is already in satoshis per byte
            const isEVMChain = ['ETH', 'BSC', 'AVAX', 'ARB', 'BASE'].includes(chain)

            if (isEVMChain) {
              // Convert gwei to wei by multiplying by 10^9
              const rateInWei = convertedRate * Math.pow(10, 9)
              const gasPrices = {
                [FeeOption.Average]: baseAmount(rateInWei, decimals),
                [FeeOption.Fast]: baseAmount(Math.ceil(rateInWei * 1.5), decimals),
                [FeeOption.Fastest]: baseAmount(Math.ceil(rateInWei * 2), decimals)
              }
              return gasPrices
            } else {
              // For non-EVM chains, use the rate as-is
              const gasPrices = {
                [FeeOption.Average]: baseAmount(convertedRate, decimals),
                [FeeOption.Fast]: baseAmount(Math.ceil(convertedRate * 1.5), decimals),
                [FeeOption.Fastest]: baseAmount(Math.ceil(convertedRate * 2), decimals)
              }
              return gasPrices
            }
          }
        )
      )
    })
  )
}

/**
 * Gets outbound fee for a chain using THORNode or MAYANode inbound addresses
 */
export const getNodeOutboundFee$ = (
  chain: Chain,
  protocol: NodeProtocol = NodeProtocol.THORCHAIN,
  assetDecimals: number = 18
) => {
  const inboundAddresses$ = protocol === NodeProtocol.THORCHAIN ? thorInboundAddresses$ : mayaInboundAddresses$

  return FP.pipe(
    inboundAddresses$,
    liveData.map((inboundAddresses) => {
      const oChainFeeData = getChainFeeData(inboundAddresses, chain)

      return FP.pipe(
        oChainFeeData,
        O.fold(
          () => baseAmount(0, assetDecimals),
          (feeData) => baseAmount(feeData.outbound_fee, assetDecimals)
        )
      )
    })
  )
}

/**
 * Convenience function to get gas prices using the appropriate node protocol for the chain
 */
export const getChainGasPrices$ = (chain: Chain, decimals: number = 18) => {
  const protocol = getChainNodeProtocol(chain)
  return getNodeGasPrices$(chain, protocol, decimals)
}
