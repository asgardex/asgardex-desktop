import { ChainKind } from '../ChainKind'

export const signingAlgorithms = ['ecdsa', 'eddsa'] as const

export type SignatureAlgorithm = typeof signingAlgorithms[number]

export const signatureAlgorithms: Record<ChainKind, SignatureAlgorithm> = {
  evm: 'ecdsa',
  utxo: 'ecdsa',
  cosmos: 'ecdsa',
  sui: 'eddsa',
  solana: 'eddsa',
  polkadot: 'eddsa',
  ton: 'eddsa',
  ripple: 'ecdsa',
  tron: 'ecdsa'
}
