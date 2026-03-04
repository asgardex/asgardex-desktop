import * as services from '../services/base'
import { createEvmContext } from './EvmContextFactory'

const { Provider: BaseProvider, useEvmChainContext: useBaseContext } = createEvmContext(services, 'Base')

export { BaseProvider, useBaseContext }
