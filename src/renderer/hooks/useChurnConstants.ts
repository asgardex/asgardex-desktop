import { useMemo } from 'react'

import { useMimirConstants } from './useMimirConstants'

export type ChurnConstants = {
  desiredValidatorSet: number
  badValidatorRedline: number
  minSlashPointsForBadValidator: number
  maxNodeToChurnOutForLowVersion: number
  churnOutForLowVersionBlocks: number
  churnInterval: number
  maxBondProviders: number
  newNodesPerChurn: number
  missingBlockChurnOut: number
  maxMissingBlockChurnOut: number
}

export const CHURN_CONSTANT_DEFAULTS: ChurnConstants = {
  desiredValidatorSet: 100,
  badValidatorRedline: 3,
  minSlashPointsForBadValidator: 100,
  maxNodeToChurnOutForLowVersion: 1,
  churnOutForLowVersionBlocks: 21600,
  churnInterval: 43200,
  maxBondProviders: 6,
  newNodesPerChurn: 1,
  missingBlockChurnOut: 0,
  maxMissingBlockChurnOut: 0
}

const MIMIR_KEY_BY_CONSTANT: Record<keyof ChurnConstants, string> = {
  desiredValidatorSet: 'DESIREDVALIDATORSET',
  badValidatorRedline: 'BADVALIDATORREDLINE',
  minSlashPointsForBadValidator: 'MINSLASHPOINTSFORBADVALIDATOR',
  maxNodeToChurnOutForLowVersion: 'MAXNODETOCHURNOUTFORLOWVERSION',
  churnOutForLowVersionBlocks: 'CHURNOUTFORLOWVERSIONBLOCKS',
  churnInterval: 'CHURNINTERVAL',
  maxBondProviders: 'MAXBONDPROVIDERS',
  newNodesPerChurn: 'NUMBEROFNEWNODESPERCHURN',
  missingBlockChurnOut: 'MISSINGBLOCKCHURNOUT',
  maxMissingBlockChurnOut: 'MAXMISSINGBLOCKCHURNOUT'
}

const ZERO_ALLOWED = new Set<keyof ChurnConstants>(['missingBlockChurnOut', 'maxMissingBlockChurnOut'])

const CONSTANT_KEYS = Object.keys(MIMIR_KEY_BY_CONSTANT) as Array<keyof ChurnConstants>
const MIMIR_KEYS = CONSTANT_KEYS.map((key) => MIMIR_KEY_BY_CONSTANT[key])

const isValidValue = (value: number | undefined, allowZero: boolean): value is number =>
  typeof value === 'number' && Number.isFinite(value) && (allowZero ? value >= 0 : value > 0)

export const useChurnConstants = (): ChurnConstants => {
  const mimir = useMimirConstants(MIMIR_KEYS)

  return useMemo(
    () =>
      CONSTANT_KEYS.reduce<ChurnConstants>(
        (acc, key) => {
          const value = mimir[MIMIR_KEY_BY_CONSTANT[key]]
          return isValidValue(value, ZERO_ALLOWED.has(key)) ? { ...acc, [key]: value } : acc
        },
        { ...CHURN_CONSTANT_DEFAULTS }
      ),
    [mimir]
  )
}
