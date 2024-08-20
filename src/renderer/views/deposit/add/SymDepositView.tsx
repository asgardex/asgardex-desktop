import React, { useCallback, useEffect, useMemo } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { BTCChain } from '@xchainjs/xchain-bitcoin'
import { Network } from '@xchainjs/xchain-client'
import { AssetCacao } from '@xchainjs/xchain-mayachain'
import { THORChain } from '@xchainjs/xchain-thorchain'
import { AnyAsset, assetToString } from '@xchainjs/xchain-util'
import * as FP from 'fp-ts/function'
import * as O from 'fp-ts/lib/Option'
import { useObservableState } from 'observable-hooks'
import { useIntl } from 'react-intl'
import { useNavigate } from 'react-router-dom'

import { AssetRuneNative } from '../../../../shared/utils/asset'
import { isLedgerWallet } from '../../../../shared/utils/guard'
import { WalletType } from '../../../../shared/wallet/types'
import { SymDeposit } from '../../../components/deposit/add'
import { Alert } from '../../../components/uielements/alert'
import { ASYM_DEPOSIT_TOOL_URL, ZERO_POOL_DATA } from '../../../const'
import { useChainContext } from '../../../contexts/ChainContext'
import { useEvmContext } from '../../../contexts/EvmContext'
import { useMayachainContext } from '../../../contexts/MayachainContext'
import { useMidgardContext } from '../../../contexts/MidgardContext'
import { useMidgardMayaContext } from '../../../contexts/MidgardMayaContext'
import { useThorchainContext } from '../../../contexts/ThorchainContext'
import { useWalletContext } from '../../../contexts/WalletContext'
import { hasLedgerAddress } from '../../../helpers/addressHelper'
import { sequenceTRD } from '../../../helpers/fpHelpers'
import * as PoolHelpers from '../../../helpers/poolHelper'
import { useDex } from '../../../hooks/useDex'
import { useLedgerAddresses } from '../../../hooks/useLedgerAddresses'
import { useLiquidityProviders } from '../../../hooks/useLiquidityProviders'
import { useNetwork } from '../../../hooks/useNetwork'
import { useOpenExplorerTxUrl } from '../../../hooks/useOpenExplorerTxUrl'
import { usePricePool } from '../../../hooks/usePricePool'
import { usePricePoolMaya } from '../../../hooks/usePricePoolMaya'
import { usePrivateData } from '../../../hooks/usePrivateData'
import { useProtocolLimit } from '../../../hooks/useProtocolLimit'
import * as poolsRoutes from '../../../routes/pools'
import { PoolAddress, PoolAssetsRD } from '../../../services/midgard/types'
import { toPoolData } from '../../../services/midgard/utils'
import { DEFAULT_BALANCES_FILTER, INITIAL_BALANCES_STATE } from '../../../services/wallet/const'
import { Props } from './SymDepositView.types'

