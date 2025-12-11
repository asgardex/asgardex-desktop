import React, { useRef, useCallback } from 'react'

import { Network } from '@xchainjs/xchain-client'
import {
  AnyAsset,
  AssetAmount,
  BaseAmount,
  assetAmount,
  assetToBase,
  baseToAsset,
  Chain,
  formatAssetAmountCurrency
} from '@xchainjs/xchain-util'
import BigNumber from 'bignumber.js'
import clsx from 'clsx'
import { function as FP } from 'fp-ts'
import { useIntl } from 'react-intl'

import WalletIcon from '../../../../assets/svg/icon-wallet.svg?react'
import { isUSDAsset } from '../../../../helpers/assetHelper'
import { chainToProtocol } from '../../../../helpers/protocolHelper'
import { AssetWithAmount, FixmeType } from '../../../../types/asgardex'
import { ProviderIcon } from '../../../swap/ProviderIcon'
import { Button } from '../../button'
import { CheckButton } from '../../button/CheckButton'
import { InputBigNumber } from '../../input'
import { Label } from '../../label'
import { AssetSelect } from '../assetSelect'

const ASSET_SELECT_BUTTON_WIDTH = 'w-[190px]'

export type Props = {
  title?: string
  amount: AssetWithAmount
  walletBalance?: BaseAmount
  priceAmount: AssetWithAmount
  showPrice?: boolean
  assets: AnyAsset[]
  network: Network
  disabled?: boolean
  showError?: boolean
  hasAmountShortcut?: boolean
  protocol?: Chain
  onChangeAsset: (asset: AnyAsset) => void
  onChange?: (value: BaseAmount) => void
  onBlur?: FP.Lazy<void>
  onFocus?: FP.Lazy<void>
  asLabel?: boolean
  useLedger: boolean
  hasLedger: boolean
  useLedgerHandler: (use: boolean) => void
  extraContent?: React.ReactNode
  className?: string
  classNameInput?: string
  onChangePercent?: (percents: number) => void
  synthDisabled?: boolean
}

/**
 * Wrapper around `InputBigNumber` component
 *
 * For input values, it takes and returns `BaseAmount`. It converts `BaseAmount` -> `AssetAmount` and vice versa,
 * to display and format values in `InputBigNumber` similar to values of `AssetAmount`
 *
 * Decimal of `InputBigNumber` depends on `decimal` of given `amount`.
 */

const amountShortcuts = [
  {
    textId: 'common.half',
    amount: 50
  },
  {
    textId: 'common.max',
    amount: 100
  }
]

