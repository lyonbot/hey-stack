import { ReactiveEffect } from '@vue/reactivity'

import { NOOP } from '../src/utils.js'

export function testEffect<T>(getter: () => T) {
  let called = false
  const effect = new ReactiveEffect(getter, NOOP, () => {
    called = true
  })
  effect.run()

  return {
    get triggeredValue() {
      effect.stop()

      if (!called) throw new Error('effect not called')
      return effect.run()
    },
  }
}
