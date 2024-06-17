import { defineComponent, h, inject, onUnmounted, provide, SetupContext } from 'vue'

import { MaybePromise } from '../../types/utilities'
import { getScopeForRelates, ScopeForPropsBase } from '../common/for'
import { createScopeContext, defineScopeVariable, disposeScopeContext, ScopeCtx, ScopeSetupOptionsBase } from '../common/scope'

export * from '../common/exports'
export type ScopeForProps = ScopeForPropsBase<FrameworkComponent>
export type ScopeSetupOptions = ScopeSetupOptionsBase<FrameworkComponent>

export const SCOPE_CONTEXT_KEY = Symbol('scopeCtx')
export type FrameworkComponent = import('vue').Component
export type ScopeComponentSetupFn = (scopeCtx: any) => MaybePromise<() => JSX.Element>

function useNewScopeContext(ctx: SetupContext): ScopeCtx {
  const parentScopeCtx = inject<ScopeCtx | null>(SCOPE_CONTEXT_KEY, null)
  const scopeCtx = createScopeContext(parentScopeCtx)

  ctx.expose({ [SCOPE_CONTEXT_KEY]: scopeCtx })
  provide(SCOPE_CONTEXT_KEY, scopeCtx)
  onUnmounted(() => disposeScopeContext(scopeCtx))

  return scopeCtx
}

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
  return defineComponent({
    setup(props, ctx) {
      const scopeCtx = useNewScopeContext(ctx)
      const setupReturn = setupFn(scopeCtx) // this can be a promise!
      if (setupReturn instanceof Promise) {
        return setupReturn.then(render => ({ _sRender: render }))
      }
      return { _sRender: setupReturn }
    },
    render() {
      return this._sRender()
    },
  })
}

/**
 * A framework-related component to render a list of items.
 */
export const ScopeFor = defineComponent({
  name: 'ScopeFor',
  setup(props: ScopeForProps) {
    const relates = getScopeForRelates(props)
    return () => relates[0].value.map(renderItem => h(ScopeForItem, {
      renderItem,
      as: props.as,
      keyAs: props.keyAs,
      itemsAs: props.itemsAs,
      childComponent: props.childComponent,

      key: renderItem.renderKey,
    }))
  },
})

// internal implementation, not exported
const ScopeForItem = defineComponent({
  name: 'ScopeForItem',
  setup(props: {
    renderItem: any
    as?: string | symbol
    keyAs?: string | symbol
    itemsAs?: string | symbol
    childComponent: FrameworkComponent
  }, ctx) {
    const scopeCtx = useNewScopeContext(ctx)

    if (props.as) defineScopeVariable(scopeCtx, props.as, {
      get: () => props.renderItem.item,
      set(value) {
        props.renderItem.items[props.renderItem.key] = value
      },
    })

    if (props.keyAs) defineScopeVariable(scopeCtx, props.keyAs, {
      get: () => props.renderItem.key,
    })

    if (props.itemsAs) defineScopeVariable(scopeCtx, props.itemsAs, {
      get: () => props.renderItem.items,
    })

    return () => h(props.childComponent)
  },
})
