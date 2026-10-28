/**
 * MAYA balance requests across wallet unlock / Refresh cycles.
 *
 * Runs the app's real wallet, balance and MAYA client modules.
 * Network is stubbed: `fetch` (CosmJS RPC) and `XMLHttpRequest` (axios REST) are counted and answered locally.
 * Wallets are throwaway mnemonics generated in memory.
 *
 * Every test gets fresh modules (`vi.resetModules`), so no state (clients, cached balances, rebuild state)
 * is shared between tests. Timers are fake (`advance`), so waits are deterministic and cost no real time.
 */
import { BehaviorSubject } from 'rxjs'
import { vi } from 'vitest'

type Hit = { host: string; what: string; step: string }
const hits: Hit[] = []
let step = 'import'
let rpc429 = false
// response time of the stubbed network (ms)
let latency = 0

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
  if (latency > 0) await new Promise((r) => setTimeout(r, latency))
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
    }, 1 + latency)
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

// Keystore state, new for every test. Modules of a previous test stay subscribed to their own subject.
const ks = vi.hoisted(() => ({ subject: undefined as unknown as BehaviorSubject<unknown> }))
vi.mock('../wallet/keystore', async (importOriginal) => {
  const orig = await importOriginal<typeof import('../wallet/keystore')>()
  const { defer } = await import('rxjs')
  return {
    ...orig,
    keystoreService: {
      ...orig.keystoreService,
      keystoreState$: defer(() => ks.subject),
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
const { WalletType } = await import('../../../shared/wallet/types')
const { MAYAChain } = await import('../../../shared/utils/chainIds')

const isRestNodeInfo = (h: Hit) => h.what.endsWith('node_info')

// Runs timers (debounce, fake XHR, `shareBalances` teardown) and the promises in between
const advance = (ms: number) => vi.advanceTimersByTimeAsync(ms)
const unlock = (id: number, phrase: string) => ks.subject.next(O.some({ id, name: `w${id}`, phrase }))
const lock = (id: number) => ks.subject.next(O.some({ id, name: `w${id}` }))

// MAYA balance states seen by the UI (`chainBalances$`), per step
type State = { step: string; tag: string; msg?: string }
let states: State[] = []
const statesIn = (s: string) => states.filter((st) => st.step === s)
const lastState = () => states[states.length - 1]

let W: typeof import('../wallet')
let reload: () => void
let isEmptyClientListError: (msg: string) => boolean
let ui: { unsubscribe: () => void } | undefined

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] })
  vi.resetModules()
  hits.length = 0
  states = []
  step = 'import'
  rpc429 = false
  latency = 0
  ks.subject = new BehaviorSubject<unknown>(O.none)
  W = await import('../wallet')
  ;({ isEmptyClientListError } = await import('./balances'))
  reload = () => W.reloadBalancesByChain(MAYAChain, WalletType.Keystore)()
  ui = W.chainBalances$.subscribe((chainBalances) =>
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
})

