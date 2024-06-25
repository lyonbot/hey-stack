/* global __dirname */

import { defineConfig } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  base: './',
  plugins: [tsconfigPaths()],
  resolve: {
    alias: {
      'hey-stack-framework': `${__dirname}/..`,
    },
  },
  esbuild: {
    jsx: 'automatic',
    jsxFragment: 'Fragment',
    jsxImportSource: 'vue',
  },
  define: {
    __DEV__: 'true',
  },
})
