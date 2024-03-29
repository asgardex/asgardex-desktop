import React, { useRef, useCallback, useState } from 'react'

import { Network } from '@xchainjs/xchain-client'
import {
  Asset,
  assetAmount,
  assetToBase,
  BaseAmount,
  baseToAsset,
  formatAssetAmountCurrency
} from '@xchainjs/xchain-util'
import BigNumber from 'bignumber.js'
import * as FP from 'fp-ts/lib/function'
import { useIntl } from 'react-intl'

import { isUSDAsset } from '../../../../helpers/assetHelper'
import { AssetWithAmount, FixmeType } from '../../../../types/asgardex'
import { CheckButton } from '../../button/CheckButton'
import { InputBigNumber } from '../../input'
import { AssetSelect } from '../assetSelect'

export const ASSET_SELECT_BUTTON_WIDTH = 'w-[180px]'

export type Props = {
  title?: string
  amount: AssetWithAmount
  priceAmount: AssetWithAmount
  assets: Asset[]
  network: Network
  disabled?: boolean
  showError?: boolean
  onChangeAsset: (asset: Asset) => void
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
}

/**
 * Wrapper around `InputBigNumber` component
 *
 * For input values, it takes and returns `BaseAmount`. It converts `BaseAmount` -> `AssetAmount` and vice versa,
 * to display and format values in `InputBigNumber` similar to values of `AssetAmount`
 *
 * Decimal of `InputBigNumber` depends on `decimal` of given `amount`.
 */
export const AssetInput: React.FC<Props> = (props): JSX.Element => {
  const {
    title,
    amount: { amount, asset },
    extraContent = <></>,
    priceAmount: { amount: priceAmount, asset: priceAsset },
    assets,
    network,
    disabled = false,
    showError = false,
    asLabel = false,
    onChangeAsset,
    onChange = FP.constVoid,
    onBlur = FP.constVoid,
    onFocus = FP.constVoid,
    useLedger,
    hasLedger,
    useLedgerHandler,
    className = '',
    classNameInput = ''
  } = props

  const inputWrapperRef = useRef<FixmeType>()

  const intl = useIntl()

  const [focused, setFocused] = useState(false)

  const onChangeHandler = useCallback(
    (value: BigNumber) => {
      onChange(assetToBase(assetAmount(value, amount.decimal)))
    },
    [amount.decimal, onChange]
  )

  const handleClickWrapper = useCallback(() => {
    inputWrapperRef.current?.firstChild?.focus()
  }, [])

  const onFocusHandler = useCallback(() => {
    setFocused(true)
    onFocus()
  }, [onFocus])

  const onBlurHandler = useCallback(() => {
    setFocused(false)
    onBlur()
  }, [onBlur])

  return (
    <div className={`flex flex-col ${className}`}>
      <div
        className={`
      relative
      flex
      border-gray1 dark:border-gray1d
      ${showError ? 'border-error0 dark:border-error0d' : ''}
      ${focused ? 'shadow-full dark:shadow-fulld' : ''}
      ease
      border
      uppercase
      ${classNameInput}`}
        ref={inputWrapperRef}
        onClick={handleClickWrapper}>
        {/* title */}
        {title && (
          <p
            className={`absolute left-[10px] top-[-15px] p-5px font-main text-[14px]
    ${showError ? 'text-error0 dark:text-error0d' : 'text-gray2 dark:text-gray2d'} m-0 bg-bg0 dark:bg-bg0d`}>
            {title}
          </p>
        )}

        <div
          className="flex w-full flex-col
        py-20px
        ">
          <InputBigNumber
            value={baseToAsset(amount).amount()}
            onChange={onChangeHandler}
            onBlur={onBlurHandler}
            onFocus={onFocusHandler}
            size="xlarge"
            ghost
            error={showError}
            disabled={asLabel || disabled}
            decimal={amount.decimal}
            // override text style of input for acting as label only
            className={`
        w-full
        border-r
        border-gray1
        leading-none
        dark:border-gray1d
          ${asLabel ? 'text-text0 !opacity-100 dark:text-text0d' : ''}`}
          />

          <p
            className="mb-0 border-r border-gray1 px-15px font-main text-[14px]
        leading-none
        text-gray1 dark:border-gray1d dark:text-gray1d
        ">
            {formatAssetAmountCurrency({
              amount: baseToAsset(priceAmount),
              asset: priceAsset,
              decimal: isUSDAsset(priceAsset) ? 4 : 6,
              trimZeros: true
            })}
          </p>
        </div>

        <AssetSelect
          className={`h-full ${ASSET_SELECT_BUTTON_WIDTH}`}
          onSelect={onChangeAsset}
          asset={asset}
          assets={assets}
          network={network}
          dialogHeadline={intl.formatMessage({ id: 'common.asset.quickSelect' })}
          disabled={disabled}
        />
      </div>
      <div className="flex flex-row">
        <div className="w-full">{extraContent}</div>
        {/* Note: 'items-start' needed to avoid stretch button in height of parent container */}
        <div className="flex w-full items-start justify-end">
          <CheckButton
            size="medium"
            color="neutral"
            className={`${ASSET_SELECT_BUTTON_WIDTH} rounded-b-lg bg-gray0 py-5px dark:bg-gray0d ${
              !hasLedger ? 'hidden' : ''
            }`}
            checked={useLedger}
            clickHandler={useLedgerHandler}>
            {intl.formatMessage({ id: 'ledger.title' })}
          </CheckButton>
        </div>
      </div>
    </div>
  )
}
