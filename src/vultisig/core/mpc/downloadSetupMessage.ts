import { assertFetchResponse } from '../lib/utils/fetch/assertFetchResponse'
import { retry } from '../lib/utils/query/retry'

type DownloadSetupMessageInput = {
  serverURL: string
  sessionId: string
  messageId?: string
  additionalHeaders?: string
}

/**
 *
 * @param {DownloadSetupMessageInput} input - the input parameters
 * @throws {Error} - if the response status is not between 200 and 300
 */
const downloadSetupMessage = async ({
  serverURL,
  sessionId,
  messageId,
  additionalHeaders
}: DownloadSetupMessageInput): Promise<string> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  }
  if (messageId) {
    headers['message_id'] = messageId
  }
  // this one is only temporary right now
  // when we do dkls/schnorr reshare will need it
  if (additionalHeaders) {
    headers['message-id'] = additionalHeaders
  }
  const response = await fetch(`${serverURL}/setup-message/${sessionId}`, {
    headers
  })

  await assertFetchResponse(response)
  if (response.status < 200 || response.status > 299) {
    throw new Error(`failed to download setup message from relay server, status: ${response.status}`)
  }
  return response.text()
}

export const waitForSetupMessage = async ({
  serverURL,
  sessionId,
  messageId,
  additionalHeaders
}: DownloadSetupMessageInput): Promise<string> => {
  const setupMessage = await retry({
    func: () =>
      downloadSetupMessage({
        serverURL,
        sessionId,
        messageId,
        additionalHeaders
      }),
    attempts: 10,
    delay: 1000
  })
  return setupMessage
}
