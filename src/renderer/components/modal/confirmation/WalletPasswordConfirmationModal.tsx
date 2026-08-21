import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { Dialog, DialogBackdrop, DialogPanel } from '@headlessui/react'
import clsx from 'clsx'
import { function as FP } from 'fp-ts'
import { useObservableState } from 'observable-hooks'
import { useIntl } from 'react-intl'

import WalletIcon from '../../../assets/svg/icon-wallet.svg?react'
import { ValidatePasswordLD } from '../../../services/wallet/types'
import { BaseButton } from '../../uielements/button'
import { InputPassword } from '../../uielements/input/InputPassword'
import { Label } from '../../uielements/label'

type PasswordModalProps = {
  visible: boolean
  invalidPassword?: boolean
  validatingPassword?: boolean
  onConfirm?: (password: string) => void
  onOk?: FP.Lazy<void>
  onCancel?: FP.Lazy<void>
  isSuccess?: boolean
}

const PasswordModal = (props: PasswordModalProps) => {
  const {
    visible,
    invalidPassword,
    validatingPassword,
    onConfirm = FP.constVoid,
    onOk = FP.constVoid,
    onCancel = FP.constVoid,
    isSuccess
  } = props

  const intl = useIntl()
  const passwordRef = useRef<HTMLInputElement>(null)

  // Fire onOk exactly once per success cycle. Parent `onOk` identity can change
  // (e.g. quote refresh recreating callbacks) while isSuccess stays true — without
  // this guard that would re-invoke submit and can broadcast again (#1175).
  const successHandledRef = useRef(false)
  useEffect(() => {
    if (!isSuccess) {
      successHandledRef.current = false
      return
    }
    if (successHandledRef.current) return
    successHandledRef.current = true
    onOk()
  }, [isSuccess, onOk])

  useEffect(() => {
    passwordRef.current?.focus()
  }, [])

  const [password, setPassword] = useState('')

  const onChangePasswordHandler = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setPassword(e.target.value)
    },
    [setPassword]
  )

  const onConfirmCb = useCallback(() => {
    onConfirm(password)
  }, [onConfirm, password])

  const onOkCb = useMemo(() => (!validatingPassword ? onConfirmCb : undefined), [validatingPassword, onConfirmCb])

  return (
    // Note: We can't use `ConfirmationModal` here,
    // its `onOkHandler` does not support different `onOk` callbacks, but will always close the modal

    <Dialog as="div" className="relative z-10" transition open={visible} onClose={onCancel}>
      <DialogBackdrop className="fixed inset-0 bg-bg0/40 dark:bg-bg0d/40" />
      {/* container to center the panel — offset for sidebar on desktop */}
      <div className="fixed inset-0 flex items-center justify-center p-4 lg:pl-[240px]">
        {/* dialog panel animated  */}
        <DialogPanel
          className={clsx(
            'mx-auto flex flex-col items-center p-6',
            'w-full max-w-[360px]',
            'bg-bg0 dark:bg-bg0d',
            'rounded-lg border border-solid border-gray0 dark:border-gray0d'
          )}>
          <div className="mb-2 flex w-full flex-col">
            <WalletIcon className="h-1/5 w-1/5 self-center text-turquoise" />
            <h1 className="mb-4 text-center text-xl text-text2 uppercase dark:text-text2d">
              {intl.formatMessage({ id: 'wallet.password.confirmation.title' })}
            </h1>
            <Label className="mb-1" size="normal" color="gray">
              {intl.formatMessage({ id: 'wallet.password.confirmation.description' })}
            </Label>

            <InputPassword
              // typevalue="normal"
              ref={passwordRef}
              size="large"
              value={password}
              onChange={onChangePasswordHandler}
              autoComplete="off"
              onEnter={onOkCb}
            />
            {invalidPassword && (
              <Label color="error" textTransform="uppercase">
                {intl.formatMessage({ id: 'wallet.password.confirmation.error' })}!
              </Label>
            )}
          </div>
          <div className="flex w-full items-center justify-end gap-2">
            <BaseButton
              className={clsx(
                'rounded-md !px-4 !py-2',
                'border border-solid border-gray1/20 dark:border-gray1d/20',
                'text-text0 dark:text-text0d',
                'hover:bg-gray1/20 dark:hover:bg-gray1d/20'
              )}
              onClick={onCancel}>
              {intl.formatMessage({ id: 'common.cancel' })}
            </BaseButton>
            <BaseButton
              className="rounded-lg bg-turquoise !px-4 !py-2 text-white hover:bg-turquoise/80"
              onClick={onOkCb}>
              {intl.formatMessage({ id: 'common.confirm' })}
            </BaseButton>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  )
}

/**
 * Wrapper around `PasswordModal` to validate password using `validatePassword$` stream
 */
type Props = {
  onSuccess: FP.Lazy<void>
  onClose: FP.Lazy<void>
  validatePassword$: (_: string) => ValidatePasswordLD
}

export const WalletPasswordConfirmationModal = ({ onSuccess, onClose, validatePassword$ }: Props) => {
  const [passwordToValidate, setPasswordToValidate] = useState('')

  const passwordValidationResult$ = useMemo(
    () => validatePassword$(passwordToValidate),
    [passwordToValidate, validatePassword$]
  )

  const passwordValidationRD = useObservableState(passwordValidationResult$, RD.initial)

  const closePrivateModal = useCallback(() => {
    onClose()
    setPasswordToValidate('')
  }, [onClose, setPasswordToValidate])

  const onPasswordValidationSucceed = useCallback(() => {
    onSuccess()
  }, [onSuccess])

  const confirmProps = useMemo(() => {
    const props = { onCancel: closePrivateModal, visible: true }
    return FP.pipe(
      passwordValidationRD,
      RD.fold(
        () => ({
          ...props,
          onConfirm: setPasswordToValidate
        }),
        () => ({
          ...props,
          validatingPassword: true,
          onConfirm: () => null
        }),
        () => ({
          ...props,
          invalidPassword: true,
          onConfirm: setPasswordToValidate
        }),
        () => ({
          ...props,
          onOk: onPasswordValidationSucceed,
          onConfirm: setPasswordToValidate,
          isSuccess: true
        })
      )
    )
  }, [passwordValidationRD, setPasswordToValidate, closePrivateModal, onPasswordValidationSucceed])

  return <PasswordModal {...confirmProps} />
}
