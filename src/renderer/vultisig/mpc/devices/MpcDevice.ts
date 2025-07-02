export type MpcDevice = 'windows' | 'mac' | 'linux' | 'iphone' | 'ipad' | 'android' | 'server' | 'extension'

const mpcDeviceName: Record<MpcDevice, string> = {
  windows: 'Windows',
  mac: 'Mac',
  linux: 'Linux',
  iphone: 'iPhone',
  ipad: 'iPad',
  android: 'Android',
  server: 'Server',
  extension: 'Extension'
}

type DeviceType = 'phone' | 'tablet' | 'desktop' | 'server' | 'browser'

const mpcDeviceType: Record<MpcDevice, DeviceType> = {
  windows: 'desktop',
  mac: 'desktop',
  linux: 'desktop',
  iphone: 'phone',
  ipad: 'tablet',
  android: 'phone',
  server: 'server',
  extension: 'browser'
}

export const formatMpcDeviceName = (deviceName: string) => {
  const mpcDevice = mpcDeviceFromDeviceName(deviceName)
  if (mpcDevice) {
    return mpcDeviceName[mpcDevice]
  }

  return deviceName
}

export const mpcDeviceFromDeviceName = (deviceName: string): MpcDevice | null => {
  const lowerCaseDeviceName = deviceName.toLowerCase()
  if (lowerCaseDeviceName in mpcDeviceType) {
    return lowerCaseDeviceName as MpcDevice
  }

  return null
}
