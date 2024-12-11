export enum StorageKey {
  BtcBaseUnit = 'btc-base-unit'
}

export const getFromStorage = (key: StorageKey) => localStorage.getItem(key)

export const saveInStorage = (key: StorageKey, value: string) => {
  localStorage.setItem(key, value)
}
