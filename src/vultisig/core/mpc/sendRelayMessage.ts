import { assertFetchResponse } from '../lib/utils/fetch/assertFetchResponse'

type SendMessageInput = {
  serverURL: string
  localPartyId: string
  sessionId: string
  message: string
  to: string
  sequenceNo: number
  messageHash: string
  messageId?: string
}
export const sendRelayMessage = async ({
  serverURL,
  localPartyId,
  sessionId,
  message,
  to,
  sequenceNo,
  messageHash,
  messageId
}: SendMessageInput): Promise<void> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  }
  if (messageId) {
    headers['message_id'] = messageId
  }

  const response = await fetch(`${serverURL}/message/${sessionId}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      session_id: sessionId,
      from: localPartyId,
      to: [to],
      body: message,
      hash: messageHash,
      sequence_no: sequenceNo
    })
  })
  await assertFetchResponse(response)
  if (response.status < 200 || response.status > 299) {
    throw new Error(`failed to upload message to relay server, status: ${response.status}`)
  }
}
