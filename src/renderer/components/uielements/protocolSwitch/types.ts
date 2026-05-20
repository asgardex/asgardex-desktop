export enum Protocol {
  All = 'All',
  THORChain = 'THOR',
  MAYAChain = 'MAYA',
  Chainflip = 'CHAINFLIP'
}

export const CHAINFLIP_PROTOCOL: string = Protocol.Chainflip

export const Protocols: Protocol[] = [Protocol.THORChain, Protocol.MAYAChain, Protocol.Chainflip]
export const ProtocolsWithAll: Protocol[] = [Protocol.All, Protocol.THORChain, Protocol.MAYAChain, Protocol.Chainflip]

export type Props = {
  protocol: string
  setProtocol: (protocol: string) => void
  withAll?: boolean
}
