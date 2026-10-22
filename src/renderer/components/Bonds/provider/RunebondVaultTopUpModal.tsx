import { ChangeEvent, useCallback, useEffect, useMemo, useState } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { Network } from '@xchainjs/xchain-client'
import { Address, BaseAmount, bn } from '@xchainjs/xchain-util'
import { option as O } from 'fp-ts'
import { useIntl } from 'react-intl'

import { THORChain } from '../../../../shared/utils/chainIds'
import { truncateAddress } from '../../../helpers/addressHelper'
import { THORCHAIN_DECIMAL } from '../../../helpers/assetHelper'
import { getRunebondVaultTopupMemo } from '../../../helpers/memoHelper'
import { hiddenString } from '../../../helpers/stringHelper'
import { useLastSuccess } from '../../../hooks/useLastSuccess'
import { RUNEBOND_RELOAD_DELAYS_MS, useReloadUntil } from '../../../hooks/useReloadUntil'
import { FeeRD, SendTxStateHandler } from '../../../services/chain/types'
import { GetExplorerTxUrl, OpenExplorerTxUrl } from '../../../services/clients'
import {
  FinderFeeVaultLevel,
  OperatorFinderFeeVault,
  OperatorFinderFeeVaultRD,
  RUNEBOND_LISTING_ADDRESS,
  RUNEBOND_LISTING_MIN_AMOUNT,
  reloadRewards
} from '../../../services/runebond'
import { ValidatePasswordHandler } from '../../../services/wallet/types'
import { walletTypeToI18n } from '../../../services/wallet/util'
import { useApp } from '../../../store/app/hooks'
import { BondWalletInfo } from '../../../views/bonds/types'
import { FlatButton } from '../../uielements/button'
import { Input } from '../../uielements/input'
import { truncateByDecimals, unformatValue, validInputValue } from '../../uielements/input/Input.util'
import { Modal } from '../../uielements/modal'
import { KnownFinderFeeVault, formatRuneAmount, isKnownVault, runeToBaseAmount } from './helpers'
import { MemoPreview } from './MemoPreview'
import { SummaryRow } from './operatorActions'
import { ErrorLine, FieldLabel, Suffix } from './RunebondListingModal'
import { useRunebondTxFlow } from './useBondTxFlow'

export const RUNEBOND_VAULT_DOCS_URL = 'https://runebond.com/docs/runebond-finder-fee-vault/'

export const VAULT_LEVEL_TEXT_CLASS: Record<FinderFeeVaultLevel, string> = {
  ok: 'text-gray2 dark:text-gray2d',
  warning: 'text-warning0 dark:text-warning0d',
  critical: 'text-error0 dark:text-error0d',
  depleted: 'text-error0 dark:text-error0d'
}

export type RunebondVaultSettled = (vault: OperatorFinderFeeVault) => boolean

const parseAmount = (text: string): BaseAmount | null => {
  const value = unformatValue(text)
  if (value === '') return null
  const parsed = bn(value)
  return parsed.isFinite() ? runeToBaseAmount(parsed) : null
}

export const useRunebondVaultTopUp = (vaultRD: OperatorFinderFeeVaultRD) => {
  const reloadUntil = useReloadUntil(vaultRD, reloadRewards, reloadRewards, RUNEBOND_RELOAD_DELAYS_MS)
  const [sent, setSent] = useState<{ settled: RunebondVaultSettled } | null>(null)

  const finish = useCallback(
    (settled: RunebondVaultSettled) => {
      setSent({ settled })
      reloadUntil(settled)
    },
    [reloadUntil]
  )

  const vault = O.toUndefined(useLastSuccess(vaultRD, undefined, { resetOnFailure: true }))

  const settledNow = sent !== null && vault !== undefined && sent.settled(vault)
  useEffect(() => {
    if (settledNow) setSent(null)
  }, [settledNow])

  return { vault, received: sent !== null && !settledNow, finish }
}

