import React, { useCallback, useMemo } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { BTCChain } from '@xchainjs/xchain-bitcoin'
import { Network } from '@xchainjs/xchain-client'
import { PoolDetail as PoolDetailMaya } from '@xchainjs/xchain-mayamidgard'
import { PoolDetail } from '@xchainjs/xchain-midgard'
import { THORChain } from '@xchainjs/xchain-thorchain'
import { AnyAsset, BaseAmount, bn } from '@xchainjs/xchain-util'
import BigNumber from 'bignumber.js'
import * as FP from 'fp-ts/function'
import * as O from 'fp-ts/lib/Option'
import { useObservableState } from 'observable-hooks'
import { map } from 'rxjs/operators'
import * as RxOp from 'rxjs/operators'

import { AssetRuneNative } from '../../../../shared/utils/asset'
import { Withdraw } from '../../../components/deposit/withdraw'
import { ZERO_BASE_AMOUNT, ZERO_BN } from '../../../const'
import { useAppContext } from '../../../contexts/AppContext'
import { useChainContext } from '../../../contexts/ChainContext'
import { useMidgardContext } from '../../../contexts/MidgardContext'
import { useMidgardMayaContext } from '../../../contexts/MidgardMayaContext'
import { useWalletContext } from '../../../contexts/WalletContext'
import { getAssetPoolPrice } from '../../../helpers/poolHelper'
import * as ShareHelpers from '../../../helpers/poolShareHelper'
import { liveData } from '../../../helpers/rx/liveData'
import { useDex } from '../../../hooks/useDex'
import { useOpenExplorerTxUrl } from '../../../hooks/useOpenExplorerTxUrl'
import { DEFAULT_NETWORK } from '../../../services/const'
import { PoolShare, PoolsDataMap } from '../../../services/midgard/types'
import { DEFAULT_BALANCES_FILTER } from '../../../services/wallet/const'
import { getBalanceByAsset } from '../../../services/wallet/util'
import { Props } from './WithdrawDepositView.types'

