import React, { useCallback, useEffect, useMemo, useState } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { Network } from '@xchainjs/xchain-client'
import { AssetCacao, MAYAChain } from '@xchainjs/xchain-mayachain'
import { Client as MayachainClient } from '@xchainjs/xchain-mayachain'
import { Client as ThorchainClient, THORChain, AssetRuneNative } from '@xchainjs/xchain-thorchain'
import { Address, Chain } from '@xchainjs/xchain-util'
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
    const balances = FP.pipe(
      oWalletBalances,
      // filter wallet balances
      O.map((balances) => filterWalletBalancesByAssets(balances, [AssetRuneNative, AssetCacao])),
      O.getOrElse<WalletBalances>(() => [])
    )
    return balances
  }, [oWalletBalances])

  const { validateAddress: validateAddressThor } = useValidateAddress(THORChain)
  const { validateAddress: validateAddressMaya } = useValidateAddress(MAYAChain)
  const [walletAddresses, setWalletAddresses] = useState<Record<'THOR' | 'MAYA', WalletAddressInfo[]>>({
    THOR: [],
    MAYA: []
  })

  // reload both chain nodes
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

  // Effect to fetch wallet addresses on load
  useEffect(() => {
    // Temporary storage for addresses
    const addressesByChain: Record<Chain, Array<{ address: string; walletType: string }>> = {
      THOR: [],
      MAYA: []
    }

    allBalances.forEach(({ asset, walletAddress, walletType }) => {
      addressesByChain[asset.chain].push({ address: walletAddress, walletType })
      addNodeAddress(walletAddress, network)
    })

    // Set the state with the accumulated addresses
    setWalletAddresses(addressesByChain)
  }, [addNodeAddress, allBalances, network])

  const nodeInfos$ = useMemo(() => {
    return FP.pipe(
      Rx.combineLatest([
        userNodes$,
        Rx.combineLatest([
          getNodeInfos$.pipe(RxOp.startWith(RD.initial)),
          getNodeInfosMaya$.pipe(RxOp.startWith(RD.initial))
        ])
      ]),
      RxOp.switchMap(([userNodes, [nodeInfosThor, nodeInfosMaya]]) =>
        Rx.of(
          FP.pipe(
            RD.combine(nodeInfosThor, nodeInfosMaya),
            RD.map(([thorData, mayaData]) =>
              FP.pipe(
                [...thorData, ...mayaData], // Assuming already in NodeInfo format
                A.filter(({ address }) => userNodes.includes(address)), // Keep nodes that are in userNodes
                A.map((nodeInfo) => ({
                  ...nodeInfo,
                  // Identify if the user is a bond provider
                  isUserBondProvider: nodeInfo.bondProviders.providers.some((provider) =>
                    userNodes.includes(provider.bondAddress)
                  )
                }))
              )
            )
          )
        )
      ),
      RxOp.startWith(RD.initial),
      RxOp.shareReplay(1)
    )
  }, [userNodes$, getNodeInfos$, getNodeInfosMaya$])

  const [nodeInfos] = useObservableState(() => nodeInfos$, RD.initial)

  const loadingNodeInfos = useMemo(() => RD.isPending(nodeInfos), [nodeInfos])

  const removeNodeByAddress = useCallback(
    (node: Address) => {
      removeNodeByAddressService(node, network)
    },
    [removeNodeByAddressService, network]
  )

  const routeToAction = useCallback(
    (action: string, node: string) => {
      const networkPrefix = network === 'mainnet' ? '' : 's'
      const nodeChain = node.startsWith(`${networkPrefix}thor`) ? THORChain : MAYAChain
      const selectedAssetBalance = allBalances.filter((balance) => balance.asset.chain === nodeChain)
      const { asset, walletAddress, walletType, walletAccount, walletIndex, hdMode } = selectedAssetBalance[0]
      setSelectedAsset(
        O.some({
          asset,
          walletAddress,
          walletType,
          walletAccount,
          walletIndex,
          hdMode
        })
      )
      const path = walletRoutes.bondInteract.path({
        interactType: action
      })
      navigate(path)
    },
    [allBalances, navigate, network, setSelectedAsset]
  )

  return (
    <>
      <Row justify="end" style={{ marginBottom: '20px' }}>
        <RefreshButton onClick={reloadNodeInfos} disabled={loadingNodeInfos} />
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
