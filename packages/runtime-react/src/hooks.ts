import { EffectScope, effectScope as createEffectScope, effectScope, shallowReactive } from '@vue/reactivity'
import { createScopeContext, disposeScopeContext, ScopeCtx } from 'hey-stack-core'
import { useContext, useEffect, useReducer, useRef } from 'react'

import { ScopeCtxContext } from './index.js'

export const $effectScope = Symbol('effectScope')
declare module 'hey-stack-core/common/scope.js' {
  export interface ScopeCtx {
    [$effectScope]: EffectScope
  }
}

function disposeScopeCtxReact(scope: ScopeCtx) {
  // console.log('disposeScopeContext', scope, scope.__uid)
  disposeScopeContext(scope)
  scope[$effectScope].stop()
}

export function useNewScopeContext(): ScopeCtx {
  const parentScopeCtx = useContext(ScopeCtxContext)
  const lastScopeCtx = useRef<ScopeCtx>()

  let scope = lastScopeCtx.current
  if (!scope || scope.$parentScope !== parentScopeCtx) {
    scope && disposeScopeCtxReact(scope)
    scope = createScopeContext(parentScopeCtx)
    lastScopeCtx.current = scope

    const parentEffectScope = parentScopeCtx?.[$effectScope]
    scope[$effectScope] = (parentEffectScope && parentEffectScope.active) ? parentEffectScope.run(() => effectScope())! : effectScope()

    // (scope as any).__uid = Math.random().toString(36).substring(2)
    // console.log('created scopeCtx', scope, scope.__uid)
  }

  const reactAssholeTimer = useRef<any>()
  useEffect(() => {
    // console.log('mounted for scope', scope, scope.__uid)
    clearTimeout(reactAssholeTimer.current)
    return () => {
      if (!scope) return

      reactAssholeTimer.current = setTimeout(() => {
        disposeScopeCtxReact(scope)
        if (lastScopeCtx.current === scope) lastScopeCtx.current = undefined // this is how React Strict Mode sucks!
      })
    }
  }, [scope])

  return scope
}

export function useSetup<T extends object, U>(effectScope: EffectScope, props: T, setup: (reactiveProps: T) => U): U {
  const lastEffectScope = useRef<EffectScope>()
  const reactiveProps = useRef<T>()
  const setupReturns = useRef<U>()

  if (lastEffectScope.current !== effectScope) {
    // first render
    lastEffectScope.current = effectScope
    reactiveProps.current = shallowReactive({ ...props })
    setupReturns.current = effectScope.run(() => setup(reactiveProps.current!))
  }
  else {
    // subsequent render
    Object.assign(reactiveProps.current!, props)
  }

  return setupReturns.current!
}

export function useEffectScope<T extends object, U>(props: T, onCreated: (reactiveProps: T) => U) {
  const effectScope = useRef<EffectScope | undefined>()
  const reactiveProps = useRef<T>()
  const setupReturns = useRef<U>()

  useEffect(() => () => {
    effectScope.current?.stop()
    effectScope.current = undefined
  }, [])

  if (!effectScope.current) {
    const $scope = createEffectScope()
    const $reactiveProps = shallowReactive({ ...props })
    effectScope.current = $scope
    reactiveProps.current = $reactiveProps
    setupReturns.current = $scope.run(() => onCreated($reactiveProps))
  }
  else {
    // in each rendering, update reactiveProps.
    Object.assign(reactiveProps.current!, props)

    // TODO: delete removed props?
  }

  return setupReturns.current!
}

export function useForceUpdate() {
  const [, forceUpdate] = useReducer(() => ({}), {} as any)
  return forceUpdate as unknown as () => void
}
