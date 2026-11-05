import { renderToStaticMarkup } from 'react-dom/server'
import { IntlProvider } from 'react-intl'

import de from '../../../i18n/de'
import en from '../../../i18n/en'
import es from '../../../i18n/es'
import fr from '../../../i18n/fr'
import hi from '../../../i18n/hi'
import ko from '../../../i18n/ko'
import ru from '../../../i18n/ru'
import { XmrBalanceSource } from '../../../services/monero/balanceSource'
import { XmrScanStatus } from '../../../services/monero/scanner'
import { XmrBalanceNote, XmrBalanceNoteView } from './XmrBalanceNote'

const render = (node: JSX.Element) =>
  renderToStaticMarkup(
    <IntlProvider locale="en" messages={en}>
      {node}
    </IntlProvider>
  )

const idle: XmrScanStatus = { kind: 'idle' }
const tooLarge: XmrScanStatus = { kind: 'range-too-large', gap: 12345, limit: 5000, fromHeight: 100, tipHeight: 12445 }

const view = (source: XmrBalanceSource, scanStatus: XmrScanStatus) =>
  render(<XmrBalanceNoteView source={source} scanStatus={scanStatus} />)

describe('components/wallet/assets/XmrBalanceNote', () => {
  describe('says what the XMR balance means (view-only keys cannot see spends)', () => {
    it('received: "Received (spends not tracked)"', () => {
      const html = view('received', idle)
      expect(html).toContain('Received (spends not tracked)')
      expect(html).not.toContain('role="alert"')
    })

    it('LWS reported spends: says so and that it is unverified', () => {
      const html = view('lws-reported', idle)
      expect(html).toContain('light-wallet server')
      expect(html).toContain('unverified')
      expect(html).not.toContain('spends not tracked')
    })

    it('is rendered for XMR only', () => {
      expect(render(<XmrBalanceNote chain="XMR" />)).toContain('Received (spends not tracked)')
      expect(render(<XmrBalanceNote chain="BTC" />)).toBe('')
    })
  })

  describe('5,000 block scan window too large: clear message next to the balance', () => {
    it('shows an alert with the numbers and how to fix it', () => {
      const html = view('received', tooLarge)
      expect(html).toContain('role="alert"')
      expect(html).toContain('12,345 blocks')
      expect(html).toContain('limit: 5,000')
      expect(html).toContain('restore height')
      expect(html).toContain('light-wallet server')
    })
  })

  it('all locales have the balance labels', () => {
    for (const messages of [en, de, fr, es, ru, hi, ko] as Array<Record<string, string>>) {
      expect(messages['monero.balance.received']).toBeTruthy()
      expect(messages['monero.balance.lws']).toBeTruthy()
    }
  })
})
