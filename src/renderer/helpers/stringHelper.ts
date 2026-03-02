export const emptyString = ''
export const loadingString = '...'
export const noDataString = '--'
export const hiddenString = '******'

export const truncateMiddle = (
  text: string,
  /* options (optional) */
  {
    start = 3 /* chars at the beginning */,
    end = 3 /* chars at the end */,
    max = 10 /* max chars */,
    delimiter = '...'
  } = {}
): string => {
  // length
  const length = text.length
  // max - compare max vs. start+end+delimiter
  const maxChars = Math.max(max, start + end + delimiter.length)
  if (length <= maxChars) return text

  // first chars to show
  const first = text.substring(0, start)
  // last chars to show
  const last = text.substring(length - end, length)

  return `${first}${delimiter}${last}`
}
