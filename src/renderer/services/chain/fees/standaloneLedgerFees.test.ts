import * as RD from '@devexperts/remote-data-ts'
import { Fees, FeeType } from '@xchainjs/xchain-client'
import { NEARChain } from '@xchainjs/xchain-near'
import { SUIChain } from '@xchainjs/xchain-sui'
import { baseAmount, Chain } from '@xchainjs/xchain-util'
import { firstValueFrom, of } from 'rxjs'
import { last } from 'rxjs/operators'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { DEFAULT_ENABLED_CHAINS } from '../../../../shared/utils/chain'
import { THORChain } from '../../../../shared/utils/chainIds'
import { isUtxoAssetChain } from '../../../helpers/assetHelper'
import { getChainAsset } from '../../../helpers/chainHelper'
import { isEvmChain } from '../../../helpers/evmHelper'
import * as ADA from '../../cardano'
import { FeesRD } from '../../clients'
import * as COSMOS from '../../cosmos'
import * as MAYA from '../../mayachain'
import * as NEAR from '../../near'
import * as XRP from '../../ripple'
import * as SOL from '../../solana'
import * as SUI from '../../sui'
import { ZERO_ADDRESS as SUI_ZERO_ADDRESS } from '../../sui/fees'
import * as THOR from '../../thorchain'
import * as TRON from '../../tron'
import { reloadStandaloneLedgerFees, standaloneLedgerFees$ } from './common'

const fees = (amount: number, decimal: number): Fees => ({
  type: FeeType.FlatFee,
  average: baseAmount(amount, decimal),
  fast: baseAmount(amount, decimal),
  fastest: baseAmount(amount, decimal)
})

// SUI has 9 decimals, RUNE 8 - the two values must never be confused
const SUI_FEES = fees(2_000_000, 9)
const RUNE_FEES = fees(2_000_000, 8)
const NEAR_FEES = fees(1_000, 24)

// Partial mocks: keep each module's real exports, stub only its fee functions
vi.mock(import('../../sui'), async (importOriginal) => ({
  ...(await importOriginal()),
  fees$: vi.fn(),
  reloadFees: vi.fn()
}))
vi.mock(import('../../near'), async (importOriginal) => ({
  ...(await importOriginal()),
  fees$: vi.fn(),
  reloadFees: vi.fn()
}))
vi.mock(import('../../thorchain'), async (importOriginal) => ({
  ...(await importOriginal()),
  fees$: vi.fn(),
  reloadFees: vi.fn()
}))
vi.mock(import('../../mayachain'), async (importOriginal) => ({
  ...(await importOriginal()),
  fees$: vi.fn(),
  reloadFees: vi.fn()
}))
vi.mock(import('../../cosmos'), async (importOriginal) => ({
  ...(await importOriginal()),
  fees$: vi.fn(),
  reloadFees: vi.fn()
}))
vi.mock(import('../../cardano'), async (importOriginal) => ({
  ...(await importOriginal()),
  fees$: vi.fn(),
  reloadFees: vi.fn()
}))
vi.mock(import('../../ripple'), async (importOriginal) => ({
  ...(await importOriginal()),
  fees$: vi.fn(),
  reloadFees: vi.fn()
}))
vi.mock(import('../../solana'), async (importOriginal) => ({
  ...(await importOriginal()),
  fees$: vi.fn(),
  reloadFees: vi.fn()
}))
vi.mock(import('../../tron'), async (importOriginal) => ({
  ...(await importOriginal()),
  fees$: vi.fn(),
  reloadFees: vi.fn()
}))

// Every enabled chain the Send view routes through standaloneLedgerFees$ (not UTXO, not EVM)
const STANDALONE_FEE_CHAINS = (Object.keys(DEFAULT_ENABLED_CHAINS) as Chain[]).filter(
  (chain) => !isUtxoAssetChain(getChainAsset(chain)) && !isEvmChain(chain)
)

const lastFees = (chain: Chain): Promise<FeesRD> =>
  firstValueFrom(standaloneLedgerFees$({ chain, amount: baseAmount(1), recipient: 'recipient' }).pipe(last()))

