import type { Config } from 'vike/types'

export default {
  name: 'vike-islands',

  onRenderHtml: 'import:vike-islands/vue/__internal/onRenderHtml:onRenderHtml',

  meta: {
    onRenderHtml: {
      env: { server: true },
      // Not cumulative — our hook wraps vike-vue's internally, only one should run
    },
  },
} satisfies Config
