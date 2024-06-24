import { defineConfig } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths()],
  esbuild: {
    tsconfigRaw: JSON.stringify({
      compilerOptions: {
        jsx: 'react',
        jsxImportSource: 'vue',
      },
    }),
  },
  define: {
    __DEV__: 'true',
  },
})
