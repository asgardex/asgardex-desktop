import { assertFetchResponse } from '../../../../lib/utils/fetch/assertFetchResponse'

import { fastVaultServerUrl } from '../config'

type VerifyVaultEmailCodeInput = {
  vaultId: string
  code: string
}

export const verifyVaultEmailCode = async ({ vaultId, code }: VerifyVaultEmailCodeInput) => {
  const url = `${fastVaultServerUrl}/verify/${vaultId}/${code}`

  const response = await fetch(url)

  await assertFetchResponse(response)

  return response
}
