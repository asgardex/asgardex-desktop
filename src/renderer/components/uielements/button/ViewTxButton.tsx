import { useCallback } from 'react'

import { TxHash } from '@xchainjs/xchain-client'
import clsx from 'clsx'
import { function as FP, option as O } from 'fp-ts'
import { useIntl } from 'react-intl'

import { sequenceTOption } from '../../../helpers/fpHelpers'
import { CopyLabel } from '../label'
import * as Styled from './ViewTxButton.styles'

type Props = {
  label?: string
  txHash: O.Option<TxHash>
  txUrl: O.Option<string>
  onClick: (txHash: string) => void
  className?: string
  network?: string
  trackable?: boolean
  protocol?: O.Option<string>
  channelId?: O.Option<string>
}

export const ViewTxButton = ({
  onClick,
  txHash: oTxHash,
  txUrl: oTxUrl,
  label,
  className,
  network,
  trackable = false,
  protocol = O.none,
  channelId = O.none
}: Props): JSX.Element => {
  const intl = useIntl()

  const onClickHandler = useCallback(() => {
    FP.pipe(oTxHash, O.fold(FP.constUndefined, onClick))
  }, [oTxHash, onClick])

  const handleTxTracker = useCallback(() => {
    return FP.pipe(
      sequenceTOption(protocol, oTxHash),
      O.fold(
        () => undefined,
        ([protocolValue, txHash]) => {
          let url: string
          switch (protocolValue) {
            case 'Thorchain':
              url = `https://track.ninerealms.com/${txHash}?logo=asgardex.png&network=${network || 'default'}`
              break
            case 'Mayachain':
              url = `https://www.xscanner.org/tx/${txHash}`
              break
            case 'Chainflip':
              return FP.pipe(
                channelId,
                O.fold(
                  () => {
                    console.warn('Channel ID required for Chainflip tracking')
                    return undefined
                  },
                  (channelIdValue) => {
                    url = `https://scan.chainflip.io/channels/${channelIdValue}`
                    if (url) {
                      window.apiUrl.openExternal(url)
                    }
                    return url
                  }
                )
              )
            default:
              return undefined
          }
          if (url) {
            window.apiUrl.openExternal(url)
          }

          return url
        }
      )
    )
  }, [protocol, oTxHash, network, channelId])

  return (
    <div className="flex flex-col">
      <div className={clsx('flex flex-col items-center', className)}>
        <Styled.ViewTxButton onClick={onClickHandler} disabled={O.isNone(oTxHash)}>
          {label || intl.formatMessage({ id: 'common.viewTransaction' })}
        </Styled.ViewTxButton>
        {trackable && (
          <Styled.ViewTxButton onClick={handleTxTracker} disabled={O.isNone(oTxHash)}>
            {label || intl.formatMessage({ id: 'common.trackTransaction' })}
          </Styled.ViewTxButton>
        )}
        <div className="flex space-x-6">
          <div className="flex items-center justify-center">
            <span className="mt-1 text-text2 dark:text-text1d">{intl.formatMessage({ id: 'common.txUrl' })} : </span>
            <CopyLabel
              textToCopy={FP.pipe(
                oTxUrl,
                O.fold(
                  () => '',
                  (url) => url
                )
              )}
            />
          </div>
          <div className="flex items-center justify-center">
            <span className="mt-1 text-text2 dark:text-text1d">{intl.formatMessage({ id: 'common.txHash' })} : </span>
            <CopyLabel
              textToCopy={FP.pipe(
                oTxHash,
                O.fold(
                  () => '',
                  (hash) => hash
                )
              )}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
