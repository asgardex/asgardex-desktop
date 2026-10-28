/**
 * MAYA balance requests across wallet unlock / Refresh cycles.
 *
 * Runs the app's real wallet, balance and MAYA client modules.
 * Network is stubbed: `fetch` (CosmJS RPC) and `XMLHttpRequest` (axios REST) are counted and answered locally.
 * Wallets are throwaway mnemonics generated in memory.
 */
import { BehaviorSubject } from 'rxjs'
import { vi } from 'vitest'

type Hit = { host: string; what: string; step: string }
const hits: Hit[] = []
let step = 'import'
let rpc429 = false

const RPC_HOST = 'tendermint.mayachain.info'
const isBalancesQuery = (h: Hit) => h.host === RPC_HOST && h.what.includes('AllBalances')
const isConnect = (h: Hit) => h.host === RPC_HOST && h.what === 'rpc:status'
const requestsIn = (s: string, f: (h: Hit) => boolean) => hits.filter((h) => h.step === s && f(h)).length

const statusResult = {
  node_info: {
    protocol_version: { p2p: '8', block: '11', app: '0' },
    id: 'a'.repeat(40),
    listen_addr: 'tcp://0.0.0.0:26656',
    network: 'mayachain-mainnet-v1',
    version: '0.38.17',
    channels: '40',
    moniker: 'm',
    other: { tx_index: 'on', rpc_address: 'tcp://0.0.0.0:26657' }
  },
  sync_info: {
    latest_block_hash: 'AA',
    latest_app_hash: 'AA',
    latest_block_height: '100',
    latest_block_time: '2026-10-28T00:00:00.000000000Z',
    earliest_block_hash: 'AA',
    earliest_app_hash: 'AA',
    earliest_block_height: '1',
    earliest_block_time: '2026-10-01T00:00:00.000000000Z',
    catching_up: false
  },
  validator_info: {
    address: 'B'.repeat(40),
    pub_key: { type: 'tendermint/PubKeyEd25519', value: 'A'.repeat(43) + '=' },
    voting_power: '0'
  }
}

// RPC (CosmJS uses fetch)
const fetchMock = vi.fn(async (input: unknown, init?: { body?: string }) => {
  const url = new URL(String(input))
  let what = 'GET ' + url.pathname
  let body: { id?: number; method?: string; params?: { path?: string } } = {}
  if (init?.body) {
    body = JSON.parse(init.body)
    what = 'rpc:' + body.method + (body.params?.path ? ' ' + body.params.path : '')
  }
  hits.push({ host: url.host, what, step })
  if (rpc429 && url.host === RPC_HOST) return new Response('rate limited', { status: 429 })
  let result: unknown = {}
  if (body.method === 'status') result = statusResult
  if (body.method === 'abci_query')
    result = {
      response: {
        code: 0,
        log: '',
        info: '',
        index: '0',
        key: null,
        value: '',
        proofOps: null,
        height: '100',
        codespace: ''
      }
    }
  return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id ?? 0, result }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  })
})

// REST (axios xhr adapter)
class FakeXHR {
  readyState = 0
  status = 0
  statusText = ''
  responseText = ''
  response: unknown = ''
  responseURL = ''
  responseType = ''
  timeout = 0
  withCredentials = false
  upload = { addEventListener() {} }
  onreadystatechange: null | (() => void) = null
  onloadend: null | (() => void) = null
  onload: null | (() => void) = null
  onerror: null | (() => void) = null
  onabort: null | (() => void) = null
  ontimeout: null | (() => void) = null
  private url = ''
  open(_method: string, url: string) {
    this.url = url
    this.readyState = 1
  }
  setRequestHeader() {}
  getAllResponseHeaders() {
    return 'content-type: application/json'
  }
  getResponseHeader() {
    return 'application/json'
  }
  addEventListener() {}
  removeEventListener() {}
  abort() {}
  send() {
    const u = new URL(this.url)
    hits.push({ host: u.host, what: 'GET ' + u.pathname, step })
    setTimeout(() => {
      this.status = 200
      this.statusText = 'OK'
      this.responseText = JSON.stringify(
        u.pathname.endsWith('node_info') ? { default_node_info: { network: 'mayachain-mainnet-v1' } } : {}
      )
      this.response = this.responseText
      this.responseURL = this.url
      this.readyState = 4
      this.onreadystatechange?.()
      this.onload?.()
      this.onloadend?.()
    }, 1)
  }
}

