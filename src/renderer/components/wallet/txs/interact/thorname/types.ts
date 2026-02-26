import { BaseAmount } from '@xchainjs/xchain-util'

export type QuoteState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; memo: string; amount: BaseAmount }

export type NameDetails = {
  name: string
  owner: string
  expireBlockHeight: number
  preferredAsset?: string
  aliases: { chain: string; address: string }[]
}

export type EstimatedExpiry = {
  date: Date
  daysLeft: number
}

export const estimateExpiry = (
  currentBlock: number | undefined,
  expireBlockHeight: number | undefined
): EstimatedExpiry | undefined => {
  if (!currentBlock || !expireBlockHeight) return undefined
  const blocksLeft = expireBlockHeight - currentBlock
  if (blocksLeft <= 0) return undefined
  // Both THORChain and MAYAChain produce blocks approximately every 6 seconds
  const BLOCK_TIME_SECONDS = 6
  const secondsLeft = blocksLeft * BLOCK_TIME_SECONDS
  const daysLeft = Math.round(secondsLeft / 86400)
  const date = new Date(Date.now() + secondsLeft * 1000)
  return { date, daysLeft }
}
