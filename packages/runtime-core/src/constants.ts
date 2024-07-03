declare const __DEV__: boolean
declare const process: any

/* v8 ignore next 3 */
export const isDevelopmentMode = typeof (__DEV__) !== 'undefined'
  ? !!(__DEV__)
  : (typeof (process) !== 'undefined' && (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test'))
