import { Network } from '@xchainjs/xchain-client'

import { bytesToHex, deriveXmrExportKeys, deriveXmrViewKeys } from './derivation'
import { lwsGetIncomingTxs, lwsGetTotalReceived, lwsLogin, LwsFetch, XmrLwsError } from './lws'
import { createLwsConfirmation, getConfirmedLws } from './lwsConfirmation'

const PHRASE = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
const SECRET_URL = 'https://lws.example/token-1234/path'

const viewKeys = deriveXmrViewKeys(PHRASE, Network.Mainnet)
const confirmed = getConfirmedLws(viewKeys, {
  lwsUrl: SECRET_URL,
  lwsConfirmation: createLwsConfirmation(viewKeys, SECRET_URL)
})!

const ok = (body: unknown): LwsFetch =>
  vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve(body) })

describe('services/monero/lws', () => {
  it('login registers address + view key (never the spend key)', async () => {
    const fetchFn = ok({})
    await lwsLogin(confirmed, viewKeys, fetchFn)
    const [url, init] = vi.mocked(fetchFn).mock.calls[0]
    expect(url).toBe(`${SECRET_URL}/login`)
    const body = JSON.parse(init.body)
    expect(body).toEqual({
      address: viewKeys.address,
      view_key: bytesToHex(viewKeys.privateViewKey),
      create_account: true,
      generated_locally: false
    })
    expect(init.body).not.toContain(deriveXmrExportKeys(PHRASE, Network.Mainnet).privateSpendKeyHex)
    expect(init.body).not.toContain(PHRASE.split(' ')[0] + ' ' + PHRASE.split(' ')[1])
  })

  it('balance = total_received only (spent outputs cannot be verified without the spend key)', async () => {
    const fetchFn = ok({ total_received: '5000000000000', total_sent: '4000000000000' })
    await expect(lwsGetTotalReceived(confirmed, viewKeys, fetchFn)).resolves.toBe(BigInt('5000000000000'))
  })

  it('incoming txs: confirmed only, newest first', async () => {
    const fetchFn = ok({
      transactions: [
        { hash: 'a', timestamp: '2026-01-01T00:00:00Z', total_received: '1', height: 10 },
        { hash: 'b', timestamp: '2026-01-02T00:00:00Z', total_received: '2', height: 20 },
        { hash: 'pool', timestamp: '2026-01-03T00:00:00Z', total_received: '3', height: 0, mempool: true },
        { hash: 'zero', timestamp: '2026-01-03T00:00:00Z', total_received: '0', height: 30 }
      ]
    })
    const txs = await lwsGetIncomingTxs(confirmed, viewKeys, fetchFn)
    expect(txs.map((t) => t.hash)).toEqual(['b', 'a'])
    expect(txs[0].amount.amount().toString()).toBe('2')
  })

  describe('never reveals the URL (path may be a secret)', () => {
    it('network failure -> generic error', async () => {
      const fetchFn: LwsFetch = vi.fn().mockRejectedValue(new TypeError(`Failed to fetch ${SECRET_URL}/login`))
      const error = await lwsLogin(confirmed, viewKeys, fetchFn).catch((e) => e)
      expect(error).toBeInstanceOf(XmrLwsError)
      expect(error.message).not.toContain('token-1234')
      expect(error.message).not.toContain('lws.example')
    })

    it('HTTP error -> status only', async () => {
      const fetchFn: LwsFetch = vi.fn().mockResolvedValue({ ok: false, status: 503, json: () => Promise.resolve({}) })
      const error = await lwsLogin(confirmed, viewKeys, fetchFn).catch((e) => e)
      expect(error.message).toContain('503')
      expect(error.message).not.toContain('token-1234')
    })

    it('does not log anything', async () => {
      const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) =>
        vi.spyOn(console, m).mockImplementation(() => {})
      )
      await lwsLogin(confirmed, viewKeys, ok({}))
      await lwsGetTotalReceived(confirmed, viewKeys, ok({ total_received: '1' }))
      await lwsGetIncomingTxs(confirmed, viewKeys, ok({ transactions: [] }))
      await lwsLogin(confirmed, viewKeys, vi.fn().mockRejectedValue(new Error('x'))).catch(() => undefined)
      for (const spy of spies) {
        expect(spy).not.toHaveBeenCalled()
        spy.mockRestore()
      }
    })
  })

  it('rejects malformed amounts', async () => {
    await expect(lwsGetTotalReceived(confirmed, viewKeys, ok({ total_received: '-1' }))).rejects.toThrow(XmrLwsError)
    await expect(lwsGetTotalReceived(confirmed, viewKeys, ok({}))).rejects.toThrow(XmrLwsError)
  })
})
