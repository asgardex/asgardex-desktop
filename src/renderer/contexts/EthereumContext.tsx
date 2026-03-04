import * as services from '../services/ethereum'
import { createEvmContext } from './EvmContextFactory'

const { Provider: EthereumProvider, useEvmChainContext: useEthereumContext } = createEvmContext(services, 'Ethereum')

export { EthereumProvider, useEthereumContext }
