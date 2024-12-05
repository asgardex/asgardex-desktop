import { Network } from '@xchainjs/xchain-client'
import { Address, AnyAsset, Asset, BaseAmount } from '@xchainjs/xchain-util'
import BigNumber from 'bignumber.js'
import * as FP from 'fp-ts/function'
import * as O from 'fp-ts/Option'

import { WalletType } from '../../../shared/wallet/types'
import { LiveData } from '../../helpers/rx/liveData'
import { ChangeSlipToleranceHandler } from '../../services/app/types'
import { SwapFeesHandler, ReloadSwapFeesHandler, SwapHandler } from '../../services/chain/types'
import { AddressValidationAsync, GetExplorerTxUrl, OpenExplorerTxUrl } from '../../services/clients'
import { ApproveFeeHandler, ApproveParams, IsApproveParams, LoadApproveFeeHandler } from '../../services/evm/types'
import { PoolDetails as PoolDetailsMaya } from '../../services/mayaMigard/types'
import { PoolAddress, PoolDetails, PoolsDataMap } from '../../services/midgard/types'
import { ApiError, KeystoreState, TxHashLD, ValidatePasswordHandler, BalancesState } from '../../services/wallet/types'
import { AssetWithDecimal, SlipTolerance } from '../../types/asgardex'

export type SwapAsset = AssetWithDecimal & { price: BigNumber }

export type SwapData = {
  readonly slip: BigNumber
  readonly swapResult: BaseAmount
}

export type AssetsToSwap = { source: Asset; target: Asset }

export enum ModalState {
  Swap = 'swap',
  Approve = 'approve',
  None = 'none'
}

export enum RateDirection {
  Source = 'fromSource',
  Target = 'fromTarget'
}

export type SwapProps = {
  keystore: KeystoreState
  poolAssets: AnyAsset[]
  assets: {
    source: SwapAsset
    target: SwapAsset
  }
  sourceKeystoreAddress: O.Option<Address>
  sourceLedgerAddress: O.Option<Address>
  sourceWalletType: WalletType
  targetWalletType: O.Option<WalletType>
  poolAddressMaya: O.Option<PoolAddress>
  poolAddressThor: O.Option<PoolAddress>
  swap$: SwapHandler
  reloadTxStatus: FP.Lazy<void>
  poolsData: PoolsDataMap
  poolDetails: PoolDetails | PoolDetailsMaya
  walletBalances: Pick<BalancesState, 'balances' | 'loading'>
  goToTransaction: OpenExplorerTxUrl
  getExplorerTxUrl: GetExplorerTxUrl
  validatePassword$: ValidatePasswordHandler
  reloadFees: ReloadSwapFeesHandler
  reloadBalances: FP.Lazy<void>
  fees$: SwapFeesHandler
  reloadApproveFee: LoadApproveFeeHandler
  approveFee$: ApproveFeeHandler
  recipientAddress: O.Option<Address>
  targetKeystoreAddress: O.Option<Address>
  targetLedgerAddress: O.Option<Address>
  onChangeAsset: ({
    source,
    sourceWalletType,
    target,
    targetWalletType,
    recipientAddress
  }: {
    source: AnyAsset
    target: AnyAsset
    sourceWalletType: WalletType
    targetWalletType: O.Option<WalletType>
    recipientAddress: O.Option<Address>
  }) => void
  network: Network
  slipTolerance: SlipTolerance
  changeSlipTolerance: ChangeSlipToleranceHandler
  approveERC20Token$: (params: ApproveParams) => TxHashLD
  isApprovedERC20Token$: (params: IsApproveParams) => LiveData<ApiError, boolean>
  importWalletHandler: FP.Lazy<void>
  disableSwapAction: boolean
  addressValidator: AddressValidationAsync
  hidePrivateData: boolean
}
