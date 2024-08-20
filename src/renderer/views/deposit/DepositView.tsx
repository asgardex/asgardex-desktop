import React, { useCallback, useEffect, useMemo } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { AssetBTC } from '@xchainjs/xchain-bitcoin'
import { THORChain } from '@xchainjs/xchain-thorchain'
import { AnyAsset, Asset, Chain } from '@xchainjs/xchain-util'
import { Spin } from 'antd'
import * as FP from 'fp-ts/lib/function'
import * as O from 'fp-ts/Option'
import { useObservableState } from 'observable-hooks'
import { useIntl } from 'react-intl'
import { useParams } from 'react-router-dom'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { Deposit } from '../../components/deposit/Deposit'
import { ErrorView } from '../../components/shared/error'
import { BackLinkButton, RefreshButton } from '../../components/uielements/button'
import { DEFAULT_WALLET_TYPE } from '../../const'
import { useChainContext } from '../../contexts/ChainContext'
import { useMayachainContext } from '../../contexts/MayachainContext'
import { useMidgardContext } from '../../contexts/MidgardContext'
import { useMidgardMayaContext } from '../../contexts/MidgardMayaContext'
import { useThorchainContext } from '../../contexts/ThorchainContext'
import { useWalletContext } from '../../contexts/WalletContext'
import { getAssetFromNullableString } from '../../helpers/assetHelper'
import { sequenceTOption } from '../../helpers/fpHelpers'
import { useDex } from '../../hooks/useDex'
import { useMimirHalt } from '../../hooks/useMimirHalt'
import { useSymDepositAddresses } from '../../hooks/useSymDepositAddresses'
import { DepositRouteParams } from '../../routes/pools/deposit'
import { AssetWithDecimalLD, AssetWithDecimalRD } from '../../services/chain/types'
import { PoolDetailRD as PoolDetailMayaRD } from '../../services/mayaMigard/types'
import { PoolDetailRD, PoolSharesLD, PoolSharesRD } from '../../services/midgard/types'
import { SymDepositView } from './add/SymDepositView'
import { ShareView } from './share/ShareView'
import { WithdrawDepositView } from './withdraw/WithdrawDepositView'

type Props = {}