type FormProps = {
  network: Network
  operatorAddress: Address
  vault: KnownFinderFeeVault
  signer: BondWalletInfo
  walletBalance: BaseAmount
  fee: FeeRD
  transfer$: SendTxStateHandler
  validatePassword$: ValidatePasswordHandler
  openExplorerTxUrl: OpenExplorerTxUrl
  getExplorerTxUrl: GetExplorerTxUrl
  onBehalf?: boolean
  onClose: () => void
  onFinish: (settled: RunebondVaultSettled) => void
}

type Props = Omit<FormProps, 'vault'> & {
  vault: OperatorFinderFeeVault | undefined
}

const isOperatorVault = (vault: OperatorFinderFeeVault, operatorAddress: Address): vault is KnownFinderFeeVault =>
  isKnownVault(vault) && vault.address.toLowerCase() === operatorAddress.toLowerCase()

export const RunebondVaultTopUpModal = ({ vault, ...props }: Props) => {
  const { operatorAddress } = props
  const knownRD: RD.RemoteData<null, KnownFinderFeeVault> = useMemo(
    () =>
      vault === undefined ? RD.pending : isOperatorVault(vault, operatorAddress) ? RD.success(vault) : RD.failure(null),
    [vault, operatorAddress]
  )
  const known = O.toUndefined(useLastSuccess(knownRD, undefined, { resetOnFailure: true }))
  if (known === undefined) return null
  return <RunebondVaultTopUpForm {...props} vault={known} />
}

