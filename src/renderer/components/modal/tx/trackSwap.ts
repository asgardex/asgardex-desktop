import { function as FP, option as O } from 'fp-ts'

import { sequenceTOption } from '../../../helpers/fpHelpers'
import { logger } from '../../../helpers/logger'

/** True when this protocol has a public tracker the receipt can open. */
export const canTrackSwap = (protocol: string, channelId: O.Option<string>): boolean => {
  if (protocol === 'Thorchain' || protocol === 'Mayachain') return true
  if (protocol === 'Chainflip') return O.isSome(channelId)
  return false
}

/**
 * Trade-asset swaps settle on the trade account and do not need a tracker.
 * An L1 leg still does. OneClick has no tracker URL, so the button stays hidden.
 */
export const swapTrackVisible = ({
  tradeAssetSwap,
  protocol,
  channelId,
  hasHash,
  settled
}: {
  tradeAssetSwap: boolean
  protocol: O.Option<string>
  channelId: O.Option<string>
  hasHash: boolean
  settled: boolean
}): boolean => {
  if (tradeAssetSwap || !settled || !hasHash) return false
  return FP.pipe(
    protocol,
    O.exists((name) => canTrackSwap(name, channelId))
  )
}

export const openTrackedSwap = (
  protocol: O.Option<string>,
  txHash: O.Option<string>,
  channelId: O.Option<string>,
  network?: string
): void => {
  FP.pipe(
    sequenceTOption(protocol, txHash),
    O.fold(
      () => undefined,
      ([protocolValue, hash]) => {
        let url: string | undefined
        switch (protocolValue) {
          case 'Thorchain':
            url = `https://track.thorchain.org/${hash}?logo=asgardex.png&network=${network || 'default'}`
            break
          case 'Mayachain':
            url = `https://www.xscanner.org/tx/${hash}`
            break
          case 'Chainflip':
            return FP.pipe(
              channelId,
              O.fold(
                () => {
                  logger.warn('Channel ID required for Chainflip tracking')
                  return undefined
                },
                (id) => {
                  window.apiUrl.openExternal(`https://scan.chainflip.io/channels/${id}`)
                  return undefined
                }
              )
            )
          default:
            return undefined
        }
        if (url) window.apiUrl.openExternal(url)
        return undefined
      }
    )
  )
}
