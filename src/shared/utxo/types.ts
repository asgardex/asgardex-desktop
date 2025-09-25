// Bitcoin UTXO derivation path modes - only P2WPKH and P2TR are supported by XChain
export type UtxoHDMode = 'p2wpkh' | 'p2tr'

export const DEFAULT_UTXO_HD_MODE: UtxoHDMode = 'p2wpkh'

// Bitcoin supported HD modes
export const BITCOIN_HD_MODES: UtxoHDMode[] = ['p2wpkh', 'p2tr']
