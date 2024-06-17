import { computed } from '@vue/reactivity'

import { makeCounter } from '../../utils'

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

export function getScopeForRelates(props: ScopeForPropsBase<any>) {
  const getRenderKey = computed((): ((item: any, key: number | string, collection: any) => any) => {
    const method = props.renderKey ?? RenderKeyStrategy.default

    if (method === RenderKeyStrategy.index) {
      return (_, key) => key
    }

    if (method === RenderKeyStrategy.reference) {
      const nextRenderKey = makeCounter()
      const renderKeyWeakmap = new WeakMap<any, number>()
      return (item: any, key: number | string) => {
        if (typeof key !== 'object' || !key) return key

        let renderKey = renderKeyWeakmap.get(item)
        if (renderKey === undefined) {
          renderKey = nextRenderKey()
          renderKeyWeakmap.set(item, renderKey)
        }
        return renderKey
      }
    }

    if (typeof method === 'function') return method
    return (item, index) => item && typeof item === 'object' ? item[method] : index
  })
  const renderList = computed(() => {
    const items = props.items()
    if (!items || typeof items !== 'object') return []

    return Object.entries(items).map(([key, item]) => {
      const renderKey = getRenderKey.value(item, key, items)
      return { key, item, items, renderKey }
    })
  })

  return [renderList] as const
}
