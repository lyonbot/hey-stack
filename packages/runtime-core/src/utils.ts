import { getCurrentScope, ReactiveEffect } from '@vue/reactivity'

export function makeCounter(i = 1) {
  return () => i++
}

/**
 * a simple wrapper for ReactiveEffect, which provide Vue's `watch`-like API.
 *
 * How to use:
 *
 * 1. Create a watcher, and provide `callback` to subscribe changes.
 * 2. In `callback`, use `consume()` to get the new value, and subscribe to next change.
 * 3. Use `onCleanup` to add a cleanup hook, which runs when next `consume()` is called.
 * 4. When you're done, call `stop()` to stop watching.
 *
 * Beware:
 *
 * 1. The `consume()` may return `null` if the value didn't change.
 * 2. `callback` only run once until `consume()` is called again, and subscribe to next change.
 */
export function compactWatcher<T>(
  getter: () => T,
  callback: () => void, // in callback, use "consume" to get the new value, and subscribe to next change.
) {
  const scope = getCurrentScope()
  const onCleanupHooks: (() => void)[] = []
  const invokeOnCleanup = () => onCleanupHooks.splice(0).forEach(hook => hook())

  const stop = () => {
    effect.stop()
    const scopeEffects = (scope as any)?.effects as any[]
    if (scopeEffects) {
      const index = scopeEffects.indexOf(effect)
      if (index >= 0) scopeEffects.splice(index, 1)
    }
    invokeOnCleanup()
  }

  const consume = (forceRerun?: boolean): { value: T, oldValue: T, unchanged?: boolean } => {
    let value = oldValue
    let unchanged = !triggered

    if (triggered || forceRerun) {
      triggered = false
      value = effect.run()
      if (forceRerun) {
        unchanged = false
      }
      else if (value === oldValue) {
        // triggered but value not changed.
        // will NOT call onCleanup.
        unchanged = true
      }
    }

    if (unchanged) {
      return {
        value,
        oldValue,
        unchanged: true,
      }
    }

    invokeOnCleanup()
    const result = { value, oldValue }
    oldValue = value
    return result
  }

  let triggered = false
  const effect = new ReactiveEffect(getter, NOOP, () => {
    triggered = true
    callback()
  }, scope)
  let oldValue = effect.run()

  return {
    stop,
    consume,
    onCleanup: (callback: () => void) => { onCleanupHooks.push(callback) },
  }
}

export const NOOP = () => void 0
