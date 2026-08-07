import { FeeOption } from '@xchainjs/xchain-client'
import { baseAmount, Chain } from '@xchainjs/xchain-util'
import { function as FP, option as O, array as A } from 'fp-ts'

import { isChainOfMaya } from '../../../../shared/utils/chain'
import { createScopedLogger } from '../../../helpers/logger'
import { LiveData, liveData } from '../../../helpers/rx/liveData'
import { inboundAddressesShared$ as mayaInboundAddresses$ } from '../../mayachain'
import { inboundAddressesShared$ as thorInboundAddresses$ } from '../../thorchain'
import { InboundAddress as ThorInboundAddress } from '../../thorchain/types'

const logger = createScopedLogger('nodeapi')

export enum NodeProtocol {
  THORCHAIN = 'THORCHAIN',
  MAYACHAIN = 'MAYACHAIN'
}

type InboundAddress = ThorInboundAddress

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
        logger.warn(`Unexpected gas_rate_units for AVAX: ${gasRateUnits}`)
      }
      return gasRate

    case 'ETH':
      // Already in gwei, which is what EVM client expects
      if (gasRateUnits && gasRateUnits !== 'gwei') {
        logger.warn(`Unexpected gas_rate_units for ETH: ${gasRateUnits}`)
      }
      return gasRate

    case 'BSC':
      // Already in gwei, which is what EVM client expects
      if (gasRateUnits && gasRateUnits !== 'gwei') {
        logger.warn(`Unexpected gas_rate_units for BSC: ${gasRateUnits}`)
      }
      return gasRate

    case 'BASE':
      // BASE returns mwei (10^-3 wei), but EVM client expects gwei (10^-9 wei)
      // Need to convert: mwei to gwei = divide by 10^6
      if (gasRateUnits === 'mwei') {
        return gasRate / 1e3
      }
      logger.warn(`Unexpected gas_rate_units for BASE: ${gasRateUnits}`)
      return gasRate

    case 'ARB':
      // ARB returns centigwei (10^-2 gwei = 0.01 gwei), but EVM client expects gwei
      // Need to convert: centigwei to gwei = divide by 100
      if (gasRateUnits === 'centigwei') {
        return gasRate / 100
      }
      logger.warn(`Unexpected gas_rate_units for ARB: ${gasRateUnits}`)
      return gasRate

    case 'BTC':
    case 'BCH':
    case 'LTC':
    case 'DOGE':
      // UTXO chains return satsperbyte, which is what clients expect
      if (gasRateUnits && gasRateUnits !== 'satsperbyte') {
        logger.warn(`Unexpected gas_rate_units for ${chain}: ${gasRateUnits}`)
      }
      return gasRate

    case 'DASH':
    case 'ZEC':
      // Assuming satsperbyte like other UTXO chains
      return gasRate

    case 'GAIA':
      // Returns uatom (micro atom), which is the smallest unit
      if (gasRateUnits && gasRateUnits !== 'uatom') {
        logger.warn(`Unexpected gas_rate_units for GAIA: ${gasRateUnits}`)
      }
      return gasRate

    case 'THOR':
    case 'MAYA':
      // Cosmos-based chains return in smallest unit
      return gasRate

    case 'XRP':
      // Returns in drops (smallest unit)
      if (gasRateUnits && gasRateUnits !== 'drop') {
        logger.warn(`Unexpected gas_rate_units for XRP: ${gasRateUnits}`)
      }
      return gasRate

    case 'SOL':
      // Solana returns in lamports (smallest unit)
      return gasRate

    case 'XRD':
      // Radix returns in smallest unit
      return gasRate

    default:
      logger.warn(`Unknown chain ${chain} with gas_rate_units: ${gasRateUnits}`)
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
  const inboundAddresses$ = (
    protocol === NodeProtocol.THORCHAIN ? thorInboundAddresses$ : mayaInboundAddresses$
  ) as LiveData<Error, InboundAddress[]>
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
  const inboundAddresses$ = (
    protocol === NodeProtocol.THORCHAIN ? thorInboundAddresses$ : mayaInboundAddresses$
  ) as LiveData<Error, InboundAddress[]>

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