type AnyGlobal = { fetch: unknown; XMLHttpRequest: unknown; window: Record<string, unknown> }
const g = globalThis as unknown as AnyGlobal
g.fetch = fetchMock
g.XMLHttpRequest = FakeXHR
g.window.fetch = fetchMock
g.window.XMLHttpRequest = FakeXHR
{
  // real default MAYA urls instead of the placeholder strings of the storage mock
  const storage = g.window.apiCommonStorage as { get: () => Promise<Record<string, unknown>> }
  const get = storage.get
  const withUrls = async () => ({
    ...(await get()),
    mayanodeRpc: { mainnet: `https://${RPC_HOST}`, stagenet: 'https://x', testnet: 'https://x' },
    mayanodeApi: { mainnet: 'https://mayanode.mayachain.info', stagenet: 'https://x', testnet: 'https://x' }
  })
  g.window.apiCommonStorage = { ...storage, get: withUrls, save: withUrls }
}

const ks = vi.hoisted(() => ({ subject: undefined as unknown as BehaviorSubject<unknown> }))
vi.mock('../wallet/keystore', async (importOriginal) => {
  const orig = await importOriginal<typeof import('../wallet/keystore')>()
  const { BehaviorSubject } = await import('rxjs')
  const { option: O } = await import('fp-ts')
  ks.subject = new BehaviorSubject<unknown>(O.none)
  return {
    ...orig,
    keystoreService: {
      ...orig.keystoreService,
      keystoreState$: ks.subject.asObservable(),
      keystoreState: () => ks.subject.getValue()
    }
  }
})
vi.mock('../storage/userChains', async () => {
  const { BehaviorSubject } = await import('rxjs')
  return {
    userChains$: new BehaviorSubject(['MAYA']),
    userChainsLoaded$: new BehaviorSubject(true),
    addChain: () => {},
    removeChain: () => {}
  }
})

const { generateMnemonic } = await import('bip39')
const { option: O } = await import('fp-ts')
const W = await import('../wallet')
const { WalletType } = await import('../../../shared/wallet/types')
const { MAYAChain } = await import('../../../shared/utils/chainIds')
const { isEmptyClientListError } = await import('./balances')

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const reload = () => W.reloadBalancesByChain(MAYAChain, WalletType.Keystore)()
const unlock = (id: number, phrase: string) => ks.subject.next(O.some({ id, name: `w${id}`, phrase }))
const lock = (id: number) => ks.subject.next(O.some({ id, name: `w${id}` }))

// MAYA balance states seen by the UI (`chainBalances$`), per step
type State = { step: string; tag: string; msg?: string }
const states: State[] = []
const ui = W.chainBalances$.subscribe((chainBalances) =>
  chainBalances
    .filter((c) => c.chain === MAYAChain)
    .forEach(({ balances }) =>
      states.push({
        step,
        tag: balances._tag,
        msg: balances._tag === 'RemoteFailure' ? String(balances.error.msg) : undefined
      })
    )
)
const statesIn = (s: string) => states.filter((st) => st.step === s)
const lastState = () => states[states.length - 1]

afterAll(() => ui.unsubscribe())

