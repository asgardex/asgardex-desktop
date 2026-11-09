import { ReactNode, useCallback, useEffect, useRef, useState } from 'react'

import { Dialog, DialogBackdrop, DialogPanel } from '@headlessui/react'
import { CheckIcon, DocumentDuplicateIcon, XMarkIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { useIntl } from 'react-intl'

import { copySecretWithAutoClear } from '../../services/monero/clipboard'
import type { XmrExportKeys } from '../../services/monero/derivation'
import { BaseButton } from '../uielements/button'
import { useAutoClose } from './useAutoClose'

const panelClass = clsx(
  'mx-auto flex flex-col items-center p-6',
  'w-full max-w-[360px] md:max-w-[480px]',
  'bg-bg0 dark:bg-bg0d',
  'rounded-lg border border-solid border-gray0 dark:border-gray0d'
)
const secondaryButtonClass = clsx(
  'rounded-md !px-4 !py-2',
  'border border-solid border-gray1/20 dark:border-gray1d/20',
  'text-text0 dark:text-text0d',
  'hover:bg-gray1/20 dark:hover:bg-gray1d/20'
)
const primaryButtonClass = 'rounded-lg bg-turquoise !px-4 !py-2 text-white hover:bg-turquoise/80'

type ModalProps = {
  title: string
  children: ReactNode
  /** Closing by click outside / ESC. Receive-only terms have to be answered explicitly -> no outside close there. */
  onDismiss?: () => void
  buttons: ReactNode
  testId?: string
}

const Modal = ({ title, children, onDismiss, buttons, testId }: ModalProps) => (
  <Dialog as="div" className="relative z-50" transition open onClose={onDismiss ?? (() => undefined)}>
    <DialogBackdrop className="fixed inset-0 bg-bg0/40 dark:bg-bg0d/40" />
    <div className="fixed inset-0 flex items-center justify-center p-4">
      <DialogPanel className={panelClass} data-testid={testId}>
        <h1 className="mb-4 text-center text-xl text-text2 uppercase dark:text-text2d">{title}</h1>
        <div className="mb-6 w-full space-y-3 text-[14px] text-text1 dark:text-text1d">{children}</div>
        <div className="flex w-full items-center justify-end gap-2">{buttons}</div>
      </DialogPanel>
    </div>
  </Dialog>
)

/**
 * Light-wallet server confirmation: the server sees ALL incoming payments and amounts, registration is permanent.
 * `host` is the redacted server (`scheme://host[:port]`, never the path: it can be a secret) so the user sees WHO
 * gets the view key.
 */
export const MoneroLwsConfirmModal = ({
  host,
  onConfirm,
  onCancel
}: {
  host: string
  onConfirm: () => void
  onCancel: () => void
}) => {
  const intl = useIntl()
  return (
    <Modal
      testId="monero-lws-confirm"
      title={intl.formatMessage({ id: 'monero.lws.confirm.title' })}
      onDismiss={onCancel}
      buttons={
        <>
          <BaseButton className={secondaryButtonClass} onClick={onCancel}>
            {intl.formatMessage({ id: 'common.cancel' })}
          </BaseButton>
          <BaseButton className={primaryButtonClass} onClick={onConfirm}>
            {intl.formatMessage({ id: 'monero.lws.confirm.ok' })}
          </BaseButton>
        </>
      }>
      <p className="font-mono break-all text-text0 dark:text-text0d" data-testid="monero-lws-confirm-host">
        {intl.formatMessage({ id: 'monero.lws.confirm.host' }, { host })}
      </p>
      <p>{intl.formatMessage({ id: 'monero.lws.confirm.body' })}</p>
    </Modal>
  )
}

/** The keys modal closes by itself after this long */
export const XMR_KEYS_MODAL_TIMEOUT_MS = 60_000

/** Copy button for a key: the clipboard is cleared again after 30s (`copySecretWithAutoClear`) */
const KeyCopyButton = ({ value }: { value: string }) => {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  const copy = useCallback(() => {
    copySecretWithAutoClear(value)
      .then(() => mounted.current && setState('copied'))
      .catch(() => mounted.current && setState('failed'))
  }, [value])
  const Icon = state === 'copied' ? CheckIcon : state === 'failed' ? XMarkIcon : DocumentDuplicateIcon
  return (
    <BaseButton className="p-0" onClick={copy} data-testid="monero-key-copy">
      <Icon className="h-5 w-5 text-text2 hover:text-turquoise dark:text-text2d" />
    </BaseButton>
  )
}

/**
 * Shows the exported private keys. They only live in this component's props until it is closed, which happens
 * automatically after `XMR_KEYS_MODAL_TIMEOUT_MS`. Copied keys are removed from the clipboard after 30 seconds.
 */
export const MoneroKeysModal = ({ keys, onClose }: { keys: XmrExportKeys; onClose: () => void }) => {
  const intl = useIntl()
  useAutoClose(onClose, XMR_KEYS_MODAL_TIMEOUT_MS)
  const row = (labelId: 'monero.export.spendKey' | 'monero.export.viewKey', value: string) => (
    <div>
      <div className="text-[12px] text-text2 uppercase dark:text-text2d">{intl.formatMessage({ id: labelId })}</div>
      <div className="flex items-center gap-2">
        {/* No `select-all`: one click would put the key into the Linux PRIMARY selection, which no timer clears. Use the copy button. */}
        <code className="font-mono text-[12px] break-all">{value}</code>
        <KeyCopyButton value={value} />
      </div>
    </div>
  )
  return (
    <Modal
      testId="monero-keys"
      title={intl.formatMessage({ id: 'monero.export.title' })}
      onDismiss={onClose}
      buttons={
        <BaseButton className={primaryButtonClass} onClick={onClose}>
          {intl.formatMessage({ id: 'common.done' })}
        </BaseButton>
      }>
      <p className="text-error0">{intl.formatMessage({ id: 'monero.export.warning' })}</p>
      <p className="text-[12px] text-text2 dark:text-text2d" data-testid="monero-keys-autoclose">
        {intl.formatMessage({ id: 'monero.export.autoClose' })}
      </p>
      {row('monero.export.spendKey', keys.privateSpendKeyHex)}
      {row('monero.export.viewKey', keys.privateViewKeyHex)}
    </Modal>
  )
}

/** Receive-only acknowledgement (presentational). */
export const MoneroReceiveAckDialog = ({
  onAcknowledge,
  onDisable
}: {
  onAcknowledge: () => void
  onDisable: () => void
}) => {
  const intl = useIntl()
  return (
    <Modal
      testId="monero-ack"
      title={intl.formatMessage({ id: 'monero.ack.title' })}
      buttons={
        <>
          <BaseButton className={secondaryButtonClass} onClick={onDisable}>
            {intl.formatMessage({ id: 'monero.ack.cancel' })}
          </BaseButton>
          <BaseButton className={primaryButtonClass} onClick={onAcknowledge}>
            {intl.formatMessage({ id: 'monero.ack.confirm' })}
          </BaseButton>
        </>
      }>
      <ul className="list-disc space-y-2 pl-5">
        <li>{intl.formatMessage({ id: 'monero.ack.send' })}</li>
        <li>{intl.formatMessage({ id: 'monero.ack.restore' })}</li>
        <li>{intl.formatMessage({ id: 'monero.ack.exit' })}</li>
      </ul>
    </Modal>
  )
}
