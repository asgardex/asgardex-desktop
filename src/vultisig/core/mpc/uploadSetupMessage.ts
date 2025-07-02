import { assertFetchResponse } from '../lib/utils/fetch/assertFetchResponse'

type UploadSetupMessageInput = {
  serverUrl: string
  message: string
  sessionId: string
  messageId?: string
  additionalHeaders?: string
}
/**
 *
 * @param {UploadSetupMessageInput} input - the input parameters
 * @throws {Error} - if the response status is not between 200 and 300
 */
export const uploadSetupMessage = async ({
  serverUrl,
  message,
  sessionId,
  messageId,
  additionalHeaders
}: UploadSetupMessageInput): Promise<void> => {
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

  const response = await fetch(`${serverUrl}/setup-message/${sessionId}`, {
    method: 'POST',
    headers,
    body: message
  })

  await assertFetchResponse(response)

  if (response.status < 200 || response.status > 299) {
    throw new Error(`failed to upload setup message to relay server, status: ${response.status}`)
  }
}
