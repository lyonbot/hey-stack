import { expect, test } from 'vitest'

import { $scopeCtxVariableManager, createScopeContext, defineScopeVariable, disposeScopeContext } from '../src/scope.js'
import { testEffect } from './test-utils.js'

test('basic scopeCtx create / define / dispose', () => {
  const ctx0 = createScopeContext()
  defineScopeVariable(ctx0, {
    foo: { value: 1 },
    bar: { value: 2 },
    baz: { value: 3, exposeAs: 'baz2' },
    privateVar: { value: 4, private: true },
  })

  const ctx1 = createScopeContext(ctx0)
  defineScopeVariable(ctx1, {
    bar: { value: 8 },
    baz: { value: 9 },
  })

  // **V8 optimization check**
  // run with node --allow-natives-syntax
  // pass if print something like `location: in-object`
  // ![%DebugPrint(ctx1)]

  // **usedBy check**

  expect(ctx0[$scopeCtxVariableManager].descriptors.foo.$debug!.usedBy.size).eq(4)
  expect(ctx0[$scopeCtxVariableManager].descriptors.bar.$debug!.usedBy.size).eq(2) // shadowed
  expect(ctx0[$scopeCtxVariableManager].descriptors.baz.$debug!.usedBy.size).eq(4) // not shadowed because of exposeAs
  expect(ctx0[$scopeCtxVariableManager].descriptors.privateVar.$debug!.usedBy.size).eq(1) // not public

  expect(ctx1[$scopeCtxVariableManager].descriptors.bar.$debug).not.eq(ctx0[$scopeCtxVariableManager].descriptors.bar.$debug)
  expect(ctx1[$scopeCtxVariableManager].descriptors.baz2.$debug).eq(ctx0[$scopeCtxVariableManager].descriptors.baz.$debug) // ctx1.baz2 is alias of ctx0.baz

  // **value access check**

  expect([ctx0.foo, ctx0.bar, ctx0.baz, ctx0.baz2, ctx0.privateVar]).deep.eq([1, 2, 3, undefined, 4])
  expect([ctx1.foo, ctx1.bar, ctx1.baz, ctx1.baz2, ctx1.privateVar]).deep.eq([1, 8, 9, 3, undefined])

  // **value write check**

  ctx1.baz2 = 'modified'
  expect(ctx1.baz2).eq('modified')
  expect(ctx0.baz).eq('modified')

  ctx1.privateVar = 'xxxx' // [!] undefined behavior: write to undeclared variable
  expect(ctx1.privateVar).eq('xxxx')
  expect(ctx0.privateVar).eq(4) // not affected

  // **dispose check**

  disposeScopeContext(ctx1)

  expect(ctx0[$scopeCtxVariableManager].descriptors.foo.$debug!.usedBy.size).eq(2)
  expect(ctx0[$scopeCtxVariableManager].descriptors.bar.$debug!.usedBy.size).eq(2)
  expect(ctx0[$scopeCtxVariableManager].descriptors.baz.$debug!.usedBy.size).eq(2)
  expect(ctx0[$scopeCtxVariableManager].descriptors.privateVar.$debug!.usedBy.size).eq(1) // not inherited

  expect(ctx1[$scopeCtxVariableManager].descriptors.bar.$debug!.usedBy.size).eq(0) // ctx1
  expect(ctx1[$scopeCtxVariableManager].descriptors.baz.$debug!.usedBy.size).eq(0)
})

test('computed variable', () => {
  const ctx = createScopeContext()
  defineScopeVariable(ctx, {
    foo: { value: 1 },
    bar: {
      get: () => ctx.foo * 2,
      set: (value) => {
        ctx.foo = value / 2
      },
    },
    onlySetter: {
      set: (value) => {
        ctx.foo = value / 3
      },
    },
    onlyGetter: {
      get: () => ctx.foo + 1,
    },
  })

  expect(ctx.bar).eq(2)

  ctx.bar = 4
  expect(ctx.foo).eq(2)

  const effect1 = testEffect(() => ctx.bar)
  ctx.foo = 9
  expect(effect1.triggeredValue).eq(18)

  // **onlySetter**

  ctx.onlySetter = 6
  expect(ctx.onlySetter).eq(undefined)
  expect(ctx.foo).eq(2)

  // **onlyGetter**
  expect(ctx.onlyGetter).eq(3)
})
