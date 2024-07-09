const throwError = () => {
  throw new Error('Your code is not compiled.')
}

const throwProxy = new Proxy(throwError, {
  get: throwError,
  set: throwError,
})

export const scope = throwProxy
export const scopeVar = throwProxy
export const scopeFor = throwProxy