export const WithdrawDepositView: React.FC<Props> = (props): JSX.Element => {
  const {
    asset: assetWD,
    poolShare: poolShareRD,
    poolDetail: poolDetailRD,
    haltedChains,
    mimirHalt,
    assetWalletAddress,
    dexWalletAddress
  } = props
  const { decimal: assetDecimal } = assetWD
  const {
    service: {
      pools: { selectedPricePoolAsset$: selectedPricePoolAssetThor$, priceRatio$, poolsState$: poolsStateThor$ },
      shares: { reloadShares }
    }
  } = useMidgardContext()

  const {
    service: {
      pools: {
        selectedPricePoolAsset$: selectedPricePoolAssetMaya$,
        priceRatio$: priceRatioMaya$,
        poolsState$: poolsStateMaya$
      },
      shares: { reloadShares: reloadSharesMaya }
    }
  } = useMidgardMayaContext()

  const { dex } = useDex()
  const selectedPricePoolAsset$ = dex.chain === THORChain ? selectedPricePoolAssetThor$ : selectedPricePoolAssetMaya$
  const { symWithdrawFee$, reloadWithdrawFees, symWithdraw$ } = useChainContext()
  const poolsState$ = dex.chain === THORChain ? poolsStateThor$ : poolsStateMaya$
  const dexPrice = useObservableState(dex.chain === THORChain ? priceRatio$ : priceRatioMaya$, bn(1))

  const [selectedPriceAssetRD]: [RD.RemoteData<Error, AnyAsset>, unknown] = useObservableState(
    () =>
      FP.pipe(
        selectedPricePoolAsset$,
        map((asset) => RD.fromOption(asset, () => Error(''))),
        // In case there is no asset for any reason set basic RUNE asset as alt value
        map(RD.alt((): RD.RemoteData<Error, AnyAsset> => RD.success(AssetRuneNative)))
      ),
    RD.initial
  )

  const [poolsDataRD] = useObservableState(
    () =>
      FP.pipe(
        poolsState$,
        liveData.map(({ poolsData }) => poolsData)
      ),
    RD.initial
  )

  const assetPriceRD: RD.RemoteData<Error, BigNumber> = FP.pipe(
    poolDetailRD,
    // convert from RUNE price to selected pool asset price
    RD.map(getAssetPoolPrice(dexPrice))
  )

  const {
    balancesState$,
    keystoreService: { validatePassword$ },
    reloadBalances
  } = useWalletContext()

  const [balances] = useObservableState(
    () =>
      FP.pipe(
        balancesState$({
          ...DEFAULT_BALANCES_FILTER,
          [BTCChain]: 'confirmed'
        }),
        RxOp.map((state) => state.balances)
      ),
    O.none
  )

  const dexBalance: O.Option<BaseAmount> = useMemo(
    () =>
      FP.pipe(
        balances,
        O.chain(getBalanceByAsset(dex.asset)),
        O.map(({ amount }) => amount)
      ),
    [balances, dex]
  )

  const { openExplorerTxUrl: openRuneExplorerTxUrl, getExplorerTxUrl: getRuneExplorerTxUrl } = useOpenExplorerTxUrl(
    O.some(dex.chain)
  )

  const { network$ } = useAppContext()
  const network = useObservableState<Network>(network$, DEFAULT_NETWORK)

  const reloadBalancesAndShares = useCallback(() => {
    reloadBalances()
    if (dex.chain === THORChain) {
      reloadShares(5000)
    } else {
      reloadSharesMaya(5000)
    }
  }, [dex, reloadBalances, reloadShares, reloadSharesMaya])

  const renderEmptyForm = useCallback(
    () => (
      <Withdraw
        haltedChains={haltedChains}
        mimirHalt={mimirHalt}
        fees$={symWithdrawFee$}
        assetPrice={ZERO_BN}
        assetWalletAddress={assetWalletAddress}
        dexPrice={dexPrice}
        dexWalletAddress={dexWalletAddress}
        dexBalance={dexBalance}
        selectedPriceAsset={AssetRuneNative}
        shares={{ rune: ZERO_BASE_AMOUNT, asset: ZERO_BASE_AMOUNT }}
        asset={assetWD}
        reloadFees={reloadWithdrawFees}
        disabled
        validatePassword$={validatePassword$}
        openRuneExplorerTxUrl={openRuneExplorerTxUrl}
        getRuneExplorerTxUrl={getRuneExplorerTxUrl}
        reloadBalances={reloadBalancesAndShares}
        withdraw$={symWithdraw$}
        network={network}
        poolsData={{}}
        dex={dex}
      />
    ),
    [
      haltedChains,
      mimirHalt,
      symWithdrawFee$,
      assetWalletAddress,
      dexPrice,
      dexWalletAddress,
      dexBalance,
      assetWD,
      reloadWithdrawFees,
      validatePassword$,
      openRuneExplorerTxUrl,
      getRuneExplorerTxUrl,
      reloadBalancesAndShares,
      symWithdraw$,
      network,
      dex
    ]
  )

  const renderWithdrawReady = useCallback(
    ({
      assetPrice,
      poolShare: { units: liquidityUnits },
      poolDetail,
      selectedPriceAsset,
      poolsData
    }: {
      assetPrice: BigNumber
      poolShare: PoolShare
      poolDetail: PoolDetail | PoolDetailMaya
      selectedPriceAsset: AnyAsset
      poolsData: PoolsDataMap
    }) => (
      <Withdraw
        haltedChains={haltedChains}
        mimirHalt={mimirHalt}
        assetPrice={assetPrice}
        assetWalletAddress={assetWalletAddress}
        dexPrice={dexPrice}
        dexWalletAddress={dexWalletAddress}
        dexBalance={dexBalance}
        selectedPriceAsset={selectedPriceAsset}
        shares={{
          rune: ShareHelpers.getRuneShare(liquidityUnits, poolDetail, dex),
          asset: ShareHelpers.getAssetShare({ liquidityUnits, detail: poolDetail, assetDecimal })
        }}
        asset={assetWD}
        fees$={symWithdrawFee$}
        reloadFees={reloadWithdrawFees}
        validatePassword$={validatePassword$}
        openRuneExplorerTxUrl={openRuneExplorerTxUrl}
        getRuneExplorerTxUrl={getRuneExplorerTxUrl}
        reloadBalances={reloadBalancesAndShares}
        withdraw$={symWithdraw$}
        network={network}
        poolsData={poolsData}
        dex={dex}
      />
    ),
    [
      haltedChains,
      mimirHalt,
      assetWalletAddress,
      dexPrice,
      dexWalletAddress,
      dexBalance,
      assetDecimal,
      assetWD,
      symWithdrawFee$,
      reloadWithdrawFees,
      validatePassword$,
      openRuneExplorerTxUrl,
      getRuneExplorerTxUrl,
      reloadBalancesAndShares,
      symWithdraw$,
      network,
      dex
    ]
  )

  return FP.pipe(
    RD.combine(assetPriceRD, poolShareRD, poolDetailRD, selectedPriceAssetRD, poolsDataRD),
    RD.fold(
      renderEmptyForm,
      renderEmptyForm,
      renderEmptyForm,
      ([assetPrice, oPoolShare, poolDetail, selectedPriceAsset, poolsData]) =>
        FP.pipe(
          oPoolShare,
          O.fold(
            () => renderEmptyForm(),
            (poolShare) => renderWithdrawReady({ assetPrice, poolShare, poolDetail, selectedPriceAsset, poolsData })
          )
        )
    )
  )
}
