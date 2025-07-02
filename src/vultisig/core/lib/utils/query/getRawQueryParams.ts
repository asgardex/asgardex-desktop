export function getRawQueryParams<T extends Record<string, string>>(url: string): T {
  const paramsObject = {} as T

  // Find the start of the query parameters
  const queryStringStart = url.indexOf('?')
  if (queryStringStart === -1) return paramsObject // No query parameters

  const queryString = url.substring(queryStringStart + 1)
  const queryPairs = queryString.split('&')

  queryPairs.forEach((pair) => {
    const [key, value] = pair.split('=')
    if (key) {
      // Directly assign the key-value pairs without decoding
      paramsObject[key as keyof T] = value as T[keyof T]
    }
  })

  return paramsObject
}
