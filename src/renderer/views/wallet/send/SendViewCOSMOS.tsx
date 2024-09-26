import React, { useMemo } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { GAIAChain } from '@xchainjs/xchain-cosmos'
import { KUJIChain } from '@xchainjs/xchain-kujira'
import { MAYAChain } from '@xchainjs/xchain-mayachain'
import { RadixChain } from '@xchainjs/xchain-radix'
import { THORChain } from '@xchainjs/xchain-thorchain'
import { Spin } from 'antd'
import * as FP from 'fp-ts/lib/function'
import * as O from 'fp-ts/Option'
import { useObservableState } from 'observable-hooks'

import { Dex, TrustedAddresses } from '../../../../shared/api/types'
import { SendFormCOSMOS } from '../../../components/wallet/txs/send'
import { useChainContext } from '../../../contexts/ChainContext'
import { useCosmosContext } from '../../../contexts/CosmosContext'
import { useKujiContext } from '../../../contexts/KujiContext'
import { useMayachainContext } from '../../../contexts/MayachainContext'
import { useThorchainContext } from '../../../contexts/ThorchainContext'
import { useWalletContext } from '../../../contexts/WalletContext'
import { useXrdContext } from '../../../contexts/XrdContext'
import { liveData } from '../../../helpers/rx/liveData'
import { getWalletBalanceByAddressAndAsset } from '../../../helpers/walletHelper'
import { useMayaScanPrice } from '../../../hooks/useMayascanPrice'
import { useNetwork } from '../../../hooks/useNetwork'
import { useOpenExplorerTxUrl } from '../../../hooks/useOpenExplorerTxUrl'
import { useValidateAddress } from '../../../hooks/useValidateAddress'
import { FeeRD } from '../../../services/chain/types'
import { FeesLD, WalletBalances } from '../../../services/clients'
import { PoolAddress, PoolDetails as PoolDetailsMaya } from '../../../services/mayaMigard/types'
import { DEFAULT_BALANCES_FILTER, INITIAL_BALANCES_STATE } from '../../../services/wallet/const'
import { SelectedWalletAsset, WalletBalance } from '../../../services/wallet/types'
import * as Styled from '../Interact/InteractView.styles'

type Props = {
  asset: SelectedWalletAsset
  trustedAddresses: TrustedAddresses | undefined
  emptyBalance: WalletBalance
  poolDetails: PoolDetailsMaya
  oPoolAddress: O.Option<PoolAddress>
  dex: Dex
}

export const SendViewCOSMOS: React.FC<Props> = (props): JSX.Element => {
  const { asset, trustedAddresses, emptyBalance, poolDetails, dex, oPoolAddress } = props

  const { network } = useNetwork()
  const {
    balancesState$,
    keystoreService: { validatePassword$ }
  } = useWalletContext()

  const [{ balances: oBalances }] = useObservableState(
    () => balancesState$(DEFAULT_BALANCES_FILTER),
    INITIAL_BALANCES_STATE
  )

  const { mayaScanPriceRD } = useMayaScanPrice()

  const { openExplorerTxUrl, getExplorerTxUrl } = useOpenExplorerTxUrl(O.some(asset.asset.chain))

  const oWalletBalance = useMemo(
    () =>
      FP.pipe(
        oBalances,
        O.chain((balances) =>
          getWalletBalanceByAddressAndAsset({ balances, address: asset.walletAddress, asset: asset.asset })
        )
      ),
    [asset, oBalances]
  )

  const { transfer$ } = useChainContext()

  const kujiContext = useKujiContext()
  const mayachainContext = useMayachainContext()
  const gaiaContext = useCosmosContext()
  const thorContext = useThorchainContext()
  const xrdContext = useXrdContext()
  let fees$: () => FeesLD
  let reloadFees: () => void

  switch (asset.asset.chain) {
    case KUJIChain:
      fees$ = kujiContext.fees$
      reloadFees = kujiContext.reloadFees
      break
    case MAYAChain:
      fees$ = mayachainContext.fees$
      reloadFees = mayachainContext.reloadFees
      break
    case GAIAChain:
      fees$ = gaiaContext.fees$
      reloadFees = gaiaContext.reloadFees
      break
    case THORChain:
      fees$ = thorContext.fees$
      reloadFees = thorContext.reloadFees
      break
    case RadixChain:
      fees$ = xrdContext.fees$
      reloadFees = xrdContext.reloadFees
      break
    default:
      throw new Error('Unsupported chain')
  }

  const [feeRD] = useObservableState<FeeRD>(
    () =>
      FP.pipe(
        fees$(),
        liveData.map((fees) => fees.fast)
      ),
    RD.initial
  )

  const { validateAddress } = useValidateAddress(asset.asset.chain)

  return FP.pipe(
    oWalletBalance,
    O.fold(
      () => (
        <Spin>
          <Styled.Container>
            <SendFormCOSMOS
              asset={asset}
              trustedAddresses={trustedAddresses}
              balances={FP.pipe(
                oBalances,
                O.getOrElse<WalletBalances>(() => [])
              )}
              balance={emptyBalance}
              transfer$={transfer$}
              openExplorerTxUrl={openExplorerTxUrl}
              getExplorerTxUrl={getExplorerTxUrl}
              addressValidation={validateAddress}
              fee={feeRD}
              reloadFeesHandler={reloadFees}
              validatePassword$={validatePassword$}
              network={network}
              poolDetails={poolDetails}
              mayaScanPrice={mayaScanPriceRD}
              oPoolAddress={oPoolAddress}
              dex={dex}
            />
          </Styled.Container>
        </Spin>
      ),
      (walletBalance) => (
        <Styled.Container>
          <SendFormCOSMOS
            asset={asset}
            trustedAddresses={trustedAddresses}
            balances={FP.pipe(
              oBalances,
              O.getOrElse<WalletBalances>(() => [])
            )}
            balance={walletBalance}
            transfer$={transfer$}
            openExplorerTxUrl={openExplorerTxUrl}
            getExplorerTxUrl={getExplorerTxUrl}
            addressValidation={validateAddress}
            fee={feeRD}
            reloadFeesHandler={reloadFees}
            validatePassword$={validatePassword$}
            network={network}
            poolDetails={poolDetails}
            mayaScanPrice={mayaScanPriceRD}
            oPoolAddress={oPoolAddress}
            dex={dex}
          />
        </Styled.Container>
      )
    )
  )
}
