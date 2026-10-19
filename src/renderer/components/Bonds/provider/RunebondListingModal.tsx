import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { InformationCircleIcon } from '@heroicons/react/24/outline'
import { Network } from '@xchainjs/xchain-client'
import { BaseAmount, baseToAsset } from '@xchainjs/xchain-util'
import BigNumber from 'bignumber.js'
import { option as O } from 'fp-ts'
import { useIntl } from 'react-intl'

import { THORChain } from '../../../../shared/utils/chainIds'
import { isKeystoreWallet } from '../../../../shared/utils/guard'
import { ZERO_BN } from '../../../const'
import { truncateAddress } from '../../../helpers/addressHelper'
import { THORCHAIN_DECIMAL } from '../../../helpers/assetHelper'
import { getRunebondDelistMemo, getRunebondListMemo } from '../../../helpers/memoHelper'
import { useLastSuccess } from '../../../hooks/useLastSuccess'
import { RUNEBOND_RELOAD_DELAYS_MS, useReloadUntil } from '../../../hooks/useReloadUntil'
import { FeeRD, SendTxStateHandler } from '../../../services/chain/types'
import { GetExplorerTxUrl, OpenExplorerTxUrl } from '../../../services/clients'
import {
  NodeListing,
  NodeListingDetails,
  NodeListingRD,
  OperatorFinderFeeVault,
  RUNEBOND_LISTING_ADDRESS,
  RUNEBOND_LISTING_MIN_AMOUNT,
  reloadRewards
} from '../../../services/runebond'
import { NodeInfo } from '../../../services/thorchain/types'
import { ValidatePasswordHandler } from '../../../services/wallet/types'
import { BondWalletInfo } from '../../../views/bonds/types'
import { FlatButton } from '../../uielements/button'
import { InputBigNumber } from '../../uielements/input'
import { Modal } from '../../uielements/modal'
import {
  MAX_FEE_BPS,
  formatBpsAsPercent,
  formatRuneAmount,
  isVaultDepleted,
  operatorFeeBps,
  runeToBaseAmount
} from './helpers'
import { MemoPreview } from './MemoPreview'
import { SummaryRow } from './operatorActions'
import { useRunebondTxFlow } from './useBondTxFlow'

export type RunebondListingAction = { type: 'list' } | { type: 'delist' }

export type RunebondListingSettled = (listing: NodeListing) => boolean

type Props = {
  action: RunebondListingAction
  network: Network
  node: NodeInfo
  signer: BondWalletInfo
  listing: NodeListing | undefined
  walletBalance: BaseAmount
  fee: FeeRD
  transfer$: SendTxStateHandler
  validatePassword$: ValidatePasswordHandler
  openExplorerTxUrl: OpenExplorerTxUrl
  getExplorerTxUrl: GetExplorerTxUrl
  vault?: OperatorFinderFeeVault
  onTopUpVault?: () => void
  onClose: () => void
  onFinish: (settled: RunebondListingSettled) => void
}

type Terms = {
  minBond: BaseAmount
  targetTotalBond: BaseAmount
  feeBps: number
}

const toFeeBps = (feePercent: BigNumber): number =>
  feePercent.times(100).integerValue(BigNumber.ROUND_HALF_UP).toNumber()

const isFeeInRange = (feeBps: number): boolean => Number.isFinite(feeBps) && feeBps >= 0 && feeBps <= MAX_FEE_BPS

const isListedBy = (
  listing: NodeListing | undefined,
  operatorAddress: string
): listing is NodeListing & { listing: NodeListingDetails } =>
  listing !== undefined &&
  listing.listed &&
  listing.listing !== null &&
  listing.listing.operatorAddress.toLowerCase() === operatorAddress.toLowerCase()

const termsMatch = (listing: NodeListing, operatorAddress: string, terms: Terms): boolean =>
  isListedBy(listing, operatorAddress) &&
  listing.listing.minBond.eq(terms.minBond) &&
  listing.listing.targetTotalBond !== null &&
  listing.listing.targetTotalBond.eq(terms.targetTotalBond) &&
  listing.listing.feeBps === terms.feeBps

