/**
 * Convert a name to a variable name, in camel case.
 *
 * For example:
 * - `foo_bar` => `fooBar`
 * - `3foo_bar` => `_3fooBar`
 */
export function toVariableName(name: string) {
  let ans = name.replace(/[^a-zA-Z0-9]+([a-zA-Z])?/g, (_, c) => c.toUpperCase())
  if (!/[a-zA-Z]/.test(ans[0])) ans = `_${ans}`
  return ans
}

/**
 * Convert a name to a component name, in PascalCase.
 *
 * For example:
 * - `foo_bar` => `FooBar`
 * - `3foo_bar` => `C3FooBar`
 */
export function toComponentName(name: string) {
  let ans = toVariableName(name).replace(/[_]+/g, '')
  if (/[a-zA-Z]/.test(ans[0])) ans = `${ans[0].toUpperCase()}${ans.slice(1)}`
  else ans = `C${ans}`
  return ans
}

export function isComponentName(name: string) {
  return /^[A-Z]/.test(name)
}
