import { useCallback, useMemo, useState } from 'react'

import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { useObservableState } from 'observable-hooks'
import { useIntl } from 'react-intl'

import {
  DEFAULT_XMR_CONNECTION_CONFIG,
  isValidXmrEndpoint,
  normalizeXmrEndpoint,
  updateXmrConnectionConfig,
  xmrConnectionConfig$,
  XmrConnectionConfig
} from '../../services/monero/config'
import { BorderButton } from '../uielements/button'
import { Input } from '../uielements/input'

type Props = {
  config: XmrConnectionConfig
  onSave?: (config: XmrConnectionConfig) => void
}

/**
 * Settings of the (watch-only) Monero client: node URL, optional light-wallet server and restore height.
 *
 * Empty fields = defaults. Especially: no light-wallet server by default — an LWS gets the private view key.
 */
export const MoneroSettingsPanel = ({ config, onSave = updateXmrConnectionConfig }: Props): JSX.Element => {
  const intl = useIntl()
  const [daemonUrl, setDaemonUrl] = useState(config.daemonUrl)
  const [lwsUrl, setLwsUrl] = useState(config.lwsUrl)
  const [restoreHeight, setRestoreHeight] = useState(config.restoreHeight === null ? '' : String(config.restoreHeight))

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

  const save = useCallback(() => {
    if (!canSave) return
    onSave({
      daemonUrl: normalizedDaemon,
      lwsUrl: normalizedLws,
      restoreHeight: restoreHeight.trim() === '' ? null : Number(restoreHeight.trim())
    })
  }, [canSave, normalizedDaemon, normalizedLws, onSave, restoreHeight])

  const labelClass = 'mb-1 text-[12px] uppercase text-text2 dark:text-text2d'
  const errorClass = 'mt-1 font-main text-[12px] text-error0'

  return (
    <div className="mt-10px flex w-full flex-col space-y-3 px-40px" data-testid="monero-settings">
      <p className="text-[12px] text-text2 dark:text-text2d">
        {intl.formatMessage({ id: 'monero.settings.watchOnly' })}
      </p>
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
      <div>
        <BorderButton size="medium" color="primary" disabled={!canSave} onClick={save}>
          {intl.formatMessage({ id: 'settings.wallet.hd.path.save' })}
        </BorderButton>
      </div>
    </div>
  )
}

/** Panel connected to the persisted Monero connection settings */
export const MoneroSettingsConnected = (): JSX.Element => {
  const config = useObservableState(xmrConnectionConfig$, DEFAULT_XMR_CONNECTION_CONFIG)
  return <MoneroSettingsPanel config={config} />
}
