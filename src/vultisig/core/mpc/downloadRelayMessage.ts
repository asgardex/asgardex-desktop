export type RelayMessage = {
  session_id: string
  from: string
  to: string[]
  body: string
  hash: string
  sequence_no: number
}

type DownloadRelayMessageInput = {
  serverURL: string
  localPartyId: string
  sessionId: string
  messageId?: string
}
export const downloadRelayMessage = async ({
  serverURL,
  localPartyId,
  sessionId,
  messageId
}: DownloadRelayMessageInput): Promise<string> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  }
  if (messageId) {
    headers['message_id'] = messageId
  }

  const response = await fetch(`${serverURL}/message/${sessionId}/${localPartyId}`, {
    method: 'GET',
    headers
  })
  if (response.status < 200 || response.status > 299) {
    throw new Error(`failed to download message from relay server, status: ${response.status}`)
  }
  const message = await response.text()
  return message
}
