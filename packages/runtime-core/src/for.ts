import { computed, toRaw } from '@vue/reactivity'

import { defineScopeVariable, ScopeCtx } from './scope.js'
import { makeCounter } from './utils.js'

/**
 * The properties for the ScopeFor component.
 *
 * @internal
 */
export interface ScopeForPropsBase<ComponentType> {
  /** A getter function (can be async) that returns an array, or object */
  items: () => any

  /** Optional string, exposed variable name. */
  as?: string

  /** Optional string, exposed variable name. */
  keyAs?: string

  /** Optional string, exposed variable name. */
  itemsAs?: string

  /** A component made by `defineScopeComponent()`. */
  childComponent: ComponentType

  /**
   * How to generate the key to render each item.
   *
   * @default `ScopeForKeying.reference` - which is good for mutable objects, but NOT recommended for immutable situations.
   */
  renderKey?: string | symbol | ((item: any) => any)
}

export const RenderKeyStrategy = {
  index: Symbol('scopeForKeying.index'),
  reference: Symbol('scopeForKeying.reference'),
  default: null as any,
}

RenderKeyStrategy.default = RenderKeyStrategy.reference // TODO: for React, change to something else.

const emptyObject = Object.create(null)

export function getScopeForRelates<RFI extends (props: {
  renderKey: any
  items: any
  index: any
  setupScope: (scopeCtx: ScopeCtx, data: { items: any, index: any }) => void
}) => any>(props: ScopeForPropsBase<any>, renderFrameworkItem: RFI) {
  const $items = computed(() => {
    const items = props.items()
    if (!items || typeof items !== 'object') return emptyObject
    return items
  })
  const $getRenderKey = computed((): ((index: number | string) => any) => {
    const method = props.renderKey ?? RenderKeyStrategy.default

    if (method === RenderKeyStrategy.index) {
      return index => index
    }

    if (method === RenderKeyStrategy.reference) {
      const nextRenderKey = makeCounter()
      const renderKeyWeakmap = new WeakMap<any, number>()
      return (index) => {
        const item = toRaw($items.value[index])
        if (typeof item !== 'object' || !item) return index

        let renderKey = renderKeyWeakmap.get(item)
        if (renderKey === undefined) {
          renderKey = nextRenderKey()
          renderKeyWeakmap.set(item, renderKey)
        }
        return renderKey
      }
    }

    if (typeof method === 'function') return method
    return (index) => {
      const item = $items.value[index]
      if (typeof item === 'object') return item[method]
      return index
    }
  })
  const $setupScope = computed(() => {
    const { as: itemAs, itemsAs, keyAs } = props

    return (scopeCtx: ScopeCtx, data: { items: any, index: any }) => {
      if (itemAs) defineScopeVariable(scopeCtx, itemAs, {
        get: () => data.items[data.index],
        set(value) {
          if (data.items === emptyObject) return
          data.items[data.index] = value
        },
      })

      if (keyAs) defineScopeVariable(scopeCtx, keyAs, {
        get: () => data.index,
      })

      if (itemsAs) defineScopeVariable(scopeCtx, itemsAs, {
        get: () => data.items,
      })
    }
  })

  const $renderedItems = computed<(ReturnType<RFI> | null)[]>(() => {
    const items = $items.value
    const keys = Object.keys(items)

    return keys.map((index) => {
      if (!Reflect.has(items, index)) return null

      return renderFrameworkItem({
        renderKey: $getRenderKey.value(index),
        items,
        index,
        setupScope: $setupScope.value,
      })
    })
  })

  return {
    items: $items,
    getRenderKey: $getRenderKey,
    renderedItems: $renderedItems,
  }
}
