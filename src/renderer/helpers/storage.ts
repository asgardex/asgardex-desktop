export enum StorageKey {
  Protocol = 'protocol'
}

export const getProtocolFromStorage = (defaultValue: string) => {
  return localStorage.getItem(StorageKey.Protocol) || defaultValue
}

export const setValueToStorage = (key: string, value: string) => {
  return localStorage.setItem(key, value)
}
