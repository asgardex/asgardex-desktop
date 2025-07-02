import BIP32Factory from 'bip32'
import * as ecc from 'tiny-secp256k1'

type DerivePublicKeyInput = {
  hexRootPubKey: string
  hexChainCode: string
  path: string
}

export const derivePublicKey = ({ hexRootPubKey, hexChainCode, path }: DerivePublicKeyInput): string => {
  if (!hexRootPubKey) {
    throw new Error('Empty pub key')
  }
  if (!hexChainCode) {
    throw new Error('Empty chain code')
  }
  if (!path) {
    throw new Error('Empty path')
  }

  const pubKeyBuf = Buffer.from(hexRootPubKey, 'hex')
  const chainCodeBuf = Buffer.from(hexChainCode, 'hex')
  if (chainCodeBuf.length !== 32) {
    throw new Error('Invalid chain code length')
  }

  const pathBuf = getDerivePathBytes(path)
  const derivedKey = derivePubKeyFromPath(pubKeyBuf, chainCodeBuf, pathBuf)
  return Buffer.from(derivedKey).toString('hex')
}

const getDerivePathBytes = (derivePath: string): number[] => {
  const pathBuf: number[] = []
  const segments = derivePath.split('/')

  for (const segment of segments) {
    if (!segment || segment === 'm') {
      continue
    }
    const index = parseInt(segment.replace("'", ''), 10)
    if (isNaN(index) || index < 0 || index > 0xffffffff) {
      throw new Error(`Invalid path segment: ${segment}`)
    }
    pathBuf.push(index)
  }

  return pathBuf
}
const hardenedOffset = 0x80000000
const derivePubKeyFromPath = (pubKey: Uint8Array, chainCode: Uint8Array, path: number[]): Uint8Array => {
  const bip32 = BIP32Factory(ecc)
  const rootNode = bip32.fromPublicKey(pubKey, chainCode)

  let currentNode = rootNode
  for (const index of path) {
    if (index >= hardenedOffset) {
      throw new Error(`Cannot derive hardened child (index ${index}) from a public key`)
    }
    currentNode = currentNode.derive(index)
  }

  if (!currentNode.publicKey) {
    throw new Error('Failed to derive public key')
  }

  return currentNode.publicKey
}
