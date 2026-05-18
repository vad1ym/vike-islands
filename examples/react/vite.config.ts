import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import vike from 'vike/plugin'
import { vikeIslands } from 'vike-islands/react'
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
    react(),
    vike(),
  ],
})
