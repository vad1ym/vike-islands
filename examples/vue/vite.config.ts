import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vike from 'vike/plugin'
import { vikeIslands } from 'vike-islands/vue'
import { createLmdbCache } from 'vike-islands/cache/lmdb'

import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      '@': __dirname,
    },
  },
  plugins: [
    vikeIslands({ cache: createLmdbCache() }),
    vue(),
    vike(),
  ],
})
