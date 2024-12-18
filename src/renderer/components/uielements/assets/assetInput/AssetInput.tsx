import React, { useRef, useCallback } from 'react'

import { Network } from '@xchainjs/xchain-client'
import {
  AnyAsset,
  assetAmount,
  assetToBase,
  BaseAmount,
  baseToAsset,
  formatAssetAmountCurrency
} from '@xchainjs/xchain-util'
import BigNumber from 'bignumber.js'
import clsx from 'clsx'
import * as FP from 'fp-ts/lib/function'
import { useIntl } from 'react-intl'

import { ReactComponent as WalletIcon } from '../../../../assets/svg/icon-wallet.svg'
import { isUSDAsset } from '../../../../helpers/assetHelper'
import { AssetWithAmount, FixmeType } from '../../../../types/asgardex'
import { Button } from '../../button'
import { CheckButton } from '../../button/CheckButton'
import { InputBigNumber } from '../../input'
import { AssetSelect } from '../assetSelect'

export const ASSET_SELECT_BUTTON_WIDTH = 'w-[190px]'

export type Props = {
  title?: string
  amount: AssetWithAmount
  walletBalance?: BaseAmount
  priceAmount: AssetWithAmount
  assets: AnyAsset[]
  network: Network
  disabled?: boolean
  showError?: boolean
  hasAmountShortcut?: boolean
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
    textId: 'common.min',
    amount: 0
  },
  {
    textId: 'common.half',
    amount: 50
  },
  {
    textId: 'common.max',
    amount: 100
  }
]

export const AssetInput: React.FC<Props> = (props): JSX.Element => {
  const {
    title,
    amount: { amount, asset },
    walletBalance,
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
    className = '',
    classNameInput = ''
  } = props

  const inputWrapperRef = useRef<FixmeType>()

  const intl = useIntl()

  const onChangeHandler = useCallback(
    (value: BigNumber) => {
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
    <div className={clsx('flex flex-col rounded-lg py-2 px-4', 'border border-gray1 dark:border-gray0d', className)}>
      <div className="flex items-center justify-between">
        {title && (
          <p
            className={clsx(
              'm-0 bg-bg0 font-main text-[14px] dark:bg-bg0d',
              showError ? 'text-error0 dark:text-error0d' : 'text-gray2 dark:text-gray2d'
            )}>
            {title}
          </p>
        )}
        {hasAmountShortcut && (
          <div className="flex items-center space-x-2">
            {amountShortcuts.map(({ textId, amount }) => (
              <Button key={textId} typevalue="outline" sizevalue="small" onClick={() => onChangePercentHandler(amount)}>
                {intl.formatMessage({ id: textId })}
              </Button>
            ))}
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
            className={clsx('w-full px-0 leading-none', { 'text-text0 !opacity-100 dark:text-text0d': asLabel })}
          />

          <p className="mb-0 font-main text-[14px] leading-none text-gray1 dark:text-gray1d">
            {formatAssetAmountCurrency({
              amount: baseToAsset(priceAmount),
              asset: priceAsset,
              decimal: isUSDAsset(priceAsset) ? 4 : 6,
              trimZeros: true
            })}
          </p>
        </div>

        <div className="flex flex-col">
          <AssetSelect
            className={`h-full ${ASSET_SELECT_BUTTON_WIDTH}`}
            onSelect={onChangeAsset}
            asset={asset}
            assets={assets}
            network={network}
            dialogHeadline={intl.formatMessage({ id: 'common.asset.chooseAsset' })}
            shadowless
            disabled={disabled}
          />
          {walletBalance ? (
            <div className="flex items-center justify-end space-x-1 pr-4">
              <WalletIcon className="h-5 w-5 text-gray1 dark:text-gray1d" />
              <p className="mb-0 text-[14px] text-gray1 dark:text-gray1d">
                {baseToAsset(walletBalance).amount().toString()}
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
