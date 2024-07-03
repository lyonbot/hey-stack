import { defineConfig } from 'vitest/config'

export default defineConfig({
  base: './',
  test: {
    env: {
      NODE_ENV: 'test',
    },
  },
})
