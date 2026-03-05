import * as services from '../services/bsc'
import { createEvmContext } from './EvmContextFactory'

const { Provider: BscProvider, useEvmChainContext: useBscContext } = createEvmContext(services, 'Bsc')

export { BscProvider, useBscContext }
