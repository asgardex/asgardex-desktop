import { useCallback, useMemo, useState } from 'react'

import { Network } from '@xchainjs/xchain-client'
import { Address, BaseAmount, bn } from '@xchainjs/xchain-util'
import { function as FP, option as O } from 'fp-ts'
import { useIntl } from 'react-intl'

import { NextChurn } from '../../../hooks/useNextChurn'
import { FeeRD } from '../../../services/chain/types'
import { GetExplorerTxUrl, OpenExplorerTxUrl } from '../../../services/clients'
import { InteractStateHandler, NodeInfo } from '../../../services/thorchain/types'
import { ValidatePasswordHandler } from '../../../services/wallet/types'
import { BondWalletInfo } from '../../../views/bonds/types'
import { FlatButton } from '../../uielements/button'
import { Modal } from '../../uielements/modal'
import { formatRuneAmount } from './helpers'
import { MemoPreview } from './MemoPreview'
import { NodeOperatorAction, OperatorActionInput, operatorActionContext, operatorActionSpec } from './operatorActions'
import { useBondTxFlow } from './useBondTxFlow'

export type { NodeOperatorAction, NodeOperatorActionType } from './operatorActions'

type Props = {
  action: NodeOperatorAction
  network: Network
  node: NodeInfo
  signer: BondWalletInfo
  walletBalance: BaseAmount
  maxBondProviders: number
  nextChurn: O.Option<NextChurn>
  fee: FeeRD
  interact$: InteractStateHandler
  validatePassword$: ValidatePasswordHandler
  validateAddress: (address: Address) => boolean
  openExplorerTxUrl: OpenExplorerTxUrl
  getExplorerTxUrl: GetExplorerTxUrl
  onClose: () => void
  onFinish: (settled: (node: NodeInfo) => boolean) => void
}

export const NodeOperatorActionModal = ({
  action,
  network,
  node,
  signer,
  walletBalance,
  maxBondProviders,
  nextChurn,
  fee: feeRD,
  interact$,
  validatePassword$,
  validateAddress,
  openExplorerTxUrl,
  getExplorerTxUrl,
  onClose,
  onFinish
}: Props) => {
  const intl = useIntl()

  const spec = useMemo(() => operatorActionSpec(action), [action])
  const ctx = useMemo(
    () => operatorActionContext({ node, network, intl, maxBondProviders, nextChurn, validateAddress }),
    [intl, maxBondProviders, network, nextChurn, node, validateAddress]
  )
  const { amount, Field, Summary } = spec

  const [input, setInput] = useState<OperatorActionInput>(() => ({
    fee: bn(ctx.currentFeeBps).div(100),
    provider: ''
  }))
  const onInputChange = useCallback(
    (update: Partial<OperatorActionInput>) => setInput((prev) => ({ ...prev, ...update })),
    []
  )

  const settled = useCallback((fresh: NodeInfo) => spec.settled(ctx, input, fresh), [ctx, input, spec])
  const finish = useCallback(() => onFinish(settled), [onFinish, settled])

  const { isLoading, oFee, footerLabel, startSigning, modals } = useBondTxFlow({
    network,
    signer,
    fee: feeRD,
    interact$,
    validatePassword$,
    openExplorerTxUrl,
    getExplorerTxUrl,
    onFinish: finish
  })

  const balanceError: string | null = useMemo(
    () =>
      FP.pipe(
        oFee,
        O.map((fee) => fee.plus(amount)),
        O.filter((required) => walletBalance.lt(required)),
        O.fold(
          () => null,
          (required) =>
            intl.formatMessage(
              { id: 'bonds.operator.modal.insufficientBalance' },
              { required: formatRuneAmount(required), balance: formatRuneAmount(walletBalance) }
            )
        )
      ),
    [amount, intl, oFee, walletBalance]
  )

  const { error: inputError, complete } = useMemo(() => spec.validate(ctx, input), [ctx, input, spec])
  const memo = useMemo(() => spec.memo(ctx, input), [ctx, input, spec])

  const submitDisabled = isLoading || O.isNone(oFee) || balanceError !== null || !complete

  return (
    <>
      <Modal
        containerClassName="lg:pl-[240px]"
        backdropClassName="bg-bg0/40 dark:bg-bg0d/40"
        visible
        title={spec.title(ctx)}
        onCancel={isLoading ? undefined : onClose}
        closable={!isLoading}
        footer={false}>
        <div className="flex flex-col px-2 pb-2">
          <span className="text-center font-main text-[14px] text-gray2 dark:text-gray2d">{spec.subtitle(ctx)}</span>

          {Field && <Field ctx={ctx} input={input} error={inputError} disabled={isLoading} onChange={onInputChange} />}

          {balanceError && (
            <span className="mt-2 font-main text-[14px] text-error0 dark:text-error0d">{balanceError}</span>
          )}

          <div className="mt-4 flex flex-col gap-2 rounded-lg bg-bg1 p-4 dark:bg-bg1d">
            <Summary ctx={ctx} input={input} />
          </div>

          <MemoPreview memo={memo} />

          <FlatButton
            className="mt-6 w-full"
            size="large"
            color={spec.danger ? 'error' : 'primary'}
            loading={isLoading}
            disabled={submitDisabled}
            onClick={() => startSigning({ memo, amount })}>
            {spec.cta(ctx)}
          </FlatButton>
          <span className="mt-3 text-center font-main text-[13px] text-gray2 dark:text-gray2d">{footerLabel}</span>
        </div>
      </Modal>
      {modals}
    </>
  )
}
