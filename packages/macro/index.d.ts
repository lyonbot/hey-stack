/* eslint-disable @typescript-eslint/ban-ts-comment */
/**
 * This file provides all "macro" functions for Pseudo JSX code.
 */

// @ts-ignore
type JSXElement = JSX.Element
type Component = (props?: any) => JSXElement

/**
 * define a new scope component
 */
export function scopeComponent(fn: () => JSXElement): Component

/**
 * define and render a new scope component (use it in JSX)
 */
export function Scope(fn: () => JSXElement): JSXElement

interface ScopeVar {
  <T>(value: T): T
  private: ScopeVar

  computed: ComputedScopeVar
  inherited: <T = any>() => T
}

interface ComputedScopeVar {
  <T>(value: T, setter?: (value: T) => void): T
  private: ComputedScopeVar
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