export const DepositView: React.FC<Props> = () => {
  const intl = useIntl()

  const { dex } = useDex()

  const { reloadLiquidityProviders: reloadLiquidityProvidersThor } = useThorchainContext()
  const { reloadLiquidityProviders: reloadLiquidityProvidersMaya } = useMayachainContext()

  const reloadLiquidityProviders = dex.chain === THORChain ? reloadLiquidityProvidersThor : reloadLiquidityProvidersMaya

  const {
    asset: routeAsset,
    assetWalletType: routeAssetWalletType,
    runeWalletType: routeRuneWalletType
  } = useParams<DepositRouteParams>()
  const {
    service: {
      setSelectedPoolAsset,
      selectedPoolAsset$: selectedPoolAssetThor$,
      pools: {
        reloadSelectedPoolDetail,
        selectedPoolDetail$: selectedPoolDetailThor$,
        haltedChains$: haltedChainsThor$
      },
      shares: { shares$: sharesThor$, reloadShares }
    }
  } = useMidgardContext()

  const {
    service: {
      setSelectedPoolAsset: setSelectedPoolAssetMaya,
      selectedPoolAsset$: selectedPoolAssetMaya$,
      pools: {
        reloadSelectedPoolDetail: reloadSelectedPoolDetailMaya,
        selectedPoolDetail$: selectedPoolDetailMaya$,
        haltedChains$: haltedChainsMaya$
      },
      shares: { shares$: sharesMaya$, reloadShares: reloadSharesMaya }
    }
  } = useMidgardMayaContext()

  const selectedPoolAsset$ = dex.chain === THORChain ? selectedPoolAssetThor$ : selectedPoolAssetMaya$

  const haltedChains$ = dex.chain === THORChain ? haltedChainsThor$ : haltedChainsMaya$
  const shares$ = dex.chain === THORChain ? sharesThor$ : sharesMaya$

  const [haltedChains] = useObservableState(() => FP.pipe(haltedChains$, RxOp.map(RD.getOrElse((): Chain[] => []))), [])
  const { mimirHalt } = useMimirHalt()
  const { keystoreService, reloadBalancesByChain } = useWalletContext()

  const { assetWithDecimal$ } = useChainContext()

  const oRouteAsset = useMemo(() => getAssetFromNullableString(routeAsset), [routeAsset])
  const assetWalletType = routeAssetWalletType || DEFAULT_WALLET_TYPE
  const runeWalletType = routeRuneWalletType || DEFAULT_WALLET_TYPE

  // if the user switches dex to thorchain we don't want THOR on the asset side
  const getAlternativeAsset = (): O.Option<Asset> => {
    return O.some(AssetBTC)
  }

  // Set selected pool asset whenever an asset in route has been changed
  useEffect(() => {
    // Function to determine if the dex and the asset's chain are equal
    const isDexEqualAssetChain = (asset: AnyAsset) => dex.chain === asset.chain

    O.fold(
      () => {},
      (asset: AnyAsset) => {
        if (isDexEqualAssetChain(asset)) {
          // If dex and asset's chain are equal, set an alternative asset
          const alternativeAsset = getAlternativeAsset()
          O.fold(
            () => {},
            (altAsset: AnyAsset) => {
              dex.chain === THORChain
                ? setSelectedPoolAsset(O.some(altAsset))
                : setSelectedPoolAssetMaya(O.some(altAsset))
            }
          )(alternativeAsset)
        } else {
          dex.chain === THORChain ? setSelectedPoolAsset(O.some(asset)) : setSelectedPoolAssetMaya(O.some(asset))
        }
      }
    )(oRouteAsset)

    return () => {
      dex.chain === THORChain ? setSelectedPoolAsset(O.none) : setSelectedPoolAssetMaya(O.none)
    }
  }, [dex, oRouteAsset, setSelectedPoolAsset, setSelectedPoolAssetMaya])

  const assetWithDecimalLD: AssetWithDecimalLD = useMemo(
    () =>
      FP.pipe(
        selectedPoolAsset$,
        RxOp.switchMap((oSelectedPoolAsset) =>
          FP.pipe(
            oSelectedPoolAsset,
            O.fold(
              () => Rx.of(RD.initial),
              (asset) => assetWithDecimal$(asset)
            )
          )
        )
      ),
    [selectedPoolAsset$, assetWithDecimal$]
  )

  const assetWithDecimalRD = useObservableState<AssetWithDecimalRD>(assetWithDecimalLD, RD.initial)

  const oSelectedAssetWithDecimal = useMemo(() => RD.toOption(assetWithDecimalRD), [assetWithDecimalRD])

  const {
    addresses: { rune: oDexWalletAddress, asset: oAssetWalletAddress }
  } = useSymDepositAddresses({
    asset: oRouteAsset,
    dex,
    assetWalletType,
    runeWalletType
  })

  /**
   * We have to get a new shares$ stream for every new address
   * @description /src/renderer/services/midgard/shares.ts
   */
  const poolShares$: PoolSharesLD = useMemo(
    () =>
      FP.pipe(
        // re-load shares whenever selected asset or rune address has been changed
        sequenceTOption(oAssetWalletAddress, oDexWalletAddress),
        O.fold(
          () => Rx.EMPTY,
          ([{ address }, _]) => shares$(address)
        )
      ),
    [oAssetWalletAddress, oDexWalletAddress, shares$]
  )

  const poolSharesRD = useObservableState<PoolSharesRD>(poolShares$, RD.initial)

  const refreshButtonDisabled = useMemo(
    () =>
      FP.pipe(
        poolSharesRD,
        RD.toOption,
        (oPoolShares) => sequenceTOption(oPoolShares, oSelectedAssetWithDecimal),
        O.isNone
      ),
    [poolSharesRD, oSelectedAssetWithDecimal]
  )

  const reloadChainAndRuneBalances = useCallback(() => {
    FP.pipe(
      oSelectedAssetWithDecimal,
      O.map(({ asset: { chain } }) => {
        reloadBalancesByChain(chain)()
        reloadBalancesByChain(dex.chain)()
        return true
      })
    )
  }, [dex, oSelectedAssetWithDecimal, reloadBalancesByChain])

  const reloadHandler = useCallback(() => {
    reloadChainAndRuneBalances()
    if (dex.chain === THORChain) {
      reloadShares()
      reloadLiquidityProviders()
      reloadSelectedPoolDetail()
    } else {
      reloadSharesMaya()
      reloadSelectedPoolDetailMaya()
    }
  }, [
    dex,
    reloadChainAndRuneBalances,
    reloadLiquidityProviders,
    reloadSelectedPoolDetail,
    reloadSelectedPoolDetailMaya,
    reloadShares,
    reloadSharesMaya
  ])

  // Important note:
  // DON'T use `INITIAL_KEYSTORE_STATE` as default value for `keystoreState`
  // Because `useObservableState` will set its state NOT before first rendering loop,
  // and `AddWallet` would be rendered for the first time,
  // before a check of `keystoreState` can be done
  const keystoreState = useObservableState(keystoreService.keystoreState$, undefined)

  const poolDetailThorRD: PoolDetailRD = useObservableState(selectedPoolDetailThor$, RD.initial)
  const poolDetailMayaRD: PoolDetailMayaRD = useObservableState(selectedPoolDetailMaya$, RD.initial)
  const poolDetailRD = dex.chain === THORChain ? poolDetailThorRD : poolDetailMayaRD
  const renderTopContent = useMemo(
    () => (
      <div className="relative mb-20px flex items-center justify-between">
        <BackLinkButton className="absolute !m-0" />
        <h2 className="m-0 w-full text-center font-mainSemiBold text-16 uppercase text-turquoise">
          {intl.formatMessage({ id: 'common.liquidity' })}
        </h2>
        <RefreshButton className="absolute right-0" disabled={refreshButtonDisabled} onClick={reloadHandler} />
      </div>
    ),
    [intl, refreshButtonDisabled, reloadHandler]
  )

  const renderLoadingContent = useMemo(
    () => (
      <div className="flex h-screen w-full items-center justify-center bg-bg0 dark:bg-bg0d">
        <Spin size="large" />
      </div>
    ),
    []
  )

  // Special case: `keystoreState` is `undefined` in first render loop
  // (see comment at its definition using `useObservableState`)
  if (keystoreState === undefined) {
    return (
      <>
        {renderTopContent}
        {renderLoadingContent}
      </>
    )
  }

  return (
    <>
      {renderTopContent}
      {FP.pipe(
        sequenceTOption(oDexWalletAddress, oAssetWalletAddress),
        O.fold(
          () => <ErrorView title={intl.formatMessage({ id: 'common.error' })} subTitle={'Could not get addresses'} />,
          ([dexWalletAddress, assetWalletAddress]) =>
            FP.pipe(
              assetWithDecimalRD,
              RD.fold(
                () => <></>,
                () => renderLoadingContent,
                (error) => (
                  <ErrorView
                    title={intl.formatMessage({ id: 'common.error' })}
                    subTitle={error?.message ?? error.toString()}
                  />
                ),
                (asset) => (
                  <Deposit
                    haltedChains={haltedChains}
                    mimirHalt={mimirHalt}
                    poolDetail={poolDetailRD}
                    asset={asset}
                    shares={poolSharesRD}
                    dexWalletAddress={dexWalletAddress}
                    assetWalletAddress={assetWalletAddress}
                    keystoreState={keystoreState}
                    ShareContent={ShareView}
                    SymDepositContent={SymDepositView}
                    WidthdrawContent={WithdrawDepositView}
                  />
                )
              )
            )
        )
      )}
    </>
  )
}
