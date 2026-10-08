import { Network } from '@xchainjs/xchain-client'

import { AssetXRD, RadixChain } from './radix'

/**
 * Stand-in for `@xchainjs/xchain-radix` when Maya AMM imports it.
 * The real package pulls the Radix Engine Toolkit into whichever chunk imports
 * it. Maya delisted XRD, so the AMM never needs the toolkit. The wallet client
 * still loads the real package from `services/radix/load.ts`.
 */
export { AssetXRD, RadixChain }

export class Client {
  private network: Network

  constructor(params?: { network?: Network }) {
    this.network = params?.network ?? Network.Mainnet
  }

  getNetwork(): Network {
    return this.network
  }

  setNetwork(network: Network): void {
    this.network = network
  }

  // Maya address checks for XRD never run. A prefix check keeps the call from throwing.
  validateAddress(address: string): boolean {
    return address.startsWith('account_')
  }
}

const mayaRadixRemoved = (name: string): never => {
  throw new Error(`MayaChain delisted Radix (${name})`)
}

export const generateAddressParam = (): never => mayaRadixRemoved('generateAddressParam')
export const generateBucketParam = (): never => mayaRadixRemoved('generateBucketParam')
export const generateStringParam = (): never => mayaRadixRemoved('generateStringParam')
