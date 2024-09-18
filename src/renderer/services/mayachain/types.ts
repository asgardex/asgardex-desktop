import * as RD from '@devexperts/remote-data-ts'
import { Client, DepositParam } from '@xchainjs/xchain-mayachain'
import type * as TN from '@xchainjs/xchain-mayanode'
import { Address, AnyAsset, BaseAmount, Chain } from '@xchainjs/xchain-util'
import BigNumber from 'bignumber.js'
import * as O from 'fp-ts/Option'
import * as t from 'io-ts'
import { IntlShape } from 'react-intl'
import * as Rx from 'rxjs'

import { NodeUrl } from '../../../shared/api/types'
import { EnabledChain } from '../../../shared/utils/chain'
import { HDMode, WalletType } from '../../../shared/wallet/types'
import { LiveData } from '../../helpers/rx/liveData'
import { AssetsWithAmount1e8, AssetWithAmount1e8 } from '../../types/asgardex'
import * as C from '../clients'
import { ClientUrl, NodeStatusEnum } from '../thorchain/types'
import { TxHashLD, TxHashRD } from '../wallet/types'

/**
 * Custom `InboundAddress` to mark some properties as `required
 */
export type InboundAddress = Omit<TN.InboundAddress, 'chain' | 'address'> &
  Required<{
    chain: Chain
    address: Address
  }>

export type InboundAddressRD = RD.RemoteData<Error, InboundAddresses>

export type InboundAddresses = InboundAddress[]
export type InboundAddressesLD = LiveData<Error, InboundAddresses>

export type MayachainConstantsRD = RD.RemoteData<Error, TN.ConstantsResponse>
export type MayachainConstantsLD = LiveData<Error, TN.ConstantsResponse>

export type LastblockItem = TN.LastBlock
export type LastblockItems = LastblockItem[]
export type MayachainLastblockRD = RD.RemoteData<Error, LastblockItems>
export type MayachainLastblockLD = LiveData<Error, LastblockItems>

export type Client$ = C.Client$<Client>

export type ClientState = C.ClientState<Client>
export type ClientState$ = C.ClientState$<Client>

export type ClientUrl$ = Rx.Observable<ClientUrl>
export type ClientUrlLD = LiveData<Error, ClientUrl>
export type ClientUrlRD = RD.RemoteData<Error, ClientUrl>

export type NodeUrl$ = Rx.Observable<NodeUrl>
export type NodeUrlLD = LiveData<Error, NodeUrl>
export type NodeUrlRD = RD.RemoteData<Error, NodeUrl>

export type CheckMayanodeNodeRpcHandler = (url: string, intl: IntlShape) => LiveData<Error, string>

type UrlRD = RD.RemoteData<Error, string>
type CheckUrlHandler = (url: string, intl: IntlShape) => LiveData<Error, string>

export type MayanodeNodeUrlRD = UrlRD
export type CheckMayanodeNodeUrlHandler = CheckUrlHandler

export type MayanodeRpcUrlRD = UrlRD
export type CheckMayanodeRpcUrlHandler = CheckUrlHandler

export type FeesService = C.FeesService

export type SendTxParams = {
  walletType: WalletType
  sender?: Address
  recipient: Address
  amount: BaseAmount
  asset: AnyAsset
  memo?: string
  walletAccount: number
  walletIndex: number
  hdMode: HDMode
}

export type TransactionService = {
  sendPoolTx$: (
    params: DepositParam & {
      walletType: WalletType
      walletAccount: number
      walletIndex: number /* override walletIndex of DepositParam to avoid 'undefined' */
      hdMode: HDMode
    }
  ) => TxHashLD
} & C.TransactionService<SendTxParams>

export type InteractParams = {
  readonly walletType: WalletType
  readonly walletAccount: number
  readonly walletIndex: number
  readonly hdMode: HDMode
  readonly amount: BaseAmount
  readonly memo: string
}

/**
 * State to reflect status of a interact actions by doing different requests
 */
export type InteractState = {
  // Number of current step
  readonly step: number
  // Constant total amount of steps
  readonly stepsTotal: 2
  // RD of all requests
  readonly txRD: TxHashRD
}

