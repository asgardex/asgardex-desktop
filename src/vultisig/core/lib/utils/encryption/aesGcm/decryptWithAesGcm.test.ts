import { describe, expect, it } from 'vitest'

import { decryptWithAesGcm } from './decryptWithAesGcm'

describe('decryptWithAesGcm', () => {
  it('should decrypt the data with the provided key', async () => {
    const key = 'd6022efdbf1cd27b2feb179341b40a800f4fdda7cdfd91ca630f1f17ee0516f3'
    const data = 'lBVUUrBAYm2R6uiESzrgOaaW0GyiOuf2ki6O18YOEBFnQryTj4s='
    const decryptedData = await decryptWithAesGcm({
      key: Buffer.from(key, 'hex'),
      value: Buffer.from(data, 'base64')
    })
    expect(decryptedData.toString('utf-8')).toBe('helloworld')
  })
})
