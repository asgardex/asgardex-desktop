import React, { useCallback, useState, useEffect, forwardRef } from 'react'

import { delay, bnOrZero } from '@xchainjs/xchain-util'
import BigNumber from 'bignumber.js'
import { function as FP, option as O } from 'fp-ts'

import { ZERO_BN } from '../../../const'
import { eqBigNumber } from '../../../helpers/fp/eq'
import { FixmeType } from '../../../types/asgardex'
import { Input, InputProps } from './Input'
import { Size } from './Input.types'
import { formatValue, unformatValue, validInputValue, VALUE_ZERO, EMPTY_INPUT, truncateByDecimals } from './Input.util'

type Props = Omit<InputProps, 'value' | 'onChange'> & {
  value?: BigNumber
  size?: Size
  onChange?: (value: BigNumber) => void
  decimal?: number
  onPressEnter?: (value: BigNumber) => void
}

export const InputBigNumber = forwardRef<HTMLInputElement, Props>((props: Props, ref: FixmeType): JSX.Element => {
  const {
    size = 'normal',
    value = ZERO_BN,
    onChange = () => {},
    decimal = 2,
    onFocus = FP.constVoid,
    onBlur = FP.constVoid,
    max,
    ...otherProps /* any props of `InputNumberProps` */
  } = props

  // Limit display decimals to maximum of 8 for better UX
  const displayDecimals = Math.min(decimal, 8)

  // value as string (formatted) - it supports empty string for an empty input
  const [broadcastValue, setBroadcastValue] = useState<O.Option<string>>(O.some(VALUE_ZERO))

  const setValues = useCallback(
    (targetValue: string) => {
      if (targetValue === EMPTY_INPUT) {
        onChange(ZERO_BN)
        setBroadcastValue(O.none)
      } else {
        // check for the '.' at the end of a `targetValue`
        const formatted = formatValue(unformatValue(targetValue), displayDecimals).replaceAll(',', '')
        const bnValue = bnOrZero(formatted)

        const currentBroadcast = FP.pipe(
          broadcastValue,
          O.getOrElse(() => EMPTY_INPUT)
        )

        // Only update if value actually changed
        const valueChanged = !eqBigNumber.equals(bnValue, value)
        const displayChanged = targetValue !== currentBroadcast

        if (valueChanged) {
          onChange(bnValue)
        }

        if (displayChanged) {
          setBroadcastValue(O.some(targetValue))
        }
      }
    },
    [onChange, value, displayDecimals, broadcastValue]
  )

  useEffect(() => {
    FP.pipe(
      value,
      O.some,
      // filter out all duplicated real values
      O.filter((val) => {
        return FP.pipe(
          broadcastValue,
          O.map((prevValue) => !eqBigNumber.equals(val, bnOrZero(unformatValue(prevValue)))),
          O.getOrElse((): boolean => false)
        )
      }),
      // fix to decimal + always round down for currencies
      O.map((val) => val.toFixed(displayDecimals, BigNumber.ROUND_DOWN)),
      O.map((s) => formatValue(s, displayDecimals)),
      O.map(setValues)
    )
  }, [displayDecimals, value, setValues, broadcastValue])

  const onFocusHandler = useCallback(
    async (event: React.FocusEvent<HTMLInputElement>) => {
      const { target } = event
      onFocus(event)
      FP.pipe(broadcastValue, O.map(unformatValue), O.map(setValues))
      // setFocus(true)
      // short delay is needed before selecting to keep its reference
      // (it will be lost in other cases due React rendering)
      await delay(1)
      target.select()
    },
    [onFocus, broadcastValue, setValues]
  )

  const _onBlurHandler = useCallback(() => {
    FP.pipe(
      broadcastValue,
      // in case user entered an empty string there will be an O.none
      // restore it to the empty string
      O.alt(() => O.some(EMPTY_INPUT)),
      O.map((v) => (v === EMPTY_INPUT ? VALUE_ZERO : v)),
      // Pass ONLY meaningful value without formatting
      O.map((v) => formatValue(unformatValue(v), displayDecimals)),
      O.map(setValues)
    )
  }, [setValues, broadcastValue, displayDecimals])

  const onBlurHandler = useCallback(
    (event: React.FocusEvent<HTMLInputElement>) => {
      _onBlurHandler()
      onBlur(event)
    },
    [_onBlurHandler, onBlur]
  )

  const onKeyDownHandler = useCallback(
    (e: React.KeyboardEvent<HTMLElement>) => {
      if (e.key === 'Enter') {
        _onBlurHandler()
      }
    },
    [_onBlurHandler]
  )

  const onChangeHandler = useCallback(
    ({ target }: React.ChangeEvent<HTMLInputElement>) => {
      const { value: newValue } = target

      if (validInputValue(unformatValue(newValue))) {
        // some checks needed whether to broadcast changes or not
        FP.pipe(
          O.some(newValue),
          // format '.' to '.0'
          O.map((value) => (value === '.' ? '0.' : value)),
          // Limit to `max` value if needed
          O.map((value) => {
            if (!max) return value

            const maxBN = bnOrZero(max)
            const valueBN = bnOrZero(value)
            // if `value` > `max`, use `max`
            return valueBN.isLessThanOrEqualTo(maxBN) ? value : max.toString()
          }),
          // Limit decimal places of entered value
          O.map(truncateByDecimals(displayDecimals)),
          O.map(setValues)
        )
      }
    },
    [displayDecimals, max, setValues]
  )

  return (
    <Input
      ref={ref}
      size={size}
      value={FP.pipe(
        broadcastValue,
        O.getOrElse(() => EMPTY_INPUT)
      )}
      onChange={onChangeHandler}
      onFocus={onFocusHandler}
      onBlur={onBlurHandler}
      onKeyDown={onKeyDownHandler}
      max={max}
      {...otherProps}
    />
  )
})
