import { useMemo } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { AnyAsset, BaseAmount, baseAmount } from '@xchainjs/xchain-util'
import { function as FP, option as O } from 'fp-ts'
import { useObservableState } from 'observable-hooks'

import { TrustedAddresses } from '../../../../shared/api/types'
import { Spin } from '../../../components/uielements/spin'
import { SendFormEVM } from '../../../components/wallet/txs/send'
import { useChainContext } from '../../../contexts/ChainContext'
import { useEvmContext } from '../../../contexts/EvmContext'
import { useWalletContext } from '../../../contexts/WalletContext'
import { getChainAsset } from '../../../helpers/chainHelper'
import { getWalletBalanceByAssetAndWalletType } from '../../../helpers/walletHelper'
import { useObserveMayaScanPrice } from '../../../hooks/useMayascanPrice'
import { useNetwork } from '../../../hooks/useNetwork'
import { useOpenExplorerTxUrl } from '../../../hooks/useOpenExplorerTxUrl'
import { FeesRD, WalletBalances } from '../../../services/clients'
import { EVMZeroAddress } from '../../../services/evm/const'
import { PoolDetails as PoolDetailsMaya } from '../../../services/midgard/mayaMigard/types'
import { PoolAddress, PoolDetails } from '../../../services/midgard/midgardTypes'
import { DEFAULT_BALANCES_FILTER, INITIAL_BALANCES_STATE } from '../../../services/wallet/const'
import { SelectedWalletAsset, WalletBalance } from '../../../services/wallet/types'

type Props = {
  asset: SelectedWalletAsset
  trustedAddresses: TrustedAddresses | undefined
  emptyBalance: WalletBalance
  poolDetails: PoolDetails | PoolDetailsMaya
  oPoolAddress: O.Option<PoolAddress>
  oPoolAddressMaya: O.Option<PoolAddress>
}

export const SendViewEVM = (props: Props): JSX.Element => {
  const { asset, trustedAddresses, emptyBalance, poolDetails, oPoolAddress, oPoolAddressMaya } = props
  const { network } = useNetwork()
  const { mayaScanPriceRD } = useObserveMayaScanPrice()

  const {
    balancesState$,
    keystoreService: { validatePassword$ }
  } = useWalletContext()

  const [{ balances: oBalances }] = useObservableState(
    () => balancesState$(DEFAULT_BALANCES_FILTER),
    INITIAL_BALANCES_STATE
  )

  const { openExplorerTxUrl, getExplorerTxUrl } = useOpenExplorerTxUrl(O.some(asset.asset.chain))

  const oWalletBalance = useMemo(() => {
    const result = getWalletBalanceByAssetAndWalletType({
      oWalletBalances: oBalances,
      asset: asset.asset,
      walletType: asset.walletType
    })

    return result
  }, [asset.asset, asset.walletType, oBalances])

  const { transfer$, poolDeposit$: deposit$, evmFees$ } = useChainContext()

  // Use centralized EVM fees that support standalone ledger mode
  const fees$ = (params: { asset: AnyAsset; amount: BaseAmount; recipient: string; from: string }) =>
    evmFees$({
      chain: asset.asset.chain,
      asset: params.asset,
      amount: params.amount,
      recipient: params.recipient,
      from: params.from
    })

  // Get reload function from individual context for now
  const { reloadFees } = useEvmContext(asset.asset.chain)

  const [feesRD] = useObservableState<FeesRD>(
    // First fees are based on "default" values
    // Whenever an user enters valid values into input fields,
    // `reloadFees` will be called and with it, `feesRD` will be updated with fees
    () => {
      return fees$({
        asset: getChainAsset(asset.asset.chain),
        amount: baseAmount(1),
        recipient: EVMZeroAddress,
        from: asset.walletAddress
      })
    },
    RD.initial
  )

  return FP.pipe(
    oWalletBalance,
    O.fold(
      () => (
        <Spin>
          <div className="flex flex-col items-center justify-center overflow-auto bg-bg0 dark:bg-bg0d">
            <SendFormEVM
              asset={asset}
              trustedAddresses={trustedAddresses}
              balance={emptyBalance}
              balances={FP.pipe(
                oBalances,
                O.getOrElse<WalletBalances>(() => [])
              )}
              fees={feesRD}
              transfer$={transfer$}
              deposit$={deposit$}
              openExplorerTxUrl={openExplorerTxUrl}
              getExplorerTxUrl={getExplorerTxUrl}
              reloadFeesHandler={reloadFees}
              validatePassword$={validatePassword$}
              network={network}
              poolDetails={poolDetails}
              oPoolAddress={O.none}
              oPoolAddressMaya={O.none}
              mayaScanPrice={mayaScanPriceRD}
            />
          </div>
        </Spin>
      ),
      (walletBalance) => (
        <div className="flex flex-col items-center justify-center overflow-auto bg-bg0 dark:bg-bg0d">
          <SendFormEVM
            asset={asset}
            trustedAddresses={trustedAddresses}
            balance={walletBalance}
            balances={FP.pipe(
              oBalances,
              O.getOrElse<WalletBalances>(() => [])
            )}
            fees={feesRD}
            transfer$={transfer$}
            deposit$={deposit$}
            openExplorerTxUrl={openExplorerTxUrl}
            getExplorerTxUrl={getExplorerTxUrl}
            reloadFeesHandler={reloadFees}
            validatePassword$={validatePassword$}
            network={network}
            poolDetails={poolDetails}
            oPoolAddress={oPoolAddress}
            mayaScanPrice={mayaScanPriceRD}
            oPoolAddressMaya={oPoolAddressMaya}
          />
        </div>
      )
    )
  )
}
