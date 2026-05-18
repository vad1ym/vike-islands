import vikeVue from 'vike-vue/config'
import vikeIslands from 'vike-islands/vue/+config'
import type { Config } from 'vike/types'

export default {
  extends: [vikeVue, vikeIslands],
  clientRouting: true,
  meta: {
    Page: {
      env: { server: true, client: false }
    }
  },
} satisfies Config
