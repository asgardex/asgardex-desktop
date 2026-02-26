import { useCallback, useState } from 'react'

import { Dialog, DialogBackdrop, DialogPanel } from '@headlessui/react'
import clsx from 'clsx'
import { useForm } from 'react-hook-form'
import { useIntl } from 'react-intl'

import { BaseButton, FlatButton } from '../uielements/button'
import { InputPassword } from '../uielements/input'

type FormData = {
  password: string
}

type Props = {
  visible: boolean
  filename: string
  onSubmit: (password: string) => Promise<void>
  onClose: () => void
}

export const VaultPasswordModal = ({ visible, filename, onSubmit, onClose }: Props) => {
  const intl = useIntl()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm<FormData>()

  const handleClose = useCallback(() => {
    reset()
    setError(null)
    onClose()
  }, [onClose, reset])

  const submitForm = useCallback(
    async ({ password }: FormData) => {
      setLoading(true)
      setError(null)

      try {
        await onSubmit(password)
        reset()
      } catch (err) {
        setError(intl.formatMessage({ id: 'wallet.vultisig.import.error.invalidPassword' }))
      } finally {
        setLoading(false)
      }
    },
    [onSubmit, reset, intl]
  )

  return (
    <Dialog as="div" className="relative z-10" transition open={visible} onClose={handleClose}>
      <DialogBackdrop className="fixed inset-0 bg-bg0/40 dark:bg-bg0d/40" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel
          className={clsx(
            'mx-auto flex flex-col items-center p-6',
            'w-full max-w-[400px]',
            'bg-bg0 dark:bg-bg0d',
            'rounded-lg border border-solid border-gray0 dark:border-gray0d'
          )}>
          <h1 className="mb-2 w-full text-center text-lg font-semibold text-text1 uppercase dark:text-text1d">
            {intl.formatMessage({ id: 'wallet.vultisig.import.password.title' })}
          </h1>
          <p className="mb-4 w-full text-center text-sm text-text2 dark:text-text2d">
            {intl.formatMessage({ id: 'wallet.vultisig.import.password.description' })}
          </p>
          <p className="mb-4 w-full text-center text-xs text-gray2 dark:text-gray2d">{filename}</p>

          <form className="w-full" onSubmit={handleSubmit(submitForm)}>
            <InputPassword
              id="vault-password"
              className="mx-auto mb-4 flex h-[38px] w-full items-center justify-between rounded-lg border border-solid !border-gray0 dark:!border-gray0d"
              inputClassName="!ring-0 w-full"
              {...register('password', { required: true })}
              placeholder={intl.formatMessage({ id: 'common.password' }).toUpperCase()}
              ghost
              size="normal"
              autoFocus={true}
              error={errors.password ? intl.formatMessage({ id: 'wallet.password.empty' }) : ''}
              disabled={loading}
            />

            {error && <p className="mb-4 text-center text-sm text-error0">{error}</p>}

            <div className="flex w-full items-center justify-end gap-2">
              <BaseButton
                className={clsx(
                  'rounded-md !px-4 !py-2',
                  'border border-solid border-gray1/20 dark:border-gray1d/20',
                  'text-text0 dark:text-text0d',
                  'hover:bg-gray1/20 hover:dark:bg-gray1d/20'
                )}
                onClick={handleClose}
                disabled={loading}>
                {intl.formatMessage({ id: 'common.cancel' })}
              </BaseButton>
              <FlatButton type="submit" size="normal" color="primary" disabled={loading} loading={loading}>
                {intl.formatMessage({ id: 'wallet.action.import' })}
              </FlatButton>
            </div>
          </form>
        </DialogPanel>
      </div>
    </Dialog>
  )
}
