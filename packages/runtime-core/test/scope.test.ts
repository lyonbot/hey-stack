import { expect, test } from 'vitest'

import { isDevelopmentMode } from '../src/constants.js'
import { createScopeContext, disposeScopeContext } from '../src/scope.js'
import { defineScopeVar } from '../src/scopeVar.js'

test('basic scopeCtx create / define / dispose', () => {
  expect(isDevelopmentMode).toBeTruthy()

  const ctx0 = createScopeContext()
  const foo = defineScopeVar(ctx0, 'foo', { value: 1 })
  const bar = defineScopeVar(ctx0, 'bar', { value: 2, private: true })
  const baz = defineScopeVar(ctx0, 'baz', { value: 3, exposeAs: 'baz2' })

  const ctx1 = createScopeContext(ctx0)
  const subFoo = defineScopeVar(ctx1, 'foo', { inherited: 'foo', exposeAs: 'wheeFoo' })
  const subBar = defineScopeVar(ctx1, 'bar', { inherited: 'bar', default: 999 })
  const subBaz = defineScopeVar(ctx1, 'baz', { inherited: 'baz', default: 999 })
  const subBaz2 = defineScopeVar(ctx1, 'baz2', { inherited: 'baz2', default: 999 })

  expect(foo.debug!.inheritedBy.size).eq(1)
  expect(bar.debug!.inheritedBy.size).eq(0)
  expect(baz.debug!.inheritedBy.size).eq(1)

  // **value access check**

  expect(foo.value).eq(1)
  expect(bar.value).eq(2)
  expect(baz.value).eq(3)

  expect(subFoo.value).eq(1)
  expect(subBar.value).eq(999)
  expect(subBaz.value).eq(999)
  expect(subBaz2.value).eq(3)

  // **redeclare a variable**

  expect(ctx1.exposed.wheeFoo).toBe(subFoo)
  expect(ctx1.vars.foo.value).eq(1)

  defineScopeVar(ctx1, 'foo', { value: 4, private: true })

  expect(ctx1.exposed.wheeFoo).toBeUndefined()
  expect(ctx1.vars.foo.value).eq(4)
  expect(foo.debug!.inheritedBy.size).eq(0) // <--

  // **dispose check**

  disposeScopeContext(ctx1)

  expect(ctx0.vars.foo.debug!.inheritedBy.size).eq(0)
  expect(ctx0.vars.bar.debug!.inheritedBy.size).eq(0)
  expect(ctx0.vars.baz.debug!.inheritedBy.size).eq(0)
})
