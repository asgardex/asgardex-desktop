import { capitalizeFirstLetter } from '../../lib/utils/capitalizeFirstLetter'
import { randomIntegerInRange } from '../../lib/utils/randomInRange'

import { MpcDevice, mpcDeviceFromDeviceName } from './MpcDevice'

const localPartyIdSeparator = '-'

export const generateLocalPartyId = (device: MpcDevice) => {
  const deviceName = device === 'server' ? capitalizeFirstLetter(device) : device

  const number = randomIntegerInRange(1000, 9999)

  return [deviceName, number].join(localPartyIdSeparator)
}

export const parseLocalPartyId = (localPartyId: string) => {
  const [deviceName, hash] = localPartyId.split(localPartyIdSeparator)

  return { deviceName, hash }
}

export const hasServer = (signers: string[]) => signers.some(isServer)

export const isServer = (device: string) => mpcDeviceFromDeviceName(parseLocalPartyId(device).deviceName) === 'server'