afterEach(async () => {
  ui?.unsubscribe()
  // let the balance loaders tear down (`shareBalances` resets one tick after the last unsubscribe)
  await advance(1000)
  vi.useRealTimers()
})

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
      await advance(50)
      step = `unlock ${i + 1}`
      unlock(id, generateMnemonic())
      await advance(700)

      step = `reload ${i + 1}`
      reload()
      await advance(700)

      step = `lock ${i + 1}`
      lock(id)
      await advance(200)
    }
    for (let i = 1; i <= N; i++) {
      // before the fix: `i` requests in each of these steps (42 instead of 12 over the run)
      expect(requestsIn(`unlock ${i}`, isBalancesQuery), `unlock ${i}`).toBe(1)
      expect(requestsIn(`reload ${i}`, isBalancesQuery), `reload ${i}`).toBe(1)
      expect(requestsIn(`lock ${i}`, isBalancesQuery), `lock ${i}`).toBe(0)
    }
  })

  it('unlocking the same wallet again is served from cache, Refresh still sends one request', async () => {
    const phrase = generateMnemonic()
    for (let i = 0; i < 4; i++) {
      step = `same unlock ${i + 1}`
      unlock(2000, phrase)
      await advance(600)
      lock(2000)
      await advance(200)
    }
    step = 'same final'
    unlock(2000, phrase)
    await advance(600)
    step = 'same reload'
    reload()
    await advance(700)

    expect(requestsIn('same unlock 1', isBalancesQuery)).toBe(1)
    for (let i = 2; i <= 4; i++) expect(requestsIn(`same unlock ${i}`, isBalancesQuery)).toBe(0)
    expect(requestsIn('same final', isBalancesQuery)).toBe(0)
    // before the fix: 5
    expect(requestsIn('same reload', isBalancesQuery)).toBe(1)
  })

  it('keeps showing the loaded balances while Refresh is in flight', async () => {
    step = 'hold unlock'
    unlock(2500, generateMnemonic())
    await advance(700)
    expect(lastState().tag).toBe('RemoteSuccess')
    step = 'hold reload'
    reload()
    await advance(700)
    expect(requestsIn('hold reload', isBalancesQuery)).toBe(1)
    expect(statesIn('hold reload').map((s) => s.tag)).not.toContain('RemotePending')
    expect(lastState().tag).toBe('RemoteSuccess')
  })

  it('rebuilds a client whose first connect failed (429) on next Refresh', async () => {
    rpc429 = true
    step = 'A unlock under 429'
    unlock(3000, generateMnemonic())
    await advance(1500)
    expect(lastState().tag).toBe('RemoteFailure')
    expect(isEmptyClientListError(lastState().msg ?? '')).toBe(true)

    rpc429 = false
    step = 'A reload after limit lifted'
    reload()
    await advance(1500)
    // before the fix: no request at all and the same failure again, until wallet / network / url changes
    expect(requestsIn(step, isConnect)).toBe(1)
    expect(requestsIn(step, isBalancesQuery)).toBe(1)
    expect(lastState().tag).toBe('RemoteSuccess')

    step = 'A reload #2'
    reload()
    await advance(900)
    // healthy client again: no further rebuild
    expect(requestsIn(step, isConnect)).toBe(0)
    expect(requestsIn(step, isBalancesQuery)).toBe(1)
    expect(lastState().tag).toBe('RemoteSuccess')
  })

  it('a quick second Refresh while a stuck client is rebuilt sends no extra request', async () => {
    rpc429 = true
    step = 'D unlock under 429'
    unlock(3500, generateMnemonic())
    await advance(1500)
    expect(isEmptyClientListError(lastState().msg ?? '')).toBe(true)

    rpc429 = false
    latency = 200 // a real network: the rebuild takes a while (chain id, connect, balances)
    step = 'D double reload'
    reload()
    await advance(100) // new client: chain id request in flight
    reload()
    await advance(250) // new client: connecting
    reload()
    await advance(200) // new client: balance request in flight
    reload()
    await advance(2000)
    expect(requestsIn(step, isConnect)).toBe(1)
    expect(requestsIn(step, isBalancesQuery)).toBe(1)
    expect(lastState().tag).toBe('RemoteSuccess')
  })

  it('Refresh works again if a rebuild hangs (after 10s)', async () => {
    rpc429 = true
    step = 'F unlock under 429'
    unlock(3700, generateMnemonic())
    await advance(1500)
    expect(isEmptyClientListError(lastState().msg ?? '')).toBe(true)

    rpc429 = false
    latency = 600_000 // network hangs: the rebuild never gets a client
    step = 'F rebuild'
    reload()
    await advance(1000)
    expect(requestsIn(step, isRestNodeInfo)).toBe(2) // chain id: keystore + read-only client
    step = 'F reload during rebuild'
    reload()
    await advance(5000)
    expect(hits.filter((h) => h.step === step).length).toBe(0)

    await advance(5000) // 10s after the rebuild
    step = 'F reload after timeout'
    reload() // reloads the (still stuck) client, which fails at once ...
    await advance(1000)
    expect(isEmptyClientListError(lastState().msg ?? '')).toBe(true)
    reload() // ... so the next Refresh builds a new client again
    await advance(1000)
    expect(requestsIn(step, isRestNodeInfo)).toBe(2)
  })

  it('a stuck flag of a locked wallet does not rebuild on Refresh', async () => {
    rpc429 = true
    step = 'E unlock under 429'
    unlock(3600, generateMnemonic())
    await advance(1500)
    expect(isEmptyClientListError(lastState().msg ?? '')).toBe(true)
    rpc429 = false

    step = 'E lock'
    lock(3600)
    await advance(700)
    step = 'E reload while locked'
    reload()
    await advance(1500)
    // before: the leftover flag rebuilt the (locked) client, 2 chain id requests
    expect(requestsIn(step, isRestNodeInfo)).toBe(0)
    expect(requestsIn(step, isConnect)).toBe(0)
    expect(requestsIn(step, isBalancesQuery)).toBe(0)
  })

  it('does not rebuild a connected client after a 429 on a query (a Refresh recovers it)', async () => {
    step = 'B unlock'
    unlock(3001, generateMnemonic())
    await advance(900)
    rpc429 = true
    step = 'B reload under 429'
    reload()
    await advance(900)
    expect(lastState().tag).toBe('RemoteFailure')
    expect(lastState().msg).toContain('Last error: Bad status on response: 429')
    rpc429 = false
    step = 'B reload after limit lifted'
    reload()
    await advance(900)
    expect(requestsIn(step, isConnect)).toBe(0)
    expect(requestsIn(step, isBalancesQuery)).toBe(1)
    expect(lastState().tag).toBe('RemoteSuccess')
  })
})
