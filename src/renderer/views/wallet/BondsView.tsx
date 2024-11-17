import React, { useCallback, useEffect, useMemo, useState } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { Network } from '@xchainjs/xchain-client'
import { AssetCacao, MAYAChain } from '@xchainjs/xchain-mayachain'
import { Client as MayachainClient } from '@xchainjs/xchain-mayachain'
import { Client as ThorchainClient, THORChain, AssetRuneNative } from '@xchainjs/xchain-thorchain'
import { Address, assetAmount, assetToBase, baseToAsset, formatAssetAmountCurrency } from '@xchainjs/xchain-util'
import { Row } from 'antd'
import * as FP from 'fp-ts/function'
import * as O from 'fp-ts/Option'
import { useObservableState } from 'observable-hooks'
import { useIntl } from 'react-intl'
import { useNavigate } from 'react-router-dom'

import * as Styled from '../../../renderer/components/wallet/assets/TotalValue.styles'
import { WalletType } from '../../../shared/wallet/types'
import { Bonds } from '../../components/Bonds'
import { RefreshButton } from '../../components/uielements/button'
import { AssetsNav } from '../../components/wallet/assets'
import { useAppContext } from '../../contexts/AppContext'
import { useMayachainContext } from '../../contexts/MayachainContext'
import { useMidgardContext } from '../../contexts/MidgardContext'
import { useMidgardMayaContext } from '../../contexts/MidgardMayaContext'
import { useThorchainContext } from '../../contexts/ThorchainContext'
import { useUserNodesContext } from '../../contexts/UserNodesContext'
import { useWalletContext } from '../../contexts/WalletContext'
import { isUSDAsset } from '../../helpers/assetHelper'
import { RUNE_PRICE_POOL } from '../../helpers/poolHelper'
import { MAYA_PRICE_POOL } from '../../helpers/poolHelperMaya'
import { hiddenString } from '../../helpers/stringHelper'
import { filterWalletBalancesByAssets } from '../../helpers/walletHelper'
import { useNodeInfos } from '../../hooks/useNodeInfos'
import { useValidateAddress } from '../../hooks/useValidateAddress'
import * as walletRoutes from '../../routes/wallet'
import { DEFAULT_NETWORK } from '../../services/const'
import { NodeInfo as NodeInfoMaya } from '../../services/mayachain/types'
import {
  addBondProvidersAddress,
  removeBondProvidersByAddress,
  userBondProviders$
} from '../../services/storage/userBondProviders'
import { NodeInfo } from '../../services/thorchain/types'
import { balancesState$ } from '../../services/wallet'
import { DEFAULT_BALANCES_FILTER, INITIAL_BALANCES_STATE } from '../../services/wallet/const'
import { WalletBalances } from '../../services/wallet/types'
import { useApp } from '../../store/app/hooks'
import { getValueOfRuneInAsset } from '../pools/Pools.utils'

export type WalletAddressInfo = {
  address: string
  walletType: WalletType
}

