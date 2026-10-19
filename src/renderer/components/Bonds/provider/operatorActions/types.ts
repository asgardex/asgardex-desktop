import { ComponentType } from 'react'

import { Network } from '@xchainjs/xchain-client'
import { Address, BaseAmount } from '@xchainjs/xchain-util'
import BigNumber from 'bignumber.js'
import { IntlShape } from 'react-intl'

import { WhitelistRequest } from '../../../../services/runebond'
import { NodeInfo, Providers } from '../../../../services/thorchain/types'

export type NodeOperatorAction =
  | { type: 'leave' }
  | { type: 'changeFee' }
  | { type: 'addProvider' }
  | { type: 'removeProvider'; provider: Providers }
  | { type: 'maintenance' }
  | { type: 'approveRequest'; request: WhitelistRequest }

export type NodeOperatorActionType = NodeOperatorAction['type']

export type OperatorActionContext = {
  node: NodeInfo
  network: Network
  intl: IntlShape
  isActive: boolean
  currentFeeBps: number
  maxBondProviders: number
  nodeLabel: string
  nextChurnLabel: string
  validateAddress: (address: Address) => boolean
}

export type OperatorActionInput = {
  fee: BigNumber
  provider: string
}

export type OperatorActionValidation = {
  error: string | null
  complete: boolean
}

export type OperatorActionFieldProps = {
  ctx: OperatorActionContext
  input: OperatorActionInput
  error: string | null
  disabled: boolean
  onChange: (update: Partial<OperatorActionInput>) => void
}

export type OperatorActionSummaryProps = {
  ctx: OperatorActionContext
  input: OperatorActionInput
}

export type OperatorActionSpec = {
  amount: BaseAmount
  danger: boolean
  title: (ctx: OperatorActionContext) => string
  subtitle: (ctx: OperatorActionContext) => string
  cta: (ctx: OperatorActionContext) => string
  memo: (ctx: OperatorActionContext, input: OperatorActionInput) => string
  validate: (ctx: OperatorActionContext, input: OperatorActionInput) => OperatorActionValidation
  settled: (ctx: OperatorActionContext, input: OperatorActionInput, fresh: NodeInfo) => boolean
  Field?: ComponentType<OperatorActionFieldProps>
  Summary: ComponentType<OperatorActionSummaryProps>
}
