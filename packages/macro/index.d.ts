/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/ban-ts-comment */

/**
 * This file provides all "macro" functions for Pseudo JSX code.
 */

// @ts-ignore
type JSXElement = JSX.Element
type Component<Props> = (props: Props) => JSXElement

type MaybePromise<T> = T | Promise<T>

/**
 * define a new scope component
 */
export function scopeComponent(name: string, fn: () => MaybePromise<JSXElement>): Component<{}>
export function scopeComponent(fn: () => MaybePromise<JSXElement>): Component<{}>
export function scopeComponent<Props>(name: string, fn: (props: Props) => MaybePromise<JSXElement>): Component<Props>
export function scopeComponent<Props>(fn: (props: Props) => MaybePromise<JSXElement>): Component<Props>

/**
 * define and render a new scope component (use it in JSX)
 */
export function Scope(name: string, fn: () => MaybePromise<JSXElement>): JSXElement
export function Scope(fn: () => MaybePromise<JSXElement>): JSXElement

interface ScopeVar {
  <T>(value: T): T

  /** create a shallow reactive variable. its value will not become a Proxy object */
  ref: <T>(value: T) => T

  /** a computed variable, optionally with setter */
  computed<T>(value: () => T, setter?: (value: T) => void): T

  /**
   * inherit from parent scope.
   *
   * @param parentExposedName - by default using same name as variable's to seek
   * @param defaultValue - value if failed to inherit. this will NOT evaluated if successfully inherited.
   *
   * @example
   * ```jsx
   * const Page = scopeComponent(async () => {
   *   const gifts = scopeVar(await fetchGifts());
   *   return (
   *     <div>
   *       <div> we got {gifts.length} gifts </div>
   *       {Scope("pageContent", () => {
   *         // `items` is identical to outer `gifts`, readable and writable
   *         //                      👇
   *         const items = scopeVar.inherited(gifts);
   *         return (
   *           <div> we got {items.length} items </div>
   *         );
   *       })}
   *     </div>
   *   );
   * });
   * ```
   */
  inherited<T = any>(parentExposedName?: string | null | undefined, defaultValue?: T): T
  inherited<T = any>(parentExposedVar: T, defaultValue?: T): T
}

/**
 * mark variable as computed, ref, etc.
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