export const SymDepositView: React.FC<Props> = (props) => {
  const {
    asset: assetWD,
    poolDetail: poolDetailRD,
    mimirHalt,
    haltedChains,
    dexWalletAddress,
    assetWalletAddress
  } = props
  const { asset } = assetWD
  const navigate = useNavigate()
  const intl = useIntl()

  const { network } = useNetwork()
  const { isPrivate } = usePrivateData()

  const { dex } = useDex()

  const { reloadInboundAddresses: reloadInboundAddressesThor } = useThorchainContext()
  const { reloadInboundAddresses: reloadInboundAddressesMaya } = useMayachainContext()

  const reloadInboundAddresses = dex.chain === THORChain ? reloadInboundAddressesThor : reloadInboundAddressesMaya
  const {
    service: {
      pools: {
        availableAssets$: availableAssetsThor$,
        reloadSelectedPoolDetail: reloadSelectedPoolDetailThor,
        selectedPoolAddress$,
        poolsState$
      },
      shares: { reloadShares }
    }
  } = useMidgardContext()
  const {
    service: {
      pools: {
        availableAssets$: availableAssetsMaya$,
        reloadSelectedPoolDetail: reloadSelectedPoolDetailMaya,
        selectedPoolAddress$: selectedPoolAddressMaya$,
        poolsState$: poolsStateMaya$
      },
      shares: { reloadShares: reloadSharesMaya }
    }
  } = useMidgardMayaContext()

  const availableAssets$ = dex.chain === THORChain ? availableAssetsThor$ : availableAssetsMaya$
  const reloadSelectedPoolDetail = dex.chain === THORChain ? reloadSelectedPoolDetailThor : reloadSelectedPoolDetailMaya

  const { symDepositFees$, symDeposit$, reloadSymDepositFees, saverDeposit$: asymDeposit$ } = useChainContext()

  const poolsState = useObservableState(dex.chain === THORChain ? poolsState$ : poolsStateMaya$, RD.initial)

  const oPoolAddress: O.Option<PoolAddress> = useObservableState(
    dex.chain === THORChain ? selectedPoolAddress$ : selectedPoolAddressMaya$,
    O.none
  )

  const {
    balancesState$,
    keystoreService: { validatePassword$ },
    reloadBalancesByChain
  } = useWalletContext()

  const { ledgerAddresses } = useLedgerAddresses()

  const { data: protocolLimitRD } = useProtocolLimit()

  const pricePoolThor = usePricePool()
  const pricePoolMaya = usePricePoolMaya()

  const { approveERC20Token$, isApprovedERC20Token$, approveFee$, reloadApproveFee } = useEvmContext(asset.chain)

  // reload inbound addresses at `onMount` to get always latest `pool address` + `feeRates`
  useEffect(() => {
    reloadInboundAddresses()
  }, [dex, reloadInboundAddresses])

  const pricePool = dex.chain === THORChain ? pricePoolThor : pricePoolMaya

  const [balancesState] = useObservableState(
    () =>
      balancesState$({
        ...DEFAULT_BALANCES_FILTER,
        [BTCChain]: 'confirmed'
      }),
    INITIAL_BALANCES_STATE
  )

  const reloadBalances = useCallback(() => {
    reloadBalancesByChain(assetWD.asset.chain)()
    reloadBalancesByChain(dex.chain)()
  }, [assetWD.asset.chain, dex, reloadBalancesByChain])

  const onChangeAsset = useCallback(
    ({
      asset,
      assetWalletType,
      runeWalletType
    }: {
      asset: AnyAsset
      assetWalletType: WalletType
      runeWalletType: WalletType
    }) => {
      // Check whether ledger is still available
      // By switching assets in `SymDeposit` there is no information about that at component level
      // That's why we check it here
      // So by switching a Ledger asset, Ledger will be still selected for new selected asset in `SymDeposit` component if available
      const hasRuneLedger = hasLedgerAddress(ledgerAddresses, THORChain)
      const hasAssetLedger = hasLedgerAddress(ledgerAddresses, asset.chain)
      // If no Ledger found, use 'keystore'
      const checkedRuneWalletType = isLedgerWallet(runeWalletType) && hasRuneLedger ? 'ledger' : 'keystore'
      const checkedAssetWalletType = isLedgerWallet(assetWalletType) && hasAssetLedger ? 'ledger' : 'keystore'

      navigate(
        poolsRoutes.deposit.path({
          asset: assetToString(asset),
          assetWalletType: checkedAssetWalletType,
          runeWalletType: checkedRuneWalletType
        }),
        {
          replace: true
        }
      )
    },
    [ledgerAddresses, navigate]
  )

  useEffect(() => {
    // reload balances, whenever sourceAsset and targetAsset have been changed (both are properties of `reloadBalances` )
    reloadBalances()
  }, [reloadBalances])

  useEffect(() => {
    if (dex.chain === THORChain) {
      reloadSelectedPoolDetail()
    } else {
      reloadSelectedPoolDetailMaya()
    }
  }, [dex, reloadSelectedPoolDetail, reloadSelectedPoolDetailMaya])

  const poolAssetsRD: PoolAssetsRD = useObservableState(availableAssets$, RD.initial)

  const { openExplorerTxUrl: openAssetExplorerTxUrl, getExplorerTxUrl: getAssetExplorerTxUrl } = useOpenExplorerTxUrl(
    O.some(asset.chain)
  )

  const { openExplorerTxUrl: openRuneExplorerTxUrl, getExplorerTxUrl: getRuneExplorerTxUrl } = useOpenExplorerTxUrl(
    O.some(dex.chain)
  )

  const protocolLimitReached = useMemo(
    () =>
      FP.pipe(
        protocolLimitRD,
        RD.map(({ reached }) => reached && network !== Network.Testnet /* ignore it on testnet */),
        RD.getOrElse(() => false)
      ),
    [network, protocolLimitRD]
  )

  const { symPendingAssets, hasAsymAssets, symAssetMismatch } = useLiquidityProviders({
    asset,
    dexAssetAddress: dexWalletAddress.address,
    assetAddress: assetWalletAddress.address,
    dex
  })

  const openAsymDepositTool = useCallback(
    (): Promise<void> => window.apiUrl.openExternal(ASYM_DEPOSIT_TOOL_URL[network]),
    [network]
  )

  const renderDisabledAddDeposit = useCallback(
    (error?: Error) => (
      <>
        {error && (
          <Alert type="error" message={intl.formatMessage({ id: 'common.error' })} description={error.toString()} />
        )}
        <SymDeposit
          disableDepositAction
          validatePassword$={validatePassword$}
          openRuneExplorerTxUrl={openRuneExplorerTxUrl}
          openAssetExplorerTxUrl={openAssetExplorerTxUrl}
          getRuneExplorerTxUrl={getRuneExplorerTxUrl}
          getAssetExplorerTxUrl={getAssetExplorerTxUrl}
          onChangeAsset={FP.constVoid}
          asset={assetWD}
          walletBalances={balancesState}
          fees$={symDepositFees$}
          reloadFees={FP.constVoid}
          approveFee$={approveFee$}
          reloadApproveFee={FP.constVoid}
          pricePool={pricePool}
          disabled={true}
          poolAddress={O.none}
          reloadBalances={reloadBalances}
          reloadShares={dex.chain === THORChain ? reloadShares : reloadSharesMaya}
          reloadSelectedPoolDetail={dex.chain === THORChain ? reloadSelectedPoolDetail : reloadSelectedPoolDetailMaya}
          poolData={ZERO_POOL_DATA}
          deposit$={symDeposit$}
          asymDeposit$={asymDeposit$}
          network={network}
          approveERC20Token$={approveERC20Token$}
          isApprovedERC20Token$={isApprovedERC20Token$}
          availableAssets={[]}
          protocolLimitReached={protocolLimitReached}
          poolDetails={[]}
          poolsData={{}}
          symPendingAssets={RD.initial}
          hasAsymAssets={RD.initial}
          symAssetMismatch={RD.initial}
          openAsymDepositTool={openAsymDepositTool}
          assetWalletType={assetWalletAddress.type}
          runeWalletType={dexWalletAddress.type}
          hidePrivateData={isPrivate}
          dex={dex}
        />
      </>
    ),
    [
      intl,
      validatePassword$,
      openRuneExplorerTxUrl,
      openAssetExplorerTxUrl,
      getRuneExplorerTxUrl,
      getAssetExplorerTxUrl,
      assetWD,
      balancesState,
      symDepositFees$,
      approveFee$,
      pricePool,
      reloadBalances,
      dex,
      reloadShares,
      reloadSharesMaya,
      reloadSelectedPoolDetail,
      reloadSelectedPoolDetailMaya,
      symDeposit$,
      asymDeposit$,
      network,
      approveERC20Token$,
      isApprovedERC20Token$,
      protocolLimitReached,
      openAsymDepositTool,
      assetWalletAddress.type,
      dexWalletAddress.type,
      isPrivate
    ]
  )

  return FP.pipe(
    sequenceTRD(poolAssetsRD, poolDetailRD, poolsState),
    RD.fold(
      renderDisabledAddDeposit,
      (_) => renderDisabledAddDeposit(),
      (error) => renderDisabledAddDeposit(error),
      ([poolAssets, poolDetail, { poolsData, poolDetails }]) => {
        // Since RUNE is not part of pool assets, add it to the list of available assets
        const availableAssets = [AssetRuneNative, AssetCacao, ...poolAssets]
        const { chain } = asset
        const disableDepositAction =
          PoolHelpers.disableAllActions({ chain, haltedChains, mimirHalt }) ||
          PoolHelpers.disableTradingActions({ chain, haltedChains, mimirHalt }) ||
          PoolHelpers.disablePoolActions({ chain, haltedChains, mimirHalt })

        return (
          <>
            <SymDeposit
              disableDepositAction={disableDepositAction}
              validatePassword$={validatePassword$}
              openRuneExplorerTxUrl={openRuneExplorerTxUrl}
              openAssetExplorerTxUrl={openAssetExplorerTxUrl}
              getRuneExplorerTxUrl={getRuneExplorerTxUrl}
              getAssetExplorerTxUrl={getAssetExplorerTxUrl}
              poolData={toPoolData(poolDetail)}
              onChangeAsset={onChangeAsset}
              asset={assetWD}
              walletBalances={balancesState}
              poolAddress={oPoolAddress}
              fees$={symDepositFees$}
              reloadFees={reloadSymDepositFees}
              approveFee$={approveFee$}
              reloadApproveFee={reloadApproveFee}
              pricePool={pricePool}
              reloadBalances={reloadBalances}
              reloadShares={dex.chain === THORChain ? reloadShares : reloadSharesMaya}
              reloadSelectedPoolDetail={reloadSelectedPoolDetail}
              availableAssets={availableAssets}
              deposit$={symDeposit$}
              asymDeposit$={asymDeposit$}
              network={network}
              approveERC20Token$={approveERC20Token$}
              isApprovedERC20Token$={isApprovedERC20Token$}
              protocolLimitReached={protocolLimitReached}
              poolDetails={poolDetails}
              poolsData={poolsData}
              symPendingAssets={symPendingAssets}
              hasAsymAssets={hasAsymAssets}
              symAssetMismatch={symAssetMismatch}
              openAsymDepositTool={openAsymDepositTool}
              assetWalletType={assetWalletAddress.type}
              runeWalletType={dexWalletAddress.type}
              hidePrivateData={isPrivate}
              dex={dex}
            />
          </>
        )
      }
    )
  )
}
