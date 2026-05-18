import type { Config } from 'vike/types'

export default {
  name: 'vike-islands-react',

  onRenderHtml: 'import:vike-islands/react/__internal/onRenderHtml:onRenderHtml',
} satisfies Config
