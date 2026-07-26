import { DEFAULT_MAYANODE_API_URLS, DEFAULT_MAYANODE_RPC_URLS } from '../mayachain/const'
import { DEFAULT_MIDGARD_MAYA_URLS } from '../mayaMidgard/const'
import { DEFAULT_MIDGARD_URLS } from '../midgard/const'
import { DEFAULT_THORNODE_API_URLS, DEFAULT_THORNODE_RPC_URLS } from '../thorchain/const'
import { ChainProviderConfig, ProviderRegistry } from './types'

// ── THORChain ──────────────────────────────────────────────

type ThorSlots = 'midgard' | 'thornodeApi' | 'thornodeRpc'

const thorchainConfig: ChainProviderConfig<ThorSlots> = {
  label: 'THORChain',
  slots: ['midgard', 'thornodeApi', 'thornodeRpc'],
  slotLabels: {
    midgard: 'Midgard',
    thornodeApi: 'THORNode API',
    thornodeRpc: 'THORNode RPC'
  },
  defaultProviderId: 'liquify',
  providers: [
    {
      id: 'liquify',
      name: 'Liquify',
      description: 'Primary public gateway',
      badge: 'recommended',
      domain: 'gateway.liquify.com',
      urls: {
        midgard: DEFAULT_MIDGARD_URLS,
        thornodeApi: DEFAULT_THORNODE_API_URLS,
        thornodeRpc: DEFAULT_THORNODE_RPC_URLS
      }
    },
    {
      id: 'chainnet',
      name: 'Chainnet',
      description: 'Community backup infrastructure',
      badge: 'backup',
      domain: 'thorchain.network',
      urls: {
        midgard: {
          mainnet: 'https://midgard.thorchain.network',
          stagenet: '',
          testnet: ''
        },
        thornodeApi: {
          mainnet: 'https://thornode.thorchain.network',
          stagenet: '',
          testnet: ''
        },
        thornodeRpc: {
          mainnet: 'https://rpc.thorchain.network',
          stagenet: '',
          testnet: ''
        }
      }
    }
  ]
}

// ── MayaChain ──────────────────────────────────────────────

type MayaSlots = 'midgardMaya' | 'mayanodeApi' | 'mayanodeRpc'

const mayachainConfig: ChainProviderConfig<MayaSlots> = {
  label: 'MAYAChain',
  slots: ['midgardMaya', 'mayanodeApi', 'mayanodeRpc'],
  slotLabels: {
    midgardMaya: 'Midgard Maya',
    mayanodeApi: 'MAYANode API',
    mayanodeRpc: 'MAYANode RPC'
  },
  defaultProviderId: 'mayachain',
  providers: [
    {
      id: 'mayachain',
      name: 'MAYAChain',
      description: 'Official MAYAChain infrastructure',
      badge: 'recommended',
      domain: 'mayachain.info',
      urls: {
        midgardMaya: DEFAULT_MIDGARD_MAYA_URLS,
        mayanodeApi: DEFAULT_MAYANODE_API_URLS,
        mayanodeRpc: DEFAULT_MAYANODE_RPC_URLS
      }
    }
  ]
}

// ── Registry ───────────────────────────────────────────────

export const PROVIDER_REGISTRY: ProviderRegistry = {
  thorchain: thorchainConfig,
  mayachain: mayachainConfig
}