const LISTING_SYNC_WINDOW_MS = RUNEBOND_RELOAD_DELAYS_MS.reduce((total, delay) => total + delay, 30_000)

export const useRunebondListingReload = (listingRD: NodeListingRD) => {
  const reloadUntil = useReloadUntil(listingRD, reloadRewards, reloadRewards, RUNEBOND_RELOAD_DELAYS_MS)
  const [expected, setExpected] = useState<{ settled: RunebondListingSettled } | null>(null)

  const finish = useCallback(
    (settled: RunebondListingSettled) => {
      setExpected({ settled })
      reloadUntil(settled)
    },
    [reloadUntil]
  )

  useEffect(() => {
    if (!expected) return
    const timer = window.setTimeout(() => setExpected(null), LISTING_SYNC_WINDOW_MS)
    return () => window.clearTimeout(timer)
  }, [expected])

  const listing = O.toUndefined(useLastSuccess(listingRD, undefined, { resetOnFailure: true }))

  const awaiting = expected !== null && !(RD.isSuccess(listingRD) && expected.settled(listingRD.value))

  return { awaiting, finish, listing }
}

export const FieldLabel = ({ children }: { children: ReactNode }) => (
  <span className="font-main-semi-bold text-[12px] tracking-[2px] text-gray2 uppercase dark:text-gray2d">
    {children}
  </span>
)

export const Suffix = ({ children }: { children: ReactNode }) => (
  <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 font-main-semi-bold text-[12px] text-gray2 uppercase dark:text-gray2d">
    {children}
  </span>
)

export const ErrorLine = ({ children }: { children: ReactNode }) => (
  <span className="mt-1 font-main text-[14px] text-error0 dark:text-error0d">{children}</span>
)

