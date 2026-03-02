import { useCallback, useEffect, useRef, useState } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { Network } from '@xchainjs/xchain-client'
import { function as FP, option as O } from 'fp-ts'
import { Observable, Subscription } from 'rxjs'

import { eqOApproveParams } from '../helpers/fp/eq'
import { ApproveParams, IsApproveParams } from '../services/evm/types'
import { TxHashRD } from '../services/wallet/types'

import { useSubscriptionState } from './useSubscriptionState'

type IsApprovedRD = RD.RemoteData<{ msg: string }, boolean>
type IsApprovedLD = Observable<IsApprovedRD>

type UseERC20ApprovalParams = {
  isApprovedERC20Token$: (params: IsApproveParams) => IsApprovedLD
  approveERC20Token$: (params: ApproveParams) => Observable<TxHashRD>
  oApproveParams: O.Option<ApproveParams>
  network: Network
  onApprovalConfirmed?: () => void
}

type UseERC20ApprovalResult = {
  approveState: TxHashRD
  subscribeApproveState: (s: Observable<TxHashRD>) => void
  resetApproval: () => void
  submitApproveTx: () => void
  isApprovedState: IsApprovedRD
  awaitingConfirmation: boolean
}

/** Timeout (ms) for each isApproved check */
const CHECK_TIMEOUT = 15_000
/** Delay (ms) before first poll after approval tx succeeds */
const POLL_INITIAL_DELAY = 10_000
/** Max polling attempts */
const POLL_MAX_ATTEMPTS = 24
/** Delay (ms) between poll attempts */
const POLL_INTERVAL = 5_000

/**
 * Consolidated hook for ERC20 approval flow:
 * - Checks on-chain approval status when `oApproveParams` changes
 * - Submits approval transactions
 * - Polls for confirmation after a successful approval tx
 * - Cleans up subscriptions on unmount or reset
 */
