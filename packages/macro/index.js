const throwError = () => {
  throw new Error('Your code is not compiled.')
}

const throwProxy = new Proxy(throwError, {
  get: throwError,
  set: throwError,
})

export const scopeComponent = throwProxy
export const scopeVar = throwProxy

export const Scope = throwProxy
export const ScopeFor = throwProxy
