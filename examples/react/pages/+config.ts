import vikeReact from 'vike-react/config'
import vikeIslands from 'vike-islands/react/+config'
import type { Config } from 'vike/types'

export default {
  extends: [vikeReact, vikeIslands],
  clientRouting: false,
  meta: {
    Page: {
      env: { server: true, client: false }
    }
  },
} satisfies Config
