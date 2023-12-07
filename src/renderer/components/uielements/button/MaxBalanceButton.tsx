import React, { useCallback } from 'react'

import { Balance } from '@xchainjs/xchain-client'
import { CryptoAmount } from '@xchainjs/xchain-thorchain-query'
import { BaseAmount, baseToAsset, formatAssetAmountCurrency } from '@xchainjs/xchain-util'
import { useIntl } from 'react-intl'

import { isUSDAsset } from '../../../helpers/assetHelper'
import { hiddenString } from '../../../helpers/stringHelper'
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
  // TODO (@veado) Make it default (not) optional to handle private data everyhere properly
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
      : `${formatAssetAmountCurrency({
          amount: baseToAsset(amount),
          asset,
          decimal: 6,
          trimZeros: true
        })} (${formatAssetAmountCurrency({
          amount: maxDollarValue.assetAmount,
          asset: maxDollarValue.asset,
          decimal: isUSDAsset(maxDollarValue.asset) ? 2 : 6,
          trimZeros: !isUSDAsset(maxDollarValue.asset)
        })})`

  return (
    <div className={`space-between flex items-center ${className}`}>
      <TextButton
        color={color}
        size={size}
        disabled={disabled}
        onClick={onClickHandler}
        className={`mr-5px w-auto !p-0 ${classNameButton} whitespace-nowrap`}>
        <span className="pr-5px underline">{intl.formatMessage({ id: 'common.max' })}:</span>
        &nbsp;
        {hidePrivateData ? hiddenString : `${valueLabel}`}
      </TextButton>

      {maxInfoText && <InfoIcon tooltip={maxInfoText} className={classNameIcon} />}
    </div>
  )
}
