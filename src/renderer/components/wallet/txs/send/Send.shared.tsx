import { useCallback, useState } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from '@headlessui/react'
import { ChevronDownIcon, FolderIcon } from '@heroicons/react/24/outline'
import { Network } from '@xchainjs/xchain-client'
import { AnyAsset, BaseAmount } from '@xchainjs/xchain-util'
import clsx from 'clsx'
import { function as FP, option as O } from 'fp-ts'
import { IntlShape } from 'react-intl'

import { TrustedAddress } from '../../../../../shared/api/types'
import { isEvmChain } from '../../../../helpers/evmHelper'
import { DepositState, SendTxState } from '../../../../services/chain/types'
import { GetExplorerTxUrl, OpenExplorerTxUrl } from '../../../../services/clients'
import { UnifiedTxModal, txHashRDToBoolean, extractTxHash, getDepositTimerValue, TxConfig } from '../../../modal/tx'
import { Label } from '../../../uielements/label'
import * as H from '../TxForm.helpers'

/**
 * Utility function to filter matched addresses from saved addresses
 */
export const filterMatchedAddresses = (
  oSavedAddresses: O.Option<TrustedAddress[]>,
  searchValue: string,
  caseSensitive: boolean = true
): O.Option<TrustedAddress[]> => {
  if (!searchValue) return O.none

  return FP.pipe(
    oSavedAddresses,
    O.map((addresses) =>
      addresses.filter((address) =>
        caseSensitive
          ? address.address.includes(searchValue)
          : address.address.toLowerCase().includes(searchValue.toLowerCase())
      )
    ),
    O.chain(O.fromPredicate((filteredAddresses) => filteredAddresses.length > 0))
  )
}

export const renderTxModal = ({
  asset,
  amountToSend,
  network,
  sendTxState,
  resetSendTxState,
  sendTxStartTime,
  openExplorerTxUrl,
  getExplorerTxUrl,
  intl
}: {
  asset: AnyAsset
  amountToSend: BaseAmount
  network: Network
  sendTxState: SendTxState
  resetSendTxState: FP.Lazy<void>
  sendTxStartTime: number
  openExplorerTxUrl: OpenExplorerTxUrl
  getExplorerTxUrl: GetExplorerTxUrl
  intl: IntlShape
}) => {
  const { status } = sendTxState

  // don't render TxModal in initial state
  if (RD.isInitial(status)) return <></>

  const oTxHash = extractTxHash(status, asset.chain)
  const txRD = txHashRDToBoolean(status)

  const txConfig: TxConfig = {
    type: 'send',
    asset: { asset, amount: amountToSend }
  }

  return (
    <UnifiedTxModal
      title={intl.formatMessage({ id: 'common.tx.sending' })}
      onClose={resetSendTxState}
      onFinish={resetSendTxState}
      startTime={sendTxStartTime}
      txRD={txRD}
      timerValue={H.getSendTxTimerValue(status)}
      txConfig={txConfig}
      txHash={oTxHash}
      getExplorerTxUrl={getExplorerTxUrl}
      openExplorerTxUrl={openExplorerTxUrl}
      network={network}
    />
  )
}

export const renderDepositModal = ({
  asset,
  amountToSend,
  network,
  depositState,
  resetDepositState,
  sendTxStartTime,
  openExplorerTxUrl,
  getExplorerTxUrl,
  intl
}: {
  asset: AnyAsset
  amountToSend: BaseAmount
  network: Network
  depositState: DepositState
  resetDepositState: FP.Lazy<void>
  sendTxStartTime: number
  openExplorerTxUrl: OpenExplorerTxUrl
  getExplorerTxUrl: GetExplorerTxUrl
  intl: IntlShape
}) => {
  const { deposit: depositRD, depositTx } = depositState

  // don't render TxModal in initial state
  if (RD.isInitial(depositRD)) return <></>

  // title
  const txModalTitle = FP.pipe(
    depositRD,
    RD.fold(
      () => 'deposit.add.state.pending',
      () => 'deposit.add.state.pending',
      () => 'deposit.add.state.error',
      () => 'deposit.add.state.success'
    ),
    (id) => intl.formatMessage({ id })
  )

  const oTxHash = FP.pipe(
    RD.toOption(depositTx),
    O.map((txHash) => (isEvmChain(asset.chain) ? txHash.replace(/0x/i, '') : txHash))
  )

  const timerValue = getDepositTimerValue(depositRD)

  const stepDescriptions = [
    intl.formatMessage({ id: 'common.tx.healthCheck' }),
    intl.formatMessage({ id: 'common.tx.sendingAsset' }, { assetTicker: asset.ticker }),
    intl.formatMessage({ id: 'common.tx.checkResult' })
  ]

  const txConfig: TxConfig = {
    type: 'deposit',
    asset: { asset, amount: amountToSend },
    steps: { current: depositState.step, total: depositState.stepsTotal },
    stepDescriptions
  }

  return (
    <UnifiedTxModal
      title={txModalTitle}
      onClose={resetDepositState}
      onFinish={resetDepositState}
      startTime={sendTxStartTime}
      txRD={depositRD}
      timerValue={timerValue}
      txConfig={txConfig}
      txHash={oTxHash}
      getExplorerTxUrl={getExplorerTxUrl}
      openExplorerTxUrl={openExplorerTxUrl}
      network={network}
    />
  )
}

export const SavedAddressSelect = ({
  placeholder,
  onChange,
  addresses
}: {
  placeholder: string
  addresses: { address: string; name: string }[]
  onChange: (address: string) => void
}) => {
  const [selected, setSelected] = useState<string>()

  const handleChange = useCallback(
    (value: string) => {
      setSelected(value)
      onChange(value)
    },
    [onChange]
  )

  return (
    <Listbox onChange={handleChange}>
      <div className="relative">
        <ListboxButton
          className={clsx(
            'relative block w-full rounded-lg border border-solid border-gray0 bg-bg0 py-1.5 pr-8 pl-3 text-left text-sm/6 text-text0 dark:border-gray0d dark:bg-bg0d dark:text-text0d',
            'focus:not-data-focus:outline-hidden data-focus:outline-2 data-focus:-outline-offset-2 data-focus:outline-white/25'
          )}>
          <Label size="big">{selected ? selected : placeholder.toUpperCase()}</Label>
          <ChevronDownIcon className="group pointer-events-none absolute top-2.5 right-2.5 size-4 stroke-text0 dark:stroke-text0d" />
        </ListboxButton>
      </div>
      <ListboxOptions
        anchor="bottom start"
        transition
        className="mt-1 w-[var(--button-width)] rounded-md border border-solid border-gray0 bg-bg0 p-4 dark:border-gray0d dark:bg-bg0d">
        {addresses.length ? (
          addresses.map(({ address, name }) => (
            <ListboxOption className="flex cursor-pointer items-center justify-between" key={address} value={address}>
              <Label>{address}</Label>
              <div className="rounded-lg bg-turquoise px-2">
                <Label color="white" size="small" textTransform="uppercase">
                  {name}
                </Label>
              </div>
            </ListboxOption>
          ))
        ) : (
          <div className="flex w-full items-center justify-center space-x-2 py-8">
            <FolderIcon className="h-8 w-8 stroke-text0 dark:stroke-text0d" />
            <Label className="!w-auto" textTransform="uppercase">
              No Saved Addresses
            </Label>
          </div>
        )}
      </ListboxOptions>
    </Listbox>
  )
}