const RunebondVaultTopUpForm = ({
  network,
  operatorAddress,
  vault,
  signer,
  walletBalance,
  fee: feeRD,
  transfer$,
  validatePassword$,
  openExplorerTxUrl,
  getExplorerTxUrl,
  onBehalf = false,
  onClose,
  onFinish
}: FormProps) => {
  const intl = useIntl()
  const { isPrivate } = useApp()

  const balance = vault.balance
  const [amountText, setAmountText] = useState('')
  const amount = useMemo(() => parseAmount(amountText), [amountText])

  const onAmountChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value.replace(/,/g, '').trim()
    if (!validInputValue(value)) return
    setAmountText(truncateByDecimals(THORCHAIN_DECIMAL)(value === '.' ? '0.' : value))
  }, [])

  const amountError =
    amount !== null && amount.lt(RUNEBOND_LISTING_MIN_AMOUNT)
      ? intl.formatMessage(
          { id: 'bonds.runebond.vault.modal.amountError' },
          { amount: formatRuneAmount(RUNEBOND_LISTING_MIN_AMOUNT) }
        )
      : null

  const memo = getRunebondVaultTopupMemo(operatorAddress)

  const settled: RunebondVaultSettled = useCallback((fresh) => fresh.known && fresh.balance.gt(balance), [balance])
  const finish = useCallback(() => onFinish(settled), [onFinish, settled])

  const { isLoading, oFee, footerLabel, feeError, startSigning, modals } = useRunebondTxFlow({
    network,
    signer,
    fee: feeRD,
    transfer$,
    validatePassword$,
    openExplorerTxUrl,
    getExplorerTxUrl,
    onClose,
    onFinish: finish
  })

  const balanceError = amount !== null ? feeError(walletBalance, amount) : null
  const submitDisabled = isLoading || O.isNone(oFee) || amount === null || balanceError !== null || amountError !== null

  const formatVault = (value: BaseAmount) => (isPrivate ? hiddenString : `${formatRuneAmount(value)} RUNE`)

  const operatorLabel = truncateAddress(operatorAddress, THORChain, network)

  return (
    <>
      <Modal
        containerClassName="lg:pl-[240px]"
        backdropClassName="bg-bg0/40 dark:bg-bg0d/40"
        visible
        title={intl.formatMessage({
          id: onBehalf ? 'bonds.runebond.vault.onBehalf.modal.title' : 'bonds.runebond.vault.modal.title'
        })}
        onCancel={isLoading ? undefined : onClose}
        closable={!isLoading}
        footer={false}>
        <div className="flex flex-col px-2 pb-2">
          <span className="text-center font-main text-[14px] text-gray2 dark:text-gray2d">{operatorLabel}</span>
          {onBehalf ? (
            <span className="mt-4 rounded-lg border border-solid border-warning0/60 bg-warning0/10 px-4 py-3 font-main text-[13px] leading-relaxed text-text0 dark:border-warning0d/60 dark:bg-warning0d/10 dark:text-text0d">
              {intl.formatMessage({ id: 'bonds.runebond.vault.onBehalf.modal.intro' }, { operator: operatorLabel })}
            </span>
          ) : (
            <span className="mt-4 font-main text-[13px] leading-relaxed text-gray2 dark:text-gray2d">
              {intl.formatMessage({ id: 'bonds.runebond.vault.modal.intro' })}
            </span>
          )}

          <div className="mt-6 flex flex-col">
            <FieldLabel>{intl.formatMessage({ id: 'bonds.runebond.vault.modal.amount' })}</FieldLabel>
            <div className="relative mt-2">
              <Input
                id="runebond-vault-topup-amount"
                className="pr-16"
                value={amountText}
                onChange={onAmountChange}
                placeholder="0"
                inputMode="decimal"
                disabled={isLoading}
                size="large"
              />
              <Suffix>RUNE</Suffix>
            </div>
            {amountError && <ErrorLine>{amountError}</ErrorLine>}
          </div>

          {balanceError && (
            <span className="mt-2 font-main text-[14px] text-error0 dark:text-error0d">{balanceError}</span>
          )}

          <div className="mt-6 flex flex-col rounded-lg bg-bg2 p-4 sm:p-5 dark:bg-bg2d">
            <div className="flex flex-col gap-2">
              {onBehalf && (
                <>
                  <SummaryRow
                    label={intl.formatMessage({ id: 'bonds.runebond.vault.onBehalf.modal.signedFrom' })}
                    value={`${truncateAddress(signer.address, THORChain, network)} · ${walletTypeToI18n(
                      signer.walletType,
                      intl
                    )}`}
                  />
                  <SummaryRow
                    label={intl.formatMessage({ id: 'bonds.runebond.vault.onBehalf.modal.creditedTo' })}
                    value={operatorLabel}
                  />
                </>
              )}
              <SummaryRow
                label={intl.formatMessage({ id: 'bonds.runebond.vault.modal.now' })}
                value={formatVault(balance)}
              />
              <SummaryRow
                label={intl.formatMessage({ id: 'bonds.runebond.vault.modal.after' })}
                value={amount !== null ? formatVault(balance.plus(amount)) : '—'}
              />
              <SummaryRow
                label={intl.formatMessage({ id: 'bonds.runebond.listing.modal.sent' })}
                value={truncateAddress(RUNEBOND_LISTING_ADDRESS, THORChain, network)}
              />
              <SummaryRow
                label={intl.formatMessage({ id: 'bonds.runebond.vault.modal.credited' })}
                value={intl.formatMessage({ id: 'bonds.runebond.vault.modal.creditedValue' })}
              />
            </div>
          </div>

          <MemoPreview memo={memo} note={null} />

          <FlatButton
            className="mt-6 w-full"
            size="large"
            loading={isLoading}
            disabled={submitDisabled}
            onClick={() => {
              if (amount !== null) startSigning({ memo, amount })
            }}>
            {intl.formatMessage({
              id: onBehalf ? 'bonds.runebond.vault.onBehalf.modal.sign' : 'bonds.runebond.vault.modal.sign'
            })}
          </FlatButton>
          <span className="mt-3 text-center font-main text-[13px] text-gray2 dark:text-gray2d">{footerLabel}</span>
        </div>
      </Modal>
      {modals}
    </>
  )
}
