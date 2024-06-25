import { ReactiveEffect } from '@vue/reactivity'

export const NOOP = (): void => void 0
export type MaybePromise<T> = T | Promise<T>

export function makeCounter(i = 1) {
  return () => i++
}

export function makeReactiveComputed<T>(getter: () => T, onNeedRecompute = NOOP) {
  const effect = new ReactiveEffect(getter, NOOP, () => {
    clear()
    onNeedRecompute()
  })

  let prev: any = effect.run()
  let invalidated = false

  const clear = () => {
    prev = undefined
    invalidated = true
  }

  return {
    get: () => {
      if (invalidated) {
        prev = effect.run()
        invalidated = false
      }
      return prev as T
    },
    clear,
  }
}
