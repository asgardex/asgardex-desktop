import React from 'react'

import { XCircleIcon } from '@heroicons/react/24/outline'
import { Network } from '@xchainjs/xchain-client'
import { Address, AnyAsset, Chain } from '@xchainjs/xchain-util'
import { function as FP, option as O } from 'fp-ts'
import { useIntl } from 'react-intl'

import { HDMode, WalletType } from '../../../../shared/wallet/types'
import { getWalletTypeLabel } from '../../../helpers/walletHelper'
import { AddressValidationAsync } from '../../../services/clients'
import { BaseButton } from '../../uielements/button'
import { WalletTypeLabel } from '../../uielements/common'
import { EditableAddress } from '../EditableAddress'

type RecipientAddressSectionProps = {
  // Mode
  isStandaloneLedger: boolean
  // Target asset/chain
  targetAsset: AnyAsset
  targetChain: Chain
  network: Network
  // Address state
  effectiveRecipientAddress: O.Option<Address>
  standaloneLedgerTargetAddress: O.Option<Address>
  setStandaloneLedgerTargetAddress: (v: O.Option<Address>) => void
  // Custom address editing
  customAddressEditActive: boolean
  setCustomAddressEditActive: (v: boolean) => void
  // Standalone ledger: derivation path controls
  targetHDMode: HDMode
  setTargetHDMode: (v: HDMode) => void
  targetWalletAccount: number
  setTargetWalletAccount: (v: number) => void
  targetWalletIndex: number
  setTargetWalletIndex: (v: number) => void
  // Standalone ledger: fetch
  fetchStandaloneLedgerTargetAddress: (chain: Chain) => Promise<void>
  isFetchingStandaloneLedgerAddress: boolean
  // Normal mode
  targetWalletType: O.Option<WalletType>
  onChangeRecipientAddress: (address: Address) => void
  onChangeEditableRecipientAddress: (address: Address) => void
  // Validation
  addressValidator: AddressValidationAsync
  hidePrivateData: boolean
}

