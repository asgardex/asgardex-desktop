import { assertFetchResponse } from '../../../../lib/utils/fetch/assertFetchResponse'

import { fastVaultServerUrl } from '../config'

type Input = {
  name: string
  session_id: string
  hex_encryption_key: string
  hex_chain_code: string
  local_party_id: string
  encryption_password: string
  email: string
  lib_type: number
}

export const setupVaultWithServer = async (input: Input) => {
  const url = `${fastVaultServerUrl}/create`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(input)
  })

  await assertFetchResponse(response)

  return response
}
