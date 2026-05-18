# vike-islands

Islands architecture for [Vike](https://vike.dev). Supports Vue and React.

Keep pages fully SSR-only and hydrate only the components you explicitly mark as islands.

- No full-page framework hydration
- Island components discovered by filename: `*.island.vue` / `*.island.tsx`
- Client bootstrap injected only when the page actually contains islands
- Framework runtime loaded lazily on first island hydration
- Each framework ships its own adapter — only the one you use is bundled

**[Vue Setup](#vue-setup) · [React Setup](#react-setup) · [Hydration Modes](#hydration-modes) · [Manual Hydration](#manual-hydration) · [Conventions](#conventions) · [Examples](#examples) · [How It Works](#how-it-works)**

---

## Framework Support

| Framework | Status |
|-----------|--------|
| Vue | ✅ Stable |
| React | ✅ Stable |
| Solid | Planned |

## Installation

```bash
pnpm add vike-islands
# or
npm install vike-islands
```

---

## Vue Setup

Dependencies: `vike`, `vike-vue`, `vue`, `vite`, `@vitejs/plugin-vue`

### 1. Vite plugin

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vike from 'vike/plugin'
import { vikeIslands } from 'vike-islands/vue'

export default defineConfig({
  plugins: [
    vikeIslands(),
    vue(),
    vike(),
  ],
})
```

### 2. Vike config

```ts
// pages/+config.ts
import type { Config } from 'vike/types'
import vikeVue from 'vike-vue/config'
import vikeIslands from 'vike-islands/vue/+config'

export default {
  extends: [vikeVue, vikeIslands],
  clientRouting: false,
  meta: {
    Page: {
      env: { server: true, client: false },
    },
  },
} satisfies Config
```

`clientRouting: false` and `Page.env.client = false` keep the page shell SSR-only.

### 3. Create an island component

```vue
<!-- components/Counter.island.vue -->
<script setup lang="ts">
import { ref } from 'vue'

const { initialCount = 0, label = 'Counter' } = defineProps<{
  initialCount?: number
  label?: string
}>()

const count = ref(initialCount)
</script>

<template>
  <div class="counter">
    <p>{{ label }}</p>
    <button @click="count--">−</button>
    <span>{{ count }}</span>
    <button @click="count++">+</button>
  </div>
</template>
```

### 4. Use it in a page

Import the island and mark it with `v-island`:

```vue
<!-- pages/index/+Page.vue -->
<script setup lang="ts">
import Counter from '@/components/Counter.island.vue'
</script>

<template>
  <div>
    <h1>My page</h1>
    <Counter v-island :initial-count="0" label="My island" />
  </div>
</template>
```

The Vite plugin transforms the component at build time. No extra config needed.

---

## React Setup

Dependencies: `vike`, `vike-react`, `react`, `react-dom`, `vite`, `@vitejs/plugin-react`

### 1. Vite plugin

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import vike from 'vike/plugin'
import { vikeIslands } from 'vike-islands/react'

export default defineConfig({
  plugins: [
    vikeIslands(),
    react(),
    vike(),
  ],
})
```

### 2. Vike config

```ts
// pages/+config.ts
import type { Config } from 'vike/types'
import vikeReact from 'vike-react/config'
import vikeIslands from 'vike-islands/react/+config'

export default {
  extends: [vikeReact, vikeIslands],
  clientRouting: false,
  meta: {
    Page: {
      env: { server: true, client: false },
    },
  },
} satisfies Config
```

### 3. Create an island component

```tsx
// components/Counter.island.tsx
import { useState } from 'react'

interface Props {
  initialCount?: number
  label?: string
}

export default function Counter({ initialCount = 0, label = 'Counter' }: Props) {
  const [count, setCount] = useState(initialCount)

  return (
    <div className="counter">
      <p>{label}</p>
      <button onClick={() => setCount(c => c - 1)}>−</button>
      <span>{count}</span>
      <button onClick={() => setCount(c => c + 1)}>+</button>
    </div>
  )
}
```

### 4. Use it in a page

React uses the `<Island>` wrapper component instead of a directive:

```tsx
// pages/index/+Page.tsx
import { Island } from 'vike-islands/react'
import Counter from '@/components/Counter.island'

export default function Page() {
  return (
    <div>
      <h1>My page</h1>
      <Island
        name="Counter"
        component={Counter}
        hydrate="visible"
        initialCount={0}
        label="My island"
      />
    </div>
  )
}
```

---

## Hydration Modes

Controls when the island hydrates on the client.

| Mode | Behavior |
|------|----------|
| `load` | Immediately on page load |
| `idle` | When the browser is idle (`requestIdleCallback`) |
| `visible` | When the island scrolls into the viewport |
| `interaction` | On first click, focus, or pointer enter |
| `manual` | Only when triggered via `hydrateIslandById()` |
| `never` | Never — stays as static SSR HTML |

Default: `visible`.

### Vue syntax

```vue
<Counter v-island />
<Counter v-island="'load'" />
<Counter v-island="'interaction'" />
<Counter v-island="{ hydrate: 'interaction', update: 'patch' }" />
```

### React syntax

```tsx
<Island name="Counter" component={Counter} hydrate="interaction" />
```

---

## Manual Hydration

For `hydrate: 'manual'` islands, trigger hydration from your own code:

```ts
// Vue
import { hydrateIslandById } from 'vike-islands/vue'

await hydrateIslandById('i1')
```

```ts
// React
import { hydrateIslandById } from 'vike-islands/react'

await hydrateIslandById('i1')
```

The island id is assigned automatically by the transform (`i1`, `i2`, …).

---

## Conventions

### Filenames

```
Counter.island.vue      # Vue
Counter.island.tsx      # React
Counter.island.jsx      # React (JS)
```

### Unique names

Island names must be unique by basename across the entire project. This is invalid:

```
components/header/Counter.island.vue
components/footer/Counter.island.vue  ← duplicate name "Counter"
```

---

## Examples

- [examples/vue](./examples/vue) — Vue + vike-vue
- [examples/react](./examples/react) — React + vike-react

Run an example:

```bash
pnpm run example:vue
pnpm run example:react
```

---

## How It Works

1. The Vite plugin scans the project for `*.island.*` files at build time.
2. Each island gets its own bundle entry — loaded only if the page uses it.
3. The framework runtime (Vue / React) gets a separate bundle — shared across islands.
4. On SSR, `onRenderHtml` detects which islands appear in the rendered HTML.
5. If any islands are present, a small inline `<script type="module">` is injected that:
   - Reads the island map from `window.__VIKE_ISLANDS__`
   - Imports the framework runtime lazily
   - Schedules each island for hydration according to its strategy
6. Islands hydrate independently — no coordination with a page-level app.
