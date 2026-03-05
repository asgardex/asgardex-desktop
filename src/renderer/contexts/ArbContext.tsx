import * as services from '../services/arb'
import { createEvmContext } from './EvmContextFactory'

const { Provider: ArbProvider, useEvmChainContext: useArbContext } = createEvmContext(services, 'Arb')

export { ArbProvider, useArbContext }
