import React, { useMemo } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { Spin } from 'antd'
import * as FP from 'fp-ts/lib/function'
import * as O from 'fp-ts/Option'
import { useObservableState } from 'observable-hooks'

import { SendFormUTXO } from '../../../components/wallet/txs/send'
import { useChainContext } from '../../../contexts/ChainContext'
import { useMayachainQueryContext } from '../../../contexts/MayachainQueryContext'
import { useMidgardContext } from '../../../contexts/MidgardContext'
import { useMidgardMayaContext } from '../../../contexts/MidgardMayaContext'
import { useThorchainQueryContext } from '../../../contexts/ThorchainQueryContext'
import { useWalletContext } from '../../../contexts/WalletContext'
import { isDashAsset } from '../../../helpers/assetHelper'
import { getWalletBalanceByAddress } from '../../../helpers/walletHelper'
import { useNetwork } from '../../../hooks/useNetwork'
import { useOpenExplorerTxUrl } from '../../../hooks/useOpenExplorerTxUrl'
import { useValidateAddress } from '../../../hooks/useValidateAddress'
import { WalletBalances } from '../../../services/clients'
import { FeesWithRatesLD } from '../../../services/utxo/types'
import { DEFAULT_BALANCES_FILTER, INITIAL_BALANCES_STATE } from '../../../services/wallet/const'
import { SelectedWalletAsset, WalletBalance } from '../../../services/wallet/types'
import * as Styled from '../Interact/InteractView.styles'

type Props = {
  asset: SelectedWalletAsset
  emptyBalance: WalletBalance
}
export const SendViewUTXO: React.FC<Props> = (props): JSX.Element => {
  const { asset, emptyBalance } = props

  const { network } = useNetwork()

  const {
    balancesState$,
    keystoreService: { validatePassword$ }
  } = useWalletContext()

  const [{ balances: oBalances }] = useObservableState(
    () => balancesState$(DEFAULT_BALANCES_FILTER),
    INITIAL_BALANCES_STATE
  )
  const {
    service: {
      pools: { poolsState$ }
    }
  } = useMidgardContext()
  const {
    service: {
      pools: { poolsState$: poolsStateMaya$ }
    }
  } = useMidgardMayaContext() // Dash asset requires maya pools
  const poolsRD = useObservableState(isDashAsset(asset.asset) ? poolsStateMaya$ : poolsState$, RD.pending)
  const poolDetails = RD.toNullable(poolsRD)?.poolDetails ?? []

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
  const { thorchainQuery } = useThorchainQueryContext()
  const { mayachainQuery } = useMayachainQueryContext()

  const feesWithRatesLD: FeesWithRatesLD = useMemo(
    () => utxoFeesWithRates$(asset.asset),
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
              reloadFeesHandler={reloadUtxoFeesWithRates$(asset.asset)}
              validatePassword$={validatePassword$}
              thorchainQuery={thorchainQuery}
              mayachainQuery={mayachainQuery}
              network={network}
              poolDetails={poolDetails}
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
            balance={walletBalance}
            transfer$={transfer$}
            openExplorerTxUrl={openExplorerTxUrl}
            getExplorerTxUrl={getExplorerTxUrl}
            addressValidation={validateAddress}
            feesWithRates={feesWithRatesRD}
            reloadFeesHandler={reloadUtxoFeesWithRates$(asset.asset)}
            validatePassword$={validatePassword$}
            thorchainQuery={thorchainQuery}
            mayachainQuery={mayachainQuery}
            network={network}
            poolDetails={poolDetails}
          />
        </Styled.Container>
      )
    )
  )
}
