import { useMemo } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { Address, BaseAmount } from '@xchainjs/xchain-util'
import { array as A } from 'fp-ts'
import { useObservableEagerState } from 'observable-hooks'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { ZERO_BASE_AMOUNT } from '../const'
import { ChurnPoint, LastChurnPayout, OperatorRewards, OperatorRewardsRD, operatorRewards$ } from '../services/runebond'
import { OperatorNodeInfo } from './useOperatorNodes'

const HISTORY_CHURNS = 12
const NO_OPERATOR_FEES$ = Rx.of<OperatorRewardsRD>(RD.initial)

export const operatorAddressesOf = (nodes: OperatorNodeInfo[]): Address[] =>
  Array.from(
    new Set(nodes.filter(({ isOperator }) => isOperator).map(({ nodeOperatorAddress }) => nodeOperatorAddress))
  )

const mergeSeries = (series: ChurnPoint[][]): ChurnPoint[] => {
  const byBlock = new Map<number, ChurnPoint>()
  series.flat().forEach((point) => {
    const existing = byBlock.get(point.churnHeight)
    byBlock.set(point.churnHeight, existing ? { ...existing, amount: existing.amount.plus(point.amount) } : point)
  })
  return [...byBlock.values()].sort((a, b) => a.churnHeight - b.churnHeight).slice(-HISTORY_CHURNS)
}

const mergeLastChurn = (all: OperatorRewards[]): LastChurnPayout | null => {
  const latest = all
    .map(({ totals }) => totals.lastChurn)
    .filter((last): last is LastChurnPayout => last !== null)
    .sort((a, b) => b.blockNumber - a.blockNumber)
  if (latest.length === 0) return null
  const [head] = latest
  const amount = latest
    .filter(({ blockNumber }) => blockNumber === head.blockNumber)
    .reduce((acc, { amount }) => acc.plus(amount), ZERO_BASE_AMOUNT)
  return { ...head, amount }
}

const churnsPaid = (payouts: OperatorRewards['payouts']): number =>
  new Set(payouts.filter(({ commissionAmount }) => commissionAmount.gt(0)).map(({ blockNumber }) => blockNumber)).size

export const mergeOperatorRewards = (all: OperatorRewards[]): OperatorRewards => {
  if (all.length === 1) return all[0]
  const series = mergeSeries(all.map(({ series }) => series))
  return {
    address: all.map(({ address }) => address).join(','),
    totals: {
      totalPaid: all.reduce((acc, { totals }) => acc.plus(totals.totalPaid), ZERO_BASE_AMOUNT),
      churnCount: churnsPaid(all.flatMap(({ payouts }) => payouts)),
      lastChurn: mergeLastChurn(all)
    },
    series,
    byNode: all
      .flatMap(({ byNode }) => byNode)
      .sort((a, b) => (b.lastPayout?.blockNumber ?? 0) - (a.lastPayout?.blockNumber ?? 0)),
    payouts: all.flatMap(({ payouts }) => payouts).sort((a, b) => b.blockNumber - a.blockNumber),
    payoutsTotal: all.reduce((acc, { payoutsTotal }) => acc + payoutsTotal, 0)
  }
}

export const useOperatorFees = (addresses: Address[]): OperatorRewardsRD => {
  const key = Array.from(new Set(addresses)).sort().join('|')
  const fees$ = useMemo(() => {
    const unique = key === '' ? [] : key.split('|')
    if (unique.length === 0) return NO_OPERATOR_FEES$
    return Rx.combineLatest(unique.map(operatorRewards$)).pipe(
      RxOp.map((all) => RD.map(mergeOperatorRewards)(A.sequence(RD.remoteData)(all)))
    )
  }, [key])
  return useObservableEagerState(fees$)
}

export type OperatorFeesWindow = {
  total: BaseAmount
  churns: number
  average: BaseAmount
  lastChurn: ChurnPoint | null
}

export const operatorFeesWindow = ({ series }: OperatorRewards): OperatorFeesWindow => {
  const paid = series.filter(({ amount }) => amount.gt(0))
  const total = series.reduce((acc, { amount }) => acc.plus(amount), ZERO_BASE_AMOUNT)
  return {
    total,
    churns: paid.length,
    average: paid.length > 0 ? total.div(paid.length) : ZERO_BASE_AMOUNT,
    lastChurn: paid.length > 0 ? paid[paid.length - 1] : null
  }
}

export const nodesPaidAtChurn = ({ payouts }: OperatorRewards, churnHeight: number): number =>
  new Set(
    payouts
      .filter(({ blockNumber, commissionAmount }) => blockNumber === churnHeight && commissionAmount.gt(0))
      .map(({ nodeAddress }) => nodeAddress)
  ).size
