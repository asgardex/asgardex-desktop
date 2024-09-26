import { Fragment, useCallback, useEffect, useMemo } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { Tab } from '@headlessui/react'
import { BTCChain } from '@xchainjs/xchain-bitcoin'
import { Network } from '@xchainjs/xchain-client'
import { THORChain } from '@xchainjs/xchain-thorchain'
import { Address, AnyAsset, assetToString, baseAmount, Chain, CryptoAmount } from '@xchainjs/xchain-util'
import * as A from 'fp-ts/lib/Array'
import * as Eq from 'fp-ts/lib/Eq'
import * as FP from 'fp-ts/lib/function'
import * as O from 'fp-ts/lib/Option'
import { useObservableState } from 'observable-hooks'
import { useIntl } from 'react-intl'
import { useMatch, useNavigate, useParams } from 'react-router-dom'
import * as RxOp from 'rxjs/operators'

import { isLedgerWallet, isWalletType } from '../../../shared/utils/guard'
import { WalletType } from '../../../shared/wallet/types'
import { AddSavers } from '../../components/savers/AddSavers'
import { WithdrawSavers } from '../../components/savers/WithdrawSavers'
import { ErrorView } from '../../components/shared/error'
import { Spin } from '../../components/shared/loading'
import { BackLinkButton, FlatButton, RefreshButton } from '../../components/uielements/button'
import { useChainContext } from '../../contexts/ChainContext'
import { useEvmContext } from '../../contexts/EvmContext'
import { useMidgardContext } from '../../contexts/MidgardContext'
import { useThorchainContext } from '../../contexts/ThorchainContext'
import { useThorchainQueryContext } from '../../contexts/ThorchainQueryContext'
import { useWalletContext } from '../../contexts/WalletContext'
import { getAssetFromNullableString } from '../../helpers/assetHelper'
import { eqChain, eqNetwork, eqWalletType } from '../../helpers/fp/eq'
import { sequenceTOption, sequenceTRD } from '../../helpers/fpHelpers'
import * as PoolHelpers from '../../helpers/poolHelper'
import { addressFromOptionalWalletAddress } from '../../helpers/walletHelper'
import { useDex } from '../../hooks/useDex'
import { useMimirHalt } from '../../hooks/useMimirHalt'
import { useNetwork } from '../../hooks/useNetwork'
import { useOpenExplorerTxUrl } from '../../hooks/useOpenExplorerTxUrl'
import { usePricePool } from '../../hooks/usePricePool'
import { usePrivateData } from '../../hooks/usePrivateData'
import * as poolsRoutes from '../../routes/pools'
import { SaversRouteParams } from '../../routes/pools/savers'
import * as saversRoutes from '../../routes/pools/savers'
import { saverDepositFee$ } from '../../services/chain'
import { saverWithdrawFee$ } from '../../services/chain/fees'
import { AssetWithDecimalLD, AssetWithDecimalRD } from '../../services/chain/types'
import { PoolAddress } from '../../services/midgard/types'
import { DEFAULT_BALANCES_FILTER, INITIAL_BALANCES_STATE } from '../../services/wallet/const'
import { ledgerAddressToWalletAddress } from '../../services/wallet/util'
import { SaversDetailsView } from './SaversDetailsView'

enum TabIndex {
  ADD = 0,
  WITHDRAW = 1
}

type TabData = {
  index: TabIndex
  label: string
}

type UpdateAddress = {
  walletType: WalletType
  chain: Chain
  network: Network /* network is needed to re-trigger stream in case of network changes */
}

const eqUpdateAddress = Eq.struct<UpdateAddress>({
  walletType: eqWalletType,
  chain: eqChain,
  network: eqNetwork
})

type Props = { asset: AnyAsset; walletType: WalletType }

