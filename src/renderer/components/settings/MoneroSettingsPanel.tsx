import { useCallback, useMemo, useState } from 'react'

import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { useIntl } from 'react-intl'

import {
  isValidXmrEndpoint,
  normalizeXmrEndpoint,
  redactXmrEndpoint,
  updateXmrConnectionConfig,
  XmrConnectionConfig
} from '../../services/monero/config'
import { XmrExportKeys } from '../../services/monero/derivation'
import { LwsConfirmation } from '../../services/monero/lwsConfirmation'
import { XmrScanStatus } from '../../services/monero/scanner'
import { ValidatePasswordLD } from '../../services/wallet/types'
import { WalletPasswordConfirmationModal } from '../modal/confirmation'
import { BorderButton } from '../uielements/button'
import { Input } from '../uielements/input'
import { MoneroKeysModal, MoneroLwsConfirmModal } from './MoneroModals'

export type MoneroSettingsActions = {
  validatePassword$: (password: string) => ValidatePasswordLD
  /** Creates the confirmation of exactly the given LWS URL (called after the dialog + password) */
  confirmLws: (url: string) => Promise<LwsConfirmation>
  /** Private spend + view keys (called after the password) */
  exportKeys: () => Promise<XmrExportKeys>
}

type Props = {
  config: XmrConnectionConfig
  scanStatus?: XmrScanStatus
  /**
   * `true` when the stored confirmation is valid for the current wallet (the confirmation is a MAC bound to wallet +
   * network + URL, see `lwsConfirmation.ts`). Default: the stored confirmation names the saved URL.
   */
  lwsConfirmedForWallet?: boolean
  onSave?: (config: XmrConnectionConfig) => void
  actions: MoneroSettingsActions
}

type Flow = 'none' | 'lws-confirm' | 'lws-password' | 'export-password'

/**
 * Settings of the (receive-only) Monero wallet: node URL, optional light-wallet server and restore height,
 * plus the password-gated export of the private keys.
 *
 * Empty fields = defaults. Especially: no light-wallet server by default — an LWS gets the private view key,
 * sees all incoming payments, and registration is permanent. A server is only used after the user confirmed
 * exactly that URL (dialog + keystore password); changing the URL requires a new confirmation. The confirmation is
 * valid for the wallet (network + address) it was made with only: with another wallet the server is shown as
 * unconfirmed (and not used) until confirmed again. There is one stored confirmation, so confirming for wallet B
 * replaces the one of wallet A.
 *
 * The password check is a UI gate: it protects the buttons, not the data. Code running in the renderer with the
 * unlocked keystore can derive keys and create a confirmation without it (see MONERO.md).
 */
