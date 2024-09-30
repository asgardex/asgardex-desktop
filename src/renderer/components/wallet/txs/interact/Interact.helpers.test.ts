import { baseAmount, bn } from '@xchainjs/xchain-util'
import * as O from 'fp-ts/lib/Option'

import { NodeInfo, NodeStatusEnum } from '../../../../services/thorchain/types'
import {
  getInteractTypeFromNullableString,
  isInteractType,
  validateCustomAmountInput,
  validateUnboundAmountInput,
  findNodeIndex
} from './Interact.helpers'

describe('wallet/interact/helpers', () => {
  describe('validateUnboundAmountInput', () => {
    const errors = {
      msg1: 'msg1',
      msg2: 'msg2'
    }
    const validValues = {
      input: bn(22),
      errors
    }

    it('valid (> 0)', async () => {
      const result = validateUnboundAmountInput(validValues)
      expect(result).resolves.toBeUndefined()
    })

    it('invalid (not numbers)', async () => {
      const props = { ...validValues, input: bn('hello') }
      const result = validateUnboundAmountInput(props)
      expect(result).rejects.toBe(errors.msg1)
    })

    it('invalid (input < 0)', async () => {
      const props = { ...validValues, input: bn(-1) }
      const result = validateUnboundAmountInput(props)
      expect(result).rejects.toBe(errors.msg2)
    })

    it('invalid (input === 0)', async () => {
      const props = { ...validValues, input: bn('0') }
      const result = validateUnboundAmountInput(props)
      expect(result).rejects.toBe(errors.msg2)
    })
  })

  describe('validateCustomAmountInput', () => {
    const errors = {
      msg1: 'msg1',
      msg2: 'msg2'
    }
    const validValues = {
      input: bn(22),
      errors
    }

    it('valid (> 0)', async () => {
      const result = validateCustomAmountInput(validValues)
      expect(result).resolves.toBeUndefined()
    })

    it('valid (=== 0)', async () => {
      const props = { ...validValues, input: bn(0) }
      const result = validateCustomAmountInput(props)
      expect(result).resolves.toBeUndefined()
    })

    it('invalid (not numbers)', async () => {
      const props = { ...validValues, input: bn('hello') }
      const result = validateCustomAmountInput(props)
      expect(result).rejects.toBe(errors.msg1)
    })

    it('invalid (input <= 0)', async () => {
      const props = { ...validValues, input: bn(-1) }
      const result = validateCustomAmountInput(props)
      expect(result).rejects.toBe(errors.msg2)
    })
  })

  describe('isInteractType', () => {
    it('bond', () => {
      const result = isInteractType('bond')
      expect(result).toBeTruthy()
    })
    it('unbond', () => {
      const result = isInteractType('unbond')
      expect(result).toBeTruthy()
    })
    it('leave', () => {
      const result = isInteractType('leave')
      expect(result).toBeTruthy()
    })
    it('custom', () => {
      const result = isInteractType('custom')
      expect(result).toBeTruthy()
    })
    it('invalid', () => {
      const result = isInteractType('invalid')
      expect(result).toBeFalsy()
    })
    it('null', () => {
      const result = isInteractType(null)
      expect(result).toBeFalsy()
    })
  })

  describe('getInteractTypeFromNullableString', () => {
    it('bond', () => {
      const result = getInteractTypeFromNullableString('bond')
      expect(result).toEqual(O.some('bond'))
    })
    it('unbond', () => {
      const result = getInteractTypeFromNullableString('unbond')
      expect(result).toEqual(O.some('unbond'))
    })
    it('leave', () => {
      const result = getInteractTypeFromNullableString('leave')
      expect(result).toEqual(O.some('leave'))
    })
    it('custom', () => {
      const result = getInteractTypeFromNullableString('custom')
      expect(result).toEqual(O.some('custom'))
    })
    it('invalid', () => {
      const result = getInteractTypeFromNullableString('invalid')
      expect(result).toBeNone()
    })
    it('undefined', () => {
      const result = getInteractTypeFromNullableString()
      expect(result).toBeNone()
    })
  })

  describe('findNodeIndex', () => {
    const nodes: NodeInfo[] = [
      {
        address: 'thor10czf2s89h79fsjmqqck85cdqeq536hw5ngz4lt',
        bond: baseAmount(100000000 * 40000000),
        award: baseAmount(100000000 * 400000),
        status: 'Active' as NodeStatusEnum,
        nodeOperatorAddress: '',
        bondProviders: { providers: [], nodeOperatorFee: baseAmount(100000000 * 400000) }, // Mock bondProviders
        signMembership: []
      },
      {
        address: 'thor16ery22gma35h2fduxr0swdfvz4s6yvy6yhskf6',
        bond: baseAmount(100000000 * 40000000), // Mock bond value
        award: baseAmount(100000000 * 400000), // Mock award value
        status: 'Standby' as NodeStatusEnum,
        nodeOperatorAddress: '',
        bondProviders: { providers: [], nodeOperatorFee: baseAmount(100000000 * 400000) }, // Mock bondProviders
        signMembership: ['thor16ery22gma35h2fduxr0swdfvz4s6yvy6yhskf6']
      },
      {
        address: 'thor13uy6szawgsj9xjs0gq2xddzmcup3zl63khp6gq',
        bond: baseAmount(100000000 * 40000000), // Mock bond value
        award: baseAmount(100000000 * 400000), // Mock award value
        status: 'Standby' as NodeStatusEnum,
        nodeOperatorAddress: '',
        bondProviders: { providers: [], nodeOperatorFee: baseAmount(100000000 * 400000) }, // Mock bondProviders
        signMembership: []
      }
    ]

    it('should find an active node', () => {
      const result = findNodeIndex(nodes, 'thor10czf2s89h79fsjmqqck85cdqeq536hw5ngz4lt')
      expect(result).toEqual(0)
    })

    it('should find a standby node with the address in signMembership', () => {
      const result = findNodeIndex(nodes, 'thor16ery22gma35h2fduxr0swdfvz4s6yvy6yhskf6')
      expect(result).toEqual(1)
    })

    it('should not find a node if the address does not match any active or standby nodes', () => {
      const result = findNodeIndex(nodes, 'thor1invalidaddress1234567890')
      expect(result).toEqual(-1)
    })

    it('should not find a node if the address matches a standby node but is not in signMembership', () => {
      const result = findNodeIndex(nodes, 'thor18df3c5lhdskfsjmqqck85cdqeq536hw5ngz4lt')
      expect(result).toEqual(-1)
    })

    it('should not find a node if the status does not match active or standby', () => {
      const modifiedNodes = [
        {
          address: 'thor1nprw0w6ex8xh4tfl3vtkhqnjvds68kwshq9ax9',
          bond: baseAmount(100000000 * 40000000), // Mock bond value
          award: baseAmount(100000000 * 400000), // Mock award value
          nodeOperatorAddress: '',
          status: 'Disabled' as NodeStatusEnum,
          bondProviders: { providers: [], nodeOperatorFee: baseAmount(100000000 * 400000) }, // Mock bondProviders
          signMembership: []
        }
      ]
      const result = findNodeIndex(modifiedNodes, 'thor1nprw0w6ex8xh4tfl3vtkhqnjvds68kwshq9ax9')
      expect(result).toEqual(-1)
    })
  })
})
