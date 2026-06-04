export enum Protocol {
  All = 'All',
  THORChain = 'THOR',
  MAYAChain = 'MAYA',
  Chainflip = 'CHAINFLIP'
}

export const CHAINFLIP_PROTOCOL: string = Protocol.Chainflip

export const Protocols: Protocol[] = [Protocol.THORChain, Protocol.MAYAChain, Protocol.Chainflip]
export const ProtocolsWithAll: Protocol[] = [Protocol.All, Protocol.THORChain, Protocol.MAYAChain, Protocol.Chainflip]
// LP only exists on THORChain and MAYAChain — Chainflip is swap-only.
export const ProtocolsLp: Protocol[] = [Protocol.THORChain, Protocol.MAYAChain]

export type Props = {
  protocol: string
  setProtocol: (protocol: string) => void
  withAll?: boolean
  // Explicit protocol list; overrides `withAll`. Pass a module-level constant
  // (not an inline array) so the reference is stable across renders.
  protocols?: Protocol[]
}
