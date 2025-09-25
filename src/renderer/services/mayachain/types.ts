import * as RD from '@devexperts/remote-data-ts'
import { Client, CompatibleAsset, DepositParam } from '@xchainjs/xchain-mayachain'
import type * as TN from '@xchainjs/xchain-mayanode'
import { LPBondedNode } from '@xchainjs/xchain-mayanode'
import { Address, AnyAsset, BaseAmount, Chain } from '@xchainjs/xchain-util'
import BigNumber from 'bignumber.js'
import { option as O } from 'fp-ts'
import { IntlShape } from 'react-intl'
import * as Rx from 'rxjs'

import { NodeUrl } from '../../../shared/api/types'
import { EnabledChain } from '../../../shared/utils/chain'
import { HDMode, WalletType } from '../../../shared/wallet/types'
import { Protocol } from '../../components/uielements/protocolSwitch/types'
import { LiveData } from '../../helpers/rx/liveData'
import { AssetsWithAmount1e8, AssetWithAmount1e8 } from '../../types/asgardex'
import * as C from '../clients'
import { ClientUrl } from '../thorchain/types'
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
  readonly asset: CompatibleAsset
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

export type MayaLpUnits = {
  asset: AnyAsset
  units: number
}

export type Providers = {
  bondAddress: Address
  bonded: boolean
  pools: MayaLpUnits[]
}

export type BondProviders = {
  nodeOperatorFee: BaseAmount
  providers: Providers[]
}
export type PubKeySet = {
  secp256k1?: Address
  ed25519?: Address
}

export type NodeInfo = {
  address: Address
  pubKeySet: PubKeySet
  nodeOperatorAddress: Address
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

export type MimirHaltChain = Record<`HALT${EnabledChain}CHAIN`, boolean>

export type MimirHaltTrading = Record<`HALT${EnabledChain}TRADING`, boolean>

export type MimirPauseLP = Record<`PAUSELP${EnabledChain}`, boolean>

export type MimirHaltTradingGlobal = {
  haltGlobalTrading: boolean
}

export type MimirHaltLpGlobal = {
  pauseGlobalLp: boolean
}

export type MimirHalt = MimirHaltChain & MimirHaltTrading & MimirPauseLP & MimirHaltTradingGlobal & MimirHaltLpGlobal

export type MimirHaltRD = RD.RemoteData<Error, MimirHalt>

export type PendingAsset = AssetWithAmount1e8
export type PendingAssets = AssetsWithAmount1e8
export type PendingAssetsRD = RD.RemoteData<Error, PendingAssets>

export type BondedNodes = {
  nodeAddress: string
  units: BigNumber
}

export type LiquidityProviderForPool = {
  asset: AnyAsset
  cacaoAddress: O.Option<Address>
  lastAddHeight: O.Option<number>
  assetAddress: O.Option<Address>
  lastWithdrawHeight: O.Option<number>
  units: string
  pendingCacao: BaseAmount
  pendingAsset: BaseAmount
  cacaoDepositValue: BaseAmount
  assetDepositValue: BaseAmount
  withdrawCounter: string
  bondedNodes: LPBondedNode[]
  cacaoRedeemValue: BaseAmount
  assetRedeemValue: BaseAmount
}

export type LiquidityProviderForPoolLD = LiveData<Error, LiquidityProviderForPool>
export type LiquidityProviderForPoolRD = RD.RemoteData<Error, LiquidityProviderForPool>

export type LiquidityProvider = {
  dexAssetAddress: O.Option<Address>
  assetAddress: O.Option<Address>
  pendingDexAsset: O.Option<PendingAsset>
  pendingAsset: O.Option<PendingAsset>
}

export type LiquidityProvidersLD = LiveData<Error, LiquidityProvider[]>
export type LiquidityProvidersRD = RD.RemoteData<Error, LiquidityProvider[]>

export type LiquidityProviderLD = LiveData<Error, LiquidityProvider>
export type LiquidityProviderRD = RD.RemoteData<Error, LiquidityProvider>

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

export type TradeAccount = {
  asset: AnyAsset
  units: BaseAmount
  owner: Address
  lastAddHeight: O.Option<number>
  lastWithdrawHeight: O.Option<number>
  walletType: WalletType
  protocol: Protocol
}

export type TradeAccountRD = RD.RemoteData<Error, TradeAccount[]>
export type TradeAccountLD = LiveData<Error, TradeAccount[]>

export type MayanodePool = {
  balanceCacao: BaseAmount
  balanceAsset: BaseAmount
  asset: AnyAsset
  lpUnits: BigNumber
  poolUnits: BigNumber
  status: string
  decimals: number | undefined
  synthUnits: string
  synthSupply: string
  pendingCacaoInbound: BaseAmount
  pendingAssetInbound: BaseAmount
  saversUnits: string
  synthMintPaused: boolean
  bondable: boolean
}
export type MayanodePools = MayanodePool[]
export type MayanodePoolsRD = RD.RemoteData<Error, MayanodePools>
export type MayanodePoolsLD = LiveData<Error, MayanodePools>

export type TxStages = {
  inboundObserved: {
    finalCount: number | undefined
    completed: boolean
  }
  inboundConfirmationCounted: {
    remainingConfirmationSeconds: number | undefined
    completed: boolean
  }
  inboundFinalised: {
    completed: boolean
  }
  swapStatus: {
    pending: boolean | undefined
    streaming: {
      interval: number | undefined
      quantity: number | undefined
      count: number | undefined
    }
  }
  outBoundDelay: {
    remainingDelayBlocks: number | undefined
    remainDelaySeconds: number | undefined
    completed: boolean | undefined
  }
  outboundSigned: {
    scheduledOutboundHeight: number | undefined
    blocksSinceScheduled: number | undefined
    completed: boolean | undefined
  }
  swapFinalised: boolean
}

export type TxStagesRD = RD.RemoteData<Error, TxStages>
export type TxStagesLD = LiveData<Error, TxStages>

export enum NodeStatusEnum {
  Active = 'Active',
  Whitelisted = 'Whitelisted',
  Standby = 'Standby',
  Ready = 'Ready',
  Disabled = 'Disabled'
}
