import { effect, shallowRef } from '@vue/reactivity'
import { getScopeForRelates, ScopeForPropsBase } from 'hey-stack-core/for.js'
import { ScopeCtx, ScopeSetupOptionsBase } from 'hey-stack-core/scope.js'
import { makeReactiveComputed, MaybePromise } from 'hey-stack-core/utils.js'
import { ComponentType, createContext, createElement, memo } from 'react'

import { $effectScope, useEffectScope, useForceUpdate, useNewScopeContext, useSetup } from './hooks.js'

export * from 'hey-stack-core'
export type ScopeForProps = ScopeForPropsBase<FrameworkComponent>
export type ScopeSetupOptions = ScopeSetupOptionsBase<FrameworkComponent>

export const ScopeCtxContext = createContext<ScopeCtx | null>(null)
export type FrameworkComponent = ComponentType
export type ScopeComponentSetupFn = (scopeCtx: any) => MaybePromise<() => JSX.Element>

/**
 * Define a component, returns a framework-related component.
 *
 * @param setupFn - A function to set up the component, which receives a scope context.
 * @returns A framework-related component.
 *
 * @example
 * const Page = defineScopeComponent((__scopeCtx) => {
 *   defineScopeVariable(__scopeCtx, "hash", {
 *     private: true,
 *     get: () => objectHash(__scopeCtx.item),
 *   });
 *
 *   return () => (
 *     <div>
 *       <div>item hash is {__scopeCtx.hash}</div>
 *       <ChildComponent1 />
 *     </div>
 *   );
 * });
 */
export function defineScopeComponent(setupFn: ScopeComponentSetupFn): FrameworkComponent {
  const component = memo((props) => {
    const scopeCtx = useNewScopeContext()
    const forceUpdate = useForceUpdate()
    const renderResult = useSetup(scopeCtx[$effectScope], props, (/* props */) => {
      const renderFn = shallowRef<() => any>(() => null as any)

      const setupReturn = setupFn(scopeCtx) // this can be a promise!
      if (setupReturn instanceof Promise) {
        setupReturn.then((render) => {
          renderFn.value = render
        })
      }
      else {
        renderFn.value = setupReturn
      }

      const vnode = makeReactiveComputed(() => renderFn.value!(), forceUpdate)
      return vnode.get
    })

    return (
      <ScopeCtxContext.Provider value={scopeCtx}>
        {renderResult()}
      </ScopeCtxContext.Provider>
    )
  })

  return component
}

/**
 * A framework-related component to render a list of items.
 */
export const ScopeFor = memo(function ScopeFor(props: ScopeForProps) {
  const forceUpdate = useForceUpdate()
  const effectScope = useEffectScope(props, (props) => {
    const relates = getScopeForRelates(props, (p) => {
      return createElement(ScopeForItem, {
        key: p.renderKey,
        index: p.index,
        items: p.items,
        setupScope: p.setupScope,
        get childComponent() { return props.childComponent },
      })
    })

    const renderedItems = makeReactiveComputed(
      () => relates.renderedItems.value,
      forceUpdate,
    )

    return { renderedItems }
  })

  const node = effectScope.renderedItems.get()
  return node
})
ScopeFor.displayName = 'ScopeFor'

const ScopeForItem = memo(function ScopeForItem(props: {
  index: any
  items: any
  setupScope: (scopeCtx: ScopeCtx, data: { items: any, index: any }) => void
  childComponent: FrameworkComponent
}) {
  const scopeCtx = useNewScopeContext()
  useSetup(scopeCtx[$effectScope], props, (props) => {
    effect(() => props.setupScope(scopeCtx, props))
  })

  const ChildComponent = props.childComponent

  return (
    <ScopeCtxContext.Provider value={scopeCtx}>
      <ChildComponent />
    </ScopeCtxContext.Provider>
  )
})
ScopeForItem.displayName = 'ScopeForItem'
