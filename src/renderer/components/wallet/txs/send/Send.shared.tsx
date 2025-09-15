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
import { TxModal } from '../../../modal/tx'
import { SendAsset } from '../../../modal/tx/extra/SendAsset'
import { ViewTxButton } from '../../../uielements/button'
import { Label } from '../../../uielements/label'
import * as H from '../TxForm.helpers'

/**
 * Utility function to filter matched addresses from saved addresses
 * @param oSavedAddresses - Option of saved addresses array
 * @param searchValue - The value to search for in addresses
 * @param caseSensitive - Whether to perform case-sensitive search (default: true)
 * @returns Option of matched addresses or O.none if no matches
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

  const oTxHash = RD.toOption(status)
  const txRD = FP.pipe(
    status,
    RD.map((txHash) => !!txHash)
  )

  return (
    <TxModal
      title={intl.formatMessage({ id: 'common.tx.sending' })}
      onClose={resetSendTxState}
      onFinish={resetSendTxState}
      startTime={sendTxStartTime}
      txRD={txRD}
      extraResult={
        <ViewTxButton
          txHash={oTxHash}
          onClick={openExplorerTxUrl}
          txUrl={FP.pipe(oTxHash, O.chain(getExplorerTxUrl))}
        />
      }
      timerValue={H.getSendTxTimerValue(status)}
      extra={
        <SendAsset
          asset={{ asset, amount: amountToSend }}
          description={H.getSendTxDescription({ status, asset, intl })}
          network={network}
        />
      }
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
    // Note: As long as we link to `viewblock` to open tx details in a browser,
    // `0x` needs to be removed from tx hash in case of ETH
    // @see https://github.com/thorchain/asgardex-electron/issues/1787#issuecomment-931934508
    O.map((txHash) => (isEvmChain(asset.chain) ? txHash.replace(/0x/i, '') : txHash))
  )

  // Get timer value
  const timerValue = FP.pipe(
    depositRD,
    RD.fold(
      () => 0,
      FP.flow(
        O.map(({ loaded }) => loaded),
        O.getOrElse(() => 0)
      ),
      () => 0,
      () => 100
    )
  )
  const stepDescriptions = [
    intl.formatMessage({ id: 'common.tx.healthCheck' }),
    intl.formatMessage({ id: 'common.tx.sendingAsset' }, { assetTicker: asset.ticker }),
    intl.formatMessage({ id: 'common.tx.checkResult' })
  ]
  const stepDescription = FP.pipe(
    depositState.deposit,
    RD.fold(
      () => '',
      () =>
        `${intl.formatMessage(
          { id: 'common.step' },
          { current: depositState.step, total: depositState.stepsTotal }
        )}: ${stepDescriptions[depositState.step - 1]}`,
      () => '',
      () => `${intl.formatMessage({ id: 'common.done' })}!`
    )
  )

  return (
    <TxModal
      title={txModalTitle}
      onClose={resetDepositState}
      onFinish={resetDepositState}
      startTime={sendTxStartTime}
      txRD={depositRD}
      extraResult={
        <ViewTxButton
          txHash={oTxHash}
          onClick={openExplorerTxUrl}
          txUrl={FP.pipe(oTxHash, O.chain(getExplorerTxUrl))}
        />
      }
      timerValue={timerValue}
      extra={<SendAsset asset={{ asset, amount: amountToSend }} description={stepDescription} network={network} />}
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
            'relative block w-full rounded-lg bg-bg0 dark:bg-bg0d py-1.5 pr-8 pl-3 text-left text-sm/6 text-text0 dark:text-text0d border border-solid border-gray0 dark:border-gray0d',
            'focus:not-data-focus:outline-none data-focus:outline-2 data-focus:-outline-offset-2 data-focus:outline-white/25'
          )}>
          <Label>{selected ? selected : placeholder.toUpperCase()}</Label>
          <ChevronDownIcon className="group pointer-events-none absolute top-2.5 right-2.5 size-4 stroke-text0 dark:stroke-text0d" />
        </ListboxButton>
      </div>
      <ListboxOptions
        anchor="bottom start"
        transition
        className="w-[var(--button-width)] mt-1 p-4 rounded-md bg-bg0 dark:bg-bg0d border border-solid border-gray0 dark:border-gray0d">
        {addresses.length ? (
          addresses.map(({ address, name }) => (
            <ListboxOption className="cursor-pointer flex items-center justify-between" key={address} value={address}>
              <Label>{address}</Label>
              <div className="bg-turquoise rounded-lg px-2">
                <Label color="white" size="small" textTransform="uppercase">
                  {name}
                </Label>
              </div>
            </ListboxOption>
          ))
        ) : (
          <div className="flex items-center justify-center w-full py-8 space-x-2">
            <FolderIcon className="stroke-text0 dark:stroke-text0d w-8 h-8" />
            <Label className="!w-auto" textTransform="uppercase">
              No Saved Addresses
            </Label>
          </div>
        )}
      </ListboxOptions>
    </Listbox>
  )
}