const Content: React.FC<Props> = (props): JSX.Element => {
  const { asset, walletType } = props

  const { chain } = asset

  const intl = useIntl()

  const navigate = useNavigate()

  const { network } = useNetwork()

  const { dex } = useDex()

  const { thorchainQuery } = useThorchainQueryContext()
  const { isPrivate } = usePrivateData()
  const { getSaverProvider$, reloadSaverProvider, reloadInboundAddresses } = useThorchainContext()

  const { assetWithDecimal$, addressByChain$, reloadSaverDepositFee, saverDeposit$, saverWithdraw$ } = useChainContext()

  const { approveERC20Token$, isApprovedERC20Token$, approveFee$, reloadApproveFee } = useEvmContext(chain)
  const {
    balancesState$,
    reloadBalancesByChain,
    getLedgerAddress$,
    keystoreService: { keystoreState$, validatePassword$ }
  } = useWalletContext()

  const keystore = useObservableState(keystoreState$, O.none)

  const {
    service: {
      pools: { poolsState$, reloadPools, reloadSelectedPoolDetail, selectedPoolAddress$, haltedChains$ },
      setSelectedPoolAsset
    }
  } = useMidgardContext()
  const oPoolAddress: O.Option<PoolAddress> = useObservableState(selectedPoolAddress$, O.none)

  const [haltedChains] = useObservableState(() => FP.pipe(haltedChains$, RxOp.map(RD.getOrElse((): Chain[] => []))), [])
  const { mimirHalt } = useMimirHalt()
  // reload inbound addresses at `onMount` to get always latest `pool address` + `feeRates`
  useEffect(() => {
    reloadInboundAddresses()
  }, [reloadInboundAddresses])

  useEffect(() => {
    // Asset is the asset of the pool we need to interact with
    // Store it in global state, all depending streams will be updated then
    setSelectedPoolAsset(O.some(asset))

    // Reset selectedPoolAsset on view's unmount to avoid effects with depending streams
    return () => {
      setSelectedPoolAsset(O.none)
    }
  }, [asset, setSelectedPoolAsset])

  const assetDecimal$: AssetWithDecimalLD = useMemo(() => assetWithDecimal$(asset), [assetWithDecimal$, asset])

  const [balancesState] = useObservableState(
    () =>
      balancesState$({
        ...DEFAULT_BALANCES_FILTER,
        [BTCChain]: 'confirmed'
      }),
    INITIAL_BALANCES_STATE
  )

  const assetRD: AssetWithDecimalRD = useObservableState(assetDecimal$, RD.initial)

  const [addressRD, updateAddress$] = useObservableState<RD.RemoteData<Error, Address>, UpdateAddress>(
    (updated$) =>
      FP.pipe(
        updated$,
        RxOp.debounceTime(300),
        RxOp.distinctUntilChanged(eqUpdateAddress.equals),
        RxOp.switchMap(({ walletType, chain }) =>
          isLedgerWallet(walletType)
            ? FP.pipe(getLedgerAddress$(chain), RxOp.map(O.map(ledgerAddressToWalletAddress)))
            : addressByChain$(chain)
        ),
        RxOp.map(addressFromOptionalWalletAddress),
        RxOp.map((oAddress) => RD.fromOption(oAddress, () => new Error(`Could not get address for ${walletType}`)))
      ),
    RD.initial
  )

  useEffect(() => {
    updateAddress$({ chain, network, walletType })
  }, [network, walletType, updateAddress$, chain])

  const { openExplorerTxUrl, getExplorerTxUrl } = useOpenExplorerTxUrl(O.some(THORChain))

  const pricePool = usePricePool()

  const poolsStateRD = useObservableState(poolsState$, RD.initial)

  const reloadHandler = useCallback(() => {
    const lazyReload = reloadBalancesByChain(chain)
    lazyReload()
    reloadSaverProvider()
  }, [chain, reloadBalancesByChain, reloadSaverProvider])

  const renderError = useCallback(
    (e: Error) => (
      <ErrorView
        className="flex h-full w-full justify-center"
        title={intl.formatMessage({ id: 'common.error' })}
        subTitle={e?.message ?? e.toString()}
        extra={
          <FlatButton size="normal" onClick={reloadPools}>
            {intl.formatMessage({ id: 'common.retry' })}
          </FlatButton>
        }
      />
    ),
    [intl, reloadPools]
  )

  const onChangeAssetHandler = useCallback(
    ({ source, sourceWalletType }: { source: AnyAsset; sourceWalletType: WalletType }) => {
      const path = saversRoutes.earn.path({
        asset: assetToString(source),
        walletType: sourceWalletType
      })
      navigate(path, { replace: true })
    },
    [navigate]
  )

  const matchAddRoute = useMatch({
    path: saversRoutes.earn.path({ asset: assetToString(asset), walletType }),
    end: false
  })
  const matchWithdrawRoute = useMatch({
    path: saversRoutes.withdraw.path({ asset: assetToString(asset), walletType }),
    end: false
  })

  const selectedIndex: number = useMemo(() => {
    if (matchAddRoute) {
      return TabIndex.ADD
    } else if (matchWithdrawRoute) {
      return TabIndex.WITHDRAW
    } else {
      return TabIndex.ADD
    }
  }, [matchAddRoute, matchWithdrawRoute])

  const tabs = useMemo(
    (): TabData[] => [
      {
        index: TabIndex.ADD,
        label: intl.formatMessage({ id: 'common.earn' })
      },
      {
        index: TabIndex.WITHDRAW,
        label: intl.formatMessage({ id: 'common.withdraw' })
      }
    ],
    [intl]
  )

  // Important note:
  // DON'T use `INITIAL_KEYSTORE_STATE` as default value for `keystoreState`
  // Because `useObservableState` will set its state NOT before first rendering loop,
  // and `AddWallet` would be rendered for the first time,
  // before a check of `keystoreState` can be done
  const keystoreState = useObservableState(keystoreState$, undefined)

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
    return <>{renderLoadingContent}</>
  }
  return (
    <>
      <div className=" relative mb-20px flex items-center justify-between">
        <BackLinkButton className="absolute !m-0" path={poolsRoutes.savers.path()} />
        <h2 className="m-0 w-full text-center font-mainSemiBold text-16 uppercase text-turquoise">
          {intl.formatMessage({ id: 'common.earn' })}
        </h2>
        <RefreshButton className="absolute right-0" onClick={reloadHandler} />
      </div>

      <div className="flex h-screen flex-col items-center justify-center ">
        {FP.pipe(
          sequenceTRD(poolsStateRD, assetRD, addressRD),
          RD.fold(
            () => renderLoadingContent,
            () => renderLoadingContent,
            renderError,
            ([{ poolDetails, assetDetails }, assetWD, address]) => {
              const poolAssets: AnyAsset[] = FP.pipe(
                assetDetails,
                A.map(({ asset }) => asset)
              )
              const disableAllPoolActions = (chain: Chain) =>
                PoolHelpers.disableAllActions({ chain, haltedChains, mimirHalt })

              const disableTradingPoolActions = (chain: Chain) =>
                PoolHelpers.disableTradingActions({ chain, haltedChains, mimirHalt })

              const checkDisableSaverAction = () => {
                return disableAllPoolActions(chain) || disableTradingPoolActions(chain)
              }
              const getTabContentByIndex = (index: number) => {
                switch (index) {
                  case TabIndex.ADD:
                    return (
                      <AddSavers
                        keystore={keystore}
                        validatePassword$={validatePassword$}
                        thorchainQuery={thorchainQuery}
                        goToTransaction={openExplorerTxUrl}
                        getExplorerTxUrl={getExplorerTxUrl}
                        sourceWalletType={walletType}
                        poolDetails={poolDetails}
                        poolAssets={poolAssets}
                        walletBalances={balancesState}
                        network={network}
                        asset={new CryptoAmount(baseAmount(0, assetWD.decimal), assetWD.asset)}
                        pricePool={pricePool}
                        fees$={saverDepositFee$}
                        address={address}
                        reloadBalances={reloadHandler}
                        approveFee$={approveFee$}
                        reloadApproveFee={reloadApproveFee}
                        reloadFees={reloadSaverDepositFee}
                        reloadSelectedPoolDetail={reloadSelectedPoolDetail}
                        isApprovedERC20Token$={isApprovedERC20Token$}
                        approveERC20Token$={approveERC20Token$}
                        poolAddress={oPoolAddress}
                        saverDeposit$={saverDeposit$}
                        hidePrivateData={isPrivate}
                        onChangeAsset={onChangeAssetHandler}
                        disableSaverAction={checkDisableSaverAction()}
                        dex={dex}
                      />
                    )
                  case TabIndex.WITHDRAW:
                    return (
                      <WithdrawSavers
                        keystore={keystore}
                        poolDetails={poolDetails}
                        thorchainQuery={thorchainQuery}
                        asset={new CryptoAmount(baseAmount(0, assetWD.decimal), assetWD.asset)}
                        walletBalances={balancesState}
                        network={network}
                        pricePool={pricePool}
                        fees$={saverWithdrawFee$}
                        address={address}
                        validatePassword$={validatePassword$}
                        goToTransaction={openExplorerTxUrl}
                        getExplorerTxUrl={getExplorerTxUrl}
                        sourceWalletType={walletType}
                        poolAssets={poolAssets}
                        reloadBalances={reloadHandler}
                        approveFee$={approveFee$}
                        reloadApproveFee={reloadApproveFee}
                        reloadFees={reloadSaverDepositFee}
                        reloadSelectedPoolDetail={reloadSelectedPoolDetail}
                        isApprovedERC20Token$={isApprovedERC20Token$}
                        approveERC20Token$={approveERC20Token$}
                        poolAddress={oPoolAddress}
                        saverWithdraw$={saverWithdraw$}
                        hidePrivateData={isPrivate}
                        onChangeAsset={onChangeAssetHandler}
                        saverPosition={getSaverProvider$}
                        disableSaverAction={checkDisableSaverAction()}
                        dex={dex}
                      />
                    )
                  default:
                    return <>`Unknown tab content (index ${index})`</>
                }
              }
              return (
                <div className="flex min-h-full w-full">
                  <div className="flex min-h-full w-full flex-col xl:flex-row">
                    <div className="min-h-auto flex w-full flex-col bg-bg0 dark:bg-bg0d xl:min-h-full xl:w-2/3">
                      <Tab.Group
                        selectedIndex={selectedIndex}
                        onChange={(index) => {
                          switch (index) {
                            case TabIndex.ADD:
                              navigate(saversRoutes.earn.path({ asset: assetToString(asset), walletType }))
                              break
                            case TabIndex.WITHDRAW:
                              navigate(saversRoutes.withdraw.path({ asset: assetToString(asset), walletType }))
                              break
                            default:
                            // nothing to do
                          }
                        }}>
                        <Tab.List className="mb-10px flex w-full justify-center border-b border-gray1 dark:border-gray1d">
                          {FP.pipe(
                            tabs,
                            A.map(({ index, label }) => (
                              <Tab key={index} as={Fragment}>
                                {({ selected }) => (
                                  <div
                                    className="
                                      group
                                      flex
                                      cursor-pointer
                                      items-center
                                      justify-center
                                      last:ml-20px
                                      focus-visible:outline-none
                                      ">
                                    <span
                                      className={`
                                        border-y-[2px] border-solid border-transparent
                                        group-hover:border-b-turquoise
                                        ${selected ? 'border-b-turquoise' : 'border-b-transparent'}
                                        ease px-20px
                                        py-[16px]
                                        font-mainSemiBold text-[16px]
                                        uppercase

                                        ${selected ? 'text-turquoise' : 'text-text2 dark:text-text2d'}
                                      hover:text-turquoise`}>
                                      {label}
                                    </span>
                                  </div>
                                )}
                              </Tab>
                            ))
                          )}
                        </Tab.List>
                        <Tab.Panels className="mt-2 flex w-full justify-center">
                          {FP.pipe(
                            tabs,
                            A.map(({ index }) => (
                              <Tab.Panel key={`content-${index}`}>{getTabContentByIndex(index)}</Tab.Panel>
                            ))
                          )}
                        </Tab.Panels>
                      </Tab.Group>
                    </div>
                    <div className="min-h-auto ml-0 mt-20px flex w-full bg-bg0 dark:bg-bg0d xl:ml-20px xl:mt-0 xl:min-h-full xl:w-1/3">
                      <SaversDetailsView asset={asset} address={address} poolDetails={poolDetails} />
                    </div>
                  </div>
                </div>
              )
            }
          )
        )}
      </div>
    </>
  )
}

export const SaversView: React.FC = (): JSX.Element => {
  const { asset, walletType } = useParams<SaversRouteParams>()

  const oWalletType = useMemo(() => FP.pipe(walletType, O.fromPredicate(isWalletType)), [walletType])
  const oAsset: O.Option<AnyAsset> = useMemo(() => getAssetFromNullableString(asset), [asset])

  const intl = useIntl()

  return FP.pipe(
    sequenceTOption(oAsset, oWalletType),
    O.fold(
      () => (
        <ErrorView
          title={intl.formatMessage(
            { id: 'routes.invalid.params' },
            {
              params: `asset: ${asset}, walletType: ${walletType}`
            }
          )}
        />
      ),
      ([asset, walletType]) => <Content asset={asset} walletType={walletType} />
    )
  )
}