export const RecipientAddressSection: React.FC<RecipientAddressSectionProps> = ({
  isStandaloneLedger,
  targetAsset,
  targetChain,
  network,
  effectiveRecipientAddress,
  standaloneLedgerTargetAddress,
  setStandaloneLedgerTargetAddress,
  customAddressEditActive,
  setCustomAddressEditActive,
  targetHDMode,
  setTargetHDMode,
  targetWalletAccount,
  setTargetWalletAccount,
  targetWalletIndex,
  setTargetWalletIndex,
  fetchStandaloneLedgerTargetAddress,
  isFetchingStandaloneLedgerAddress,
  targetWalletType,
  onChangeRecipientAddress,
  onChangeEditableRecipientAddress,
  addressValidator,
  hidePrivateData
}) => {
  const intl = useIntl()

  if (isStandaloneLedger) {
    return (
      <div
        className="flex flex-col rounded-lg border border-solid border-gray0 px-4 py-2 dark:border-gray0d"
        key="standalone-recipient-address">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <h3 className="mr-10px !mb-0 w-auto p-0 font-main text-[12px] text-text2 uppercase dark:text-text2d">
              {intl.formatMessage({ id: 'common.recipient' })}
            </h3>
            <WalletTypeLabel key="target-w-type">{intl.formatMessage({ id: 'common.ledger' })}</WalletTypeLabel>
          </div>

          {FP.pipe(standaloneLedgerTargetAddress, O.isSome) && !customAddressEditActive && (
            <BaseButton
              size="small"
              className="hover:shadow-full dark:hover:shadow-fulld"
              loading={isFetchingStandaloneLedgerAddress}
              onClick={() => {
                if (
                  window.confirm(
                    `Please make sure the ${targetAsset.chain} app is open on your Ledger device before proceeding.`
                  )
                ) {
                  setCustomAddressEditActive(false)
                  fetchStandaloneLedgerTargetAddress(targetAsset.chain)
                }
              }}>
              {intl.formatMessage({ id: 'common.fetchFromLedger' })}
            </BaseButton>
          )}
        </div>

        {FP.pipe(
          standaloneLedgerTargetAddress,
          O.fold(
            () => (
              <div className="mt-3 space-y-3">
                <div className="grid grid-cols-1 gap-3">
                  <div className="rounded-lg border border-gray0 dark:border-gray0d">
                    <DerivationPathControls
                      targetAsset={targetAsset}
                      targetHDMode={targetHDMode}
                      setTargetHDMode={setTargetHDMode}
                      targetWalletAccount={targetWalletAccount}
                      setTargetWalletAccount={setTargetWalletAccount}
                      targetWalletIndex={targetWalletIndex}
                      setTargetWalletIndex={setTargetWalletIndex}
                    />
                    <button
                      className="group flex w-full items-center justify-between p-4 transition-all duration-200 hover:bg-bg1 dark:hover:bg-bg1d"
                      disabled={isFetchingStandaloneLedgerAddress}
                      onClick={() => {
                        if (
                          window.confirm(
                            `Please make sure the ${targetChain} app is open on your Ledger device before proceeding.`
                          )
                        ) {
                          setCustomAddressEditActive(false)
                          fetchStandaloneLedgerTargetAddress(targetChain)
                        }
                      }}>
                      <div className="flex items-center space-x-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-turquoise/10">
                          <div className="h-4 w-4 rounded-xs bg-turquoise"></div>
                        </div>
                        <div className="text-left">
                          <div className="font-medium text-text0 dark:text-text0d">
                            {intl.formatMessage({ id: 'common.fetchFromLedger' })}
                          </div>
                          <div className="text-[12px] text-text2 dark:text-text2d">
                            {intl.formatMessage({ id: 'wallet.ledger.fetchDescription' })}
                          </div>
                        </div>
                      </div>
                      <div className="text-turquoise transition-transform duration-200 group-hover:translate-x-1">
                        →
                      </div>
                    </button>
                  </div>

                  <button
                    className="group flex items-center justify-between rounded-lg border border-gray0 p-4 transition-all duration-200 hover:border-turquoise hover:bg-bg1 dark:border-gray0d dark:hover:bg-bg1d"
                    onClick={() => {
                      setStandaloneLedgerTargetAddress(O.none)
                      setCustomAddressEditActive(true)
                    }}>
                    <div className="flex items-center space-x-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-warning0/10">
                        <div className="h-4 w-4 rounded-xs bg-warning0"></div>
                      </div>
                      <div className="text-left">
                        <div className="font-medium text-text0 dark:text-text0d">Enter Manually</div>
                        <div className="text-[12px] text-text2 dark:text-text2d">
                          Type or paste the recipient address
                        </div>
                      </div>
                    </div>
                    <div className="text-turquoise transition-transform duration-200 group-hover:translate-x-1">→</div>
                  </button>
                </div>

                {customAddressEditActive && (
                  <ManualAddressEntry
                    targetAsset={targetAsset}
                    network={network}
                    customAddressEditActive={customAddressEditActive}
                    setStandaloneLedgerTargetAddress={setStandaloneLedgerTargetAddress}
                    onChangeRecipientAddress={onChangeRecipientAddress}
                    onChangeEditableRecipientAddress={onChangeEditableRecipientAddress}
                    setCustomAddressEditActive={setCustomAddressEditActive}
                    addressValidator={addressValidator}
                    hidePrivateData={hidePrivateData}
                  />
                )}
              </div>
            ),
            (address) => (
              <div className="mt-2">
                {customAddressEditActive ? (
                  <ManualAddressEntry
                    targetAsset={targetAsset}
                    network={network}
                    customAddressEditActive={customAddressEditActive}
                    setStandaloneLedgerTargetAddress={setStandaloneLedgerTargetAddress}
                    onChangeRecipientAddress={onChangeRecipientAddress}
                    onChangeEditableRecipientAddress={onChangeEditableRecipientAddress}
                    setCustomAddressEditActive={setCustomAddressEditActive}
                    addressValidator={addressValidator}
                    hidePrivateData={hidePrivateData}
                    showClearButton={!customAddressEditActive}
                  />
                ) : (
                  <div className="flex items-center space-x-2">
                    <div className="flex-1">
                      <EditableAddress
                        key={address}
                        asset={targetAsset}
                        network={network}
                        address={address}
                        onChangeAddress={(newAddress) => {
                          setStandaloneLedgerTargetAddress(O.some(newAddress))
                          onChangeRecipientAddress(newAddress)
                        }}
                        onChangeEditableAddress={onChangeEditableRecipientAddress}
                        onChangeEditableMode={(editModeActive) => setCustomAddressEditActive(editModeActive)}
                        addressValidator={addressValidator}
                        hidePrivateData={hidePrivateData}
                      />
                    </div>
                    <BaseButton size="small" className="!p-1" onClick={() => setStandaloneLedgerTargetAddress(O.none)}>
                      <XCircleIcon className="ml-5px h-[30px] w-[30px] cursor-pointer text-gray2 dark:text-gray2d" />
                    </BaseButton>
                  </div>
                )}
              </div>
            )
          )
        )}
      </div>
    )
  }

  // Normal keystore/vultisig mode
  return FP.pipe(
    effectiveRecipientAddress,
    O.map((address) => (
      <div
        className="flex flex-col rounded-lg border border-solid border-gray0 px-4 py-2 dark:border-gray0d"
        key="edit-address">
        <div className="flex items-center">
          <h3 className="mr-10px !mb-0 w-auto p-0 font-main text-[12px] text-text2 uppercase dark:text-text2d">
            {intl.formatMessage({ id: 'common.recipient' })}
          </h3>
          <WalletTypeLabel key="target-w-type">{getWalletTypeLabel(targetWalletType, intl)}</WalletTypeLabel>
        </div>
        <EditableAddress
          key={address}
          asset={targetAsset}
          network={network}
          address={address}
          onChangeAddress={onChangeRecipientAddress}
          onChangeEditableAddress={onChangeEditableRecipientAddress}
          onChangeEditableMode={(editModeActive) => setCustomAddressEditActive(editModeActive)}
          addressValidator={addressValidator}
          hidePrivateData={hidePrivateData}
        />
      </div>
    )),
    O.toNullable
  )
}

