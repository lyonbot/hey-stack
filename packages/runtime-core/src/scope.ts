/* eslint-disable @typescript-eslint/no-unsafe-declaration-merging */
import { computed, Ref, ref as createRef, shallowRef } from '@vue/reactivity'

import { isDevelopmentMode } from './constants.js'
import { NOOP } from './utils.js'

export const $scopeCtxVariableManager = Symbol('scopeCtxVariableManager') // all of current scope, including private. store with current name

type ExtendedPropertyDescriptor = PropertyDescriptor & { $debug?: ScopeVariableDebugInfo | null }

class ScopeCtxVariableManager {
  fallbackRevision = shallowRef(0)
  keyRevisions = Object.create(null) as Record<string | symbol, Ref<number>>
  parent: ScopeCtxVariableManager | null
  dest: any

  descriptors: Record<string | symbol, ExtendedPropertyDescriptor>

  /**
   * access the field revision counter of a key. works with Vue reactivity.
   *
   * @remarks this function is already bound, you can call it without `this`.
   * @returns `true` if key exists in this or any ancestor zone
   */
  readonly depend: ($key: string | symbol) => boolean

  /**
   * create or update variables in this zone.
   */
  readonly add: (descriptors: Record<string | symbol, ExtendedPropertyDescriptor>) => void

  /**
   * @param dest
   * @param parent parent variable manager. only for
   */
  constructor(dest: any, parent: ScopeCtxVariableManager | null = null) {
    this.dest = dest
    this.parent = parent

    if (parent) {
      this.descriptors = Object.create(parent.descriptors)

      if (isDevelopmentMode) {
        for (const key in parent.descriptors) {
          const debug = parent.descriptors[key].$debug
          if (debug) debug.usedBy.add(dest)
        }
      }
    }
    else {
      this.descriptors = Object.create(null)
    }

    const { keyRevisions, fallbackRevision } = this
    const parentDepend = parent?.depend
    this.depend = ($key) => {
      // add dependency by accessing the ref.value
      const k = keyRevisions[$key];
      (k || fallbackRevision).value
      if (!k && parentDepend) return parentDepend($key)
      return !!k
    }

    this.add = (descriptors) => {
      // if is shadowing, remove from "usedBy" of parent
      if (isDevelopmentMode) {
        for (const name in descriptors) {
          const debug = this.descriptors[name]?.$debug
          if (debug) debug.usedBy.delete(dest)
        }
      }

      Object.defineProperties(dest, descriptors)
      Object.assign(this.descriptors, descriptors)

      const mod = this.modKeys()
      Object.keys(descriptors).forEach(mod.update)
      mod.commit()
    }
  }

  modKeys() {
    let isKeyListChanged = false
    const queue = new Set<Ref<number>>()

    const selfKeyRev = this.keyRevisions
    const allKeyRev = this.fallbackRevision

    return {
      update(key: string | symbol) {
        const rev = selfKeyRev[key]
        if (rev) queue.add(rev)
        else {
          selfKeyRev[key] = shallowRef(0)
          isKeyListChanged = true
        }
        return rev
      },

      delete(key: string | symbol) {
        const rev = selfKeyRev[key]
        if (rev) {
          queue.add(rev)
          delete selfKeyRev[key]
          isKeyListChanged = true
        }

        return rev
      },

      commit() {
        queue.forEach(rev => rev.value++)
        if (isKeyListChanged) allKeyRev.value++

        queue.clear()
        isKeyListChanged = false
      },
    }
  }
}

export const $variableZoneForDescendants = Symbol('variableZoneForDescendants')

export interface ScopeCtx {
  [key: string | symbol]: any

  /** The current scope. */
  $scope: any

  /** The parent scope. */
  $parentScope: ScopeCtx | null

  /** The variable manager for this scope. */
  [$scopeCtxVariableManager]: ScopeCtxVariableManager

  /** For descendants, Used to inherit variables from parent scope. */
  [$variableZoneForDescendants]: ScopeCtx
}

export interface ScopeVariableOptions {
  /** If true, use `shallowRef` to store value. */
  shallow?: boolean

  /** Initializer function (can be async). Can't be used together with `get` or `set`. */
  value?: any

  /** Getter function. */
  get?: () => any

  /** Setter function. */
  set?: (value: any) => void

  /** If true, variable cannot be inherited. */
  private?: boolean

  /** String or symbol to change the name for sub-scopes. Can't be used together with `private`. */
  exposeAs?: string | symbol
}

export interface ScopeVariableDebugInfo {
  name: string | symbol
  scope: ScopeCtx
  usedBy: Set<ScopeCtx>
  options: ScopeVariableOptions
  ref?: Ref
  source?: string
  // typing info?
}