export const BondsView: React.FC = (): JSX.Element => {
  const { client$, getNodeInfos$, reloadNodeInfos: reloadNodeInfosThor } = useThorchainContext()
  const {
    client$: clientMaya$,
    getNodeInfos$: getNodeInfosMaya$,
    reloadNodeInfos: reloadNodeInfosMaya
  } = useMayachainContext()

  const {
    service: {
      pools: { selectedPricePool$: selectedPricePoolThor$ }
    }
  } = useMidgardContext()

  const {
    service: {
      pools: { selectedPricePool$: selectedPricePoolMaya$ }
    }
  } = useMidgardMayaContext()
  const { userNodes$, addNodeAddress, removeNodeByAddress: removeNodeByAddressService } = useUserNodesContext()
  const { network$ } = useAppContext()
  const intl = useIntl()
  const { isPrivate } = useApp()
  const navigate = useNavigate()
  const { setSelectedAsset } = useWalletContext()
  const network = useObservableState<Network>(network$, DEFAULT_NETWORK)
  const oClientThor = useObservableState<O.Option<ThorchainClient>>(client$, O.none)
  const oClientMaya = useObservableState<O.Option<MayachainClient>>(clientMaya$, O.none)
  const [balancesState] = useObservableState(
    () =>
      balancesState$({
        ...DEFAULT_BALANCES_FILTER
      }),
    INITIAL_BALANCES_STATE
  )
  // State for selected price pools
  const [selectedPricePoolThor] = useObservableState(() => selectedPricePoolThor$, RUNE_PRICE_POOL)
  const [selectedPricePoolMaya] = useObservableState(() => selectedPricePoolMaya$, MAYA_PRICE_POOL)

  // Separate price pool data states for each chain
  const { poolData: pricePoolDataThor } = useObservableState(selectedPricePoolThor$, RUNE_PRICE_POOL)
  const { poolData: pricePoolDataMaya } = useObservableState(selectedPricePoolMaya$, MAYA_PRICE_POOL)
  const { balances: oWalletBalances } = balancesState
  const allBalances: WalletBalances = useMemo(() => {
    return FP.pipe(
      oWalletBalances,
      O.map((balances) => filterWalletBalancesByAssets(balances, [AssetRuneNative, AssetCacao])),
      O.getOrElse<WalletBalances>(() => [])
    )
  }, [oWalletBalances])
  // Subscribe to `userBondProviders$` to get the bond provider watch list
  const bondProviderWatchList = useObservableState(userBondProviders$, [])

  const { validateAddress: validateAddressThor } = useValidateAddress(THORChain)
  const { validateAddress: validateAddressMaya } = useValidateAddress(MAYAChain)

  // State to track fetched wallet addresses
  const [walletAddresses, setWalletAddresses] = useState<Record<'THOR' | 'MAYA', WalletAddressInfo[]>>({
    THOR: [],
    MAYA: []
  })

  // State to track if wallet addresses have been fetched
  const [addressesFetched, setAddressesFetched] = useState(false)

  const reloadNodeInfos = useCallback(() => {
    reloadNodeInfosThor()
    reloadNodeInfosMaya()
  }, [reloadNodeInfosThor, reloadNodeInfosMaya])

  const goToExplorerNodeAddress = useCallback(
    (address: Address) =>
      address.startsWith('thor')
        ? FP.pipe(
            oClientThor,
            O.map((client) => client.getExplorerAddressUrl(address)),
            O.map(window.apiUrl.openExternal)
          )
        : FP.pipe(
            oClientMaya,
            O.map((client) => client.getExplorerAddressUrl(address)),
            O.map(window.apiUrl.openExternal)
          ),
    [oClientThor, oClientMaya]
  )

  // Effect to fetch wallet addresses first
  useEffect(() => {
    const addressesByChain: Record<'THOR' | 'MAYA', WalletAddressInfo[]> = {
      THOR: [],
      MAYA: []
    }

    if (allBalances.length > 0) {
      allBalances.forEach(({ asset, walletAddress, walletType }) => {
        if (asset.chain === 'THOR' || asset.chain === 'MAYA') {
          addressesByChain[asset.chain].push({ address: walletAddress, walletType })
        }
      })

      setWalletAddresses(addressesByChain)
      setAddressesFetched(true)
    } else {
      setAddressesFetched(true)
    }
  }, [allBalances, addNodeAddress, network])

  // Use `useNodeInfos` to manage `nodeInfos` state and observable
  const nodeInfos = useNodeInfos({
    addressesFetched,
    walletAddresses,
    userNodes$,
    getNodeInfos$,
    getNodeInfosMaya$
  })

  const removeNodeByAddress = useCallback(
    (node: Address) => {
      removeNodeByAddressService(node, network)
    },
    [removeNodeByAddressService, network]
  )

  const routeToAction = useCallback(
    (action: string, node: string, walletType: string) => {
      const networkPrefix = network === 'mainnet' ? '' : 's'
      const nodeChain = node.startsWith(`${networkPrefix}thor`) ? THORChain : MAYAChain
      const selectedAssetBalance = allBalances.filter(
        (balance) => balance.asset.chain === nodeChain && balance.walletType === walletType
      )
      if (selectedAssetBalance.length > 0) {
        const { asset, walletAddress, walletType, walletAccount, walletIndex, hdMode } = selectedAssetBalance[0]
        setSelectedAsset(
          O.some({
            asset,
            walletAddress,
            walletType, // This comes from the selected balance
            walletAccount,
            walletIndex,
            hdMode
          })
        )

        const path = walletRoutes.bondInteract.path({
          interactType: action
        })
        navigate(path)
      }
    },
    [allBalances, navigate, network, setSelectedAsset]
  )

  const renderBondTotal = useMemo(() => {
    const calculateTotalBondByChain = (nodes: NodeInfo[] | NodeInfoMaya[]) => {
      const walletAddressSet = new Set([
        ...walletAddresses.THOR.map((info) => info.address.toLowerCase()),
        ...walletAddresses.MAYA.map((info) => info.address.toLowerCase())
      ])

      return nodes.reduce(
        (acc, node) => {
          const chain = node.address.startsWith('thor') ? 'THOR' : 'MAYA'

          const totalBondProviderAmount = node.bondProviders.providers.reduce((providerSum, provider) => {
            const normalizedAddress = provider.bondAddress.toLowerCase()
            if (walletAddressSet.has(normalizedAddress)) {
              return providerSum.plus(provider.bond) // Sum only bondProvider's bondAmount
            }
            return providerSum
          }, assetToBase(assetAmount(0)))

          acc[chain] = acc[chain] ? acc[chain].plus(totalBondProviderAmount) : totalBondProviderAmount
          return acc
        },
        { THOR: assetToBase(assetAmount(0)), MAYA: assetToBase(assetAmount(0)) }
      )
    }

    const calculateTotalMonitoredBondByChain = (nodes: NodeInfo[] | NodeInfoMaya[]) => {
      return nodes.reduce(
        (acc, node) => {
          const chain = node.address.startsWith('thor') ? 'THOR' : 'MAYA'

          const totalBondProviderAmount = node.bondProviders.providers.reduce((providerSum, provider) => {
            const normalizedAddress = provider.bondAddress.toLowerCase()
            if (bondProviderWatchList.includes(normalizedAddress)) {
              return providerSum.plus(provider.bond) // Sum only bondProvider's bondAmount
            }
            return providerSum
          }, assetToBase(assetAmount(0)))

          acc[chain] = acc[chain] ? acc[chain].plus(totalBondProviderAmount) : totalBondProviderAmount
          return acc
        },
        { THOR: assetToBase(assetAmount(0)), MAYA: assetToBase(assetAmount(0)) }
      )
    }

    return FP.pipe(
      nodeInfos,
      RD.fold(
        // Initial loading state
        () => <Styled.BalanceLabel>--</Styled.BalanceLabel>,

        // Pending state
        () => <Styled.Spin />,

        // Error state
        (error) => (
          <Styled.BalanceLabel>
            {intl.formatMessage({ id: 'common.error.api.limit' }, { errorMsg: error.message })}
          </Styled.BalanceLabel>
        ),

        // Success state
        (nodes) => {
          const totals = calculateTotalBondByChain(nodes)
          const totalMonitored = calculateTotalMonitoredBondByChain(nodes)

          const thorTotal = totals.THOR.amount().isGreaterThan(0) ? (
            <Styled.BalanceLabel>
              {isPrivate
                ? hiddenString
                : formatAssetAmountCurrency({
                    amount: baseToAsset(getValueOfRuneInAsset(totals.THOR, pricePoolDataThor)),
                    asset: selectedPricePoolThor.asset,
                    decimal: isUSDAsset(selectedPricePoolThor.asset) ? 2 : 4
                  })}{' '}
              /{' '}
              {isPrivate
                ? hiddenString
                : formatAssetAmountCurrency({
                    amount: baseToAsset(getValueOfRuneInAsset(totalMonitored.THOR, pricePoolDataThor)),
                    asset: selectedPricePoolThor.asset,
                    decimal: isUSDAsset(selectedPricePoolThor.asset) ? 2 : 4
                  })}
            </Styled.BalanceLabel>
          ) : null

          const mayaTotal = totals.MAYA.amount().isGreaterThan(0) ? (
            <Styled.BalanceLabel>
              {isPrivate
                ? hiddenString
                : formatAssetAmountCurrency({
                    amount: baseToAsset(getValueOfRuneInAsset(totals.MAYA, pricePoolDataMaya)),
                    asset: selectedPricePoolMaya.asset,
                    decimal: isUSDAsset(selectedPricePoolMaya.asset) ? 2 : 4
                  })}
            </Styled.BalanceLabel>
          ) : null

          return (
            <>
              {thorTotal}
              {mayaTotal}
            </>
          )
        }
      )
    )
  }, [
    intl,
    isPrivate,
    nodeInfos,
    pricePoolDataMaya,
    pricePoolDataThor,
    bondProviderWatchList,
    selectedPricePoolMaya.asset,
    selectedPricePoolThor.asset,
    walletAddresses.MAYA,
    walletAddresses.THOR
  ])

  return (
    <>
      <Row justify="end" style={{ marginBottom: '20px' }}>
        <RefreshButton onClick={reloadNodeInfos} disabled={RD.isPending(nodeInfos)} />
      </Row>
      <AssetsNav />
      <Styled.Container>
        <Styled.TitleContainer>
          <Styled.BalanceTitle>Total Connected (Monitored) Value</Styled.BalanceTitle>
        </Styled.TitleContainer>
        {renderBondTotal}
      </Styled.Container>
      <Bonds
        addressValidationThor={validateAddressThor}
        addressValidationMaya={validateAddressMaya}
        nodes={nodeInfos}
        addWatchlist={addBondProvidersAddress}
        removeWatchlist={removeBondProvidersByAddress}
        removeNode={removeNodeByAddress}
        goToNode={goToExplorerNodeAddress}
        goToAction={routeToAction}
        network={network}
        addNode={addNodeAddress}
        reloadNodeInfos={reloadNodeInfos}
        walletAddresses={walletAddresses}
        watchList={bondProviderWatchList}
      />
    </>
  )
}
