import { describe, expect, it } from 'vitest'

import { maybeAsync } from '../src/async.js'

describe('async', () => {
  it('maybeAsync', async () => {
    const readJson = (path: string) => Promise.resolve({ path })

    const processFile = maybeAsync(function* (pathOrData: string | object) {
      if (typeof pathOrData === 'string') {
        // use `yield`, not `await` to wait for the promise
        pathOrData = (yield readJson(pathOrData)) as object
      }

      // do something with the data
      const newData = { ...pathOrData, foo: 'bar' }
      return newData
    })

    await expect(processFile('foo.json')).resolves.toEqual({ path: 'foo.json', foo: 'bar' })
    expect(processFile({ foo: 'baz' })).toEqual({ foo: 'bar' })
  })
})
