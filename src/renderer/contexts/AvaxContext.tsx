import * as services from '../services/avax'
import { createEvmContext } from './EvmContextFactory'

const { Provider: AvaxProvider, useEvmChainContext: useAvaxContext } = createEvmContext(services, 'Avax')

export { AvaxProvider, useAvaxContext }
