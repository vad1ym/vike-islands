import { defineConfig } from 'tsup'

export default defineConfig([
  {
    entry: {
      plugin: 'lib/plugin/index.ts',
      vue: 'lib/vue/entry.ts',
      react: 'lib/react/entry.ts',
      'vue/+config': 'lib/vue/+config.ts',
      'react/+config': 'lib/react/+config.ts',
      'vue/__internal/onRenderHtml': 'lib/vue/onRenderHtml.ts',
      'react/__internal/onRenderHtml': 'lib/react/onRenderHtml.ts',
    },
    outDir: 'dist',
    format: ['esm'],
    dts: false,
    clean: true,
    external: [
      'vite',
      'vue',
      'react',
      'react-dom/client',
      'react-dom/server',
      '@vue/compiler-sfc',
      '@vue/compiler-dom',
    ],
  },
  {
    // Runtime bundles must be self-contained — they are inlined into <script type="module">
    // and cannot reference external chunk files
    entry: {
      'runtime-vue': 'lib/vue/hydrateIslands.ts',
      'runtime-react': 'lib/react/hydrateIslands.ts',
    },
    outDir: 'dist',
    format: ['esm'],
    dts: false,
    splitting: false,
    external: [
      'vite',
      'vue',
      'react',
      'react-dom/client',
      'react-dom/server',
      '@vue/compiler-sfc',
      '@vue/compiler-dom',
    ],
  },
])
