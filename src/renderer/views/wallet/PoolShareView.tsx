import React, { useCallback, useMemo, useRef, useEffect, useState } from 'react'

import { SyncOutlined } from '@ant-design/icons'
import * as RD from '@devexperts/remote-data-ts'
import { Network } from '@xchainjs/xchain-client'
import { MAYAChain } from '@xchainjs/xchain-mayachain'
import { THORChain } from '@xchainjs/xchain-thorchain'
import { Address, Asset, Chain } from '@xchainjs/xchain-util'
import { Row } from 'antd'
import * as A from 'fp-ts/Array'
import * as FP from 'fp-ts/function'
import * as O from 'fp-ts/Option'
import { useObservableState } from 'observable-hooks'
import { useIntl } from 'react-intl'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { ENABLED_CHAINS, getChainsForDex } from '../../../shared/utils/chain'
import { PoolShares as PoolSharesTable } from '../../components/PoolShares'
import { PoolShareTableRowData } from '../../components/PoolShares/PoolShares.types'
import { ErrorView } from '../../components/shared/error'
import { Button, RefreshButton } from '../../components/uielements/button'
import { AssetsNav, TotalValue } from '../../components/wallet/assets'
import { useChainContext } from '../../contexts/ChainContext'
import { useMidgardContext } from '../../contexts/MidgardContext'
import { useMidgardMayaContext } from '../../contexts/MidgardMayaContext'
import { useWalletContext } from '../../contexts/WalletContext'
import { isMayaChain, isThorChain } from '../../helpers/chainHelper'
import { sequenceTOption } from '../../helpers/fpHelpers'
import { RUNE_PRICE_POOL } from '../../helpers/poolHelper'
import { MAYA_PRICE_POOL } from '../../helpers/poolHelperMaya'
import { addressFromOptionalWalletAddress, addressFromWalletAddress } from '../../helpers/walletHelper'
import { useDex } from '../../hooks/useDex'
import { useMimirHalt } from '../../hooks/useMimirHalt'
import { useNetwork } from '../../hooks/useNetwork'
import { usePrivateData } from '../../hooks/usePrivateData'
// import { WalletAddress$ } from '../../services/clients/types'
import { PoolSharesRD } from '../../services/midgard/types'
import { ledgerAddressToWalletAddress } from '../../services/wallet/util'
import { BaseAmountRD } from '../../types'
import * as H from './PoolShareView.helper'

