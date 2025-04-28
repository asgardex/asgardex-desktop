import React, { useCallback, useEffect, useMemo, useState } from 'react'

import { SwapOutlined } from '@ant-design/icons'
import * as RD from '@devexperts/remote-data-ts'
import { Network } from '@xchainjs/xchain-client'
import { AssetCacao, MAYAChain } from '@xchainjs/xchain-mayachain'
import { Client as MayachainClient } from '@xchainjs/xchain-mayachain'
import { Client as ThorchainClient, THORChain, AssetRuneNative } from '@xchainjs/xchain-thorchain'
import {
  Address,
  assetAmount,
  assetToBase,
  BaseAmount,
  baseToAsset,
  formatAssetAmountCurrency
} from '@xchainjs/xchain-util'
import * as FP from 'fp-ts/function'
import * as O from 'fp-ts/Option'
import { useObservableState } from 'observable-hooks'
import { useIntl } from 'react-intl'
import { useNavigate } from 'react-router-dom'

import { Bonds } from '../../components/Bonds'
import { BaseButton, RefreshButton } from '../../components/uielements/button'
import { ProtocolSwitch } from '../../components/uielements/protocolSwitch'
import * as Styled from '../../components/wallet/assets/TotalValue.styles'
import { useAppContext } from '../../contexts/AppContext'
import { useMayachainContext } from '../../contexts/MayachainContext'
import { useMidgardContext } from '../../contexts/MidgardContext'
import { useMidgardMayaContext } from '../../contexts/MidgardMayaContext'
import { useThorchainContext } from '../../contexts/ThorchainContext'
import { useUserBondProvidersContext } from '../../contexts/UserBondProvidersContext'
import { useUserNodesContext } from '../../contexts/UserNodesContext'
import { useWalletContext } from '../../contexts/WalletContext'
import { isUSDAsset } from '../../helpers/assetHelper'
import { RUNE_PRICE_POOL } from '../../helpers/poolHelper'
import { MAYA_PRICE_POOL } from '../../helpers/poolHelperMaya'
import { hiddenString } from '../../helpers/stringHelper'
import { filterWalletBalancesByAssets } from '../../helpers/walletHelper'
import { useThorNodeInfos } from '../../hooks/useNodeInfos'
import { useMayaNodeInfos } from '../../hooks/useNodeInfosMaya'
import { useValidateAddress } from '../../hooks/useValidateAddress'
import * as walletRoutes from '../../routes/wallet'
import { DEFAULT_NETWORK } from '../../services/const'
import { NodeInfo as NodeInfoMaya, Providers as MayaProviders } from '../../services/mayachain/types'
import { NodeInfo as NodeInfoThor } from '../../services/thorchain/types'
import { balancesState$ } from '../../services/wallet'
import { DEFAULT_BALANCES_FILTER, INITIAL_BALANCES_STATE } from '../../services/wallet/const'
import { WalletBalances } from '../../services/wallet/types'
import { useApp } from '../../store/app/hooks'
import { getValueOfRuneInAsset } from '../pools/Pools.utils'
import { WalletAddressInfo } from './types'

enum LabelView {
  Connected = 'Connected',
  Monitored = 'Monitored'
}

