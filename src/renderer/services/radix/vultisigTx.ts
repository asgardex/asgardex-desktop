import { createVultisigSdkNativeTx } from '../shared/vultisigSdkTx'
import { ErrorId } from '../wallet/types'

export const createVultisigRadixTx = () => createVultisigSdkNativeTx('XRD')

// Pool deposits via SDK native pipeline.
// Limitation: SDK sendTransaction has no router param. Radix pool deposits require
// calling `user_deposit` on a router contract (see keystore path in transaction.ts).
// Currently guarded at UI level — pool features are not yet enabled for Vultisig.
// When enabled, this will need a dedicated handler if the SDK cannot infer router
// semantics from memo alone.
export const createVultisigRadixPoolTx = () => createVultisigSdkNativeTx('XRD', ErrorId.POOL_TX)
