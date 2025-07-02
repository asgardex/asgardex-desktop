const sInMin = 60
const hInDay = 24

export const msInSec = 1000
export const msInMin = sInMin * msInSec
export const msInHour = sInMin * msInMin
export const msInDay = hInDay * msInHour
export const msInWeek = 7 * msInDay
export const nsInMs = 1000000

export type Milliseconds = number
export type Seconds = number
