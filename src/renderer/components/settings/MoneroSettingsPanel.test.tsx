import { renderToStaticMarkup } from 'react-dom/server'
import { IntlProvider } from 'react-intl'

import en from '../../i18n/en'
import { DEFAULT_XMR_CONNECTION_CONFIG } from '../../services/monero/config'
import { XmrScanStatus } from '../../services/monero/scanner'
import { MoneroSettingsActions, MoneroSettingsPanel } from './MoneroSettingsPanel'

const actions: MoneroSettingsActions = {
  validatePassword$: vi.fn(),
  confirmLws: vi.fn(),
  exportKeys: vi.fn()
}

const render = (scanStatus: XmrScanStatus, config = DEFAULT_XMR_CONNECTION_CONFIG) =>
  renderToStaticMarkup(
    <IntlProvider locale="en" messages={en}>
      <MoneroSettingsPanel config={config} scanStatus={scanStatus} actions={actions} onSave={() => undefined} />
    </IntlProvider>
  )

describe('components/settings/MoneroSettingsPanel', () => {
  it('shows nothing about the scan window while it is fine', () => {
    expect(render({ kind: 'idle' })).not.toContain('monero-scan-range')
  })

  it('5,000 block failure: clear message with gap, limit and the fix', () => {
    const html = render({ kind: 'range-too-large', gap: 20000, limit: 5000, fromHeight: 1, tipHeight: 20001 })
    expect(html).toContain('monero-scan-range')
    expect(html).toContain('20,000 blocks')
    expect(html).toContain('limit: 5,000')
    expect(html).toContain('restore height')
  })

  it('warns about the LWS and offers the password-gated export', () => {
    const html = render({ kind: 'idle' })
    expect(html).toContain(en['monero.settings.lws.warning'])
    expect(html).toContain('Export private keys')
  })

  it('a saved LWS URL without a valid confirmation is flagged as NOT used', () => {
    const html = render({ kind: 'idle' }, { ...DEFAULT_XMR_CONNECTION_CONFIG, lwsUrl: 'https://lws.example' })
    expect(html).toContain('monero-lws-unconfirmed')
    expect(html).toContain('NOT used')
  })

  describe('LWS confirmation text', () => {
    const body = en['monero.lws.confirm.body']
    it('says the server sees ALL incoming payments and amounts, and that registration is permanent', () => {
      expect(body).toContain('ALL incoming payments')
      expect(body).toContain('amounts')
      expect(body).toContain('permanent')
      expect(body).toContain('private view key')
    })
  })
})
