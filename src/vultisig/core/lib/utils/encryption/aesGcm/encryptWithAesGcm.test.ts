import { describe, it } from 'vitest'

import { decryptWithAesGcm } from './decryptWithAesGcm'
import { encryptWithAesGcm } from './encryptWithAesGcm'

describe('encryptWithAesGcm-roundtrip', () => {
  it('should encrypt the data with the provided key', async () => {
    const key = 'd6022efdbf1cd27b2feb179341b40a800f4fdda7cdfd91ca630f1f17ee0516f3'
    const beforeEncryption = 'Hello, World!'
    const encryptedData = await encryptWithAesGcm({
      key: Buffer.from(key, 'hex'),
      value: Buffer.from(beforeEncryption)
    })
    console.log(encryptedData)
    const decryptedData = await decryptWithAesGcm({
      key: Buffer.from(key, 'hex'),
      value: encryptedData
    })
    console.log(decryptedData.toString('utf-8'))
  })
})