/** @internal */
export interface ScopeSetupOptionsBase<FrameworkComponent> {
  /** The component to render, when async setup throws an error. */
  errorComponent?: FrameworkComponent
}

export const scopeContextSetupHooks: ((self: ScopeCtx, parent: ScopeCtx | null) => void)[] = []

// why separate this function?
// because V8 fast-properties optimization will be applied to a returned object
// ( use %DebugPrint(scope) to check )
function baseCreate(parent: ScopeCtx | null): ScopeCtx {
  const scope: ScopeCtx = parent ? Object.create(parent) : {}
  scope[$scopeCtxVariableManager] = new ScopeCtxVariableManager(scope, parent?.[$scopeCtxVariableManager])
  scope.$parentScope = parent
  scope.$scope = scope
  return scope
}

export function createScopeContext(parent?: ScopeCtx | null): ScopeCtx {
  const parentPublic = parent?.[$variableZoneForDescendants] || null
  const scope = baseCreate(parentPublic)

  // a sibling scope for descendants, which contains public variables only
  const forDescendants = baseCreate(parentPublic)
  forDescendants.$scope = scope

  scope[$variableZoneForDescendants] = forDescendants

  return scope
}

function disposeByDescriptors(s: ScopeCtx) {
  if (!s) return
  const descriptors = s[$scopeCtxVariableManager].descriptors

  if (isDevelopmentMode) {
    for (const name in descriptors) {
      const debug = descriptors[name].$debug!
      debug.usedBy.delete(s)
    }
  }
}

export function disposeScopeContext(scopeCtx: ScopeCtx): void {
  scopeCtx = scopeCtx.$scope

  disposeByDescriptors(scopeCtx)
  disposeByDescriptors(scopeCtx[$variableZoneForDescendants])

  // TODO: check children-leaking: parent disposed but child still in use
}

/**
 * Define a variable inside scope.
 *
 * @param name - The name of the variable.
 * @param options - The options for the variable.
 */
export function defineScopeVariable(scope: ScopeCtx, name: string | symbol, options: ScopeVariableOptions): void
export function defineScopeVariable(scope: ScopeCtx, variables: Record<string | symbol, ScopeVariableOptions>): void
export function defineScopeVariable(scope: ScopeCtx, arg1: any, arg2?: any): void {
  if (!arg1) return

  const optionsMap: Record<string | symbol, ScopeVariableOptions> = typeof arg1 === 'string' || typeof arg1 === 'symbol'
    ? { [arg1]: arg2 }
    : { ...arg1 }

  const descendantScope = scope[$variableZoneForDescendants]

  // all updated descriptors, for Object.defineProperties
  const selfDescriptors = {} as Record<string | symbol, ExtendedPropertyDescriptor>
  const descendantsDescriptors = {} as Record<string | symbol, ExtendedPropertyDescriptor>

  const selfMgr = scope[$scopeCtxVariableManager]
  const descendantMgr = descendantScope[$scopeCtxVariableManager]

  const selfDepend = selfMgr.depend
  const descendantDepend = descendantMgr.depend

  for (const name in optionsMap) {
    const options = optionsMap[name]
    if (!options) continue

    // 1. create ref

    let ref: Ref
    if (options.set) {
      ref = computed({
        get: options.get || NOOP,
        set: options.set,
      })
    }
    else if (options.get) {
      ref = computed(options.get)
    }
    else {
      // value ref
      if (options.shallow) ref = shallowRef(options.value)
      else ref = createRef(options.value)
    }

    // 2. create descriptor

    const debugInfo: null | ScopeVariableDebugInfo = !isDevelopmentMode
      ? null
      : {
          name,
          scope,
          options,
          ref,
          usedBy: new Set([scope]),
          source: '',
        }

    const descriptor: ExtendedPropertyDescriptor = {
      enumerable: true,
      configurable: true,
      get: () => (selfDepend(name), ref.value),
      set: newValue => void (ref.value = newValue),
      $debug: debugInfo,
    }

    // apply to descendants
    const exposeAs = options.private ? null : (options.exposeAs ?? name)
    if (exposeAs != null) {
      descendantsDescriptors[exposeAs] = {
        ...descriptor,
        get: () => (descendantDepend(exposeAs), ref.value),
      }

      if (isDevelopmentMode && debugInfo) debugInfo.usedBy.add(descendantScope)
    }

    // apply to self
    selfDescriptors[name] = descriptor
  }

  selfMgr.add(selfDescriptors)
  descendantMgr.add(descendantsDescriptors)
}
