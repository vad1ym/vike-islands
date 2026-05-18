import type { Config } from 'vike/types'

export default {
  name: 'vike-islands-react',

  onRenderHtml: 'import:vike-islands/react/__internal/onRenderHtml:onRenderHtml',

  meta: {
    Page: {
      env: { server: true, client: false },
    },
    Layout: {
      env: { server: true },
      cumulative: true,
    },
    title: {
      env: { server: true },
    },
    description: {
      env: { server: true },
    },
    favicon: {
      env: { server: true },
      global: true,
    },
    lang: {
      env: { server: true },
    },
  },
} satisfies Config
