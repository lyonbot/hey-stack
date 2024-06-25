import { Ref, ref as createRef } from '@vue/reactivity'

import { isDevelopmentMode } from './constants.js'

export interface ScopeCtx {
  [k: string | symbol]: any

  /** The current scope. */
  $scope: any

  /** The parent scope. */
  $parentScope: ScopeCtx | null

  /** Inheritable variables for sub scopes. */
  [$inheritableDescriptors]: Record<string | symbol, [descriptor: PropertyDescriptor, debug: null | ScopeVariableDebugInfo]>

  /** All variables in the current scope, including private. */
  [$descriptors]: Record<string | symbol, [descriptor: PropertyDescriptor, debug: null | ScopeVariableDebugInfo]>
}

export interface ScopeVariableOptions {
  /** Initializer function (can be async). Can't be used together with `get` or `set`. */
  value?: any

  /** Getter function. */
  get?: () => any

  /** Setter function. */
  set?: (value: any) => void

  /** If true, variable cannot be inherited. */
  private?: boolean

  /** String or symbol to change the name for sub-scopes. Can't be used together with `private`. */
  exposedAs?: string | symbol
}

export const $descriptors = Symbol('descriptors') // all of current scope, including private. store with current name
export const $inheritableDescriptors = Symbol('inheritableDescriptors')

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

export function createScopeContext(parent: ScopeCtx | null): ScopeCtx {
  const scope: ScopeCtx = {
    $parentScope: parent,
    $scope: null as any,
    [$inheritableDescriptors]: {},
    [$descriptors]: {},
  }

  if (parent) {
    // inherit all variables from parent scope
    const parentDescriptors = parent[$inheritableDescriptors]
    Object.assign(scope[$inheritableDescriptors], parentDescriptors)
    Object.assign(scope[$descriptors], parentDescriptors)
    Object.entries(parentDescriptors).forEach(([name, [descriptor, debug]]) => {
      Object.defineProperty(scope, name, descriptor)
      if (isDevelopmentMode && debug) debug.usedBy.add(scope)
    })
  }

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
export function defineScopeVariable(scope: ScopeCtx, name: string | symbol, options: ScopeVariableOptions): void {
  const descriptor: PropertyDescriptor = {
    enumerable: true,
    configurable: true,
  }

  let ref: Ref | undefined
  if (options.get || options.set) {
    descriptor.get = options.get
    descriptor.set = options.set
  }
  else {
    // TODO: shallowRef?
    ref = createRef(options.value)
    descriptor.get = () => ref!.value
    descriptor.set = (newValue) => {
      ref!.value = newValue
    }
  }

  const debugInfo: null | ScopeVariableDebugInfo = !isDevelopmentMode
    ? null
    : {
        name,
        scope: scope,
        options,
        ref,
        usedBy: new Set([scope]),
        source: '',
      }

  scope[$descriptors][name] = [descriptor, debugInfo]
  const exposedAs = options.private ? null : (options.exposedAs ?? name)
  if (exposedAs != null) scope[$inheritableDescriptors][exposedAs] = [descriptor, debugInfo]

  Object.defineProperty(scope, name, descriptor)
}