// ─── Sub-components ──────────────────────────────────────────────────────────

/** Derivation path controls for standalone ledger (Account, Index, HD type) */
const DerivationPathControls: React.FC<{
  targetAsset: AnyAsset
  targetHDMode: HDMode
  setTargetHDMode: (v: HDMode) => void
  targetWalletAccount: number
  setTargetWalletAccount: (v: number) => void
  targetWalletIndex: number
  setTargetWalletIndex: (v: number) => void
}> = ({
  targetAsset,
  targetHDMode,
  setTargetHDMode,
  targetWalletAccount,
  setTargetWalletAccount,
  targetWalletIndex,
  setTargetWalletIndex
}) => {
  const intl = useIntl()
  const isUTXO = ['BTC', 'LTC', 'BCH', 'DASH', 'DOGE'].includes(targetAsset.chain)
  const isEVM = ['ETH', 'BSC', 'AVAX', 'ARB', 'BASE'].includes(targetAsset.chain)

  if (!isUTXO && !isEVM) return null

  const inputClass =
    'h-6 w-14 rounded border border-gray0 bg-bg0 px-2 text-center text-xs text-text0 transition-colors focus:border-turquoise focus:outline-hidden dark:border-gray0d dark:bg-bg0d dark:text-text0d dark:focus:border-turquoise'
  const selectClass =
    'h-6 rounded border border-gray0 bg-bg0 px-2 py-1 text-xs text-text0 transition-colors focus:border-turquoise focus:outline-hidden dark:border-gray0d dark:bg-bg0d dark:text-text0d dark:focus:border-turquoise'

  return (
    <div className="border-b border-gray0 p-3 dark:border-gray0d">
      <div className="mb-2 text-[12px] font-medium text-text2 uppercase dark:text-text2d">
        {intl.formatMessage({ id: 'ledger.derivation.path' })}
      </div>
      <div className="flex items-end gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-text2 dark:text-text2d">Account</span>
          <input
            type="number"
            value={targetWalletAccount.toString()}
            onChange={(e) => setTargetWalletAccount(Math.max(0, parseInt(e.target.value) || 0))}
            className={inputClass}
            min="0"
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-text2 dark:text-text2d">Index</span>
          <input
            type="number"
            value={targetWalletIndex.toString()}
            onChange={(e) => setTargetWalletIndex(Math.max(0, parseInt(e.target.value) || 0))}
            className={inputClass}
            min="0"
          />
        </div>
        {targetAsset.chain === 'BTC' && (
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-text2 dark:text-text2d">
              {intl.formatMessage({ id: 'common.type' })}
            </span>
            <select
              value={targetHDMode}
              onChange={(e) => setTargetHDMode(e.target.value as HDMode)}
              className={selectClass}>
              <option value="p2wpkh">{intl.formatMessage({ id: 'common.nativeSegwit' })}</option>
              <option value="p2tr">{intl.formatMessage({ id: 'common.taproot' })}</option>
            </select>
          </div>
        )}
        {['LTC', 'BCH', 'DASH', 'DOGE'].includes(targetAsset.chain) && (
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-text2 dark:text-text2d">
              {intl.formatMessage({ id: 'common.type' })}
            </span>
            <select
              value={targetHDMode}
              onChange={(e) => setTargetHDMode(e.target.value as HDMode)}
              className={selectClass}>
              <option value="default">Default</option>
            </select>
          </div>
        )}
        {isEVM && (
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-text2 dark:text-text2d">
              {intl.formatMessage({ id: 'common.type' })}
            </span>
            <select
              value={targetHDMode}
              onChange={(e) => setTargetHDMode(e.target.value as HDMode)}
              className={selectClass}>
              <option value="ledgerlive">Ledger Live</option>
              <option value="legacy">Legacy</option>
              <option value="metamask">MetaMask</option>
            </select>
          </div>
        )}
      </div>
    </div>
  )
}

