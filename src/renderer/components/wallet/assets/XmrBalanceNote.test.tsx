import { renderToStaticMarkup } from 'react-dom/server'
import { IntlProvider } from 'react-intl'

import de from '../../../i18n/de'
import en from '../../../i18n/en'
import es from '../../../i18n/es'
import fr from '../../../i18n/fr'
import hi from '../../../i18n/hi'
import ko from '../../../i18n/ko'
import ru from '../../../i18n/ru'
import { XmrBalanceInfo } from '../../../services/monero/balanceSource'
import { XmrScanStatus } from '../../../services/monero/scanner'
import { formatPiconero, XmrBalanceNote, XmrBalanceNoteView } from './XmrBalanceNote'

const render = (node: JSX.Element) =>
  renderToStaticMarkup(
    <IntlProvider locale="en" messages={en}>
      {node}
    </IntlProvider>
  )

const idle: XmrScanStatus = { kind: 'idle' }
const tooLarge: XmrScanStatus = { kind: 'range-too-large', gap: 12345, limit: 5000, fromHeight: 100, tipHeight: 12445 }

const local: XmrBalanceInfo = { source: 'local-scan' }
const view = (info: XmrBalanceInfo, scanStatus: XmrScanStatus, rejectedCount = 0) =>
  render(<XmrBalanceNoteView info={info} scanStatus={scanStatus} rejectedCount={rejectedCount} />)

describe('components/wallet/assets/XmrBalanceNote', () => {
  describe('says what the XMR balance means (view-only keys cannot see spends)', () => {
    it('received: "Received (spends not tracked)"', () => {
      const html = view(local, idle)
      expect(html).toContain('Received (spends not tracked)')
      expect(html).not.toContain('role="alert"')
      expect(html).not.toContain('xmr-server-spends')
    })

    it('LWS: says the amount is reported by the server and unverified, still "spends not tracked"', () => {
      const html = view({ source: 'lws' }, idle)
      expect(html).toContain('light-wallet server')
      expect(html).toContain('unverified')
      expect(html).toContain('spends not tracked')
      expect(html).not.toContain('xmr-server-spends')
    })

    it('LWS reported spends: a separate line "Server-reported spends (unverified, may include decoys)"', () => {
      const html = view({ source: 'lws', serverReportedSpent: BigInt('1230000000000') }, idle)
      expect(html).toContain('data-testid="xmr-server-spends"')
      expect(html).toContain('Server-reported spends (unverified, may include decoys): 1.23 XMR')
      // the received label is untouched (nothing is subtracted)
      expect(html).toContain('spends not tracked')
    })

    it('formats piconero exactly', () => {
      expect(formatPiconero(BigInt(0))).toBe('0')
      expect(formatPiconero(BigInt(1))).toBe('0.000000000001')
      expect(formatPiconero(BigInt('1230000000000'))).toBe('1.23')
      expect(formatPiconero(BigInt('123456789012345678'))).toBe('123456.789012345678')
    })

    it('rejected outputs (failed amount verification) are called out with the count', () => {
      const html = view(local, idle, 2)
      expect(html).toContain('data-testid="xmr-rejected"')
      expect(html).toContain('2 incoming output(s) were NOT counted')
      expect(view(local, idle, 0)).not.toContain('xmr-rejected')
    })

    it('is rendered for XMR only', () => {
      expect(render(<XmrBalanceNote chain="XMR" />)).toContain('Received (spends not tracked)')
      expect(render(<XmrBalanceNote chain="BTC" />)).toBe('')
    })
  })

  describe('5,000 block scan window too large: clear message next to the balance', () => {
    it('shows an alert with the numbers and how to fix it', () => {
      const html = view(local, tooLarge)
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
      expect(messages['monero.balance.serverSpends']).toContain('{amount}')
      expect(messages['monero.balance.rejected']).toContain('{count}')
      expect(messages['monero.lws.confirm.host']).toContain('{host}')
      expect(messages['monero.export.autoClose']).toBeTruthy()
    }
  })
})
