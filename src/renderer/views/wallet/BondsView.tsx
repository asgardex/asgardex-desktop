import React, { useCallback, useEffect, useMemo, useState } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { Network } from '@xchainjs/xchain-client'
import { MAYAChain } from '@xchainjs/xchain-mayachain'
import { Client as MayachainClient } from '@xchainjs/xchain-mayachain'
import { Client as ThorchainClient, THORChain } from '@xchainjs/xchain-thorchain'
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
import { useValidateAddress } from '../../hooks/useValidateAddress'
import * as walletRoutes from '../../routes/wallet'
import { DEFAULT_NETWORK } from '../../services/const'
import { chainBalances$ } from '../../services/wallet'
import { ChainBalances } from '../../services/wallet/types'

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
  const network = useObservableState<Network>(network$, DEFAULT_NETWORK)
  const oClientThor = useObservableState<O.Option<ThorchainClient>>(client$, O.none)
  const oClientMaya = useObservableState<O.Option<MayachainClient>>(clientMaya$, O.none)

  const { validateAddress: validateAddressThor } = useValidateAddress(THORChain)
  const { validateAddress: validateAddressMaya } = useValidateAddress(MAYAChain)
  const [walletAddresses, setWalletAddresses] = useState<Record<'THOR' | 'MAYA', WalletAddressInfo[]>>({
    THOR: [],
    MAYA: []
  })

  const [chainBalances] = useObservableState(
    () =>
      FP.pipe(
        chainBalances$,
        RxOp.map<ChainBalances, ChainBalances>((chainBalances) =>
          FP.pipe(
            chainBalances,
            // we show all balances
            A.filter(({ chain }) => chain === THORChain || chain === MAYAChain)
          )
        )
      ),
    []
  )

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
    const addressesByChain: Record<'THOR' | 'MAYA', Array<{ address: string; walletType: string }>> = {
      THOR: [],
      MAYA: []
    }

    chainBalances.forEach(({ chain, walletAddress, walletType }) => {
      // Check if the chain is THOR or MAYA and if walletAddress has a value
      if ((chain === THORChain || chain === MAYAChain) && walletAddress._tag === 'Some') {
        // Push the address into the corresponding array
        addressesByChain[chain].push({ address: walletAddress.value, walletType })
        addNodeAddress(walletAddress.value, network)
      }
    })

    // Set the state with the accumulated addresses
    setWalletAddresses(addressesByChain)
  }, [addNodeAddress, chainBalances, network])

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
    (action: String) => {
      switch (action) {
        case 'bond':
          navigate(walletRoutes.interact.path({ interactType: 'bond' }))
          break
        case 'unbond':
          navigate(walletRoutes.interact.path({ interactType: 'unbond' }))
          break
      }
    },
    [navigate]
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
