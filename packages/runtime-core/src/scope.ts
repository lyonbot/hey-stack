/* eslint-disable @typescript-eslint/no-unsafe-declaration-merging */
import { ShallowReactive, shallowReactive } from '@vue/reactivity'

import { isDevelopmentMode } from './constants.js'
import { ScopeVar } from './scopeVar.js'

export interface ScopeCtx {
  /** The current scope. */
  self: ScopeCtx

  /** The parent scope. */
  parent: ScopeCtx | null

  /** All scopeVar declared in this scope. */
  vars: Record<string | symbol, ScopeVar>

  /** Exposed scopeVar for descendants. */
  exposed: ShallowReactive<Record<string | symbol, ScopeVar>>

  /** all own scopeVar that is inheriting. only in development mode. */
  $inheritingVars?: Set<ScopeVar>
}

/** @internal */
export interface ScopeSetupOptionsBase<FrameworkComponent> {
  /** The component to render, when async setup throws an error. */
  errorComponent?: FrameworkComponent
}

export const scopeContextSetupHooks: ((self: ScopeCtx, parent: ScopeCtx | null) => void)[] = []

export function createScopeContext(parent?: ScopeCtx | null): ScopeCtx {
  const scope: ScopeCtx = {
    self: null as any,
    parent: parent || null,
    vars: {},
    exposed: shallowReactive({} as any),
  }
  scope.self = scope

  return scope
}

export function disposeScopeContext(scopeCtx: ScopeCtx): void {
  if (isDevelopmentMode) {
    const { $inheritingVars: inheritedVars } = scopeCtx
    if (inheritedVars) {
      inheritedVars.forEach(v => v.debug!.inherited?.debug!.inheritedBy.delete(v))
      inheritedVars.clear()
    }
  }
}
