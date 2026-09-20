import { useCallback } from 'react'

import { Address } from '@xchainjs/xchain-util'
import { function as FP, option as O } from 'fp-ts'
import { useForm } from 'react-hook-form'
import { useIntl } from 'react-intl'

import { FlatButton } from '../../uielements/button'
import { Input } from '../../uielements/input'
import { Modal } from '../../uielements/modal'

type FormValues = { nodeAddress: string }

type Props = {
  /** node addresses already monitored, used to reject duplicates */
  monitoredNodes: Address[]
  /** every known node address, `none` while the node list has not loaded */
  oNodeAddresses: O.Option<Address[]>
  validateAddress: (address: Address) => boolean
  onAdd: (nodeAddress: Address) => void
  onClose: () => void
}

export const AddNodeModal = ({ monitoredNodes, oNodeAddresses, validateAddress, onAdd, onClose }: Props) => {
  const intl = useIntl()

  const {
    register,
    handleSubmit,
    formState: { errors, isValid }
  } = useForm<FormValues>({ mode: 'onChange', defaultValues: { nodeAddress: '' } })

  const onSubmit = useCallback(
    ({ nodeAddress }: FormValues) => {
      onAdd(nodeAddress.trim())
      onClose()
    },
    [onAdd, onClose]
  )

  return (
    <Modal
      containerClassName="lg:pl-[240px]"
      visible
      title={intl.formatMessage({ id: 'bonds.operator.addNode.title' })}
      onCancel={onClose}
      footer={false}>
      <form className="flex flex-col px-2 pb-2" onSubmit={handleSubmit(onSubmit)}>
        <span className="text-center font-main text-[14px] text-gray2 dark:text-gray2d">
          {intl.formatMessage({ id: 'bonds.operator.addNode.description' })}
        </span>

        <label className="mt-6 flex flex-col">
          <span className="mb-2 font-main-semi-bold text-[11px] tracking-[2px] text-gray2 uppercase dark:text-gray2d">
            {intl.formatMessage({ id: 'bonds.operator.addNode.label' })}
          </span>
          <Input
            autoFocus
            size="normal"
            placeholder={intl.formatMessage({ id: 'bonds.node.enterMessage' })}
            error={!!errors.nodeAddress}
            {...register('nodeAddress', {
              required: intl.formatMessage({ id: 'wallet.validations.shouldNotBeEmpty' }),
              validate: {
                valid: (value) =>
                  validateAddress(value.trim()) || intl.formatMessage({ id: 'wallet.errors.address.invalid' }),
                // checked before `unique`: an address that is not a node may already
                // be in the monitoring list, and "already added" would hide the real reason
                known: (value) =>
                  FP.pipe(
                    oNodeAddresses,
                    O.fold(
                      () => true,
                      (nodes) => nodes.some((node) => node.toLowerCase() === value.trim().toLowerCase())
                    )
                  ) || intl.formatMessage({ id: 'bonds.validations.nodeNotFound' }),
                unique: (value) =>
                  !monitoredNodes.some((node) => node.toLowerCase() === value.trim().toLowerCase()) ||
                  intl.formatMessage({ id: 'bonds.validations.nodeAlreadyAdded' })
              }
            })}
          />
          {errors.nodeAddress && (
            <span className="mt-1 font-main text-[13px] text-error0 dark:text-error0d">
              {errors.nodeAddress.message}
            </span>
          )}
        </label>

        <FlatButton className="mt-6 w-full" size="large" type="submit" disabled={!isValid}>
          {intl.formatMessage({ id: 'bonds.node.add' })}
        </FlatButton>
      </form>
    </Modal>
  )
}
