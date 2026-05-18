import type { Config } from 'vike/types'

export default {
  name: 'vike-islands',

  onRenderHtml: 'import:vike-islands/vue/__internal/onRenderHtml:onRenderHtml',
} satisfies Config
