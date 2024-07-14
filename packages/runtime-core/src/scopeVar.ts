import { computed, Ref, ref as createRef, shallowRef } from '@vue/reactivity'

import { isDevelopmentMode } from './constants.js'
import type { ScopeCtx } from './scope.js'
import { NOOP } from './utils.js'

interface ScopeVarOptionsBase {
  /** If true, variable cannot be inherited. */
  private?: boolean

  /** String or symbol to change the name for sub-scopes. Can't be used together with `private`. */
  exposeAs?: string | symbol
}

interface ValueScopeVarOptions<T> extends ScopeVarOptionsBase {
  /** Initial value. */
  value?: T

  /** If true, use `shallowRef` to store value. */
  shallow?: boolean
}

interface ComputedScopeVarOptions<T> extends ScopeVarOptionsBase {
  /** Getter function. */
  get: () => T

  /** Setter function. */
  set?: (value: T) => void
}

interface InheritedScopeVarOptions<T> extends ScopeVarOptionsBase {
  /** Name of the variable to inherit from outer scope. */
  inherited: string | symbol

  /** if failed to inherit, use what value. */
  default?: T

  /** if failed to inherit, use what value. (only works when `default` not provided) */
  defaultInitializer?: (scope: ScopeCtx) => T
}

export type ScopeVarOptions<T> = ValueScopeVarOptions<T> | ComputedScopeVarOptions<T> | InheritedScopeVarOptions<T>

export interface ScopeVarDebugInfo {
  name: string | symbol
  exposeAs: string | symbol | null
  scope: ScopeCtx
  inheritedBy: Set<ScopeVar>
  options: ScopeVarOptions<any>
  ref?: Ref
  source?: string

  /** if is inherited, points to the original ScopeVar */
  inherited?: ScopeVar
  // typing info?
}

export class ScopeVar<T = any> {
  _ref: Ref<T>

  readonly id: string | symbol
  readonly exposeAs: string | symbol | null
  debug?: ScopeVarDebugInfo

  constructor(id: string | symbol, ref: Ref<T>, exposeAs: string | symbol | null) {
    this.id = id
    this._ref = ref
    this.exposeAs = exposeAs
  }

  get value(): T {
    return this._ref.value
  }

  set value(newValue: T) {
    this._ref.value = newValue
  }
}

/**
 *
 * @param scope
 * @param name
 * @param options
 */
export function defineScopeVar<T = any>(
  scope: ScopeCtx,
  name: string | symbol,
  options: ScopeVarOptions<T>,
): ScopeVar<T> {
  // 1. create reactive ref

  let ref: Ref
  let inheritedScopeVar: ScopeVar | undefined
  let postCall1 = NOOP

  if ('set' in options) {
    ref = computed({
      get: options.get || NOOP,
      set: options.set!,
    })
  }
  else if ('get' in options) {
    ref = computed(options.get)
  }
  else if ('inherited' in options) {
    const inheritedName = options.inherited
    const inheritedRef = computed(() => {
      let parentScope: ScopeCtx | null = scope
      while (parentScope = parentScope.parent) { // eslint-disable-line no-cond-assign
        const originalScopeVar = parentScope.exposed[inheritedName]
        if (originalScopeVar) {
          if (isDevelopmentMode) {
            // in development mode, track usage by scopeCtx.$inheritedVars
            inheritedScopeVar?.debug!.inheritedBy.delete(scopeVar)
            inheritedScopeVar = originalScopeVar
            originalScopeVar.debug!.inheritedBy.add(scopeVar)
          }
          return originalScopeVar
        }
      }

      if (isDevelopmentMode && inheritedScopeVar) {
        // the inheriting var is removed from parent scope?
        console.warn(`[hey-stack] deleting variable "${String(inheritedScopeVar.debug!.name)}" that inherited by descendant: `, scope, name)
        inheritedScopeVar.debug!.inheritedBy.delete(scopeVar)
        inheritedScopeVar = undefined
      }

      return computed(() => {
        let val = options.default
        if (val === undefined && typeof options.defaultInitializer === 'function') {
          val = options.defaultInitializer(scope)
        }
        return val
      })
    })

    ref = computed({
      get: () => inheritedRef.value.value,
      set: newValue => void ((inheritedRef.value as any).value = newValue),
    })

    if (isDevelopmentMode) {
      // compute the `inheritedRef` first, to make `inheritedBy` updated
      postCall1 = () => void inheritedRef.value
    }
  }
  else {
    // value ref
    if (options.shallow) ref = shallowRef(options.value)
    else ref = createRef(options.value)
  }

  // 2. create scopeVar

  const exposeAs = options.private ? null : (options.exposeAs ?? name)
  const scopeVar = new ScopeVar<T>(name, ref, exposeAs)

  if (isDevelopmentMode) {
    scopeVar.debug = {
      name,
      exposeAs,
      scope,
      options,
      inheritedBy: new Set(),
      ref: ref,
      source: '',
      get inherited() { return inheritedScopeVar },
    }

    if ('inherited' in options) {
      if (!scope.$inheritingVars) scope.$inheritingVars = new Set()
      scope.$inheritingVars.add(scopeVar)
    }
  }

  // 3. add to scope

  const prevScopeVar = scope.vars[name]
  if (prevScopeVar) {
    // redeclaring variable in scope! dangerous!

    // the `exposeAs` changed
    const prevExposeAs = prevScopeVar.exposeAs
    if (prevExposeAs !== exposeAs && prevExposeAs !== null) delete scope.exposed[prevExposeAs]

    // in development mode, maintain the `$inheritingVars` set
    if (isDevelopmentMode) {
      prevScopeVar.debug!.inherited?.debug!.inheritedBy.delete(prevScopeVar)
      scope.$inheritingVars?.delete(prevScopeVar)
    }
  }

  scope.vars[name] = scopeVar
  if (exposeAs !== null) scope.exposed[exposeAs] = scopeVar

  postCall1()
  return scopeVar
}
