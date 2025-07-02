/* eslint-disable @typescript-eslint/no-explicit-any */
export const base64Encode = (msg: any): string => {
  return Buffer.from(msg).toString('base64')
}
