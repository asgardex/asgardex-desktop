import React, { useMemo } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { Asset } from '@xchainjs/xchain-util'
import { Spin } from 'antd'
import * as FP from 'fp-ts/lib/function'
import * as O from 'fp-ts/Option'
import { useObservableState } from 'observable-hooks'

import { Dex, TrustedAddresses } from '../../../../shared/api/types'
import { SendFormUTXO } from '../../../components/wallet/txs/send'
import { useChainContext } from '../../../contexts/ChainContext'
import { useWalletContext } from '../../../contexts/WalletContext'
import { getWalletBalanceByAddress } from '../../../helpers/walletHelper'
import { useNetwork } from '../../../hooks/useNetwork'
import { useOpenExplorerTxUrl } from '../../../hooks/useOpenExplorerTxUrl'
import { useValidateAddress } from '../../../hooks/useValidateAddress'
import { WalletBalances } from '../../../services/clients'
import { PoolDetails as PoolDetailsMaya, PoolAddress as PoolAddressMaya } from '../../../services/mayaMigard/types'
import { PoolAddress, PoolDetails } from '../../../services/midgard/types'
import { FeesWithRatesLD } from '../../../services/utxo/types'
import { DEFAULT_BALANCES_FILTER, INITIAL_BALANCES_STATE } from '../../../services/wallet/const'
import { SelectedWalletAsset, WalletBalance } from '../../../services/wallet/types'
import * as Styled from '../Interact/InteractView.styles'

type Props = {
  asset: SelectedWalletAsset
  trustedAddresses: TrustedAddresses | undefined
  emptyBalance: WalletBalance
  poolDetails: PoolDetails | PoolDetailsMaya
  oPoolAddress: O.Option<PoolAddress>
  oPoolAddressMaya: O.Option<PoolAddressMaya>
  dex: Dex
}
export const SendViewUTXO: React.FC<Props> = (props): JSX.Element => {
  const { dex, asset, trustedAddresses, emptyBalance, poolDetails, oPoolAddress, oPoolAddressMaya } = props

  const { network } = useNetwork()

  const {
    balancesState$,
    keystoreService: { validatePassword$ }
  } = useWalletContext()

  const [{ balances: oBalances }] = useObservableState(
    () => balancesState$(DEFAULT_BALANCES_FILTER),
    INITIAL_BALANCES_STATE
  )

  const { openExplorerTxUrl, getExplorerTxUrl } = useOpenExplorerTxUrl(O.some(asset.asset.chain))

  const oWalletBalance = useMemo(
    () =>
      FP.pipe(
        oBalances,
        O.chain((balances) => getWalletBalanceByAddress(balances, asset.walletAddress))
      ),
    [asset.walletAddress, oBalances]
  )
  const { transfer$, utxoFeesWithRates$, reloadUtxoFeesWithRates$ } = useChainContext()

  const feesWithRatesLD: FeesWithRatesLD = useMemo(
    () => utxoFeesWithRates$(asset.asset as Asset),
    [asset.asset, utxoFeesWithRates$]
  )
  const feesWithRatesRD = useObservableState(feesWithRatesLD, RD.initial)
  const { validateAddress } = useValidateAddress(asset.asset.chain)

  return FP.pipe(
    oWalletBalance,
    O.fold(
      () => (
        <Spin>
          <Styled.Container>
            <SendFormUTXO
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
              feesWithRates={feesWithRatesRD}
              reloadFeesHandler={reloadUtxoFeesWithRates$(asset.asset as Asset)}
              validatePassword$={validatePassword$}
              network={network}
              poolDetails={poolDetails}
              oPoolAddress={oPoolAddress}
              oPoolAddressMaya={oPoolAddressMaya}
              dex={dex}
            />
          </Styled.Container>
        </Spin>
      ),
      (walletBalance) => (
        <Styled.Container>
          <SendFormUTXO
            asset={asset}
            balances={FP.pipe(
              oBalances,
              O.getOrElse<WalletBalances>(() => [])
            )}
            trustedAddresses={trustedAddresses}
            balance={walletBalance}
            transfer$={transfer$}
            openExplorerTxUrl={openExplorerTxUrl}
            getExplorerTxUrl={getExplorerTxUrl}
            addressValidation={validateAddress}
            feesWithRates={feesWithRatesRD}
            reloadFeesHandler={reloadUtxoFeesWithRates$(asset.asset as Asset)}
            validatePassword$={validatePassword$}
            network={network}
            poolDetails={poolDetails}
            oPoolAddress={oPoolAddress}
            oPoolAddressMaya={oPoolAddressMaya}
            dex={dex}
          />
        </Styled.Container>
      )
    )
  )
}
