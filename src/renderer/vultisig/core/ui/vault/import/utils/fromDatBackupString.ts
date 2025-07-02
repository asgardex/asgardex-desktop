import { DatBackup, fromDatBackup } from './fromDatBackup'

export const fromDatBackupString = (value: string) => {
  const decodedString = Buffer.from(value, 'hex').toString('utf8')

  const datBackup = JSON.parse(decodedString) as DatBackup
  return fromDatBackup(datBackup)
}
