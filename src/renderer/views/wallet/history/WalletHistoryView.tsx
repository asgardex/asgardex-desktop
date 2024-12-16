import React, { useMemo, useCallback, useState, useEffect } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { THORChain } from '@xchainjs/xchain-thorchain'
import { Chain } from '@xchainjs/xchain-util'
import { Row } from 'antd'
import * as A from 'fp-ts/Array'
import * as FP from 'fp-ts/lib/function'
import * as O from 'fp-ts/Option'
import { useObservableState } from 'observable-hooks'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { EnabledChain } from '../../../../shared/utils/chain'
import { WalletAddress, WalletAddresses } from '../../../../shared/wallet/types'
import { PoolActionsHistory } from '../../../components/poolActionsHistory'
import { historyFilterToViewblockFilter } from '../../../components/poolActionsHistory/PoolActionsHistory.helper'
import { Filter } from '../../../components/poolActionsHistory/types'
import { WalletPoolActionsHistoryHeader } from '../../../components/poolActionsHistory/WalletPoolActionsHistoryHeader'
import { RefreshButton } from '../../../components/uielements/button'
import { ProtocolSwitch } from '../../../components/uielements/protocolSwitch'
import { AssetsNav } from '../../../components/wallet/assets'
import { useChainContext } from '../../../contexts/ChainContext'
import { useWalletContext } from '../../../contexts/WalletContext'
import { eqString } from '../../../helpers/fp/eq'
import { ordWalletAddressByChain } from '../../../helpers/fp/ord'
import { useMayaMidgardHistoryActions } from '../../../hooks/useMayaMidgardHistoryActions'
import { useMidgardHistoryActions } from '../../../hooks/useMidgardHistoryActions'
import { useNetwork } from '../../../hooks/useNetwork'
import { useOpenAddressUrl } from '../../../hooks/useOpenAddressUrl'
import { useOpenExplorerTxUrl } from '../../../hooks/useOpenExplorerTxUrl'
import { userChains$ } from '../../../services/storage/userChains'
import { ledgerAddressToWalletAddress } from '../../../services/wallet/util'

const HISTORY_FILTERS: Filter[] = ['ALL', 'SEND', 'DEPOSIT', 'SWAP', 'WITHDRAW', 'DONATE', 'REFUND', 'RUNEPOOLDEPOSIT']

