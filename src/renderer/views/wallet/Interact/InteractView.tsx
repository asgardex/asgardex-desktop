import React, { useCallback } from 'react'

import { MAYAChain } from '@xchainjs/xchain-mayachain'
import { THORChain } from '@xchainjs/xchain-thorchain'
import * as FP from 'fp-ts/lib/function'
import * as O from 'fp-ts/Option'
import { useObservableState } from 'observable-hooks'
import { useIntl } from 'react-intl'

import { isSupportedChain } from '../../../../shared/utils/chain'
import { LoadingView } from '../../../components/shared/loading'
import { useWalletContext } from '../../../contexts/WalletContext'
import { SelectedWalletAsset } from '../../../services/wallet/types'
import { InteractViewMAYA } from './InteractViewMAYA'
import { InteractViewTHOR } from './InteractViewTHOR'

type Props = {}

export const InteractView: React.FC<Props> = (): JSX.Element => {
  const intl = useIntl()

  const { selectedAsset$ } = useWalletContext()

  const oSelectedAsset = useObservableState(selectedAsset$, O.none)

  const renderSendView = useCallback(
    (asset: SelectedWalletAsset) => {
      const chain = asset.asset.chain
      if (!isSupportedChain(chain)) {
        return (
          <h1>
            {intl.formatMessage(
              { id: 'wallet.errors.invalidChain' },
              {
                chain
              }
            )}
          </h1>
        )
      }
      switch (chain) {
        case THORChain:
          return <InteractViewTHOR />
        case MAYAChain:
          return <InteractViewMAYA />
      }
    },
    [intl]
  )

  return FP.pipe(
    oSelectedAsset,
    O.fold(
      () => <LoadingView size="large" />,
      (selectedAsset) => <div>{renderSendView(selectedAsset)}</div>
    )
  )
}
