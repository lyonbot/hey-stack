import { getScopeForRelates, ScopeForPropsBase } from 'hey-stack-core/for.js'
import { createScopeContext, disposeScopeContext, ScopeCtx, ScopeSetupOptionsBase } from 'hey-stack-core/scope.js'
import { MaybePromise } from 'hey-stack-core/utils.js'
import { defineComponent, effect, h, inject, onUnmounted, provide, SetupContext, VNode } from 'vue'

export * from 'hey-stack-core'
export type ScopeForProps = ScopeForPropsBase<FrameworkComponent>
export type ScopeSetupOptions = ScopeSetupOptionsBase<FrameworkComponent>

export const SCOPE_CONTEXT_KEY = Symbol('scopeCtx')
export type FrameworkComponent = any // import('vue').Component
export type ScopeComponentSetupFn = (scopeCtx: ScopeCtx) => MaybePromise<() => VNode>

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
        return setupReturn.then(render => ({ myRender: render }))
      }
      return { myRender: setupReturn }
    },
    render() {
      return this.myRender()
    },
  })
}

/**
 * A framework-related component to render a list of items.
 */
export const ScopeFor = defineComponent({
  name: 'ScopeFor',
  props: {
    items: { type: Function, required: true },
    as: { type: String, default: '' },
    keyAs: { type: String, default: '' },
    itemsAs: { type: String, default: '' },
    childComponent: { required: true },
  } as any,
  setup(props: ScopeForProps) {
    const relates = getScopeForRelates(props, (p): VNode => {
      return h(ScopeForItem, {
        key: p.renderKey,
        index: p.index,
        items: p.items,
        setupScope: p.setupScope,
        get childComponent() { return props.childComponent },
      })
    })

    return () => relates.renderedItems.value
  },
})

// internal implementation, not exported
const ScopeForItem = defineComponent({
  name: 'ScopeForItem',
  props: {
    index: { required: true },
    items: { required: true },
    setupScope: { type: Function, required: true },
    childComponent: { required: true },
  } as any,
  setup(props: {
    index: any
    items: any
    setupScope: (scopeCtx: ScopeCtx, data: { items: any, index: any }) => void
    childComponent: FrameworkComponent
  }, ctx) {
    const scopeCtx = useNewScopeContext(ctx)
    effect(() => props.setupScope(scopeCtx, props))

    return () => h(props.childComponent)
  },
})
