import React, { useCallback, useEffect, useState } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { ARBChain } from '@xchainjs/xchain-arbitrum'
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
import { MAYAChain } from '@xchainjs/xchain-mayachain'
import { RadixChain } from '@xchainjs/xchain-radix'
import { THORChain } from '@xchainjs/xchain-thorchain'
import { AssetType, baseAmount } from '@xchainjs/xchain-util'
import { Row } from 'antd'
import * as FP from 'fp-ts/lib/function'
import * as O from 'fp-ts/Option'
import { useObservableState } from 'observable-hooks'
import { useIntl } from 'react-intl'

import { TrustedAddresses } from '../../../../shared/api/types'
import { isChainOfMaya, isSupportedChain } from '../../../../shared/utils/chain'
import { BackLinkButton, RefreshButton } from '../../../components/uielements/button'
import { useMidgardContext } from '../../../contexts/MidgardContext'
import { useMidgardMayaContext } from '../../../contexts/MidgardMayaContext'
import { useWalletContext } from '../../../contexts/WalletContext'
import { useDex } from '../../../hooks/useDex'
import { PoolAddress } from '../../../services/midgard/types'
import { userAddresses$ } from '../../../services/storage/userAddresses'
import { reloadBalancesByChain } from '../../../services/wallet'
import { SelectedWalletAsset } from '../../../services/wallet/types'
import { SendViewCOSMOS, SendViewEVM, SendViewUTXO } from './index'

type Props = {}

export const SendView: React.FC<Props> = (): JSX.Element => {
  const intl = useIntl()

  const { selectedAsset$ } = useWalletContext()

  const { dex } = useDex()

  const [trustedAddresses, setTrustedAddresses] = useState<TrustedAddresses>()

  useEffect(() => {
    const subscription = userAddresses$.subscribe((addresses) => setTrustedAddresses({ addresses }))
    return () => subscription.unsubscribe()
  }, [])

  const oSelectedAsset = useObservableState(selectedAsset$, O.none)

  const {
    service: {
      pools: { selectedPoolAddress$, poolsState$: poolsStateThor$ },
      setSelectedPoolAsset
    }
  } = useMidgardContext()
  const {
    service: {
      pools: { selectedPoolAddress$: selectedPoolAddressMaya$, poolsState$: poolsStateMaya$ },
      setSelectedPoolAsset: setSelectedPoolAssetMaya
    }
  } = useMidgardMayaContext()

  useEffect(() => {
    FP.pipe(
      oSelectedAsset,
      O.fold(
        () => setSelectedPoolAsset(O.none),
        (asset) => {
          setSelectedPoolAsset(O.some(asset.asset))
          setSelectedPoolAssetMaya(O.some(asset.asset))
        }
      )
    )
    return () => {
      setSelectedPoolAsset(O.none)
      setSelectedPoolAssetMaya(O.none)
    }
  }, [setSelectedPoolAsset, setSelectedPoolAssetMaya, dex, oSelectedAsset])

  const poolsStateThorRD = useObservableState(poolsStateThor$, RD.pending)
  const poolsStateMayaRD = useObservableState(poolsStateMaya$, RD.pending)

  const oPoolAddress: O.Option<PoolAddress> = useObservableState(selectedPoolAddress$, O.none)

  const oPoolAddressMaya: O.Option<PoolAddress> = useObservableState(selectedPoolAddressMaya$, O.none)

  const renderSendView = useCallback(
    (asset: SelectedWalletAsset) => {
      const chain = asset.asset.type === AssetType.SYNTH ? dex.chain : asset.asset.chain
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
      const poolDetailsThor = RD.toNullable(poolsStateThorRD)?.poolDetails ?? []
      const poolDetailsMaya = RD.toNullable(poolsStateMayaRD)?.poolDetails ?? []
      const DEFAULT_WALLET_BALANCE = {
        walletAddress: asset.walletAddress,
        walletType: asset.walletType,
        walletAccount: asset.walletAccount,
        walletIndex: asset.walletIndex,
        hdMode: asset.hdMode,
        amount: baseAmount(0),
        asset: asset.asset
      }

      switch (chain) {
        case BCHChain:
        case BTCChain:
        case DOGEChain:
        case DASHChain:
        case LTCChain:
          return (
            <SendViewUTXO
              asset={asset}
              trustedAddresses={trustedAddresses}
              emptyBalance={DEFAULT_WALLET_BALANCE}
              poolDetails={!isChainOfMaya(asset.asset.chain) ? poolDetailsThor : poolDetailsMaya}
              oPoolAddress={oPoolAddress}
              oPoolAddressMaya={oPoolAddressMaya}
              dex={dex}
            />
          )
        case ETHChain:
        case ARBChain:
        case AVAXChain:
        case BSCChain:
          return (
            <SendViewEVM
              asset={asset}
              trustedAddresses={trustedAddresses}
              emptyBalance={DEFAULT_WALLET_BALANCE}
              poolDetails={!isChainOfMaya(asset.asset.chain) ? poolDetailsThor : poolDetailsMaya}
              oPoolAddress={oPoolAddress}
              oPoolAddressMaya={oPoolAddressMaya}
              dex={dex}
            />
          )
        case THORChain:
        case MAYAChain:
        case KUJIChain:
        case GAIAChain:
        case RadixChain:
          return (
            <SendViewCOSMOS
              asset={asset}
              trustedAddresses={trustedAddresses}
              emptyBalance={DEFAULT_WALLET_BALANCE}
              poolDetails={!isChainOfMaya(asset.asset.chain) ? poolDetailsThor : poolDetailsMaya}
              oPoolAddress={!isChainOfMaya(asset.asset.chain) ? oPoolAddress : oPoolAddressMaya}
              dex={dex}
            />
          )
      }
    },
    [dex, poolsStateThorRD, poolsStateMayaRD, intl, trustedAddresses, oPoolAddress, oPoolAddressMaya]
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
                selectedAsset.asset.type === AssetType.SYNTH ? THORChain : selectedAsset.asset.chain
              )}></RefreshButton>
          </Row>
          <div className="flex flex-col justify-center"> {renderSendView(selectedAsset)}</div>
        </div>
      )
    )
  )
}
