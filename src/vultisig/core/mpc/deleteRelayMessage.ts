type DeleteRelayMessageInput = {
  serverURL: string
  localPartyId: string
  sessionId: string
  messageHash: string
  messageId?: string
}
export const deleteRelayMessage = async ({
  serverURL,
  localPartyId,
  sessionId,
  messageHash,
  messageId
}: DeleteRelayMessageInput): Promise<void> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  }
  if (messageId) {
    headers['message_id'] = messageId
  }

  await fetch(`${serverURL}/message/${sessionId}/${localPartyId}/${messageHash}`, {
    method: 'DELETE',
    headers
  })
}
