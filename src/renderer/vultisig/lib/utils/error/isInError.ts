import { extractErrorMsg } from './extractErrorMsg'

export const isInError = (error: unknown, ...msgs: string[]): boolean => {
  const errorMessage = extractErrorMsg(error).toLowerCase()

  return msgs.some(msg => errorMessage.includes(msg.toLowerCase()))
}
