import React, { useMemo } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { THORChain } from '@xchainjs/xchain-thorchain'
import { Spin } from 'antd'
import * as FP from 'fp-ts/lib/function'
import * as O from 'fp-ts/Option'
import { useObservableState } from 'observable-hooks'

import { SendFormTHOR } from '../../../components/wallet/txs/send/'
import { useChainContext } from '../../../contexts/ChainContext'
import { useMidgardContext } from '../../../contexts/MidgardContext'
import { useThorchainContext } from '../../../contexts/ThorchainContext'
import { useThorchainQueryContext } from '../../../contexts/ThorchainQueryContext'
import { useWalletContext } from '../../../contexts/WalletContext'
import { liveData } from '../../../helpers/rx/liveData'
import { getWalletBalanceByAddressAndAsset } from '../../../helpers/walletHelper'
import { useNetwork } from '../../../hooks/useNetwork'
import { useOpenExplorerTxUrl } from '../../../hooks/useOpenExplorerTxUrl'
import { useValidateAddress } from '../../../hooks/useValidateAddress'
import { FeeRD } from '../../../services/chain/types'
import { WalletBalances } from '../../../services/clients'
import { DEFAULT_BALANCES_FILTER, INITIAL_BALANCES_STATE } from '../../../services/wallet/const'
import { SelectedWalletAsset, WalletBalance } from '../../../services/wallet/types'
import * as Styled from '../Interact/InteractView.styles'

type Props = {
  asset: SelectedWalletAsset
  emptyBalance: WalletBalance
}

export const SendViewTHOR: React.FC<Props> = (props): JSX.Element => {
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
  const poolsRD = useObservableState(poolsState$, RD.pending)
  const poolDetails = RD.toNullable(poolsRD)?.poolDetails ?? []

  const { openExplorerTxUrl, getExplorerTxUrl } = useOpenExplorerTxUrl(O.some(THORChain))

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

  const { thorchainQuery } = useThorchainQueryContext()

  const { fees$, reloadFees } = useThorchainContext()

  const [feeRD] = useObservableState<FeeRD>(
    () =>
      FP.pipe(
        fees$(),
        liveData.map((fees) => fees.fast)
      ),
    RD.initial
  )

  const { validateAddress } = useValidateAddress(THORChain)

  return FP.pipe(
    oWalletBalance,
    O.fold(
      () => (
        <Spin>
          <Styled.Container>
            <SendFormTHOR
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
              fee={feeRD}
              reloadFeesHandler={reloadFees}
              validatePassword$={validatePassword$}
              thorchainQuery={thorchainQuery}
              network={network}
              poolDetails={poolDetails}
            />
          </Styled.Container>
        </Spin>
      ),
      (walletBalance) => (
        <Styled.Container>
          <SendFormTHOR
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
            fee={feeRD}
            reloadFeesHandler={reloadFees}
            validatePassword$={validatePassword$}
            thorchainQuery={thorchainQuery}
            network={network}
            poolDetails={poolDetails}
          />
        </Styled.Container>
      )
    )
  )
}
