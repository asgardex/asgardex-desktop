import { ChangeEvent, useCallback, useMemo, useState } from 'react'

import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from '@headlessui/react'
import { ChevronDownIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { Network, TxHash } from '@xchainjs/xchain-client'
import { Address, BaseAmount, baseToAsset } from '@xchainjs/xchain-util'
import clsx from 'clsx'
import { function as FP, option as O } from 'fp-ts'
import { useIntl } from 'react-intl'

import { THORChain } from '../../../../shared/utils/chainIds'
import { isLedgerWallet } from '../../../../shared/utils/guard'
import { ZERO_BASE_AMOUNT } from '../../../const'
import { truncateAddress } from '../../../helpers/addressHelper'
import { THORCHAIN_DECIMAL } from '../../../helpers/assetHelper'
import { getRunebondWhitelistRequestMemo } from '../../../helpers/memoHelper'
import { hiddenString } from '../../../helpers/stringHelper'
import { FeeRD, SendTxStateHandler } from '../../../services/chain/types'
import { GetExplorerTxUrl, OpenExplorerTxUrl } from '../../../services/clients'
import {
  RUNEBOND_AFFILIATE_ADDRESS,
  RUNEBOND_LISTING_ADDRESS,
  RUNEBOND_LISTING_MIN_AMOUNT,
  addSentWhitelistRequest,
  reloadProviderRequests
} from '../../../services/runebond'
import { NodeInfo } from '../../../services/thorchain/types'
import { ValidatePasswordHandler } from '../../../services/wallet/types'
import { walletTypeToI18n } from '../../../services/wallet/util'
import { useApp } from '../../../store/app/hooks'
import { BondWalletInfo } from '../../../views/bonds/types'
import { FlatButton } from '../../uielements/button'
import { Input } from '../../uielements/input'
import { truncateByDecimals, validInputValue } from '../../uielements/input/Input.util'
import { Modal } from '../../uielements/modal'
import { formatRuneAmount } from './helpers'
import { MemoPreview } from './MemoPreview'
import { SummaryRow } from './operatorActions'
import { ErrorLine, FieldLabel, Suffix } from './RunebondListingModal'
import { parseAmount } from './RunebondVaultTopUpModal'
import { useRunebondTxFlow } from './useBondTxFlow'

type Props = {
  network: Network
  node: NodeInfo
  name: string | null
  minBond: BaseAmount
  roomLeft: BaseAmount
  walletInfos: BondWalletInfo[]
  balanceByAddress: (address: Address) => BaseAmount
  fee: FeeRD
  transfer$: SendTxStateHandler
  validatePassword$: ValidatePasswordHandler
  openExplorerTxUrl: OpenExplorerTxUrl
  getExplorerTxUrl: GetExplorerTxUrl
  onClose: () => void
  onFinish: () => void
}

export const RunebondRequestSlotModal = ({
  network,
  node,
  name,
  minBond,
  roomLeft,
  walletInfos,
  balanceByAddress,
  fee: feeRD,
  transfer$,
  validatePassword$,
  openExplorerTxUrl,
  getExplorerTxUrl,
  onClose,
  onFinish
}: Props) => {
  const intl = useIntl()
  const { isPrivate } = useApp()

  const richestWallet = useMemo(
    () =>
      walletInfos.reduce((best, info) =>
        balanceByAddress(info.address).gt(balanceByAddress(best.address)) ? info : best
      ),
    [walletInfos, balanceByAddress]
  )
  const [pickedSigner, setPickedSigner] = useState<BondWalletInfo | null>(null)
  const signer = pickedSigner ?? richestWallet
  const [amountText, setAmountText] = useState(() => baseToAsset(minBond).amount().toFixed())
  const amount = useMemo(() => parseAmount(amountText), [amountText])

  const onAmountChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value.replace(/,/g, '').trim()
    if (!validInputValue(value)) return
    setAmountText(truncateByDecimals(THORCHAIN_DECIMAL)(value === '.' ? '0.' : value))
  }, [])

  const intendedBond = amount !== null && amount.gt(0) ? amount : null

  const memo = getRunebondWhitelistRequestMemo(
    node.address,
    signer.address,
    intendedBond ?? ZERO_BASE_AMOUNT,
    O.toUndefined(RUNEBOND_AFFILIATE_ADDRESS)
  )

  const [signed, setSigned] = useState<{ providerAddress: Address; intendedBond: BaseAmount } | null>(null)

  const finish = useCallback(
    (txHash?: TxHash) => {
      if (txHash && signed) {
        addSentWhitelistRequest({ txHash, nodeAddress: node.address, ...signed, sentDate: new Date() })
        reloadProviderRequests()
      }
      onFinish()
    },
    [node.address, onFinish, signed]
  )

  const { isLoading, oFee, startSigning, modals } = useRunebondTxFlow({
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

  const formatAmount = (value: BaseAmount) => (isPrivate ? hiddenString : formatRuneAmount(value))

  const notEnough = FP.pipe(
    oFee,
    O.exists((fee) => balanceByAddress(signer.address).lt(fee.plus(RUNEBOND_LISTING_MIN_AMOUNT)))
  )
  const error = notEnough
    ? intl.formatMessage(
        { id: 'bonds.runebond.requestSlot.error.notEnough' },
        { amount: formatRuneAmount(RUNEBOND_LISTING_MIN_AMOUNT) }
      )
    : intendedBond === null
      ? intl.formatMessage({ id: 'bonds.runebond.requestSlot.error.empty' })
      : null

  const warning =
    intendedBond === null
      ? null
      : intendedBond.lt(minBond)
        ? intl.formatMessage({ id: 'bonds.runebond.requestSlot.warning.belowMin' }, { amount: formatAmount(minBond) })
        : intendedBond.gt(roomLeft)
          ? intl.formatMessage(
              { id: 'bonds.runebond.requestSlot.warning.aboveRoom' },
              { amount: formatAmount(roomLeft) }
            )
          : null

  const submitDisabled = isLoading || O.isNone(oFee) || error !== null

  const nodeLabel = truncateAddress(node.address, THORChain, network)

  const footer = FP.pipe(
    oFee,
    O.fold(
      () => '—',
      (fee) => {
        const networkFee = intl.formatMessage(
          { id: 'bonds.runebond.requestSlot.networkFee' },
          { fee: formatRuneAmount(fee) }
        )
        return isLedgerWallet(signer.walletType)
          ? `${networkFee} · ${intl.formatMessage({ id: 'bonds.runebond.requestSlot.ledgerConfirm' })}`
          : networkFee
      }
    )
  )

  const renderWallet = (info: BondWalletInfo) => (
    <div className="flex min-w-0 flex-col">
      <span className="font-mono text-[14px] text-text0 dark:text-text0d">
        {truncateAddress(info.address, THORChain, network)}
      </span>
      <span className="mt-0.5 font-main text-[12px] text-gray2 dark:text-gray2d">
        {`${walletTypeToI18n(info.walletType, intl)} · ᚱ${formatAmount(balanceByAddress(info.address))}`}
      </span>
    </div>
  )

  const renderFrom = () =>
    walletInfos.length > 1 ? (
      <Listbox value={signer} by="address" disabled={isLoading} onChange={setPickedSigner}>
        <div className="relative mt-2">
          <ListboxButton
            as="div"
            className={clsx(
              'flex cursor-pointer items-center justify-between gap-3 rounded-lg px-4 py-2.5',
              'border border-solid border-gray0 bg-bg0 dark:border-gray0d dark:bg-bg0d',
              { 'opacity-50': isLoading }
            )}>
            {({ open }) => (
              <>
                {renderWallet(signer)}
                <ChevronDownIcon
                  className={clsx('h-4 w-4 shrink-0 text-gray2 dark:text-gray2d', { 'rotate-180': open })}
                />
              </>
            )}
          </ListboxButton>
          <ListboxOptions
            className={clsx(
              'absolute z-[2000] mt-1 max-h-60 w-full overflow-auto rounded-lg focus:outline-hidden',
              'border border-solid border-gray0 bg-bg0 dark:border-gray0d dark:bg-bg0d'
            )}>
            {walletInfos.map((info) => (
              <ListboxOption
                key={info.address}
                value={info}
                className="cursor-pointer px-4 py-2.5 data-focus:bg-bg2 data-selected:bg-bg2 dark:data-focus:bg-bg2d dark:data-selected:bg-bg2d">
                {renderWallet(info)}
              </ListboxOption>
            ))}
          </ListboxOptions>
        </div>
      </Listbox>
    ) : (
      <div className="mt-2 flex rounded-lg border border-solid border-gray0 px-4 py-2.5 dark:border-gray0d">
        {renderWallet(signer)}
      </div>
    )

  return (
    <>
      <Modal
        containerClassName="lg:pl-[240px]"
        backdropClassName="bg-bg0/40 dark:bg-bg0d/40"
        visible
        title={intl.formatMessage({ id: 'bonds.runebond.requestSlot.title' })}
        onCancel={isLoading ? undefined : onClose}
        closable={!isLoading}
        footer={false}>
        <div className="flex flex-col px-2 pb-2">
          <span className="truncate text-center font-mono text-[14px] text-gray2 dark:text-gray2d">
            {name ? `${name} · ${nodeLabel}` : nodeLabel}
          </span>

          <div className="mt-6 flex flex-col">
            <FieldLabel>{intl.formatMessage({ id: 'bonds.runebond.requestSlot.intendedBond' })}</FieldLabel>
            <div className="relative mt-2">
              <Input
                id="runebond-request-slot-amount"
                className={clsx('pr-16', warning && '!border-warning0 dark:!border-warning0d')}
                value={amountText}
                onChange={onAmountChange}
                placeholder="0"
                inputMode="decimal"
                disabled={isLoading}
                size="large"
              />
              <Suffix>RUNE</Suffix>
            </div>
            <div className="mt-2 flex min-h-[40px] items-start gap-1.5 font-main text-[13px] leading-5">
              {warning ? (
                <>
                  <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-warning0 dark:text-warning0d" />
                  <span className="text-warning0 dark:text-warning0d">{warning}</span>
                </>
              ) : (
                <span className="text-gray2 dark:text-gray2d">
                  {intl.formatMessage(
                    { id: 'bonds.runebond.requestSlot.hint' },
                    { min: formatAmount(minBond), room: formatAmount(roomLeft) }
                  )}
                </span>
              )}
            </div>
          </div>

          <div className="mt-6 flex flex-col">
            <FieldLabel>{intl.formatMessage({ id: 'bonds.runebond.requestSlot.from' })}</FieldLabel>
            {renderFrom()}
            {error && <ErrorLine>{error}</ErrorLine>}
          </div>

          <div className="mt-6 flex flex-col rounded-lg bg-bg2 p-4 sm:p-5 dark:bg-bg2d">
            <div className="flex flex-col gap-2">
              <SummaryRow
                label={intl.formatMessage({ id: 'bonds.runebond.requestSlot.sentTo' })}
                value={truncateAddress(RUNEBOND_LISTING_ADDRESS, THORChain, network)}
              />
              <SummaryRow
                label={intl.formatMessage({ id: 'bonds.runebond.requestSlot.attached' })}
                value={intl.formatMessage(
                  { id: 'bonds.runebond.requestSlot.attachedValue' },
                  { amount: formatRuneAmount(RUNEBOND_LISTING_MIN_AMOUNT) }
                )}
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
              if (intendedBond === null) return
              setPickedSigner(signer)
              setSigned({ providerAddress: signer.address, intendedBond })
              startSigning({ memo, amount: RUNEBOND_LISTING_MIN_AMOUNT })
            }}>
            {intl.formatMessage({ id: 'bonds.runebond.requestSlot.sign' })}
          </FlatButton>
          <span className="mt-3 text-center font-main text-[13px] text-gray2 dark:text-gray2d">{footer}</span>
        </div>
      </Modal>
      {modals}
    </>
  )
}