/** Manual address entry with EditableAddress */
const ManualAddressEntry: React.FC<{
  targetAsset: AnyAsset
  network: Network
  customAddressEditActive: boolean
  setStandaloneLedgerTargetAddress: (v: O.Option<Address>) => void
  onChangeRecipientAddress: (address: Address) => void
  onChangeEditableRecipientAddress: (address: Address) => void
  setCustomAddressEditActive: (v: boolean) => void
  addressValidator: AddressValidationAsync
  hidePrivateData: boolean
  showClearButton?: boolean
}> = ({
  targetAsset,
  network,
  customAddressEditActive,
  setStandaloneLedgerTargetAddress,
  onChangeRecipientAddress,
  onChangeEditableRecipientAddress,
  setCustomAddressEditActive,
  addressValidator,
  hidePrivateData,
  showClearButton = false
}) => (
  <div className="space-y-2">
    <div className="text-[14px] text-text2 dark:text-text2d">Enter recipient address:</div>
    <div className="flex items-center space-x-2">
      <div className="flex-1">
        <EditableAddress
          key="manual-entry"
          asset={targetAsset}
          network={network}
          address=""
          startInEditMode={customAddressEditActive}
          onChangeAddress={(newAddress) => {
            if (newAddress.trim()) {
              setStandaloneLedgerTargetAddress(O.some(newAddress))
              onChangeRecipientAddress(newAddress)
            } else {
              setStandaloneLedgerTargetAddress(O.none)
            }
          }}
          onChangeEditableAddress={onChangeEditableRecipientAddress}
          onChangeEditableMode={(editModeActive) => setCustomAddressEditActive(editModeActive)}
          addressValidator={addressValidator}
          hidePrivateData={hidePrivateData}
        />
      </div>
      {showClearButton && (
        <BaseButton size="small" className="!p-1" onClick={() => setStandaloneLedgerTargetAddress(O.none)}>
          <XCircleIcon className="ml-5px h-[30px] w-[30px] cursor-pointer text-gray2 dark:text-gray2d" />
        </BaseButton>
      )}
    </div>
  </div>
)
