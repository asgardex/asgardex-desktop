import { assertFetchResponse } from '../../../lib/utils/fetch/assertFetchResponse'

type StartMpcSessionInput = {
  serverUrl: string
  sessionId: string
  devices: string[]
}

export const startMpcSession = async ({ serverUrl, sessionId, devices }: StartMpcSessionInput) => {
  const response = await fetch(`${serverUrl}/start/${sessionId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(devices)
  })

  await assertFetchResponse(response)

  return response
}
