import { createVultisigSdkNativeTx } from '../shared/vultisigSdkTx'
import { ErrorId } from '../wallet/types'

export const createVultisigRadixTx = () => createVultisigSdkNativeTx('XRD')

// Pool deposits via SDK native pipeline.
// Note: The SDK sendTransaction does not take a router param. For Radix pool deposits
// that require calling `user_deposit` on a router contract, the SDK must handle this
// internally based on the memo. If the SDK does not support this, pool deposits will
// need a dedicated handler similar to the keystore path.
export const createVultisigRadixPoolTx = () => createVultisigSdkNativeTx('XRD', ErrorId.POOL_TX)
