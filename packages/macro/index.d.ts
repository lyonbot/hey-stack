/* eslint-disable @typescript-eslint/ban-ts-comment */
/**
 * This file provides all "macro" functions for Pseudo JSX code.
 */

// @ts-ignore
type JSXElement = JSX.ELement

/**
 * define a new scope component
 */
export function scope(fn: () => JSXElement): any

interface ScopeVar {
  <T>(value: T): T
  computed: ScopeVar
  private: ScopeVar
  inherited: <T = any>() => T
  // TODO: props
}

/**
 * mark variable as computed, private, etc.
 */
export const scopeVar: ScopeVar

/**
 * render a list of items
 */
export function scopeFor<T>(
  items: T[] | null | undefined,
  render: (item: T, key: number, array: T[]) => JSXElement
): JSXElement
export function scopeFor<T>(
  items: Record<string, T> | null | undefined,
  render: (item: T, key: string, array: T[]) => JSXElement
): JSXElement
export function scopeFor<T>(
  items: T[] | Record<string | number | symbol, T> | null | undefined,
  render: (item: T, key: any, array: T[]) => JSXElement
): JSXElement
