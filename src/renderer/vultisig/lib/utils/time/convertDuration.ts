import { msInDay, msInHour, msInMin, msInSec, msInWeek, nsInMs } from '.'
import { DurationUnit } from './DurationUnit'

const msInUnit: Record<DurationUnit, number> = {
  ns: 1 / nsInMs,
  ms: 1,
  s: msInSec,
  min: msInMin,
  h: msInHour,
  d: msInDay,
  w: msInWeek
}

export const convertDuration = (value: number, from: DurationUnit, to: DurationUnit) => {
  const result = value * (msInUnit[from] / msInUnit[to])

  return result
}