describe('services/mayachain/balances', () => {
  it('isEmptyClientListError', () => {
    expect(isEmptyClientListError('No clients available. Can not retrieve balances for maya1x')).toBe(true)
    expect(
      isEmptyClientListError(
        'No clients available. Can not retrieve balances for maya1x. Last error: Bad status on response: 429'
      )
    ).toBe(false)
    expect(isEmptyClientListError('Bad status on response: 429')).toBe(false)
  })

  it('sends one balance request per unlock and per Refresh, however often wallets are unlocked', async () => {
    const N = 5
    for (let i = 0; i < N; i++) {
      const id = 1000 + i
      lock(id) // select wallet (locked)
      await sleep(50)
      step = `unlock ${i + 1}`
      unlock(id, generateMnemonic())
      await sleep(700)

      step = `reload ${i + 1}`
      reload()
      await sleep(700)

      step = `lock ${i + 1}`
      lock(id)
      await sleep(200)
    }
    for (let i = 1; i <= N; i++) {
      // before the fix: `i` requests in each of these steps (42 instead of 12 over the run)
      expect(requestsIn(`unlock ${i}`, isBalancesQuery), `unlock ${i}`).toBe(1)
      expect(requestsIn(`reload ${i}`, isBalancesQuery), `reload ${i}`).toBe(1)
      expect(requestsIn(`lock ${i}`, isBalancesQuery), `lock ${i}`).toBe(0)
    }
  }, 30_000)

  it('unlocking the same wallet again is served from cache, Refresh still sends one request', async () => {
    const phrase = generateMnemonic()
    for (let i = 0; i < 4; i++) {
      step = `same unlock ${i + 1}`
      unlock(2000, phrase)
      await sleep(600)
      lock(2000)
      await sleep(200)
    }
    step = 'same final'
    unlock(2000, phrase)
    await sleep(600)
    step = 'same reload'
    reload()
    await sleep(700)

    expect(requestsIn('same unlock 1', isBalancesQuery)).toBe(1)
    for (let i = 2; i <= 4; i++) expect(requestsIn(`same unlock ${i}`, isBalancesQuery)).toBe(0)
    expect(requestsIn('same final', isBalancesQuery)).toBe(0)
    // before the fix: 5
    expect(requestsIn('same reload', isBalancesQuery)).toBe(1)
  }, 30_000)

  it('keeps showing the loaded balances while Refresh is in flight', async () => {
    step = 'hold unlock'
    unlock(2500, generateMnemonic())
    await sleep(700)
    expect(lastState().tag).toBe('RemoteSuccess')
    step = 'hold reload'
    reload()
    await sleep(700)
    expect(requestsIn('hold reload', isBalancesQuery)).toBe(1)
    expect(statesIn('hold reload').map((s) => s.tag)).not.toContain('RemotePending')
    expect(lastState().tag).toBe('RemoteSuccess')
  }, 30_000)

  it('rebuilds a client whose first connect failed (429) on next Refresh', async () => {
    rpc429 = true
    step = 'A unlock under 429'
    unlock(3000, generateMnemonic())
    await sleep(1500)
    expect(lastState().tag).toBe('RemoteFailure')
    expect(isEmptyClientListError(lastState().msg ?? '')).toBe(true)

    rpc429 = false
    step = 'A reload after limit lifted'
    reload()
    await sleep(1500)
    // before the fix: no request at all and the same failure again, until wallet / network / url changes
    expect(requestsIn(step, isConnect)).toBe(1)
    expect(requestsIn(step, isBalancesQuery)).toBe(1)
    expect(lastState().tag).toBe('RemoteSuccess')

    step = 'A reload #2'
    reload()
    await sleep(900)
    // healthy client again: no further rebuild
    expect(requestsIn(step, isConnect)).toBe(0)
    expect(requestsIn(step, isBalancesQuery)).toBe(1)
    expect(lastState().tag).toBe('RemoteSuccess')
  }, 30_000)

  it('does not rebuild a connected client after a 429 on a query (a Refresh recovers it)', async () => {
    step = 'B unlock'
    unlock(3001, generateMnemonic())
    await sleep(900)
    rpc429 = true
    step = 'B reload under 429'
    reload()
    await sleep(900)
    expect(lastState().tag).toBe('RemoteFailure')
    expect(lastState().msg).toContain('Last error: Bad status on response: 429')
    rpc429 = false
    step = 'B reload after limit lifted'
    reload()
    await sleep(900)
    expect(requestsIn(step, isConnect)).toBe(0)
    expect(requestsIn(step, isBalancesQuery)).toBe(1)
    expect(lastState().tag).toBe('RemoteSuccess')
  }, 30_000)
})
