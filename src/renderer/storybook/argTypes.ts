import { Network } from '@xchainjs/xchain-client'
import { option as O } from 'fp-ts'
import { InputType } from 'storybook/internal/types'

import { MOCK_PHRASE } from '../../shared/mock/wallet'

export const keystore = {
  options: ['empty', 'locked', 'unlocked'],
  mapping: {
    empty: O.none,
    locked: O.some({ id: 1 }),
    unlocked: O.some({ id: 1, phrase: MOCK_PHRASE })
  }
}

export const network: InputType = {
  name: 'Network',
  control: {
    type: 'radio',
    options: [Network.Mainnet, Network.Stagenet, Network.Testnet]
  }
}

export const hdMode = {
  name: 'HDMode',
  control: { type: 'select', options: ['default', 'ledgerlive', 'metamask', 'legacy'] }
}