export const useERC20Approval = ({
  isApprovedERC20Token$,
  approveERC20Token$,
  oApproveParams,
  network,
  onApprovalConfirmed
}: UseERC20ApprovalParams): UseERC20ApprovalResult => {
  // Approval tx lifecycle (initial → pending → success/failure)
  const {
    state: approveState,
    reset: resetApproveState,
    subscribe: subscribeApproveState
  } = useSubscriptionState<TxHashRD>(RD.initial)

  // On-chain approval check result
  const [isApprovedState, setIsApprovedState] = useState<IsApprovedRD>(RD.initial)

  // Whether we're polling for confirmation after tx success
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false)

  // Refs for subscription cleanup and dedup
  const activeSubRef = useRef<Subscription | null>(null)
  const approvalHandledRef = useRef(false)
  const paramsRef = useRef<ApproveParams | null>(null)
  const prevCheckParamsRef = useRef<O.Option<ApproveParams>>(O.none)
  const onApprovalConfirmedRef = useRef(onApprovalConfirmed)

  // Keep callback ref stable
  useEffect(() => {
    onApprovalConfirmedRef.current = onApprovalConfirmed
  }, [onApprovalConfirmed])

  // Initial check: when oApproveParams changes, check on-chain status
  useEffect(() => {
    if (eqOApproveParams.equals(oApproveParams, prevCheckParamsRef.current)) return
    prevCheckParamsRef.current = oApproveParams

    return FP.pipe(
      oApproveParams,
      O.fold(
        // params went to None — nothing to check, no cleanup needed
        () => () => undefined,
        (params) => {
          setIsApprovedState(RD.pending)

          const sub = isApprovedERC20Token$({
            contractAddress: params.contractAddress,
            spenderAddress: params.spenderAddress,
            fromAddress: params.fromAddress
          }).subscribe((rd) => {
            if (RD.isSuccess(rd) || RD.isFailure(rd)) {
              clearTimeout(timeout)
              setIsApprovedState(rd)
              sub.unsubscribe()
            }
          })

          // Timeout guard
          const timeout = setTimeout(() => {
            sub.unsubscribe()
            setIsApprovedState(RD.initial)
          }, CHECK_TIMEOUT)

          return () => {
            clearTimeout(timeout)
            sub.unsubscribe()
          }
        }
      )
    )
  }, [oApproveParams, isApprovedERC20Token$])

  // Submit approval tx
  const submitApproveTx = useCallback(() => {
    FP.pipe(
      oApproveParams,
      O.map(({ walletAccount, walletIndex, walletType, hdMode, contractAddress, spenderAddress, fromAddress }) =>
        subscribeApproveState(
          approveERC20Token$({
            network,
            contractAddress,
            spenderAddress,
            fromAddress,
            walletAccount,
            walletIndex,
            hdMode,
            walletType
          })
        )
      )
    )
  }, [approveERC20Token$, network, oApproveParams, subscribeApproveState])

  // Post-tx polling: after approveState becomes success, poll until confirmed
  useEffect(() => {
    if (!RD.isSuccess(approveState)) return
    if (approvalHandledRef.current) return
    approvalHandledRef.current = true

    // Capture current params so polling survives oApproveParams going to None
    const currentParams = FP.pipe(
      oApproveParams,
      O.getOrElseW(() => null)
    )
    if (currentParams) {
      paramsRef.current = currentParams
    }

    const pollParams = paramsRef.current
    if (!pollParams) return

    setAwaitingConfirmation(true)
    let cancelled = false

    const runPolling = async () => {
      // Initial delay before first poll
      await new Promise((r) => setTimeout(r, POLL_INITIAL_DELAY))
      if (cancelled) return

      for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
        if (cancelled) return

        const result = await new Promise<IsApprovedRD>((resolve) => {
          const timeout = setTimeout(() => {
            sub.unsubscribe()
            resolve(RD.initial)
          }, CHECK_TIMEOUT)

          const sub = isApprovedERC20Token$({
            contractAddress: pollParams.contractAddress,
            spenderAddress: pollParams.spenderAddress,
            fromAddress: pollParams.fromAddress
          }).subscribe((rd) => {
            if (RD.isSuccess(rd) || RD.isFailure(rd)) {
              clearTimeout(timeout)
              sub.unsubscribe()
              resolve(rd)
            }
          })

          // Store subscription so cleanup can unsubscribe it
          activeSubRef.current = sub
        })

        if (cancelled) return

        if (RD.isSuccess(result) && result.value === true) {
          setIsApprovedState(RD.success(true))
          setAwaitingConfirmation(false)
          onApprovalConfirmedRef.current?.()
          return
        }

        // Wait between attempts
        if (attempt < POLL_MAX_ATTEMPTS - 1) {
          await new Promise((r) => setTimeout(r, POLL_INTERVAL))
        }
      }

      // All attempts exhausted
      if (!cancelled) {
        setAwaitingConfirmation(false)
      }
    }

    runPolling()

    return () => {
      cancelled = true
      activeSubRef.current?.unsubscribe()
      activeSubRef.current = null
    }
  }, [approveState, oApproveParams, isApprovedERC20Token$])

  // Full reset
  const resetApproval = useCallback(() => {
    resetApproveState()
    setIsApprovedState(RD.initial)
    setAwaitingConfirmation(false)
    approvalHandledRef.current = false
    paramsRef.current = null
    prevCheckParamsRef.current = O.none
    activeSubRef.current?.unsubscribe()
    activeSubRef.current = null
  }, [resetApproveState])

  // Reset when approveState goes back to initial (external reset)
  useEffect(() => {
    if (RD.isInitial(approveState)) {
      approvalHandledRef.current = false
    }
  }, [approveState])

  return {
    approveState,
    subscribeApproveState,
    resetApproval,
    submitApproveTx,
    isApprovedState,
    awaitingConfirmation
  }
}