describe('standaloneLedgerFees$', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(SUI.fees$).mockReturnValue(of(RD.success(SUI_FEES)))
    vi.mocked(NEAR.fees$).mockReturnValue(of(RD.success(NEAR_FEES)))
    vi.mocked(THOR.fees$).mockReturnValue(of(RD.success(RUNE_FEES)))
  })

  it('returns SUI fees for SUI (not RUNE fees)', async () => {
    const result = await lastFees(SUIChain)

    expect(SUI.fees$).toHaveBeenCalledTimes(1)
    expect(THOR.fees$).not.toHaveBeenCalled()
    expect(result).toEqual(RD.success(SUI_FEES))
    expect(RD.isSuccess(result) && result.value.fast.decimal).toBe(9)
  })

  it('asks the SUI fee service for a native SUI transfer estimate', async () => {
    await lastFees(SUIChain)

    const [params] = vi.mocked(SUI.fees$).mock.calls[0]
    expect(params.recipient).toBe(SUI_ZERO_ADDRESS)
    expect(params.amount.amount().toNumber()).toBe(1)
  })

  it('returns fees (no error) for every enabled chain that uses this path', async () => {
    const otherFees = of(RD.success(fees(1, 6)))
    ;[MAYA, COSMOS, ADA, XRP, SOL, TRON].forEach((service) => vi.mocked(service.fees$).mockReturnValue(otherFees))

    expect(STANDALONE_FEE_CHAINS).toEqual(
      expect.arrayContaining(['THOR', 'MAYA', 'GAIA', 'ADA', 'XRP', 'SOL', 'TRON', 'NEAR', 'SUI'])
    )
    for (const chain of STANDALONE_FEE_CHAINS) {
      const result = await lastFees(chain)
      expect(RD.isSuccess(result), `fees for ${chain}`).toBe(true)
    }
    // Only THOR itself may read RUNE fees
    expect(THOR.fees$).toHaveBeenCalledTimes(1)
  })

  it('keeps existing chains on their own fees (THOR, NEAR)', async () => {
    expect(await lastFees(THORChain)).toEqual(RD.success(RUNE_FEES))
    expect(await lastFees(NEARChain)).toEqual(RD.success(NEAR_FEES))
    expect(THOR.fees$).toHaveBeenCalledTimes(1)
    expect(NEAR.fees$).toHaveBeenCalledTimes(1)
    expect(SUI.fees$).not.toHaveBeenCalled()
  })

  it('returns a fee error for an unknown chain instead of falling back to RUNE fees', async () => {
    const result = await lastFees('UNKNOWN' as Chain)

    expect(THOR.fees$).not.toHaveBeenCalled()
    expect(RD.isFailure(result)).toBe(true)
    expect(RD.isFailure(result) && result.error.message).toContain('UNKNOWN')
  })
})

describe('reloadStandaloneLedgerFees', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('reloads SUI fees for SUI', () => {
    reloadStandaloneLedgerFees(SUIChain)

    expect(SUI.reloadFees).toHaveBeenCalledTimes(1)
    const [params] = vi.mocked(SUI.reloadFees).mock.calls[0]
    expect(params.recipient).toBe(SUI_ZERO_ADDRESS)
    expect(params.amount.amount().toNumber()).toBe(1)
    expect(THOR.reloadFees).not.toHaveBeenCalled()
  })

  it('reloads each enabled chain on its own fee service, never RUNE for another chain', () => {
    STANDALONE_FEE_CHAINS.filter((chain) => chain !== THORChain).forEach((chain) => reloadStandaloneLedgerFees(chain))

    expect(THOR.reloadFees).not.toHaveBeenCalled()
    ;[MAYA, COSMOS, ADA, XRP, SOL, TRON, NEAR, SUI].forEach((service) =>
      expect(service.reloadFees).toHaveBeenCalledTimes(1)
    )
  })

  it('keeps reloading THOR fees for THOR', () => {
    reloadStandaloneLedgerFees(THORChain)

    expect(THOR.reloadFees).toHaveBeenCalledWith(true)
  })

  it('does not reload RUNE fees for an unknown chain', () => {
    reloadStandaloneLedgerFees('UNKNOWN' as Chain)

    expect(THOR.reloadFees).not.toHaveBeenCalled()
    expect(SUI.reloadFees).not.toHaveBeenCalled()
  })
})