export const RunebondListingModal = ({
  action,
  network,
  node,
  signer,
  listing,
  walletBalance,
  fee: feeRD,
  transfer$,
  validatePassword$,
  openExplorerTxUrl,
  getExplorerTxUrl,
  vault,
  onTopUpVault,
  onClose,
  onFinish
}: Props) => {
  const intl = useIntl()
  const isDelist = action.type === 'delist'
  const blockedByVault = !isDelist && isVaultDepleted(vault)
  const current = isListedBy(listing, node.nodeOperatorAddress) ? listing.listing : null
  const isUpdate = current !== null
  const onChainFeeBps = operatorFeeBps(node.bondProviders.nodeOperatorFee)

  const [minInput, setMinInput] = useState<BigNumber>(() => (current ? baseToAsset(current.minBond).amount() : ZERO_BN))
  const [targetInput, setTargetInput] = useState<BigNumber>(() =>
    current ? baseToAsset(current.targetTotalBond ?? current.minBond).amount() : ZERO_BN
  )
  const [feeInput, setFeeInput] = useState<BigNumber>(() => new BigNumber(current?.feeBps ?? onChainFeeBps).div(100))
  const [touched, setTouched] = useState({ min: false, target: false })

  const terms: Terms = useMemo(
    () => ({
      minBond: runeToBaseAmount(minInput),
      targetTotalBond: runeToBaseAmount(targetInput),
      feeBps: toFeeBps(feeInput)
    }),
    [feeInput, minInput, targetInput]
  )

  const minError = terms.minBond.lte(0) ? intl.formatMessage({ id: 'bonds.runebond.listing.modal.minError' }) : null
  const targetError =
    terms.targetTotalBond.lte(0) || terms.targetTotalBond.lt(terms.minBond)
      ? intl.formatMessage({ id: 'bonds.runebond.listing.modal.targetError' })
      : null
  const feeRangeError = isFeeInRange(terms.feeBps)
    ? null
    : intl.formatMessage({ id: 'bonds.runebond.listing.modal.feeError' })
  const unchanged =
    current !== null &&
    current.minBond.eq(terms.minBond) &&
    current.targetTotalBond !== null &&
    current.targetTotalBond.eq(terms.targetTotalBond) &&
    current.feeBps === terms.feeBps
  const inputComplete = isDelist || (minError === null && targetError === null && feeRangeError === null && !unchanged)

  const memo = useMemo(
    () =>
      isDelist
        ? getRunebondDelistMemo(node.address)
        : getRunebondListMemo(
            node.address,
            terms.minBond,
            terms.targetTotalBond,
            isFeeInRange(terms.feeBps) ? terms.feeBps : onChainFeeBps
          ),
    [isDelist, node.address, onChainFeeBps, terms]
  )

  const settled: RunebondListingSettled = useCallback(
    (fresh) => (isDelist ? !fresh.listed : termsMatch(fresh, node.nodeOperatorAddress, terms)),
    [isDelist, node.nodeOperatorAddress, terms]
  )
  const finish = useCallback(() => onFinish(settled), [onFinish, settled])

  const { isLoading, oFee, feeLabel, footerLabel, feeError, startSigning, modals } = useRunebondTxFlow({
    network,
    signer,
    fee: feeRD,
    transfer$,
    validatePassword$,
    openExplorerTxUrl,
    getExplorerTxUrl,
    onFinish: finish
  })

  const balanceError = feeError(walletBalance, RUNEBOND_LISTING_MIN_AMOUNT)
  const submitDisabled = isLoading || O.isNone(oFee) || balanceError !== null || !inputComplete

  const title = intl.formatMessage({
    id: blockedByVault
      ? 'bonds.runebond.vault.blocked.title'
      : isDelist
        ? 'bonds.runebond.listing.modal.delistTitle'
        : isUpdate
          ? 'bonds.runebond.listing.modal.updateTitle'
          : 'bonds.runebond.listing.modal.listTitle'
  })
  const cta = intl.formatMessage({
    id: isDelist
      ? 'bonds.runebond.listing.modal.signDelist'
      : isUpdate
        ? 'bonds.runebond.listing.modal.signUpdate'
        : 'bonds.runebond.listing.modal.signList'
  })

  const attachedAmount = formatRuneAmount(RUNEBOND_LISTING_MIN_AMOUNT)

  const renderFields = () => (
    <>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-y-0">
        <div className="flex flex-col sm:row-span-3 sm:grid sm:grid-rows-subgrid">
          <div className="sm:self-end">
            <FieldLabel>{intl.formatMessage({ id: 'bonds.runebond.listing.modal.minBond' })}</FieldLabel>
          </div>
          <div className="relative mt-2">
            <InputBigNumber
              value={minInput}
              onChange={(value) => {
                setMinInput(value)
                setTouched((prev) => ({ ...prev, min: true }))
              }}
              disabled={isLoading}
              size="large"
              decimal={THORCHAIN_DECIMAL}
            />
            <Suffix>RUNE</Suffix>
          </div>
          {touched.min && minError && <ErrorLine>{minError}</ErrorLine>}
        </div>
        <div className="flex flex-col sm:row-span-3 sm:grid sm:grid-rows-subgrid">
          <div className="sm:self-end">
            <FieldLabel>{intl.formatMessage({ id: 'bonds.runebond.listing.modal.targetBond' })}</FieldLabel>
          </div>
          <div className="relative mt-2">
            <InputBigNumber
              value={targetInput}
              onChange={(value) => {
                setTargetInput(value)
                setTouched((prev) => ({ ...prev, target: true }))
              }}
              disabled={isLoading}
              size="large"
              decimal={THORCHAIN_DECIMAL}
            />
            <Suffix>RUNE</Suffix>
          </div>
          {touched.target && targetError && <ErrorLine>{targetError}</ErrorLine>}
        </div>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-x-4 sm:grid-cols-2">
        <div className="sm:col-start-1 sm:row-start-1">
          <FieldLabel>{intl.formatMessage({ id: 'bonds.runebond.listing.modal.fee' })}</FieldLabel>
        </div>
        <div className="relative mt-2 sm:col-start-1 sm:row-start-2">
          <InputBigNumber
            className="pr-8"
            value={feeInput}
            onChange={setFeeInput}
            disabled={isLoading}
            size="large"
            decimal={2}
          />
          <Suffix>%</Suffix>
        </div>
        <span className="mt-2 font-main text-[13px] leading-normal text-gray2 sm:col-start-2 sm:row-start-2 sm:self-center dark:text-gray2d">
          {intl.formatMessage({ id: 'bonds.runebond.listing.modal.feeHint' })}
        </span>
      </div>
      {feeRangeError && <ErrorLine>{feeRangeError}</ErrorLine>}
      {!feeRangeError && terms.feeBps !== onChainFeeBps && (
        <div className="mt-4 flex items-start gap-2.5 rounded-lg bg-turquoise/10 px-4 py-3">
          <InformationCircleIcon className="h-[18px] w-[18px] shrink-0 text-turquoise" />
          <span className="font-main text-[13px] leading-normal text-text0 dark:text-text0d">
            {intl.formatMessage(
              { id: 'bonds.runebond.listing.modal.feeMismatch' },
              {
                fee: formatBpsAsPercent(terms.feeBps, intl.locale),
                nodeFee: formatBpsAsPercent(onChainFeeBps, intl.locale)
              }
            )}
          </span>
        </div>
      )}
    </>
  )

  const renderSummary = () => (
    <>
      <div className="mt-6 flex flex-col rounded-lg bg-bg2 p-4 sm:p-5 dark:bg-bg2d">
        <div className="flex flex-col gap-2">
          <SummaryRow
            label={intl.formatMessage({ id: 'bonds.runebond.listing.modal.sentTo' })}
            value={truncateAddress(RUNEBOND_LISTING_ADDRESS, THORChain, network)}
          />
          <SummaryRow
            label={intl.formatMessage({ id: 'bonds.operator.modal.attached' })}
            value={intl.formatMessage(
              {
                id: isDelist
                  ? 'bonds.runebond.listing.modal.attachedDelist'
                  : 'bonds.runebond.listing.modal.attachedList'
              },
              { amount: attachedAmount }
            )}
          />
        </div>
      </div>
      <MemoPreview memo={memo} note={null} />
    </>
  )

  const footer = isKeystoreWallet(signer.walletType)
    ? intl.formatMessage({ id: 'bonds.runebond.listing.modal.footer' }, { amount: attachedAmount, fee: feeLabel })
    : footerLabel

  const renderForm = () => (
    <>
      {!isDelist && renderFields()}
      {balanceError && <span className="mt-2 font-main text-[14px] text-error0 dark:text-error0d">{balanceError}</span>}

      {renderSummary()}

      <FlatButton
        className="mt-6 w-full"
        size="large"
        color={isDelist ? 'error' : 'primary'}
        loading={isLoading}
        disabled={submitDisabled}
        onClick={() => startSigning({ memo, amount: RUNEBOND_LISTING_MIN_AMOUNT })}>
        {cta}
      </FlatButton>
      <span className="mt-3 text-center font-main text-[13px] text-gray2 dark:text-gray2d">{footer}</span>
    </>
  )

  const renderBlockedByVault = () => (
    <>
      <span className="mt-6 font-main text-[15px] text-text0 dark:text-text0d">
        {intl.formatMessage({ id: 'bonds.runebond.vault.blocked.headline' })}
      </span>
      <span className="mt-2 font-main text-[13px] leading-relaxed text-gray2 dark:text-gray2d">
        {intl.formatMessage({ id: 'bonds.runebond.vault.blocked.body' })}
      </span>
      {onTopUpVault && isVaultDepleted(vault) && (
        <FlatButton className="mt-6 w-full" size="large" onClick={onTopUpVault}>
          {intl.formatMessage({ id: 'bonds.runebond.vault.topUp' })}
        </FlatButton>
      )}
    </>
  )

  return (
    <>
      <Modal
        containerClassName="lg:pl-[240px]"
        backdropClassName="bg-bg0/40 dark:bg-bg0d/40"
        visible
        title={title}
        onCancel={isLoading ? undefined : onClose}
        closable={!isLoading}
        footer={false}>
        <div className="flex flex-col px-2 pb-2">
          <span className="text-center font-mono text-[14px] text-gray2 dark:text-gray2d">
            {truncateAddress(node.address, THORChain, network)}
          </span>

          {blockedByVault ? renderBlockedByVault() : renderForm()}
        </div>
      </Modal>
      {modals}
    </>
  )
}
