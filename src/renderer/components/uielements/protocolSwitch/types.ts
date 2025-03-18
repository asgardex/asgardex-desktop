export enum Protocol {
  All = 'All',
  THORChain = 'THOR',
  MAYAChain = 'MAYA'
}

export const Protocols: Protocol[] = [Protocol.THORChain, Protocol.MAYAChain]
export const ProtocolsWithAll: Protocol[] = [Protocol.All, Protocol.THORChain, Protocol.MAYAChain]

export type Props = {
  protocol: string
  setProtocol: (protocol: string) => void
  withAll?: boolean
}
