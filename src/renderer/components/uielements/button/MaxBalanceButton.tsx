import React, { useCallback } from 'react'

import { Balance } from '@xchainjs/xchain-client'
import { BaseAmount, CryptoAmount, baseToAsset, formatAssetAmountCurrency } from '@xchainjs/xchain-util'
import clsx from 'clsx'
import { useIntl } from 'react-intl'

import { formatAssetAmountCurrencyAsg, isUSDAsset } from '../../../helpers/assetHelper'
import { hiddenString } from '../../../helpers/stringHelper'
import { useApp } from '../../../store/app/hooks'
import { InfoIcon } from '../info'
import { TextButton, Props as ButtonProps } from './TextButton'

export type ComponentProps = {
  balance: Balance
  maxInfoText?: string
  maxDollarValue: CryptoAmount
  onClick: (amount: BaseAmount) => void
  disabled?: boolean
  className?: string
  classNameButton?: string
  classNameIcon?: string
  hidePrivateData?: boolean
}

export type Props = ComponentProps & Omit<ButtonProps, 'onClick'>

export const MaxBalanceButton: React.FC<Props> = (props): JSX.Element => {
  const {
    balance,
    maxDollarValue,
    onClick,
    disabled = false,
    maxInfoText = '',
    color = 'primary',
    size = 'normal',
    className = '',
    classNameButton = '',
    classNameIcon = '',
    hidePrivateData = false
  } = props
  const { amount, asset } = balance

  const { btcBaseUnit } = useApp()
  const intl = useIntl()

  const onClickHandler = useCallback(() => onClick(amount), [amount, onClick])

  const valueLabel =
    amount === maxDollarValue.baseAmount
      ? formatAssetAmountCurrency({
          amount: baseToAsset(amount),
          asset,
          decimal: 6,
          trimZeros: true
        })
      : `${formatAssetAmountCurrencyAsg({
          amount: baseToAsset(amount),
          asset,
          decimal: 6,
          trimZeros: true,
          baseUnit: btcBaseUnit
        })} (${formatAssetAmountCurrency({
          amount: maxDollarValue.assetAmount,
          asset: maxDollarValue.asset,
          decimal: isUSDAsset(maxDollarValue.asset) ? 2 : 6,
          trimZeros: !isUSDAsset(maxDollarValue.asset)
        })})`

  return (
    <div className={clsx('space-between flex items-center', className)}>
      <TextButton
        color={color}
        size={size}
        disabled={disabled}
        onClick={onClickHandler}
        className={clsx('mr-5px w-auto whitespace-nowrap !p-0', classNameButton)}>
        <span className="pr-5px underline">{intl.formatMessage({ id: 'common.max' })}:</span>
        &nbsp;
        {hidePrivateData ? hiddenString : valueLabel}
      </TextButton>

      {maxInfoText && <InfoIcon tooltip={maxInfoText} className={classNameIcon} />}
    </div>
  )
}