export const AssetInput = (props: Props): JSX.Element => {
  const {
    title,
    amount: { amount, asset },
    walletBalance,
    showPrice = true,
    extraContent = <></>,
    priceAmount: { amount: priceAmount, asset: priceAsset },
    assets,
    network,
    hasAmountShortcut = false,
    disabled = false,
    showError = false,
    asLabel = false,
    onChangeAsset,
    onChange = FP.constVoid,
    onChangePercent,
    useLedger,
    hasLedger,
    useLedgerHandler,
    protocol,
    className = '',
    classNameInput = '',
    synthDisabled = false
  } = props

  const inputWrapperRef = useRef<FixmeType>()

  const intl = useIntl()

  const onChangeHandler = useCallback(
    (value: BigNumber) => {
      // Convert asset amount (what user types) to base amount (internal representation)
      onChange(assetToBase(assetAmount(value, amount.decimal)))
    },
    [amount.decimal, onChange]
  )

  const onChangePercentHandler = useCallback(
    (percents: number) => {
      if (onChangePercent) onChangePercent(percents)
    },
    [onChangePercent]
  )

  const handleClickWrapper = useCallback(() => {
    inputWrapperRef.current?.firstChild?.focus()
  }, [])

  return (
    <div className={clsx('flex flex-col rounded-lg px-4 py-2', 'border border-gray0 dark:border-gray0d', className)}>
      <div className="flex items-center justify-between">
        {title && (
          <p
            className={clsx(
              'm-0 bg-bg0 font-main text-[14px] dark:bg-bg0d',
              showError ? 'text-error0 dark:text-error0d' : 'text-text2 dark:text-text2d'
            )}>
            {title}
          </p>
        )}
        {hasAmountShortcut && (
          <div className="flex items-center space-x-1">
            {amountShortcuts.map(({ textId, amount }) => (
              <Button
                className="rounded-lg !border-turquoise !text-text0 hover:!bg-turquoise hover:!text-white dark:!text-text0d"
                key={textId}
                typevalue="outline"
                sizevalue="small"
                onClick={() => onChangePercentHandler(amount)}>
                {intl.formatMessage({ id: textId })}
              </Button>
            ))}
          </div>
        )}
        {!hasAmountShortcut && protocol && (
          <div className="flex items-center space-x-1">
            <ProviderIcon protocol={protocol} />
            <Label textTransform="uppercase" color="gray" size="small">
              {chainToProtocol[protocol as keyof typeof chainToProtocol]}
            </Label>
          </div>
        )}
      </div>
      <div
        className={clsx('ease flex uppercase', { 'border-error0 dark:border-error0d': showError }, classNameInput)}
        ref={inputWrapperRef}
        onClick={handleClickWrapper}>
        <div className="flex w-full flex-col py-1">
          <InputBigNumber
            value={baseToAsset(amount).amount()}
            onChange={onChangeHandler}
            size="xlarge"
            ghost
            error={showError}
            disabled={asLabel || disabled}
            decimal={amount.decimal}
            // override text style of input for acting as label only
            className={clsx(
              'w-full !px-0 leading-none',
              { 'text-text0 !opacity-100 dark:text-text0d': asLabel },
              { '!py-2 text-[28px] md:text-[32px]': !showPrice }
            )}
          />

          {showPrice && (
            <p className="mb-0 font-main text-[14px] leading-none text-gray1 dark:text-gray1d">
              {formatAssetAmountCurrency({
                amount: baseToAsset(priceAmount),
                asset: priceAsset,
                decimal: isUSDAsset(priceAsset) ? 4 : 6,
                trimZeros: true
              })}
            </p>
          )}
        </div>

        <div className="flex flex-col">
          <AssetSelect
            className={clsx('h-full', ASSET_SELECT_BUTTON_WIDTH)}
            onSelect={onChangeAsset}
            asset={asset}
            assets={assets}
            network={network}
            dialogHeadline={intl.formatMessage({ id: 'common.asset.chooseAsset' })}
            shadowless
            disabled={disabled}
            synthDisabled={synthDisabled}
          />
          {walletBalance ? (
            <div className="flex items-center justify-end space-x-1 pr-4">
              <WalletIcon className="h-5 w-5 text-gray1 dark:text-gray1d" />
              <p className="mb-0 text-[14px] text-gray1 dark:text-gray1d">
                {(() => {
                  const assetAmount = baseToAsset(walletBalance)
                  // For very small amounts, use more decimal places to avoid scientific notation
                  const getDecimalPlaces = (amount: AssetAmount) => {
                    const num = amount.amount().toNumber()
                    if (num === 0) return 0
                    if (num < 0.000001) return 8 // Show 8 decimals for very small amounts
                    if (num < 0.001) return 6 // Show 6 decimals for small amounts
                    return 3 // Default 3 decimals
                  }
                  return formatAssetAmountCurrency({
                    amount: assetAmount,
                    asset,
                    decimal: getDecimalPlaces(assetAmount),
                    trimZeros: true
                  })
                })()}
              </p>
            </div>
          ) : (
            <></>
          )}
        </div>
      </div>
      <div className="flex flex-row">
        <div className="w-full">{extraContent}</div>
        {/* Note: 'items-start' needed to avoid stretch button in height of parent container */}
        <div className="flex w-full items-start justify-end">
          <CheckButton
            size="medium"
            color="neutral"
            className={clsx(ASSET_SELECT_BUTTON_WIDTH, 'rounded-b-lg bg-gray0 py-5px dark:bg-gray0d', {
              hidden: !hasLedger
            })}
            checked={useLedger}
            clickHandler={useLedgerHandler}>
            {intl.formatMessage({ id: 'ledger.title' })}
          </CheckButton>
        </div>
      </div>
    </div>
  )
}