export const BondsView = (): JSX.Element => {
  const { protocol, setProtocol } = useApp()
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
  const { userBondProviders$, addBondProvidersAddress, removeBondProvidersByAddress } = useUserBondProvidersContext()
  const { network$ } = useAppContext()
  const intl = useIntl()
  const { isPrivate } = useApp()
  const navigate = useNavigate()
  const { setSelectedAsset } = useWalletContext()

  const network = useObservableState<Network>(network$, DEFAULT_NETWORK)
  const oClientThor = useObservableState<O.Option<ThorchainClient>>(client$, O.none)
  const oClientMaya = useObservableState<O.Option<MayachainClient>>(clientMaya$, O.none)
  const [balancesState] = useObservableState(
    () => balancesState$({ ...DEFAULT_BALANCES_FILTER }),
    INITIAL_BALANCES_STATE
  )
  const [activeLabel, setActiveLabel] = useState<LabelView>(LabelView.Connected)
  const [selectedPricePoolThor] = useObservableState(() => selectedPricePoolThor$, RUNE_PRICE_POOL)
  const [selectedPricePoolMaya] = useObservableState(() => selectedPricePoolMaya$, MAYA_PRICE_POOL)
  const { poolData: pricePoolDataThor } = useObservableState(selectedPricePoolThor$, RUNE_PRICE_POOL)
  const { poolData: pricePoolDataMaya } = useObservableState(selectedPricePoolMaya$, MAYA_PRICE_POOL)
  const { balances: oWalletBalances } = balancesState

  const allBalances: WalletBalances = useMemo(
    () =>
      FP.pipe(
        oWalletBalances,
        O.map((balances) => filterWalletBalancesByAssets(balances, [AssetRuneNative, AssetCacao])),
        O.getOrElse<WalletBalances>(() => [])
      ),
    [oWalletBalances]
  )

  const bondProviderWatchList = useObservableState(userBondProviders$, [])
  const { validateAddress: validateAddressThor } = useValidateAddress(THORChain)
  const { validateAddress: validateAddressMaya } = useValidateAddress(MAYAChain)

  const [walletAddresses, setWalletAddresses] = useState<Record<'THOR' | 'MAYA', WalletAddressInfo[]>>({
    THOR: [],
    MAYA: []
  })
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

  useEffect(() => {
    const addressesByChain: Record<'THOR' | 'MAYA', WalletAddressInfo[]> = { THOR: [], MAYA: [] }
    if (allBalances.length > 0) {
      allBalances.forEach(({ asset, walletAddress, walletType }) => {
        if (asset.chain === 'THOR' || asset.chain === 'MAYA') {
          addressesByChain[asset.chain].push({ address: walletAddress, walletType })
        }
      })
      setWalletAddresses(addressesByChain)
      setAddressesFetched(true)
    } else {
      setAddressesFetched(false)
    }
  }, [allBalances, network])

  const nodeInfosThor = useThorNodeInfos({
    addressesFetched,
    thorWalletAddresses: walletAddresses.THOR,
    userNodes$,
    getNodeInfosThor$: getNodeInfos$
  })
  const nodeInfosMaya = useMayaNodeInfos({
    addressesFetched,
    mayaWalletAddresses: walletAddresses.MAYA,
    userNodes$,
    getNodeInfosMaya$
  })

  const removeNodeByAddress = useCallback(
    (node: Address) => {
      removeNodeByAddressService(node, network)
    },
    [removeNodeByAddressService, network]
  )

  const addNodeByAddress = useCallback(
    (node: Address) => {
      addNodeAddress(node, network)
    },
    [addNodeAddress, network]
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
        setSelectedAsset(O.some({ asset, walletAddress, walletType, walletAccount, walletIndex, hdMode }))
        const path = walletRoutes.bondInteract.path({ interactType: action })
        navigate(path)
      }
    },
    [allBalances, navigate, network, setSelectedAsset]
  )

  // THORChain-specific bond total calculation (Connected)
  const calculateTotalBondThor = (nodes: NodeInfoThor[], walletAddresses: WalletAddressInfo[]): BaseAmount => {
    const walletAddressSet = new Set(walletAddresses.map((info) => info.address.toLowerCase()))
    return nodes.reduce((acc: BaseAmount, node: NodeInfoThor) => {
      const totalBondProviderAmount = node.bondProviders.providers.reduce(
        (providerSum: BaseAmount, provider: { bondAddress: string; bond: BaseAmount }) => {
          const normalizedAddress = provider.bondAddress.toLowerCase()
          if (walletAddressSet.has(normalizedAddress)) {
            return providerSum.plus(provider.bond)
          }
          return providerSum
        },
        assetToBase(assetAmount(0))
      )
      return acc.plus(totalBondProviderAmount)
    }, assetToBase(assetAmount(0)))
  }

  // MayaChain-specific bond total calculation (Connected)
  const calculateTotalBondMaya = (nodes: NodeInfoMaya[], walletAddresses: WalletAddressInfo[]): BaseAmount => {
    const walletAddressSet = new Set(walletAddresses.map((info) => info.address.toLowerCase()))
    return nodes.reduce((acc: BaseAmount, node: NodeInfoMaya) => {
      const totalBondProviderAmount = node.bondProviders.providers.reduce(
        (providerSum: BaseAmount, provider: MayaProviders) => {
          const normalizedAddress = provider.bondAddress.toLowerCase()
          if (walletAddressSet.has(normalizedAddress)) {
            return providerSum.plus(node.bond)
          }
          return providerSum
        },
        assetToBase(assetAmount(0))
      )
      return acc.plus(totalBondProviderAmount)
    }, assetToBase(assetAmount(0)))
  }

  const renderBondTotal = useMemo(() => {
    // THORChain-specific monitored bond total calculation
    const calculateTotalMonitoredBondThor = (nodes: NodeInfoThor[]): BaseAmount => {
      return nodes.reduce((acc: BaseAmount, node: NodeInfoThor) => {
        const totalBondProviderAmount = node.bondProviders.providers.reduce(
          (providerSum: BaseAmount, provider: { bondAddress: string; bond: BaseAmount }) => {
            const normalizedAddress = provider.bondAddress.toLowerCase()
            if (bondProviderWatchList.includes(normalizedAddress)) {
              return providerSum.plus(provider.bond)
            }
            return providerSum
          },
          assetToBase(assetAmount(0))
        )
        return acc.plus(totalBondProviderAmount)
      }, assetToBase(assetAmount(0)))
    }

    // MayaChain-specific monitored bond total calculation
    const calculateTotalMonitoredBondMaya = (nodes: NodeInfoMaya[]): BaseAmount => {
      return nodes.reduce((acc: BaseAmount, node: NodeInfoMaya) => {
        const totalBondProviderAmount = node.bondProviders.providers.reduce(
          (providerSum: BaseAmount, provider: MayaProviders) => {
            const normalizedAddress = provider.bondAddress.toLowerCase()
            if (bondProviderWatchList.includes(normalizedAddress)) {
              return providerSum.plus(node.bond)
            }
            return providerSum
          },
          assetToBase(assetAmount(0))
        )
        return acc.plus(totalBondProviderAmount)
      }, assetToBase(assetAmount(0)))
    }

    const renderThorTotal = RD.fold(
      () => <Styled.BalanceLabel>--</Styled.BalanceLabel>,
      () => <Styled.Spin />,
      (error: Error) => (
        <Styled.BalanceLabel>
          {intl.formatMessage({ id: 'common.error.api.limit' }, { errorMsg: error.message })}
        </Styled.BalanceLabel>
      ),
      (nodes: NodeInfoThor[]) => {
        const totals = calculateTotalBondThor(nodes, walletAddresses.THOR)
        const totalMonitored = calculateTotalMonitoredBondThor(nodes)
        const activeAmount = activeLabel === LabelView.Connected ? totals : totalMonitored

        return (
          <Styled.BalanceLabel>
            {isPrivate
              ? hiddenString
              : formatAssetAmountCurrency({
                  amount: baseToAsset(getValueOfRuneInAsset(activeAmount, pricePoolDataThor)),
                  asset: selectedPricePoolThor.asset,
                  decimal: isUSDAsset(selectedPricePoolThor.asset) ? 2 : 4
                })}{' '}
            /{' '}
            {isPrivate
              ? hiddenString
              : `ᚱ ${new Intl.NumberFormat().format(parseFloat(baseToAsset(activeAmount).amount().toFixed(2)))}`}
          </Styled.BalanceLabel>
        )
      }
    )

    const renderMayaTotal = RD.fold(
      () => <Styled.BalanceLabel>--</Styled.BalanceLabel>,
      () => <Styled.Spin />,
      (error: Error) => (
        <Styled.BalanceLabel>
          {intl.formatMessage({ id: 'common.error.api.limit' }, { errorMsg: error.message })}
        </Styled.BalanceLabel>
      ),
      (nodes: NodeInfoMaya[]) => {
        const totals = calculateTotalBondMaya(nodes, walletAddresses.MAYA)
        const totalMonitored = calculateTotalMonitoredBondMaya(nodes)
        const activeAmount = activeLabel === LabelView.Connected ? totals : totalMonitored

        return (
          <Styled.BalanceLabel>
            {isPrivate
              ? hiddenString
              : formatAssetAmountCurrency({
                  amount: baseToAsset(getValueOfRuneInAsset(activeAmount, pricePoolDataMaya)),
                  asset: selectedPricePoolMaya.asset,
                  decimal: isUSDAsset(selectedPricePoolMaya.asset) ? 2 : 4
                })}{' '}
            /{' '}
            {isPrivate
              ? hiddenString
              : `${new Intl.NumberFormat().format(parseFloat(baseToAsset(activeAmount).amount().toFixed(2)))} CACAO`}
          </Styled.BalanceLabel>
        )
      }
    )

    return protocol === 'THOR' ? renderThorTotal(nodeInfosThor) : renderMayaTotal(nodeInfosMaya)
  }, [
    protocol,
    nodeInfosThor,
    nodeInfosMaya,
    bondProviderWatchList,
    intl,
    walletAddresses.THOR,
    walletAddresses.MAYA,
    activeLabel,
    isPrivate,
    pricePoolDataThor,
    selectedPricePoolThor.asset,
    pricePoolDataMaya,
    selectedPricePoolMaya.asset
  ])

  return (
    <>
      <div className="flex w-full justify-end pb-10px">
        <ProtocolSwitch protocol={protocol} setProtocol={setProtocol} />
      </div>
      <Styled.Container className="rounded-t-lg">
        <div className="relative flex w-full items-center justify-center">
          <Styled.TitleContainer>
            <Styled.BalanceTitle>
              {activeLabel === LabelView.Monitored
                ? 'Total Value Across Connected and Monitored Addresses'
                : 'Total Connected Wallet Value'}
            </Styled.BalanceTitle>
            <BaseButton
              className="ml-2 !p-0 text-turquoise"
              onClick={() =>
                setActiveLabel((prev) => (prev === LabelView.Connected ? LabelView.Monitored : LabelView.Connected))
              }>
              <SwapOutlined className="rounded-full border border-solid border-turquoise p-1" />
            </BaseButton>
          </Styled.TitleContainer>
          <div className="absolute right-0 flex items-center">
            <RefreshButton onClick={reloadNodeInfos} disabled={RD.isPending(nodeInfosThor)} />
          </div>
        </div>
        {renderBondTotal}
      </Styled.Container>
      <Bonds
        addressValidationThor={validateAddressThor}
        addressValidationMaya={validateAddressMaya}
        nodesThor={nodeInfosThor}
        nodesMaya={nodeInfosMaya}
        addWatchlist={addBondProvidersAddress}
        removeWatchlist={removeBondProvidersByAddress}
        removeNode={removeNodeByAddress}
        goToNode={goToExplorerNodeAddress}
        goToAction={routeToAction}
        network={network}
        addNode={addNodeByAddress}
        reloadNodeInfos={reloadNodeInfos}
        walletAddresses={walletAddresses}
        watchList={bondProviderWatchList}
      />
    </>
  )
}
