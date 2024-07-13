import { transform as babelTransform } from '@babel/core'
import jsxPlugin from '@babel/plugin-syntax-jsx'

import plugin from '../src'

export function transpile(code: string) {
  const out = babelTransform(code, {
    plugins: [
      jsxPlugin,
      plugin,
    ],
  })

  return {
    code: out?.code,
  }
}