export const WalletHistoryView: React.FC = () => {
  const [protocol, setProtocol] = useState<Chain>(THORChain)
  const { network } = useNetwork()

  const { addressByChain$ } = useChainContext()

  const {
    requestParams: requestParamsThor,
    loadHistory,
    reloadHistory,
    historyPage,
    prevHistoryPage,
    setFilter,
    setAddress,
    setPage,
    loading: loadingHistory
  } = useMidgardHistoryActions(10)

  const {
    requestParams: requestParamsMaya,
    loadHistory: loadHistoryMaya,
    reloadHistory: reloadHistoryMaya,
    historyPage: historyPageMaya,
    prevHistoryPage: prevHistoryPageMaya,
    setFilter: setFilterMaya,
    setAddress: setAddressMaya,
    setPage: setPageMaya,
    loading: loadingHistoryMaya
  } = useMayaMidgardHistoryActions(10)

  const requestParams = protocol === THORChain ? requestParamsThor : requestParamsMaya

  const { openExplorerTxUrl } = useOpenExplorerTxUrl(O.some(protocol))

  const [enabledChains, setEnabledChains] = useState<EnabledChain[]>([])

  useEffect(() => {
    const subscription = userChains$.subscribe(setEnabledChains)
    return () => subscription.unsubscribe()
  }, [])

  const keystoreAddresses$ = useMemo<Rx.Observable<WalletAddresses>>(
    () =>
      FP.pipe(
        [...enabledChains],
        A.map(addressByChain$),
        (addresses) => Rx.combineLatest(addresses),
        RxOp.map(A.filterMap(FP.identity))
      ),
    [enabledChains, addressByChain$]
  )

  const { getLedgerAddress$ } = useWalletContext()

  const ledgerAddresses$ = useMemo<Rx.Observable<WalletAddresses>>(
    () =>
      FP.pipe(
        [...enabledChains],
        A.map((chain) => getLedgerAddress$(chain)),
        (addresses) => Rx.combineLatest(addresses),
        // Accept `successfully` added addresses only
        RxOp.map(A.filterMap(FP.identity)),
        RxOp.map(A.map(ledgerAddressToWalletAddress))
      ),
    [enabledChains, getLedgerAddress$]
  )

  const addresses$ = useMemo(
    () =>
      FP.pipe(
        Rx.combineLatest([keystoreAddresses$, ledgerAddresses$]),
        RxOp.map(A.flatten),
        RxOp.map(A.sort(ordWalletAddressByChain)),
        RxOp.switchMap((addresses) => {
          FP.pipe(
            addresses,
            // Get first address by default
            A.findFirst((address) => address.chain === protocol),
            O.map(({ address }) => {
              const hist =
                protocol === THORChain
                  ? loadHistory({ addresses: [address] })
                  : loadHistoryMaya({ addresses: [address] })
              return hist
            })
          )
          return Rx.of(addresses)
        })
      ),
    [protocol, keystoreAddresses$, ledgerAddresses$, loadHistory, loadHistoryMaya]
  )

  const addresses = useObservableState(addresses$, [])

  const currentFilter = useMemo(() => requestParams.type || 'ALL', [requestParams])

  const oSelectedWalletAddress: O.Option<WalletAddress> = useMemo(
    () =>
      FP.pipe(
        requestParams.addresses,
        O.fromNullable,
        O.chain(A.head),
        O.chain((paramAddress) =>
          FP.pipe(
            addresses,
            A.findFirst(({ address }) => {
              const addrs = eqString.equals(address, paramAddress)
              return addrs
            })
          )
        )
      ),
    [addresses, requestParams.addresses]
  )

  const openAddressUrl = useOpenAddressUrl(O.some(protocol))

  const openAddressUrlHandler = useCallback(() => {
    FP.pipe(
      oSelectedWalletAddress,
      O.map(({ address }) => {
        // add extra params for selected filter
        const searchParam = { param: 'txsType', value: historyFilterToViewblockFilter(currentFilter) }
        openAddressUrl(address, [searchParam])
        return true
      })
    )
  }, [currentFilter, oSelectedWalletAddress, openAddressUrl])

  const headerContent = useMemo(
    () => (
      <WalletPoolActionsHistoryHeader
        addresses={addresses}
        selectedAddress={oSelectedWalletAddress}
        network={network}
        availableFilters={HISTORY_FILTERS}
        currentFilter={currentFilter}
        setFilter={protocol === THORChain ? setFilter : setFilterMaya}
        onWalletAddressChanged={protocol === THORChain ? setAddress : setAddressMaya}
        onClickAddressIcon={openAddressUrlHandler}
        disabled={!RD.isSuccess(historyPage)}
        protocol={protocol}
      />
    ),
    [
      addresses,
      currentFilter,
      protocol,
      historyPage,
      network,
      oSelectedWalletAddress,
      openAddressUrlHandler,
      setAddress,
      setAddressMaya,
      setFilter,
      setFilterMaya
    ]
  )

  return (
    <>
      <Row justify="space-between" style={{ marginBottom: '20px' }}>
        <ProtocolSwitch protocol={protocol} setProtocol={setProtocol} />
        <RefreshButton
          onClick={protocol === THORChain ? reloadHistory : reloadHistoryMaya}
          disabled={loadingHistory || loadingHistoryMaya}
        />
      </Row>
      <AssetsNav />
      <PoolActionsHistory
        network={network}
        headerContent={headerContent}
        currentPage={requestParams.page + 1}
        historyPageRD={protocol === THORChain ? historyPage : historyPageMaya}
        prevHistoryPage={protocol === THORChain ? prevHistoryPage : prevHistoryPageMaya}
        openExplorerTxUrl={openExplorerTxUrl}
        changePaginationHandler={protocol === THORChain ? setPage : setPageMaya}
        reloadHistory={protocol === THORChain ? reloadHistory : reloadHistoryMaya}
      />
    </>
  )
}