export const MoneroSettingsPanel = ({
  config,
  scanStatus = { kind: 'idle' },
  lwsConfirmedForWallet,
  onSave = updateXmrConnectionConfig,
  actions
}: Props): JSX.Element => {
  const intl = useIntl()
  const [daemonUrl, setDaemonUrl] = useState(config.daemonUrl)
  const [lwsUrl, setLwsUrl] = useState(config.lwsUrl)
  const [restoreHeight, setRestoreHeight] = useState(config.restoreHeight === null ? '' : String(config.restoreHeight))
  const [flow, setFlow] = useState<Flow>('none')
  const [keys, setKeys] = useState<XmrExportKeys | undefined>(undefined)

  const normalizedDaemon = normalizeXmrEndpoint(daemonUrl)
  const normalizedLws = normalizeXmrEndpoint(lwsUrl)
  const daemonInvalid = normalizedDaemon !== '' && !isValidXmrEndpoint(normalizedDaemon)
  const lwsInvalid = normalizedLws !== '' && !isValidXmrEndpoint(normalizedLws)
  const heightInvalid = restoreHeight.trim() !== '' && !/^\d+$/.test(restoreHeight.trim())

  const dirty = useMemo(
    () =>
      normalizedDaemon !== config.daemonUrl ||
      normalizedLws !== config.lwsUrl ||
      (restoreHeight.trim() === '' ? null : Number(restoreHeight)) !== config.restoreHeight,
    [config, normalizedDaemon, normalizedLws, restoreHeight]
  )
  const canSave = dirty && !daemonInvalid && !lwsInvalid && !heightInvalid

  /** A saved LWS URL which has no (valid) confirmation: it is NOT used until confirmed */
  const lwsUnconfirmed =
    config.lwsUrl !== '' && !(lwsConfirmedForWallet ?? config.lwsConfirmation?.url === config.lwsUrl)

  const save = useCallback(() => {
    if (!canSave) return
    // Changing the LWS URL always drops the confirmation (config sanitizing); a re-confirmation is required
    onSave({
      daemonUrl: normalizedDaemon,
      lwsUrl: normalizedLws,
      lwsConfirmation: normalizedLws === config.lwsUrl ? config.lwsConfirmation : null,
      restoreHeight: restoreHeight.trim() === '' ? null : Number(restoreHeight.trim())
    })
    if (normalizedLws !== '' && normalizedLws !== config.lwsUrl) setFlow('lws-confirm')
  }, [canSave, config.lwsConfirmation, config.lwsUrl, normalizedDaemon, normalizedLws, onSave, restoreHeight])

  const onLwsPasswordOk = useCallback(() => {
    setFlow('none')
    actions
      .confirmLws(config.lwsUrl)
      .then((lwsConfirmation) => onSave({ ...config, lwsConfirmation }))
      .catch(() => undefined) // wallet locked meanwhile: stays unconfirmed (= not used)
  }, [actions, config, onSave])

  const onExportPasswordOk = useCallback(() => {
    setFlow('none')
    actions
      .exportKeys()
      .then(setKeys)
      .catch(() => undefined)
  }, [actions])

  const labelClass = 'mb-1 text-[12px] uppercase text-text2 dark:text-text2d'
  const errorClass = 'mt-1 font-main text-[12px] text-error0'

  return (
    <div className="mt-10px flex w-full flex-col space-y-3 px-40px" data-testid="monero-settings">
      <p className="text-[12px] text-text2 dark:text-text2d">
        {intl.formatMessage({ id: 'monero.settings.watchOnly' })}
      </p>
      {scanStatus.kind === 'range-too-large' && (
        <p className="flex items-start text-[12px] text-error0" role="alert" data-testid="monero-scan-range">
          <ExclamationTriangleIcon className="mt-[2px] mr-1 h-4 w-4 shrink-0" />
          {intl.formatMessage(
            { id: 'monero.scan.rangeTooLarge' },
            { gap: scanStatus.gap.toLocaleString('en-US'), limit: scanStatus.limit.toLocaleString('en-US') }
          )}
        </p>
      )}
      <div>
        <div className={labelClass}>{intl.formatMessage({ id: 'monero.settings.daemon' })}</div>
        <Input
          id="xmr-daemon-url"
          size="normal"
          placeholder="https://"
          value={daemonUrl}
          error={daemonInvalid}
          uppercase={false}
          onChange={(e) => setDaemonUrl(e.target.value)}
        />
        {daemonInvalid && <p className={errorClass}>{intl.formatMessage({ id: 'monero.settings.invalidUrl' })}</p>}
      </div>
      <div>
        <div className={labelClass}>{intl.formatMessage({ id: 'monero.settings.lws' })}</div>
        <Input
          id="xmr-lws-url"
          size="normal"
          placeholder="https://"
          value={lwsUrl}
          error={lwsInvalid}
          uppercase={false}
          onChange={(e) => setLwsUrl(e.target.value)}
        />
        {lwsInvalid && <p className={errorClass}>{intl.formatMessage({ id: 'monero.settings.invalidUrl' })}</p>}
        <p className="mt-1 flex items-start text-[12px] text-warning0">
          <ExclamationTriangleIcon className="mt-[2px] mr-1 h-4 w-4 shrink-0" />
          {intl.formatMessage({ id: 'monero.settings.lws.warning' })}
        </p>
        {lwsUnconfirmed && !dirty && (
          <div className="mt-2 flex items-center space-x-2" data-testid="monero-lws-unconfirmed">
            <p className="text-[12px] text-error0">{intl.formatMessage({ id: 'monero.lws.unconfirmed' })}</p>
            <BorderButton size="medium" color="primary" onClick={() => setFlow('lws-confirm')}>
              {intl.formatMessage({ id: 'monero.lws.confirm.button' })}
            </BorderButton>
          </div>
        )}
      </div>
      <div>
        <div className={labelClass}>{intl.formatMessage({ id: 'monero.settings.restoreHeight' })}</div>
        <Input
          id="xmr-restore-height"
          size="normal"
          inputMode="numeric"
          value={restoreHeight}
          error={heightInvalid}
          uppercase={false}
          onChange={(e) => setRestoreHeight(e.target.value)}
        />
        {heightInvalid && <p className={errorClass}>{intl.formatMessage({ id: 'monero.settings.invalidHeight' })}</p>}
        <p className="mt-1 text-[12px] text-text2 dark:text-text2d">
          {intl.formatMessage({ id: 'monero.settings.restoreHeight.hint' })}
        </p>
      </div>
      <div className="flex items-center space-x-2">
        <BorderButton size="medium" color="primary" disabled={!canSave} onClick={save}>
          {intl.formatMessage({ id: 'settings.wallet.hd.path.save' })}
        </BorderButton>
        <BorderButton size="medium" color="warning" onClick={() => setFlow('export-password')}>
          {intl.formatMessage({ id: 'monero.export.button' })}
        </BorderButton>
      </div>

      {flow === 'lws-confirm' && (
        <MoneroLwsConfirmModal
          host={redactXmrEndpoint(config.lwsUrl)}
          onConfirm={() => setFlow('lws-password')}
          onCancel={() => setFlow('none')}
        />
      )}
      {flow === 'lws-password' && (
        <WalletPasswordConfirmationModal
          validatePassword$={actions.validatePassword$}
          onSuccess={onLwsPasswordOk}
          onClose={() => setFlow('none')}
        />
      )}
      {flow === 'export-password' && (
        <WalletPasswordConfirmationModal
          validatePassword$={actions.validatePassword$}
          onSuccess={onExportPasswordOk}
          onClose={() => setFlow('none')}
        />
      )}
      {keys && <MoneroKeysModal keys={keys} onClose={() => setKeys(undefined)} />}
    </div>
  )
}
