declare const __DEV__: boolean
declare const process: any

export const isDevelopmentMode = typeof (__DEV__) !== 'undefined'
  ? !!(__DEV__)
  : (typeof (process) !== 'undefined' && process.env.NODE_ENV === 'development')