/**
 * Absolute per-chain fee-rate floors, in each chain's native rate unit (sats/duffs/koinu per byte).
 *
 * These are conservative multiples of each chain's minimum relay fee. A tx paying at or below the
 * relay minimum under-propagates and is never mined; for a THORChain inbound that is silent, because
 * only *confirmed* inbounds are observed - the swap never starts and the funds sit until mempool
 * expiry (~14d on BCH). Applied to every UTXO tx, pool or plain send.
 */
export const UTXO_MIN_FEE_RATES: Record<string, number> = {
  BTC: 2, // relay min ~1 sat/vB
  BCH: 2, // relay min ~1 sat/vB - the 2026-07-17 stuck swap paid 0.986
  LTC: 2, // relay min ~1 lit/byte
  DASH: 2, // relay min ~1 duff/byte
  DOGE: 1000 // relay min 0.01 DOGE/kB = 1000 koinu/byte
}

const DEFAULT_UTXO_MIN_FEE_RATE = 2

export const getUtxoMinFeeRate = (chain: Chain): number => UTXO_MIN_FEE_RATES[chain] ?? DEFAULT_UTXO_MIN_FEE_RATE

/**
 * Absolute per-chain fee-rate ceilings, in the same native units as `UTXO_MIN_FEE_RATES`.
 *
 * A plausibility gate on *upstream* numbers, not a target: no legitimate rate reaches these, so a
 * value above one means the source is wrong (bad units, a decimal shift, a broken endpoint) rather
 * than the network being busy. Live rates on 2026-07-31 were BTC 3, BCH 3, LTC 27, DASH 12,
 * DOGE 750000, so ordinary congestion never trips them.
 *
 * Sized by the worst case each permits *in fiat*, not in native units - unit price differs ~300x
 * across these chains, so one shared number would mean wildly different exposure. At a 300 byte tx
 * (a typical inbound with its OP_RETURN) a ceiling-rate fee costs roughly $57 on BTC (@ $63k) and
 * under $1 on BCH/LTC/DASH.
 *
 * Tripping a ceiling is not catastrophic: the fallback is the provider estimate, which during real
 * congestion is itself elevated, so what is forfeited is the node's padding rather than the fee.
 * That makes a tighter BTC bound close to free - it sits above nearly all sustained historical
 * rates (the 2023 ordinals congestion ran mostly under 300 sat/vB, spiking past 500 only briefly).
 */
export const UTXO_MAX_FEE_RATES: Record<string, number> = {
  BTC: 300, // ~$57 on a 300 vB tx @ $63k - the only chain where the ceiling is a meaningful loss
  BCH: 1000,
  LTC: 1000,
  DASH: 1000,
  DOGE: 20_000_000 // ~26x the current 750000
}

const DEFAULT_UTXO_MAX_FEE_RATE = 1000

export const getUtxoMaxFeeRate = (chain: Chain): number => UTXO_MAX_FEE_RATES[chain] ?? DEFAULT_UTXO_MAX_FEE_RATE

