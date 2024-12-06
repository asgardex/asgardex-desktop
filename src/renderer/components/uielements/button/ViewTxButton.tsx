import React, { useCallback } from 'react'

import { TxHash } from '@xchainjs/xchain-client'
import clsx from 'clsx'
import * as FP from 'fp-ts/lib/function'
import * as O from 'fp-ts/lib/Option'
import { useIntl } from 'react-intl'

import { sequenceTOption } from '../../../helpers/fpHelpers'
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
}

export const ViewTxButton: React.FC<Props> = ({
  onClick,
  txHash: oTxHash,
  txUrl: oTxUrl,
  label,
  className,
  network,
  trackable = false,
  protocol = O.none
}): JSX.Element => {
  const intl = useIntl()

  const onClickHandler = useCallback(() => {
    FP.pipe(oTxHash, O.fold(FP.constUndefined, onClick))
  }, [oTxHash, onClick])

  const handleTxTracker = useCallback(() => {
    // Ensure both `protocol` and `oTxHash` are wrapped in Option
    return FP.pipe(
      sequenceTOption(protocol, oTxHash),
      O.fold(
        () => {},
        ([protocolValue, txHash]) => {
          const url =
            protocolValue === 'Thorchain'
              ? `https://track.ninerealms.com/${txHash}?logo=asgardex.png&network=${network || 'default'}`
              : `https://www.xscanner.org/tx/${txHash}`
          window.apiUrl.openExternal(url)
        }
      )
    )
  }, [protocol, oTxHash, network])

  return (
    <div className="flex flex-col">
      <Styled.Wrapper className={clsx('flex-col', className)}>
        <Styled.ViewTxButton onClick={onClickHandler} disabled={O.isNone(oTxHash)}>
          {label || intl.formatMessage({ id: 'common.viewTransaction' })}
        </Styled.ViewTxButton>
        {trackable && (
          <Styled.ViewTxButton onClick={handleTxTracker} disabled={O.isNone(oTxHash)}>
            {label || intl.formatMessage({ id: 'common.trackTransaction' })}
          </Styled.ViewTxButton>
        )}
        <div>
          <Styled.CopyLabel
            copyable={
              FP.pipe(
                oTxUrl,
                O.map((url) => ({
                  text: url,
                  tooltips: intl.formatMessage({ id: 'common.copyTxUrl' })
                })),
                O.toUndefined
              ) || false
            }></Styled.CopyLabel>
        </div>
      </Styled.Wrapper>
    </div>
  )
}
