import React, { useMemo, useCallback } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { Row } from 'antd'
import * as A from 'fp-ts/Array'
import * as FP from 'fp-ts/lib/function'
import * as O from 'fp-ts/Option'
import { useObservableState } from 'observable-hooks'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { ENABLED_CHAINS } from '../../../../shared/utils/chain'
import { WalletAddress, WalletAddresses } from '../../../../shared/wallet/types'
import { PoolActionsHistory } from '../../../components/poolActionsHistory'
import { historyFilterToViewblockFilter } from '../../../components/poolActionsHistory/PoolActionsHistory.helper'
import { Filter } from '../../../components/poolActionsHistory/types'
import { WalletPoolActionsHistoryHeader } from '../../../components/poolActionsHistory/WalletPoolActionsHistoryHeader'
import { RefreshButton } from '../../../components/uielements/button'
import { AssetsNav } from '../../../components/wallet/assets'
import { useChainContext } from '../../../contexts/ChainContext'
import { useWalletContext } from '../../../contexts/WalletContext'
import { eqString } from '../../../helpers/fp/eq'
import { ordWalletAddressByChain } from '../../../helpers/fp/ord'
import { useDex } from '../../../hooks/useDex'
import { useMayaMidgardHistoryActions } from '../../../hooks/useMayaMidgardHistoryActions'
import { useMidgardHistoryActions } from '../../../hooks/useMidgardHistoryActions'
import { useNetwork } from '../../../hooks/useNetwork'
import { useOpenAddressUrl } from '../../../hooks/useOpenAddressUrl'
import { useOpenExplorerTxUrl } from '../../../hooks/useOpenExplorerTxUrl'
import { ledgerAddressToWalletAddress } from '../../../services/wallet/util'

const HISTORY_FILTERS: Filter[] = ['ALL', 'SWITCH', 'DEPOSIT', 'SWAP', 'WITHDRAW', 'DONATE', 'REFUND']

export const WalletHistoryView: React.FC = () => {
  const { network } = useNetwork()
  const { dex } = useDex()

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

  const requestParams = dex.chain === 'THOR' ? requestParamsThor : requestParamsMaya

  const { openExplorerTxUrl } = useOpenExplorerTxUrl(O.some(dex.chain))

  const keystoreAddresses$ = useMemo<Rx.Observable<WalletAddresses>>(
    () =>
      FP.pipe(
        [...ENABLED_CHAINS],
        A.map(addressByChain$),
        (addresses) => Rx.combineLatest(addresses),
        RxOp.map(A.filterMap(FP.identity))
      ),
    [addressByChain$]
  )

  const { getLedgerAddress$ } = useWalletContext()

  const ledgerAddresses$ = useMemo<Rx.Observable<WalletAddresses>>(
    () =>
      FP.pipe(
        [...ENABLED_CHAINS],
        A.map((chain) => getLedgerAddress$(chain)),
        (addresses) => Rx.combineLatest(addresses),
        // Accept `successfully` added addresses only
        RxOp.map(A.filterMap(FP.identity)),
        RxOp.map(A.map(ledgerAddressToWalletAddress))
      ),
    [getLedgerAddress$]
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
            A.findFirst((address) => address.chain === dex.chain),
            O.map(({ address }) => {
              const hist =
                dex.chain === 'THOR' ? loadHistory({ addresses: [address] }) : loadHistoryMaya({ addresses: [address] })
              return hist
            })
          )
          return Rx.of(addresses)
        })
      ),
    [dex, keystoreAddresses$, ledgerAddresses$, loadHistory, loadHistoryMaya]
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

  const openAddressUrl = useOpenAddressUrl(O.some(dex.chain))

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
        setFilter={dex.chain === 'THOR' ? setFilter : setFilterMaya}
        onWalletAddressChanged={dex.chain === 'THOR' ? setAddress : setAddressMaya}
        onClickAddressIcon={openAddressUrlHandler}
        disabled={!RD.isSuccess(historyPage)}
        dex={dex}
      />
    ),
    [
      addresses,
      currentFilter,
      dex,
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
      <Row justify="end" style={{ marginBottom: '20px' }}>
        <RefreshButton
          onClick={dex.chain === 'THOR' ? reloadHistory : reloadHistoryMaya}
          disabled={loadingHistory || loadingHistoryMaya}
        />
      </Row>
      <AssetsNav />
      <PoolActionsHistory
        network={network}
        headerContent={headerContent}
        currentPage={requestParams.page + 1}
        historyPageRD={dex.chain === 'THOR' ? historyPage : historyPageMaya}
        prevHistoryPage={dex.chain === 'THOR' ? prevHistoryPage : prevHistoryPageMaya}
        openExplorerTxUrl={openExplorerTxUrl}
        changePaginationHandler={dex.chain === 'THOR' ? setPage : setPageMaya}
        reloadHistory={dex.chain === 'THOR' ? reloadHistory : reloadHistoryMaya}
      />
    </>
  )
}
