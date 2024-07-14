/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/ban-ts-comment */

/**
 * This file provides all "macro" functions for Pseudo JSX code.
 */

// @ts-ignore
type JSXElement = JSX.Element
type Component<Props> = (props: Props) => JSXElement

/**
 * define a new scope component
 */
export function scopeComponent(name: string, fn: () => JSXElement): Component<{}>
export function scopeComponent(fn: () => JSXElement): Component<{}>
export function scopeComponent<Props>(name: string, fn: (props: Props) => JSXElement): Component<Props>
export function scopeComponent<Props>(fn: (props: Props) => JSXElement): Component<Props>

/**
 * define and render a new scope component (use it in JSX)
 */
export function Scope(name: string, fn: () => JSXElement): JSXElement
export function Scope(fn: () => JSXElement): JSXElement

interface ScopeVar {
  <T>(value: T): T
  private: ScopeVar

  /** a computed variable, optionally with setter */
  computed<T>(value: T, setter?: (value: T) => void): T

  /**
   * inherit from parent scope.
   *
   * @param parentExposedName - by default using same name as variable's to seek
   * @param defaultValue - value if failed to inherit. this will NOT evaluated if successfully inherited.
   */
  inherited<T = any>(parentExposedName?: string | null | undefined, defaultValue?: T): T
}

/**
 * mark variable as computed, private, etc.
 */
export const scopeVar: ScopeVar

/**
 * render a list of items (use it in JSX)
 */
export function ScopeFor<T>(
  items: T[] | null | undefined,
  renderItem: (item: T, key: number, array: T[]) => JSXElement
): JSXElement
export function ScopeFor<T>(
  items: Record<string, T> | null | undefined,
  renderItem: (item: T, key: string, array: T[]) => JSXElement
): JSXElement
export function ScopeFor<T>(
  items: T[] | Record<string | number | symbol, T> | null | undefined,
  renderItem: (item: T, key: any, array: T[]) => JSXElement
): JSXElement
