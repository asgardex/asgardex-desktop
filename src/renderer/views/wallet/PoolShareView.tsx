import React, { useCallback, useMemo, useRef, useEffect, useState } from 'react'

import { SyncOutlined } from '@ant-design/icons'
import * as RD from '@devexperts/remote-data-ts'
import { Network } from '@xchainjs/xchain-client'
import { THORChain } from '@xchainjs/xchain-thorchain'
import { Address, AnyAsset, baseAmount, BaseAmount, Chain } from '@xchainjs/xchain-util'
import { Row } from 'antd'
import * as FP from 'fp-ts/function'
import * as O from 'fp-ts/Option'
import { useObservableState } from 'observable-hooks'
import { useIntl } from 'react-intl'
import * as RxOp from 'rxjs/operators'

import { PoolShares as PoolSharesTable } from '../../components/PoolShares'
import { PoolShareTableRowData } from '../../components/PoolShares/PoolShares.types'
import { ErrorView } from '../../components/shared/error'
import { Button, RefreshButton } from '../../components/uielements/button'
import { ProtocolSwitch } from '../../components/uielements/protocolSwitch'
import { AssetsNav, TotalAssetValue } from '../../components/wallet/assets'
import { useChainContext } from '../../contexts/ChainContext'
import { useMidgardContext } from '../../contexts/MidgardContext'
import { useMidgardMayaContext } from '../../contexts/MidgardMayaContext'
import { sequenceTOption } from '../../helpers/fpHelpers'
import { RUNE_PRICE_POOL } from '../../helpers/poolHelper'
import { MAYA_PRICE_POOL } from '../../helpers/poolHelperMaya'
import { addressFromOptionalWalletAddress } from '../../helpers/walletHelper'
import { useThorchainMimirHalt } from '../../hooks/useMimirHalt'
import { useNetwork } from '../../hooks/useNetwork'
import { usePoolShares } from '../../hooks/usePoolShares'
import { useApp } from '../../store/app/hooks'
import * as H from './PoolShareView.helper'

export const PoolShareView: React.FC = (): JSX.Element => {
  const intl = useIntl()
  const { network } = useNetwork()

  const [protocol, setProtocol] = useState<Chain>(THORChain)

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
      reloadNetworkInfo
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
      reloadNetworkInfo: reloadMayaNetworkInfo
    }
  } = useMidgardMayaContext()

  const selectedPricePool$ = useMemo(
    () => (protocol === THORChain ? selectedPricePoolThor$ : selectedPricePoolMaya$),
    [protocol, selectedPricePoolMaya$, selectedPricePoolThor$]
  )
  const allPoolDetails$ = protocol === THORChain ? allPoolDetailsThor$ : allPoolDetailsMaya$
  const poolsRD = useObservableState(protocol === THORChain ? poolsState$ : mayaPoolsState$, RD.pending)
  const { addressByChain$ } = useChainContext()

  const { isPrivate } = useApp()

  useEffect(() => {
    if (protocol === THORChain) {
      reloadAllPools()
    } else {
      reloadAllMayaPools()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [oDexNativeAddress, setODexNativeAddress] = useState<O.Option<Address>>(O.none)

  useEffect(() => {
    const subscription = FP.pipe(addressByChain$(protocol), RxOp.map(addressFromOptionalWalletAddress)).subscribe(
      setODexNativeAddress
    ) // Set the state based on the observable's new value

    return () => subscription.unsubscribe() // Cleanup by unsubscribing when the component unmounts or dex changes
  }, [addressByChain$, protocol])

  const haltedChains$ = protocol === THORChain ? haltedChainsThor$ : haltedMayaChains$
  const [haltedChains] = useObservableState(() => FP.pipe(haltedChains$, RxOp.map(RD.getOrElse((): Chain[] => []))), [])
  const { mimirHalt } = useThorchainMimirHalt()
  const poolDetailsRD = useObservableState(allPoolDetails$, RD.pending)
  const { poolData: pricePoolData } = useObservableState(
    selectedPricePool$,
    protocol === THORChain ? RUNE_PRICE_POOL : MAYA_PRICE_POOL
  )
  const oPriceAsset = useObservableState<O.Option<AnyAsset>>(
    protocol === THORChain ? selectedPricePoolAsset$ : selectedPricePoolMayaAsset$,
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
        protocol === THORChain
          ? `https://runescan.io/address/${dexAddress}`
          : `https://www.mayascan.org/address/${dexAddress}`
      ),
      O.map(window.apiUrl.openExternal)
    )
  }, [protocol, network, oDexNativeAddress])

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
          protocol={protocol}
        />
      )
    },
    [haltedChains, mimirHalt, priceAsset, openExternalShareInfo, network, protocol]
  )

  const clickRefreshHandler = useCallback(() => {
    if (protocol === THORChain) {
      reloadAllPools()
      reloadNetworkInfo()
    } else {
      reloadAllMayaPools()
      reloadMayaNetworkInfo()
    }
  }, [protocol, reloadAllMayaPools, reloadAllPools, reloadMayaNetworkInfo, reloadNetworkInfo])

  const renderRefreshBtn = useMemo(
    () => (
      <Button onClick={clickRefreshHandler} typevalue="outline">
        <SyncOutlined />
        {intl.formatMessage({ id: 'common.refresh' })}
      </Button>
    ),
    [clickRefreshHandler, intl]
  )

  const { allSharesRD } = usePoolShares(protocol)

  const sharesByChain: Record<string, BaseAmount> = useMemo(() => {
    let sharesDetails = {}
    FP.pipe(
      RD.combine(allSharesRD, poolDetailsRD),
      RD.fold(
        () => {},
        () => {},
        () => {},
        ([poolShares, poolDetails]) => {
          const data = H.getPoolShareTableData(poolShares, poolDetails, pricePoolData, protocol)

          data.forEach((item) => {
            sharesDetails = {
              ...sharesDetails,
              [item.asset.chain]: baseAmount(item.runeDepositPrice.amount().plus(item.assetDepositPrice.amount()))
            }
          })
        }
      )
    )

    return sharesDetails
  }, [allSharesRD, protocol, poolDetailsRD, pricePoolData])

  console.log('SHARES BY CHAIN - ', sharesByChain)

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
            const data = H.getPoolShareTableData(poolShares, poolDetails, pricePoolData, protocol)
            previousPoolShares.current = O.some(data)
            return renderPoolSharesTable(data, false)
          }
        )
      ),
    [allSharesRD, poolDetailsRD, renderPoolSharesTable, renderRefreshBtn, pricePoolData, protocol]
  )

  const disableRefresh = useMemo(() => RD.isPending(poolsRD) || RD.isPending(allSharesRD), [allSharesRD, poolsRD])

  const refreshHandler = useCallback(() => {
    if (protocol === THORChain) {
      reloadAllPools()
    } else {
      reloadAllMayaPools()
    }
  }, [protocol, reloadAllMayaPools, reloadAllPools])

  return (
    <>
      <Row justify="space-between" className="pb-20px">
        <ProtocolSwitch protocol={protocol} setProtocol={setProtocol} />
        <RefreshButton onClick={refreshHandler} disabled={disableRefresh} />
      </Row>

      <AssetsNav />

      <TotalAssetValue
        balancesByChain={sharesByChain}
        errorsByChain={{}}
        title={intl.formatMessage({ id: 'wallet.shares.total' })}
        hidePrivateData={isPrivate}
      />
      {renderShares}
    </>
  )
}
