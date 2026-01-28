import { function as FP } from 'fp-ts'
import { Observable, BehaviorSubject } from 'rxjs'

type ObservableState<T> = {
  /** Observable stream of state changes - subscribe to react to updates */
  get$: Observable<T>
  /** Synchronous getter for current value */
  get: () => T
  /**
   * Setter that accepts either:
   * - Direct value: `set(newValue)`
   * - Functional updater: `set(prev => ({ ...prev, field: 'updated' }))`
   *
   * Use functional form to avoid stale closures in callbacks/async code
   */
  set: (value: T | ((prev: T) => T)) => void
}

/**
 * Factory to create an Observable State
 *
 * It returns an object with following properties:
 *
 * `get$` - A getter as an Observable - to subscribe to any changes if needed
 * `get` - A getter of current value
 * `set` - A setter to update values
 *
 * Example:
 *
 * const { get$, get, set} = observableState(0)
 * // subscribe to any updates
 * get$.subscribe({next: (value) => console.log('next value' , value)})
 * // get current value
 * const current = get()
 * console.log(current) // 0
 * set(1)
 * console.log(current) // 1
 * // Now "next value 1" will be printed by previous subscription, too
 *
 */
export const observableState = <T>(initial: T): ObservableState<T> => {
  // BehaviorSubject holds current value and emits to new subscribers immediately
  const subject$$ = new BehaviorSubject(initial)
  return {
    get$: subject$$.asObservable(),
    get: () => subject$$.getValue(),
    set: (valueOrUpdater: T | ((prev: T) => T)) => {
      // Support both direct values and functional updaters (React setState pattern)
      // Functional form: set(prev => prev + 1) - always gets fresh value, avoids stale closures
      // Direct form: set(5) - simple replacement
      const newValue =
        typeof valueOrUpdater === 'function' ? (valueOrUpdater as (prev: T) => T)(subject$$.getValue()) : valueOrUpdater
      subject$$.next(newValue)
    }
  }
}

export type TriggerStream$ = Observable<string>

type TriggerStream = {
  /** Observable that emits when trigger() is called */
  stream$: TriggerStream$
  /** Call to emit on stream$ - used to kick off dependent operations */
  trigger: FP.Lazy<void>
}

/**
 * Helper to create a stream, which can trigger changes of it
 *
 * It might be handy to trigger other, depending streams in a queue to do something
 */
export const triggerStream = (): TriggerStream => {
  const subject$$ = new BehaviorSubject('')
  return {
    stream$: subject$$.asObservable(),
    trigger: () => subject$$.next('trigger')
  }
}
