import { useCallback, useEffect, useState } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { ARBChain } from '@xchainjs/xchain-arbitrum'
import { AVAXChain } from '@xchainjs/xchain-avax'
import { BASEChain } from '@xchainjs/xchain-base'
import { BTCChain } from '@xchainjs/xchain-bitcoin'
import { BCHChain } from '@xchainjs/xchain-bitcoincash'
import { BSCChain } from '@xchainjs/xchain-bsc'
import { ADAChain } from '@xchainjs/xchain-cardano'
import { GAIAChain } from '@xchainjs/xchain-cosmos'
import { DASHChain } from '@xchainjs/xchain-dash'
import { DOGEChain } from '@xchainjs/xchain-doge'
import { ETHChain } from '@xchainjs/xchain-ethereum'
import { KUJIChain } from '@xchainjs/xchain-kujira'
import { LTCChain } from '@xchainjs/xchain-litecoin'
import { MAYAChain } from '@xchainjs/xchain-mayachain'
import { RadixChain } from '@xchainjs/xchain-radix'
import { XRPChain } from '@xchainjs/xchain-ripple'
import { SOLChain } from '@xchainjs/xchain-solana'
import { THORChain } from '@xchainjs/xchain-thorchain'
import { AssetType, baseAmount } from '@xchainjs/xchain-util'
import { ZECChain } from '@xchainjs/xchain-zcash'
import { function as FP, option as O } from 'fp-ts'
import { useObservableState } from 'observable-hooks'
import { useIntl } from 'react-intl'

import { TrustedAddresses } from '../../../../shared/api/types'
import { isChainOfMaya, isSupportedChain } from '../../../../shared/utils/chain'
import { BackLinkButton, RefreshButton } from '../../../components/uielements/button'
import { useMidgardContext } from '../../../contexts/MidgardContext'
import { useMidgardMayaContext } from '../../../contexts/MidgardMayaContext'
import { useWalletContext } from '../../../contexts/WalletContext'
import { PoolAddress } from '../../../services/midgard/midgardTypes'
import { userAddresses$ } from '../../../services/storage/userAddresses'
import { reloadBalancesByChain } from '../../../services/wallet'
import { SelectedWalletAsset } from '../../../services/wallet/types'
import { SendViewCOSMOS, SendViewEVM, SendViewUTXO } from './index'

export const SendView = (): JSX.Element => {
  const intl = useIntl()

  const { selectedAsset$ } = useWalletContext()

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
  }, [setSelectedPoolAsset, setSelectedPoolAssetMaya, oSelectedAsset])

  const poolsStateThorRD = useObservableState(poolsStateThor$, RD.pending)
  const poolsStateMayaRD = useObservableState(poolsStateMaya$, RD.pending)

  const oPoolAddress: O.Option<PoolAddress> = useObservableState(selectedPoolAddress$, O.none)

  const oPoolAddressMaya: O.Option<PoolAddress> = useObservableState(selectedPoolAddressMaya$, O.none)

  const renderSendView = useCallback(
    (asset: SelectedWalletAsset) => {
      const chain =
        asset.asset.type === AssetType.SYNTH
          ? MAYAChain
          : asset.asset.type === AssetType.SECURED
          ? THORChain
          : asset.asset.chain
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
        case ADAChain:
        case DASHChain:
        case LTCChain:
        case ZECChain:
          return (
            <SendViewUTXO
              asset={asset}
              trustedAddresses={trustedAddresses}
              emptyBalance={DEFAULT_WALLET_BALANCE}
              poolDetails={!isChainOfMaya(asset.asset.chain) ? poolDetailsThor : poolDetailsMaya}
              oPoolAddress={oPoolAddress}
              oPoolAddressMaya={oPoolAddressMaya}
            />
          )
        case ETHChain:
        case ARBChain:
        case AVAXChain:
        case BSCChain:
        case BASEChain:
          return (
            <SendViewEVM
              asset={asset}
              trustedAddresses={trustedAddresses}
              emptyBalance={DEFAULT_WALLET_BALANCE}
              poolDetails={!isChainOfMaya(asset.asset.chain) ? poolDetailsThor : poolDetailsMaya}
              oPoolAddress={oPoolAddress}
              oPoolAddressMaya={oPoolAddressMaya}
            />
          )
        case THORChain:
        case MAYAChain:
        case KUJIChain:
        case GAIAChain:
        case XRPChain:
        case RadixChain:
        case SOLChain:
          return (
            <SendViewCOSMOS
              asset={asset}
              trustedAddresses={trustedAddresses}
              emptyBalance={DEFAULT_WALLET_BALANCE}
              poolDetails={!isChainOfMaya(asset.asset.chain) ? poolDetailsThor : poolDetailsMaya}
              oPoolAddress={!isChainOfMaya(asset.asset.chain) ? oPoolAddress : oPoolAddressMaya}
            />
          )
      }
    },
    [poolsStateThorRD, poolsStateMayaRD, intl, trustedAddresses, oPoolAddress, oPoolAddressMaya]
  )

  return FP.pipe(
    oSelectedAsset,
    O.fold(
      () => <></>,
      (selectedAsset) => (
        <div>
          <div className="flex items-center justify-between mb-4">
            <BackLinkButton />
            <RefreshButton
              onClick={reloadBalancesByChain(
                selectedAsset.asset.type === AssetType.SYNTH
                  ? MAYAChain
                  : selectedAsset.asset.type === AssetType.SECURED
                  ? THORChain
                  : selectedAsset.asset.chain,
                selectedAsset.walletType
              )}
            />
          </div>
          <div className="flex flex-col justify-center">{renderSendView(selectedAsset)}</div>
        </div>
      )
    )
  )
}
