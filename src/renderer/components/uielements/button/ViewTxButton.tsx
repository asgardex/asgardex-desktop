import React, { useCallback } from 'react'

import { TxHash } from '@xchainjs/xchain-client'
import * as FP from 'fp-ts/lib/function'
import * as O from 'fp-ts/lib/Option'
import { useIntl } from 'react-intl'

import * as Styled from './ViewTxButton.styles'

type Props = {
  label?: string
  txHash: O.Option<TxHash>
  txUrl: O.Option<string>
  onClick: (txHash: string) => void
  className?: string
  trackable?: boolean
}

export const ViewTxButton: React.FC<Props> = ({
  onClick,
  txHash: oTxHash,
  txUrl: oTxUrl,
  label,
  className,
  trackable = false
}): JSX.Element => {
  const intl = useIntl()

  const onClickHandler = useCallback(() => {
    FP.pipe(oTxHash, O.fold(FP.constUndefined, onClick))
  }, [oTxHash, onClick])

  const handleTxTracker = useCallback(() => {
    FP.pipe(
      oTxHash,
      O.map((txHash) => window.apiUrl.openExternal(`https://track.ninerealms.com/${txHash}?logo=asgardex.png`))
    )
  }, [oTxHash])

  return (
    <div className="flex flex-col">
      <Styled.Wrapper className={`${className} flex-col`}>
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