export type InteractState$ = Rx.Observable<InteractState>

export type InteractStateHandler = (p: InteractParams) => InteractState$

export type Providers = {
  bondAddress: Address
  bond: BaseAmount
}

export type BondProviders = {
  nodeOperatorFee: BaseAmount
  providers: Providers[]
}

export type NodeInfo = {
  address: Address
  bond: BaseAmount
  award: BaseAmount
  status: NodeStatusEnum
  bondProviders: BondProviders
  signMembership: string[]
}

export type NodeInfoLD = LiveData<Error, NodeInfo>
export type NodeInfoRD = RD.RemoteData<Error, NodeInfo>

export type NodeInfos = NodeInfo[]
export type NodeInfosLD = LiveData<Error, NodeInfos>
export type NodeInfosRD = RD.RemoteData<Error, NodeInfos>

export type MayanodeApiUrlLD = LiveData<Error, string>
export type MayanodeApiUrlRD = RD.RemoteData<Error, string>

export type Mimir = {
  [key: string]: number
}

export type MimirLD = LiveData<Error, Mimir>
export type MimirRD = RD.RemoteData<Error, Mimir>

export type MimirConstantsRD = RD.RemoteData<Error, Mimir>

export type MimirHaltChain = Record<`halt${EnabledChain}Chain`, boolean>

export type MimirHaltTrading = Record<`halt${EnabledChain}Trading`, boolean>

export type MimirPauseLP = Record<`pauseLp${EnabledChain}`, boolean>

export type MimirHaltTradingGlobal = {
  haltTrading: boolean
}

export type MimirHaltLpGlobal = {
  pauseLp: boolean
}

export type MimirHalt = MimirHaltChain & MimirHaltTrading & MimirPauseLP & MimirHaltTradingGlobal & MimirHaltLpGlobal

export type MimirHaltRD = RD.RemoteData<Error, MimirHalt>

export type PendingAsset = AssetWithAmount1e8
export type PendingAssets = AssetsWithAmount1e8
export type PendingAssetsRD = RD.RemoteData<Error, PendingAssets>

export type LiquidityProvider = {
  cacaoAddress: O.Option<Address>
  assetAddress: O.Option<Address>

  pendingCacao: O.Option<PendingAsset>
  pendingAsset: O.Option<PendingAsset>
}

export type LiquidityProvidersLD = LiveData<Error, LiquidityProvider[]>
export type LiquidityProviderLD = LiveData<Error, O.Option<LiquidityProvider>>
export type LiquidityProviderRD = RD.RemoteData<Error, O.Option<LiquidityProvider>>
export type LiquidityProvidersRD = RD.RemoteData<Error, LiquidityProvider[]>

export type LiquidityProviderHasAsymAssets = { cacao: boolean; asset: boolean }
export type LiquidityProviderHasAsymAssetsRD = RD.RemoteData<Error, LiquidityProviderHasAsymAssets>

export type LiquidityProviderAssetMismatch = O.Option<{ cacaoAddress: Address; assetAddress: Address }>
export type LiquidityProviderAssetMismatchRD = RD.RemoteData<Error, LiquidityProviderAssetMismatch>

export type SaverProvider = {
  address: Address
  depositValue: BaseAmount
  redeemValue: BaseAmount
  growthPercent: BigNumber
  addHeight: O.Option<number>
  withdrawHeight: O.Option<number>
  walletType?: WalletType
}

export type SaverProviderRD = RD.RemoteData<Error, SaverProvider>
export type SaverProviderLD = LiveData<Error, SaverProvider>

export const erc20WhitelistTokenIO = t.type({
  chainId: t.number,
  address: t.string,
  symbol: t.string,
  name: t.string,
  logoURI: t.union([t.string, t.undefined])
})

export type ERC20WhitelistToken = t.TypeOf<typeof erc20WhitelistTokenIO>

export const erc20WhitelistIO = t.type({
  tokens: t.array(erc20WhitelistTokenIO),
  version: t.type({
    major: t.number,
    minor: t.number,
    patch: t.number
  })
})

export type ERC20Whitelist = t.TypeOf<typeof erc20WhitelistIO>
