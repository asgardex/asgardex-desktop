import { AnyAsset, BaseAmount } from '@xchainjs/xchain-util'

import { ASGARDEX_ONECLICK_API_KEY } from '../../../shared/const'
import { createScopedLogger } from '../../helpers/logger'
import { findOneClickToken } from './assets'

const logger = createScopedLogger('oneclick')

const ONECLICK_QUOTE_URL = 'https://1click.chaindefuser.com/v0/quote'
const ONECLICK_QUOTE_TIMEOUT_MS = 30_000

export type OneClickDepositQuote = {
  depositAddress: string
  amountOut: string
  correlationId?: string
}

type RequestOneClickDepositAddressParams = {
  fromAsset: AnyAsset
  destinationAsset: AnyAsset
  amount: BaseAmount
  fromAddress: string
  destinationAddress: string
  /** Slippage in basis points (100 = 1%). */
  slippageToleranceBps?: number
}

/**
 * Executable (wet) 1Click quote — returns a deposit address for broadcast.
 * Estimate/preview uses dry quotes (no deposit address); call this immediately
 * before sending funds, same pattern as Chainflip openDepositChannel.
 */
export const requestOneClickDepositAddress = async ({
  fromAsset,
  destinationAsset,
  amount,
  fromAddress,
  destinationAddress,
  slippageToleranceBps = 100
}: RequestOneClickDepositAddressParams): Promise<OneClickDepositQuote> => {
  const srcToken = findOneClickToken(fromAsset)
  const destToken = findOneClickToken(destinationAsset)
  if (!srcToken || !destToken) {
    if (!srcToken) {
      throw new Error(`Source asset not supported by OneClick: ${fromAsset.chain}.${fromAsset.symbol}`)
    }
    throw new Error(`Destination asset not supported by OneClick: ${destinationAsset.chain}.${destinationAsset.symbol}`)
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (ASGARDEX_ONECLICK_API_KEY) headers['Authorization'] = `Bearer ${ASGARDEX_ONECLICK_API_KEY}`

  const body = {
    dry: false,
    swapType: 'EXACT_INPUT',
    depositType: 'ORIGIN_CHAIN',
    recipientType: 'DESTINATION_CHAIN',
    refundType: 'ORIGIN_CHAIN',
    originAsset: srcToken.assetId,
    destinationAsset: destToken.assetId,
    amount: amount.amount().integerValue().toFixed(0),
    refundTo: fromAddress,
    recipient: destinationAddress,
    slippageTolerance: slippageToleranceBps,
    deadline: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    referral: 'asgardex'
  }

  logger.info('Requesting OneClick wet quote (deposit address)', {
    from: srcToken.assetId,
    to: destToken.assetId,
    amount: body.amount
  })

  const resp = await fetch(ONECLICK_QUOTE_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(ONECLICK_QUOTE_TIMEOUT_MS)
  })

  if (!resp.ok) {
    let detail = `1Click getQuote failed: ${resp.status}`
    try {
      const errBody = (await resp.json()) as { message?: string; error?: string }
      detail = errBody.message || errBody.error || detail
    } catch {
      // ignore JSON parse errors
    }
    throw new Error(detail)
  }

  const data = (await resp.json()) as {
    quote?: { depositAddress?: string; amountOut?: string }
    correlationId?: string
    message?: string
    error?: string
  }

  if (data.error || data.message) {
    throw new Error(data.error || data.message || 'Unknown OneClick quote error')
  }

  const depositAddress = data.quote?.depositAddress
  if (!depositAddress) {
    throw new Error('OneClick quote returned no deposit address')
  }

  return {
    depositAddress,
    amountOut: data.quote?.amountOut ?? '0',
    correlationId: data.correlationId
  }
}
