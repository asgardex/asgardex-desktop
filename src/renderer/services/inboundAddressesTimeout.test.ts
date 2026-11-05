// A hung `inbound_addresses` request must end as a Failure (halt status unknown), never stay Pending forever.
import * as RD from '@devexperts/remote-data-ts'
import { Network } from '@xchainjs/xchain-client'
import * as Rx from 'rxjs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { HALT_REQUEST_TIMEOUT_MS } from '../helpers/requestTimeout'
import { createMayanodeService$ } from './mayachain/mayanode'
import { createThornodeService$ } from './thorchain/thornode'

const { hung, hangingNetworkApi } = vi.hoisted(() => {
  const hung = { calls: [] as unknown[][] }
  const hangingNetworkApi = (original: Record<string, unknown>) => {
    const Base = original.NetworkApi as new (...args: unknown[]) => object
    return class extends Base {
      inboundAddresses(...args: unknown[]) {
        hung.calls.push(args)
        return new Promise(() => {}) // node accepts the connection but never answers
      }
    }
  }
  return { hung, hangingNetworkApi }
})
vi.mock('@xchainjs/xchain-thornode', async (importOriginal) => {
  const original = await importOriginal<Record<string, unknown>>()
  return { ...original, NetworkApi: hangingNetworkApi(original) }
})
vi.mock('@xchainjs/xchain-mayanode', async (importOriginal) => {
  const original = await importOriginal<Record<string, unknown>>()
  return { ...original, NetworkApi: hangingNetworkApi(original) }
})

const nodeUrl = { node: 'https://node.example', rpc: 'https://rpc.example' }
const clientUrl$ = Rx.of({ mainnet: nodeUrl, stagenet: nodeUrl, testnet: nodeUrl } as never)

describe('services: inbound_addresses request timeout', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    hung.calls = []
  })
  afterEach(() => vi.useRealTimers())

  it.each([
    ['THORNode', () => createThornodeService$(Rx.of(Network.Mainnet), clientUrl$)],
    ['MAYANode', () => createMayanodeService$(Rx.of(Network.Mainnet), clientUrl$)]
  ])('%s: a hung request times out to Failure', async (_, create) => {
    const results: RD.RemoteData<Error, unknown>[] = []
    const sub = create()
      .loadInboundAddresses$()
      .subscribe((rd) => results.push(rd))
    await vi.advanceTimersByTimeAsync(HALT_REQUEST_TIMEOUT_MS - 1000)
    expect(RD.isPending(results.at(-1)!)).toBe(true)
    // fallback bases (if any) time out one after another
    await vi.advanceTimersByTimeAsync(5 * HALT_REQUEST_TIMEOUT_MS)
    sub.unsubscribe()
    expect(hung.calls.length).toBeGreaterThan(0)
    expect(hung.calls[0][1]).toEqual({ timeout: HALT_REQUEST_TIMEOUT_MS })
    const last = results.at(-1)!
    expect(RD.isFailure(last) && last.error.message).toMatch(/inbound_addresses request timed out/)
  })
})
