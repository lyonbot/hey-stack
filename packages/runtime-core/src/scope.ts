import { computed, Ref, ref as createRef, shallowRef } from '@vue/reactivity'

import { isDevelopmentMode } from './constants.js'
import { NOOP } from './utils.js'

export interface ScopeCtx {
  [k: string | symbol]: any

  /** The current scope. */
  $scope: any

  /** The parent scope. */
  $parentScope: ScopeCtx | null

  /** All variables in the current scope, including private. */
  [$descriptors]: Record<string | symbol, [descriptor: PropertyDescriptor, debug: null | ScopeVariableDebugInfo]>

  /** revision of descriptors. specially includes `fallbackKey` for undeclared variables */
  [$descriptorRevision]: Record<string | symbol, Ref<number>>

  /** Prototype for descendants. Used to inherit descriptors from parent scope. */
  [$protoForDescendants]: {
    [k: string | symbol]: any
    [$descriptors]: Record<string | symbol, [descriptor: PropertyDescriptor, debug: null | ScopeVariableDebugInfo]>
    [$descriptorRevision]: Record<string | symbol, Ref<number>>
  }
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

export const $descriptors = Symbol('descriptors') // all of current scope, including private. store with current name
const $protoForDescendants = Symbol('protoForDescendants')
const $descriptorRevision = Symbol('descriptorRevision')
const $fallbackKey = Symbol('fallbackKey')

export interface ScopeVariableDebugInfo {
  name: string | symbol
  scope: ScopeCtx
  usedBy: Set<ScopeCtx>
  options: ScopeVariableOptions
  revision: Ref<number>
  ref?: Ref
  source?: string
  // typing info?
}

/** @internal */
export interface ScopeSetupOptionsBase<FrameworkComponent> {
  /** The component to render, when async setup throws an error. */
  errorComponent?: FrameworkComponent
}

function create<T = any>(proto: any, data?: T): T {
  const obj = Object.create(proto || null)
  if (data) Object.assign(obj, data)
  return obj
}

export function createScopeContext(parent: ScopeCtx | null): ScopeCtx {
  const parentProto = parent?.[$protoForDescendants]
  const scope = create<ScopeCtx>(
    parentProto,
    {
      $parentScope: parent,
      $scope: null as any,

      // this may contain private variables which are not exposed to descendants
      [$descriptors]: create(parentProto?.[$descriptors]),
      [$descriptorRevision]: create(parentProto?.[$descriptorRevision], {
        [$fallbackKey]: shallowRef(0),
      }),

      // for descendants inheriting
      [$protoForDescendants]: create(parentProto, {
        [$descriptors]: create(parentProto?.[$descriptors]),
        [$descriptorRevision]: create(parentProto?.[$descriptorRevision], {
          [$fallbackKey]: shallowRef(0),
        }),
      }),
    },
  )

  return (scope.$scope = scope)
}

export function disposeScopeContext(scopeCtx: ScopeCtx): void {
  const descriptors = scopeCtx[$descriptors]
  Object.entries(descriptors).forEach(([/* name */, [/* descriptor */, debug]]) => {
    if (isDevelopmentMode && debug) debug.usedBy.delete(scopeCtx)
  })

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
    : arg1

  // all updated field revision counters, exclude `fallbackKey`
  const revCounterQueue = [] as Ref<number>[]

  // shortcuts
  const selfRevisions = scope[$descriptorRevision]
  const descendantScope = scope[$protoForDescendants]
  const descendantsRevisions = descendantScope[$descriptorRevision]

  // all updated descriptors, for Object.defineProperties
  const selfDescriptors = {} as Record<string | symbol, PropertyDescriptor>
  const descendantsDescriptors = {} as Record<string | symbol, PropertyDescriptor>

  for (const name in optionsMap) {
    const options = optionsMap[name]
    if (!options) continue

    // 0. field revision counter

    let revCounter = selfRevisions[name]
    if (!revCounter) selfRevisions[name] = revCounter = shallowRef(0)
    revCounterQueue.push(revCounter)

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

    const descriptor: PropertyDescriptor = {
      enumerable: true,
      configurable: true,
      get: () => (revCounter.value, ref.value),
      set: newValue => void (ref.value = newValue),
    }

    const debugInfo: null | ScopeVariableDebugInfo = !isDevelopmentMode
      ? null
      : {
          name,
          scope,
          options,
          ref,
          revision: revCounter,
          usedBy: new Set([scope]),
          source: '',
        }

    // apply to descendants
    const exposeAs = options.private ? null : (options.exposeAs ?? name)
    if (exposeAs != null) {
      descendantsDescriptors[exposeAs] = descriptor
      descendantScope[$descriptors][name] = [descriptor, debugInfo]

      // because this property is inherited, we reuse same revision counter
      const prevRevCounter = descendantsRevisions[exposeAs]
      descendantsRevisions[exposeAs] = revCounter // force replace revision counter
      if (prevRevCounter && prevRevCounter !== revCounter) revCounterQueue.push(prevRevCounter) // if did replaced, notify the old one when updated
    }

    // apply to self
    selfDescriptors[name] = descriptor
    scope[$descriptors][name] = [descriptor, debugInfo]
  }

  // batch defineProperties
  if (Object.keys(descendantsDescriptors).length) {
    Object.defineProperties(descendantScope, descendantsDescriptors)
    revCounterQueue.push(descendantsRevisions[$fallbackKey])
  }
  Object.defineProperties(scope, selfDescriptors)

  // notify revision counters
  selfRevisions[$fallbackKey].value++
  revCounterQueue.forEach(revCounter => revCounter.value++)
}
