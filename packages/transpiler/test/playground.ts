/* global console */

import { transform } from '@babel/core'
import jsxPlugin from '@babel/plugin-syntax-jsx'
import fs from 'fs/promises'

import plugin from '../src/index'

const code = await fs.readFile('./fixtures/1.jsx', 'utf-8')

const out = transform(code, {
  plugins: [
    jsxPlugin,
    plugin,
  ],
})!

console.log(out.code)
fs.writeFile('./fixtures/tmp-out.jsx', out.code as string)
