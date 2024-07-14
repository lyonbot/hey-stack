/* eslint-disable @typescript-eslint/no-unsafe-declaration-merging */
import { ShallowReactive, shallowReactive } from '@vue/reactivity'

import { isDevelopmentMode } from './constants.js'
import { ScopeVar } from './scopeVar.js'

export class ScopeCtx {
  /** The current scope. */
  self: ScopeCtx

  /** The parent scope. */
  parent: ScopeCtx | null

  /** All scopeVar declared in this scope. */
  vars: Record<string | symbol, ScopeVar>

  /** Exposed scopeVar for descendants. */
  exposed: ShallowReactive<Record<string | symbol, ScopeVar>>

  /** (only in development mode) all own scopeVar that is inheriting. */
  $inheritingVars?: Set<ScopeVar>

  constructor(parent?: ScopeCtx | null) {
    this.self = this
    this.parent = parent || null
    this.vars = {}
    this.exposed = shallowReactive({} as any)
  }
}

/** @internal */
export interface ScopeSetupOptionsBase<FrameworkComponent> {
  /** The component to render, when async setup throws an error. */
  errorComponent?: FrameworkComponent
}

export const scopeContextSetupHooks: ((self: ScopeCtx, parent: ScopeCtx | null) => void)[] = []

export function createScopeContext(parent?: ScopeCtx | null): ScopeCtx {
  return new ScopeCtx(parent)
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
