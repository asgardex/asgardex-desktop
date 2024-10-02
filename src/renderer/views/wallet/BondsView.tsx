import React, { useCallback, useEffect, useMemo, useState } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { Network } from '@xchainjs/xchain-client'
import { AssetCacao, MAYAChain } from '@xchainjs/xchain-mayachain'
import { Client as MayachainClient } from '@xchainjs/xchain-mayachain'
import { Client as ThorchainClient, THORChain, AssetRuneNative } from '@xchainjs/xchain-thorchain'
import { Address } from '@xchainjs/xchain-util'
import { Row } from 'antd'
import * as A from 'fp-ts/Array'
import * as FP from 'fp-ts/function'
import * as O from 'fp-ts/Option'
import { useObservableState } from 'observable-hooks'
import { useNavigate } from 'react-router-dom'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { Bonds } from '../../components/Bonds'
import { RefreshButton } from '../../components/uielements/button'
import { AssetsNav } from '../../components/wallet/assets'
import { useAppContext } from '../../contexts/AppContext'
import { useMayachainContext } from '../../contexts/MayachainContext'
import { useThorchainContext } from '../../contexts/ThorchainContext'
import { useUserNodesContext } from '../../contexts/UserNodesContext'
import { useWalletContext } from '../../contexts/WalletContext'
import { filterWalletBalancesByAssets } from '../../helpers/walletHelper'
import { useValidateAddress } from '../../hooks/useValidateAddress'
import * as walletRoutes from '../../routes/wallet'
import { DEFAULT_NETWORK } from '../../services/const'
import { NodeInfo } from '../../services/thorchain/types'
import { balancesState$ } from '../../services/wallet'
import { DEFAULT_BALANCES_FILTER, INITIAL_BALANCES_STATE } from '../../services/wallet/const'
import { WalletBalances } from '../../services/wallet/types'

export type WalletAddressInfo = {
  address: string
  walletType: string
}

export const BondsView: React.FC = (): JSX.Element => {
  const { client$, getNodeInfos$, reloadNodeInfos: reloadNodeInfosThor } = useThorchainContext()
  const {
    client$: clientMaya$,
    getNodeInfos$: getNodeInfosMaya$,
    reloadNodeInfos: reloadNodeInfosMaya
  } = useMayachainContext()
  const { userNodes$, addNodeAddress, removeNodeByAddress: removeNodeByAddressService } = useUserNodesContext()
  const { network$ } = useAppContext()
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
  const { balances: oWalletBalances } = balancesState
  const allBalances: WalletBalances = useMemo(() => {
    return FP.pipe(
      oWalletBalances,
      O.map((balances) => filterWalletBalancesByAssets(balances, [AssetRuneNative, AssetCacao])),
      O.getOrElse<WalletBalances>(() => [])
    )
  }, [oWalletBalances])

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

  const [nodeInfos, setNodeInfos] = useState<RD.RemoteData<Error, NodeInfo[]>>(RD.initial)

  const nodeInfos$ = useMemo(() => {
    if (!addressesFetched) {
      return Rx.of(RD.initial)
    }

    const walletAddressSet = new Set([
      ...walletAddresses.THOR.map((addr) => addr.address.toLowerCase()),
      ...walletAddresses.MAYA.map((addr) => addr.address.toLowerCase())
    ])

    return FP.pipe(
      Rx.combineLatest([
        userNodes$,
        Rx.combineLatest([
          getNodeInfos$.pipe(RxOp.startWith(RD.initial)),
          getNodeInfosMaya$.pipe(RxOp.startWith(RD.initial))
        ])
      ]),
      RxOp.switchMap(([userNodes, [nodeInfosThor, nodeInfosMaya]]) => {
        const normalizedUserNodes = userNodes.map((node) => node.toLowerCase())

        return Rx.of(
          FP.pipe(
            RD.combine(nodeInfosThor, nodeInfosMaya),
            RD.map(([thorData, mayaData]) =>
              FP.pipe(
                [...thorData, ...mayaData],
                A.map((nodeInfo) => {
                  const isUserStoredNodeAddress = normalizedUserNodes.includes(nodeInfo.address)

                  const isUserBondProvider = nodeInfo.bondProviders.providers.some((provider) => {
                    const normalizedBondAddress = provider.bondAddress.toLowerCase()
                    const isWalletAddress = walletAddressSet.has(normalizedBondAddress)

                    return isWalletAddress
                  })

                  return {
                    ...nodeInfo,
                    isUserStoredNodeAddress,
                    isUserBondProvider
                  }
                }),
                A.filter((nodeInfo) => nodeInfo.isUserStoredNodeAddress || nodeInfo.isUserBondProvider)
              )
            )
          )
        )
      }),
      RxOp.startWith(RD.initial),
      RxOp.shareReplay(1)
    )
  }, [addressesFetched, userNodes$, getNodeInfos$, getNodeInfosMaya$, walletAddresses])

  // Effect to subscribe to the observable and update state
  useEffect(() => {
    const subscription = nodeInfos$.subscribe(setNodeInfos)
    return () => subscription.unsubscribe()
  }, [nodeInfos$, setNodeInfos])

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

  return (
    <>
      <Row justify="end" style={{ marginBottom: '20px' }}>
        <RefreshButton onClick={reloadNodeInfos} disabled={RD.isPending(nodeInfos)} />
      </Row>
      <AssetsNav />
      <Bonds
        addressValidationThor={validateAddressThor}
        addressValidationMaya={validateAddressMaya}
        nodes={nodeInfos}
        removeNode={removeNodeByAddress}
        goToNode={goToExplorerNodeAddress}
        goToAction={routeToAction}
        network={network}
        addNode={addNodeAddress}
        reloadNodeInfos={reloadNodeInfos}
        walletAddresses={walletAddresses}
      />
    </>
  )
}
