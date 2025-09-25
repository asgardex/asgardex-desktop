import { useEffect, useState, useMemo, useCallback } from 'react'

import { CheckCircleIcon, PencilSquareIcon, XCircleIcon } from '@heroicons/react/24/outline'
import { Network } from '@xchainjs/xchain-client'
import { Address, AnyAsset } from '@xchainjs/xchain-util'
import { option as O } from 'fp-ts'
import { useForm } from 'react-hook-form'
import { useIntl } from 'react-intl'

import { truncateAddress } from '../../helpers/addressHelper'
import { isEvmChain } from '../../helpers/evmHelper'
import { hiddenString } from '../../helpers/stringHelper'
import { AddressValidationAsync } from '../../services/clients'
import { BaseButton } from '../uielements/button'
import { InfoIcon } from '../uielements/info'
import { Input } from '../uielements/input'
import { CopyLabel } from '../uielements/label'
import { Tooltip } from '../uielements/tooltip'

export type EditableAddressProps = {
  asset: AnyAsset
  address: Address
  network: Network
  onChangeAddress: (address: Address) => void
  onChangeEditableAddress: (address: Address) => void
  onChangeEditableMode: (editModeActive: boolean) => void
  addressValidator: AddressValidationAsync
  hidePrivateData: boolean
  startInEditMode?: boolean
}

const RECIPIENT_FIELD = 'recipient'

type FormValues = {
  recipient: string
}

export const EditableAddress = ({
  asset,
  address,
  onChangeAddress,
  onChangeEditableAddress,
  onChangeEditableMode,
  addressValidator,
  network,
  hidePrivateData,
  startInEditMode = false
}: EditableAddressProps) => {
  const intl = useIntl()
  const [editableAddress, setEditableAddress] = useState<O.Option<Address>>(startInEditMode ? O.some(address) : O.none)

  const {
    register,
    reset,
    getValues,
    setValue,
    formState: { errors }
  } = useForm<FormValues>({
    mode: 'onChange',
    defaultValues: {
      recipient: address
    }
  })

  useEffect(() => {
    if (startInEditMode) {
      setEditableAddress(O.some(address))
      onChangeEditableMode(true)
      setValue(RECIPIENT_FIELD, address)
    }
  }, [startInEditMode, address, onChangeEditableMode, setValue])

  const truncatedAddress = useMemo(
    () => truncateAddress(address, asset.chain, network),
    [address, asset.chain, network]
  )

  const validateAddress = useCallback(
    async (value: string) => {
      if (!value) {
        return intl.formatMessage({ id: 'wallet.errors.address.empty' })
      }
      const valid = await addressValidator(value)

      if (!valid) {
        return intl.formatMessage({ id: 'wallet.errors.address.invalid' })
      }
      return true
    },
    [addressValidator, intl]
  )

  const confirmEditHandler = useCallback(() => {
    const currentValue = getValues(RECIPIENT_FIELD)
    if (currentValue && !errors.recipient) {
      onChangeAddress(currentValue)
      onChangeEditableAddress(currentValue)
      reset()
      setEditableAddress(O.none)
      onChangeEditableMode(false)
    }
  }, [getValues, errors.recipient, onChangeAddress, onChangeEditableAddress, onChangeEditableMode, reset])

  const cancelEditHandler = useCallback(() => {
    reset()
    onChangeEditableAddress(address)
    setEditableAddress(O.none)
    onChangeEditableMode(false)
  }, [address, onChangeEditableAddress, onChangeEditableMode, reset])

  const inputOnKeyUpHandler = useCallback(
    (e: React.KeyboardEvent<HTMLElement>) => {
      const currentValue = getValues(RECIPIENT_FIELD)
      onChangeEditableAddress(currentValue)

      if (e.key === 'Enter') {
        confirmEditHandler()
      }
      if (e.key === 'Escape') {
        cancelEditHandler()
      }
    },
    [cancelEditHandler, confirmEditHandler, getValues, onChangeEditableAddress]
  )

  const renderAddress = useMemo(() => {
    const displayedAddress = hidePrivateData ? hiddenString : truncatedAddress

    return (
      <div className="flex items-center overflow-hidden font-main text-[16px] normal-case text-text2 dark:text-text2d">
        <Tooltip title={displayedAddress} size="big">
          <BaseButton
            className="!px-0 normal-case !text-text2 dark:!text-text2d"
            onClick={() => {
              setEditableAddress(O.fromNullable(address))
              onChangeEditableMode(true)
              setValue(RECIPIENT_FIELD, address)
            }}>
            {displayedAddress}
          </BaseButton>
        </Tooltip>
        <div className="flex flex-row items-center">
          <PencilSquareIcon
            className="ml-[5px] h-[20px] w-[20px] cursor-pointer text-gray2 dark:text-gray2d"
            onClick={() => {
              setEditableAddress(O.fromNullable(address))
              onChangeEditableMode(true)
              setValue(RECIPIENT_FIELD, address)
            }}
          />
          <CopyLabel className="text-gray2 dark:text-gray2d" textToCopy={address} />
        </div>
      </div>
    )
  }, [address, hidePrivateData, truncatedAddress, onChangeEditableMode, setValue])

  const renderEditableAddress = useCallback(() => {
    return (
      <div className="w-full">
        <form className="flex w-full items-start" onSubmit={(e) => e.preventDefault()}>
          <div className="flex flex-col w-full">
            <Input
              className="!text-[16px] normal-case"
              color="primary"
              onKeyUp={inputOnKeyUpHandler}
              {...register(RECIPIENT_FIELD, {
                required: true,
                validate: validateAddress
              })}
              error={!!errors.recipient}
            />
            {errors.recipient && (
              <span className="text-error0 dark:text-error0d text-xs mt-1">{errors.recipient.message}</span>
            )}
          </div>

          <CheckCircleIcon
            className="ml-5px h-[30px] w-[30px] cursor-pointer text-turquoise"
            onClick={confirmEditHandler}
          />
          <XCircleIcon
            className="ml-5px h-[30px] w-[30px] cursor-pointer text-gray2 dark:text-gray2d"
            onClick={cancelEditHandler}
          />
        </form>

        {/* EVM Smart Contract Warning */}
        {isEvmChain(asset.chain) && (
          <div
            className="mt-2 flex items-center text-[12px] text-warning0 dark:text-warning0d"
            role="alert"
            aria-live="polite">
            <InfoIcon
              tooltip={intl.formatMessage({ id: 'swap.address.evm.warning' })}
              className="mr-1 h-[14px] w-[14px]"
            />
            {intl.formatMessage({ id: 'swap.address.evm.warning' })}
          </div>
        )}
      </div>
    )
  }, [asset.chain, cancelEditHandler, confirmEditHandler, inputOnKeyUpHandler, intl, validateAddress, register, errors])

  if (O.isSome(editableAddress)) {
    return renderEditableAddress()
  }

  return renderAddress
}
