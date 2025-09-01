import React, { useCallback } from 'react'

import { Meta } from '@storybook/react'
import { bn } from '@xchainjs/xchain-util'
import BigNumber from 'bignumber.js'
import { Controller, useForm } from 'react-hook-form'

import { Button } from '../button'
import { InputBigNumber, InputBigNumber as Component } from './InputBigNumber'

const meta: Meta<typeof Component> = {
  component: Component,
  title: 'Components/InputBigNumber/Default',
  args: {
    onChange: (value) => {
      console.log('value ', value.toString())
    }
  }
}

export default meta

type FormValues = {
  amount: BigNumber
}

const FormValidation = () => {
  const {
    control,
    handleSubmit,
    formState: { errors }
  } = useForm<FormValues>({
    defaultValues: {
      amount: bn('1')
    }
  })

  const checkValue = (value?: BigNumber) => {
    console.log('checkValue ', value?.toString() ?? 'undefined value')
    if (value && value.isGreaterThan(bn(10))) {
      return true
    }
    return 'Value must be greater than 10!'
  }

  const onFinish = (values: FormValues) => {
    console.log('onFinish: ', values)
  }

  return (
    <form onSubmit={handleSubmit(onFinish)}>
      <div className="mb-4">
        <label className="block mb-2 text-sm font-medium">Amount</label>
        <Controller
          name="amount"
          control={control}
          rules={{ validate: checkValue }}
          render={({ field: { value, onChange } }) => (
            <InputBigNumber value={value} onChange={onChange as unknown as (v: BigNumber) => void} />
          )}
        />
        {errors.amount && <p className="mt-1 text-xs text-red-500">{errors.amount.message}</p>}
      </div>
      <Button type="primary" htmlType="submit">
        Submit
      </Button>
    </form>
  )
}

export const formValidation: Meta<typeof FormValidation> = {
  component: FormValidation,
  title: 'Components/InputBigNumber/FormValidation'
}

const SetValue = () => {
  const [value, setValue] = React.useState<BigNumber>(bn('0.000001'))
  const handleChange = useCallback((v: BigNumber) => {
    console.log('onChange:', v.toString())
    setValue(v)
  }, [])
  return (
    <div className="p-4">
      <InputBigNumber value={value} onChange={handleChange} />
      <div className="flex gap-2 mt-2">
        <Button onClick={() => setValue(bn(40000))}>Set 40k</Button>
        <Button onClick={() => setValue(bn(2000))}>Set 2k</Button>
      </div>
    </div>
  )
}

export const setValue: Meta<typeof SetValue> = {
  component: SetValue,
  title: 'Components/InputBigNumber/SetValue'
}

const SetDecimal = ({ decimal }: { decimal: number }) => {
  const [value, setValue] = React.useState<BigNumber>(bn('0.00000001'))
  const handleChange = useCallback((v: BigNumber) => {
    setValue(v)
  }, [])
  return (
    <div className="p-4">
      <InputBigNumber value={value} onChange={handleChange} decimal={decimal} />
    </div>
  )
}

export const setDecimal: Meta<typeof SetDecimal> = {
  component: SetDecimal,
  title: 'Components/InputBigNumber/SetDecimal',
  argTypes: {
    decimal: {
      control: {
        type: 'number'
      },
      defaultValue: 8
    }
  }
}
