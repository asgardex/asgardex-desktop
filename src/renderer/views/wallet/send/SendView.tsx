import React, { useCallback } from 'react'

import { AVAXChain } from '@xchainjs/xchain-avax'
import { BTCChain } from '@xchainjs/xchain-bitcoin'
import { BCHChain } from '@xchainjs/xchain-bitcoincash'
import { BSCChain } from '@xchainjs/xchain-bsc'
import { GAIAChain } from '@xchainjs/xchain-cosmos'
import { DASHChain } from '@xchainjs/xchain-dash'
import { DOGEChain } from '@xchainjs/xchain-doge'
import { ETHChain } from '@xchainjs/xchain-ethereum'
import { KUJIChain } from '@xchainjs/xchain-kujira'
import { LTCChain } from '@xchainjs/xchain-litecoin'
import { AssetCacao, MAYAChain } from '@xchainjs/xchain-mayachain'
import { AssetRuneNative, THORChain } from '@xchainjs/xchain-thorchain'
import { baseAmount } from '@xchainjs/xchain-util'
import { Row } from 'antd'
import * as FP from 'fp-ts/lib/function'
import * as O from 'fp-ts/Option'
import { useObservableState } from 'observable-hooks'
import { useIntl } from 'react-intl'

import { isEnabledChain } from '../../../../shared/utils/chain'
import { BackLinkButton, RefreshButton } from '../../../components/uielements/button'
import { useWalletContext } from '../../../contexts/WalletContext'
import { useDex } from '../../../hooks/useDex'
import { reloadBalancesByChain } from '../../../services/wallet'
import { SelectedWalletAsset } from '../../../services/wallet/types'
import { SendViewEVM, SendViewTHOR, SendViewMAYA, SendViewCOSMOS, SendViewUTXO, SendViewKUJI } from './index'

type Props = {}

export const SendView: React.FC<Props> = (): JSX.Element => {
  const intl = useIntl()

  const { selectedAsset$ } = useWalletContext()

  const { dex } = useDex()

  const oSelectedAsset = useObservableState(selectedAsset$, O.none)

  const renderSendView = useCallback(
    (asset: SelectedWalletAsset) => {
      const chain = asset.asset.synth ? (dex === 'THOR' ? AssetRuneNative.chain : AssetCacao.chain) : asset.asset.chain
      if (!isEnabledChain(chain)) {
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
      const DEFAULT_WALLET_BALANCE = {
        walletAddress: asset.walletAddress, // default wallet address
        walletType: asset.walletType, // default wallet type
        walletIndex: asset.walletIndex, // default wallet index
        hdMode: asset.hdMode, // default hd mode
        amount: baseAmount(0), // default balance amount
        asset: asset.asset // default asset
      }

      switch (chain) {
        case BCHChain:
        case BTCChain:
        case DOGEChain:
        case DASHChain:
        case LTCChain:
          return <SendViewUTXO asset={asset} emptyBalance={DEFAULT_WALLET_BALANCE} />
        case ETHChain:
        case AVAXChain:
        case BSCChain:
          return <SendViewEVM asset={asset} emptyBalance={DEFAULT_WALLET_BALANCE} />
        case THORChain:
          return <SendViewTHOR asset={asset} emptyBalance={DEFAULT_WALLET_BALANCE} />
        case MAYAChain:
          return <SendViewMAYA asset={asset} emptyBalance={DEFAULT_WALLET_BALANCE} />
        case GAIAChain:
          return <SendViewCOSMOS asset={asset} emptyBalance={DEFAULT_WALLET_BALANCE} />
        case KUJIChain:
          return <SendViewKUJI asset={asset} emptyBalance={DEFAULT_WALLET_BALANCE} />
      }
    },
    [dex, intl]
  )

  return FP.pipe(
    oSelectedAsset,
    O.fold(
      () => <></>,
      (selectedAsset) => (
        <div>
          <Row justify="space-between">
            <BackLinkButton />
            <RefreshButton
              onClick={reloadBalancesByChain(
                selectedAsset.asset.synth ? THORChain : selectedAsset.asset.chain
              )}></RefreshButton>
          </Row>
          <div className="flex flex-col justify-center"> {renderSendView(selectedAsset)}</div>
        </div>
      )
    )
  )
}