export const PoolShareView: React.FC = (): JSX.Element => {
  const intl = useIntl()
  const { dex } = useDex()
  const { network } = useNetwork()

  const {
    service: {
      pools: {
        allPoolDetails$: allPoolDetailsThor$,
        poolsState$,
        selectedPricePool$: selectedPricePoolThor$,
        selectedPricePoolAsset$,
        reloadAllPools,
        haltedChains$: haltedChainsThor$
      },
      reloadNetworkInfo,
      shares: { allSharesByAddresses$: allSharesByAddressesThor$, reloadAllSharesByAddresses }
    }
  } = useMidgardContext()

  const {
    service: {
      pools: {
        allPoolDetails$: allPoolDetailsMaya$,
        poolsState$: mayaPoolsState$,
        selectedPricePool$: selectedPricePoolMaya$,
        selectedPricePoolAsset$: selectedPricePoolMayaAsset$,
        reloadAllPools: reloadAllMayaPools,
        haltedChains$: haltedMayaChains$
      },
      reloadNetworkInfo: reloadMayaNetworkInfo,
      shares: {
        allSharesByAddresses$: allSharesByAddressesMaya$,
        reloadAllSharesByAddresses: reloadAllSharesByAddressesMaya
      }
    }
  } = useMidgardMayaContext()

  const selectedPricePool$ = useMemo(
    () => (dex === 'THOR' ? selectedPricePoolThor$ : selectedPricePoolMaya$),
    [dex, selectedPricePoolMaya$, selectedPricePoolThor$]
  )
  const [selectedPricePool] = useObservableState(
    () => selectedPricePool$,
    dex === 'THOR' ? RUNE_PRICE_POOL : MAYA_PRICE_POOL
  )
  const allPoolDetails$ = dex === 'THOR' ? allPoolDetailsThor$ : allPoolDetailsMaya$
  const poolsRD = useObservableState(dex === 'THOR' ? poolsState$ : mayaPoolsState$, RD.pending)

  const allSharesByAddresses$ = dex === 'THOR' ? allSharesByAddressesThor$ : allSharesByAddressesMaya$

  const { addressByChain$ } = useChainContext()

  const { getLedgerAddress$ } = useWalletContext()

  const { isPrivate } = usePrivateData()

  useEffect(() => {
    if (dex === 'THOR') {
      reloadAllPools()
    } else {
      reloadAllMayaPools()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [oDexNativeAddress, setODexNativeAddress] = useState<O.Option<Address>>(O.none)

  useEffect(() => {
    const subscription = FP.pipe(
      addressByChain$(dex === 'THOR' ? THORChain : MAYAChain),
      RxOp.map(addressFromOptionalWalletAddress)
    ).subscribe(setODexNativeAddress) // Set the state based on the observable's new value

    return () => subscription.unsubscribe() // Cleanup by unsubscribing when the component unmounts or dex changes
  }, [addressByChain$, dex])

  const [allSharesRD, setAllSharesRD] = useState<PoolSharesRD>(RD.initial)

  useEffect(() => {
    const INCLUDED_CHAINS = getChainsForDex(dex) // React to `dex` changes

    const addresses$ = FP.pipe(
      [...ENABLED_CHAINS],
      A.filter(
        (chain) => INCLUDED_CHAINS.includes(chain) && (dex === 'THOR' ? !isThorChain(chain) : !isMayaChain(chain))
      ),
      A.map(addressByChain$)
    )

    const ledgerAddresses$ = FP.pipe(
      [...ENABLED_CHAINS],
      A.filter((chain) => INCLUDED_CHAINS.includes(chain) && !isThorChain(chain)),
      A.map((chain) => getLedgerAddress$(chain)),
      A.map(RxOp.map(FP.flow(O.map(ledgerAddressToWalletAddress))))
    )

    const subscription = FP.pipe(
      Rx.combineLatest([...addresses$, ...ledgerAddresses$]),
      RxOp.switchMap(FP.flow(A.filterMap(FP.identity), A.map(addressFromWalletAddress), allSharesByAddresses$))
    ).subscribe((result) => setAllSharesRD(result))

    // Cleanup observable subscription
    return () => subscription.unsubscribe()
  }, [addressByChain$, allSharesByAddresses$, dex, getLedgerAddress$]) // `dex` is the dependency we're tracking for changes

  const haltedChains$ = dex === 'THOR' ? haltedChainsThor$ : haltedMayaChains$
  const [haltedChains] = useObservableState(() => FP.pipe(haltedChains$, RxOp.map(RD.getOrElse((): Chain[] => []))), [])
  const { mimirHalt } = useMimirHalt()
  const poolDetailsRD = useObservableState(allPoolDetails$, RD.pending)
  const { poolData: pricePoolData } = useObservableState(
    selectedPricePool$,
    dex === 'THOR' ? RUNE_PRICE_POOL : MAYA_PRICE_POOL
  )
  const oPriceAsset = useObservableState<O.Option<Asset>>(
    dex === 'THOR' ? selectedPricePoolAsset$ : selectedPricePoolMayaAsset$,
    O.none
  )
  const priceAsset = FP.pipe(oPriceAsset, O.toUndefined)

  // store previous data of pools to render these while reloading
  const previousPoolShares = useRef<O.Option<PoolShareTableRowData[]>>(O.none)

  const openExternalShareInfo = useCallback(() => {
    // `thoryield.com` does not support testnet, we ignore it here
    const oMainnet = O.fromPredicate<Network>(() => network === Network.Mainnet)(network)

    return FP.pipe(
      sequenceTOption(oDexNativeAddress, oMainnet),
      O.map(([dexAddress, _]) =>
        dex === 'THOR'
          ? `https://app.thoryield.com/accounts?thor=${dexAddress}`
          : `https://www.mayascan.org/address/${dexAddress}`
      ),
      O.map(window.apiUrl.openExternal)
    )
  }, [dex, network, oDexNativeAddress])

  const renderPoolSharesTable = useCallback(
    (data: PoolShareTableRowData[], loading: boolean) => {
      previousPoolShares.current = O.some(data)
      return (
        <PoolSharesTable
          haltedChains={haltedChains}
          mimirHalt={mimirHalt}
          loading={loading}
          data={data}
          priceAsset={priceAsset}
          openShareInfo={openExternalShareInfo}
          network={network}
          dex={dex}
        />
      )
    },
    [haltedChains, mimirHalt, priceAsset, openExternalShareInfo, network, dex]
  )

  const clickRefreshHandler = useCallback(() => {
    if (dex === 'THOR') {
      reloadAllPools()
      reloadNetworkInfo()
    } else {
      reloadAllMayaPools()
      reloadMayaNetworkInfo()
    }
  }, [dex, reloadAllMayaPools, reloadAllPools, reloadMayaNetworkInfo, reloadNetworkInfo])

  const renderRefreshBtn = useMemo(
    () => (
      <Button onClick={clickRefreshHandler} typevalue="outline">
        <SyncOutlined />
        {intl.formatMessage({ id: 'common.refresh' })}
      </Button>
    ),
    [clickRefreshHandler, intl]
  )

  const renderSharesTotal = useMemo(() => {
    const sharesTotalRD: BaseAmountRD = FP.pipe(
      RD.combine(allSharesRD, poolDetailsRD),
      RD.map(([poolShares, poolDetails]) => H.getSharesTotal(poolShares, poolDetails, pricePoolData, dex))
    )
    return (
      <TotalValue
        total={sharesTotalRD}
        pricePool={selectedPricePool}
        title={intl.formatMessage({ id: 'wallet.shares.total' })}
        hidePrivateData={isPrivate}
      />
    )
  }, [allSharesRD, dex, intl, isPrivate, poolDetailsRD, pricePoolData, selectedPricePool])

  const renderShares = useMemo(
    () =>
      FP.pipe(
        RD.combine(allSharesRD, poolDetailsRD),
        RD.fold(
          // initial state
          () => renderPoolSharesTable([], false),
          // loading state
          () => {
            const data: PoolShareTableRowData[] = FP.pipe(
              previousPoolShares.current,
              O.getOrElse<PoolShareTableRowData[]>(() => [])
            )
            return renderPoolSharesTable(data, true)
          },
          // error state
          (error: Error) => {
            const msg = error?.toString() ?? ''
            return <ErrorView title={msg} extra={renderRefreshBtn} />
          },
          // success state
          ([poolShares, poolDetails]) => {
            const data = H.getPoolShareTableData(poolShares, poolDetails, pricePoolData, dex)
            previousPoolShares.current = O.some(data)
            return renderPoolSharesTable(data, false)
          }
        )
      ),
    [allSharesRD, poolDetailsRD, renderPoolSharesTable, renderRefreshBtn, pricePoolData, dex]
  )

  const disableRefresh = useMemo(() => RD.isPending(poolsRD) || RD.isPending(allSharesRD), [allSharesRD, poolsRD])

  const refreshHandler = useCallback(() => {
    if (dex === 'THOR') {
      reloadAllPools()
      reloadAllSharesByAddresses()
    } else {
      reloadAllMayaPools()
      reloadAllSharesByAddressesMaya()
    }
  }, [dex, reloadAllMayaPools, reloadAllPools, reloadAllSharesByAddresses, reloadAllSharesByAddressesMaya])

  return (
    <>
      <Row justify="end" style={{ marginBottom: '20px' }}>
        <RefreshButton onClick={refreshHandler} disabled={disableRefresh} />
      </Row>
      <AssetsNav />
      {renderSharesTotal}
      {renderShares}
    </>
  )
}
