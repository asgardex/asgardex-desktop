import { describe, expect, it } from 'vitest'

import { recoverTxHashFromBroadcastTimeout } from './cosmosBroadcastError'

describe('helpers/cosmosBroadcastError', () => {
  it('recovers CosmJS TimeoutError with txId', () => {
    const error = Object.assign(
      new Error(
        'Transaction with ID 5082A38F91694E4DD64A44FCA37D00DE9BD11CA5AC29648CDB732FA655449DDF was submitted but was not yet found on the chain. You might want to check later. There was a wait of 60 seconds.'
      ),
      { txId: '5082A38F91694E4DD64A44FCA37D00DE9BD11CA5AC29648CDB732FA655449DDF', name: 'TimeoutError' }
    )

    expect(recoverTxHashFromBroadcastTimeout(error)).toEqual({
      txHash: '5082A38F91694E4DD64A44FCA37D00DE9BD11CA5AC29648CDB732FA655449DDF',
      message: error.message
    })
  })

  it('recovers hash from the CosmJS message when txId prop is missing', () => {
    const message =
      'Transaction with ID abcdef0123456789 was submitted but was not yet found on the chain. There was a wait of 60 seconds.'
    expect(recoverTxHashFromBroadcastTimeout(new Error(message))).toEqual({
      txHash: 'abcdef0123456789',
      message
    })
  })

  it('does not recover plain RPC timeouts without a tx hash (fail closed)', () => {
    expect(recoverTxHashFromBroadcastTimeout(new Error('request timed out'))).toBeUndefined()
    expect(recoverTxHashFromBroadcastTimeout(new Error('transaction broadcasting was timed out'))).toBeUndefined()
  })

  it('does not treat unrelated errors as broadcast timeouts', () => {
    expect(recoverTxHashFromBroadcastTimeout(new Error('insufficient funds'))).toBeUndefined()
    expect(recoverTxHashFromBroadcastTimeout(new Error('account sequence mismatch'))).toBeUndefined()
  })
})