/**
 * Resolves the fee rate to use for a UTXO tx.
 *
 * Chain data providers estimate from generic network conditions and can return rates below a chain's
 * own relay minimum. For BCH the first provider is BitGo, whose `feeByBlockTarget` is empty, so it
 * derives `fast` as 75% of `fastest` - which produced 0.986 sat/vB on 2026-07-17, below BCH's ~1
 * sat/vB floor. LTC currently reports 0.825 the same way.
 *
 * Pass `oFeeData` as `O.some` for THORChain/MAYAChain **inbounds**, where the vault's `gas_rate` is
 * the authoritative figure and must not be undercut. Pass `O.none` for ordinary sends - `gas_rate`
 * is padded for inbounds (27 vs a 0.825 estimate on LTC) and would badly overpay a plain transfer.
 *
 * Bounded on both sides by `UTXO_MIN_FEE_RATES` / `UTXO_MAX_FEE_RATES`. An implausibly high
 * `gas_rate` is treated as bad data and ignored in favour of the local estimate - clamping to the
 * ceiling instead would still overpay by orders of magnitude on a decimal-shifted value.
 *
 * Never fails, and always returns a whole number: rates are integral in each chain's native unit,
 * and rounding up can only ever help a tx propagate.
 *
 * Pure: takes already-resolved fee data so the arithmetic is testable without observables.
 */
export const resolveUtxoFeeRate = (chain: Chain, estimatedRate: number, oFeeData: O.Option<ChainFeeData>): number => {
  const minRate = getUtxoMinFeeRate(chain)
  const maxRate = getUtxoMaxFeeRate(chain)
  // guards against the provider returning a sub-relay-fee estimate, or an implausible one
  const safeEstimate = Math.min(Math.max(Number.isFinite(estimatedRate) ? estimatedRate : 0, minRate), maxRate)
  if (estimatedRate > maxRate) {
    logger.warn(`Implausible ${chain} provider estimate ${estimatedRate} (max ${maxRate}) - using ${safeEstimate}`)
  }

  const rate = FP.pipe(
    oFeeData,
    O.fold(
      () => safeEstimate,
      ({ gas_rate, gas_rate_units }) => {
        const nodeRate = convertNodeGasRate(chain, Number(gas_rate), gas_rate_units)
        if (!Number.isFinite(nodeRate) || nodeRate <= 0) {
          logger.warn(`Invalid node gas_rate "${gas_rate}" for ${chain} - using ${safeEstimate}`)
          return safeEstimate
        }
        if (nodeRate > maxRate) {
          // bad data, not a busy network - trust the local estimate rather than pay this
          logger.warn(`Implausible ${chain} node gas_rate ${nodeRate} (max ${maxRate}) - using ${safeEstimate}`)
          return safeEstimate
        }
        return Math.max(safeEstimate, nodeRate)
      }
    )
  )

  const feeRate = Math.ceil(rate)
  if (feeRate > estimatedRate) {
    logger.info(`${chain} fee rate raised ${estimatedRate} -> ${feeRate} (min ${minRate}, max ${maxRate})`)
  }
  return feeRate
}

/**
 * Resolves the fee rate for a UTXO tx, sourcing `gas_rate` from inbound addresses when
 * `useNodeFeeRate` is set (i.e. the tx is a THORChain/MAYAChain inbound).
 *
 * Never fails: if node fee data is unavailable the local estimate is used, clamped to the chain's
 * minimum, so an outage can neither block a send nor let a sub-relay-fee rate through.
 */
export const utxoFeeRate$ = (chain: Chain, estimatedRate: number, useNodeFeeRate: boolean): LiveData<Error, number> => {
  if (!useNodeFeeRate) return liveData.right(resolveUtxoFeeRate(chain, estimatedRate, O.none))

  const protocol = getChainNodeProtocol(chain)
  const inboundAddresses$ = (
    protocol === NodeProtocol.THORCHAIN ? thorInboundAddresses$ : mayaInboundAddresses$
  ) as LiveData<Error, InboundAddress[]>

  return FP.pipe(
    inboundAddresses$,
    liveData.map((inboundAddresses) =>
      resolveUtxoFeeRate(chain, estimatedRate, getChainFeeData(inboundAddresses, chain))
    ),
    liveData.altOnError((error) => {
      logger.warn(`Failed to load ${protocol} inbound addresses for ${chain}`, error)
      return resolveUtxoFeeRate(chain, estimatedRate, O.none)
    })
  )
}
