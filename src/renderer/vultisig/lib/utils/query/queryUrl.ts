import { assertFetchResponse } from '../fetch/assertFetchResponse'

export const queryUrl = async <T>(
  url: string | URL,
  options?: RequestInit
): Promise<T> => {
  const response = await fetch(url, {
    method: 'GET',
    ...options,
  })

  await assertFetchResponse(response)

  return response.json()
}
