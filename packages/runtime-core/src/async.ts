export function isPromise<T>(value: any): value is Promise<T> {
  return value && typeof value.then === 'function'
}

/**
 * a utility to make a function that MAY async/sync
 *
 * @example
 * ```ts
 * // given such a function
 * const processFile = co(function* (pathOrData) {
 *   if (typeof pathOrData === 'string') {
 *     pathOrData = yield fs.readJson(pathOrData) // use `yield`, not `await` to wait for the promise
 *   }
 *
 *   // do something with the data
 *   const newData = { ...pathOrData, foo: 'bar' }
 *   return newData
 * })
 *
 * // use it
 * const data1 = await processFile('foo.json') // <- is async function!
 * const data2 = processFile({ foo: 'baz' })   // <- is sync function!
 * ```
 */
export function maybeAsync<ARG extends any[], T>(
  fn: (...args: ARG) => Generator<any, T>,
): (...args: ARG) => (T | Promise<T>) {
  return function (this: any, ...args: ARG) {
    const generator = fn.apply(this, args)
    let step: IteratorResult<any>
    let feed: any
    while (step = generator.next(feed)) { // eslint-disable-line no-cond-assign
      const value = step.value
      if (step.done) return value // sync finished
      feed = value

      if (isPromise(feed)) {
        // go async route!
        // stop the sync execution
        return (async () => {
          feed = await feed
          while (step = generator.next(feed)) { // eslint-disable-line no-cond-assign
            const value = await step.value
            if (step.done) return value
            feed = value
          }
        })()
      }
    }
  }
}
