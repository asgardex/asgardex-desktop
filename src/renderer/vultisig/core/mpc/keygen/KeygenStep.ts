export const keygenSteps = ['prepareVault', 'ecdsa', 'eddsa'] as const

export type KeygenStep = typeof keygenSteps[number]
