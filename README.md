# vike-islands

Islands architecture for [Vike](https://vike.dev). Supports Vue and React.

Keep pages fully SSR-only and hydrate only the components you explicitly mark as islands.

- No full-page framework hydration
- Mark any component as an island with `?island` on the import
- Client bootstrap injected only when the page actually contains islands
- Framework runtime loaded lazily on first island hydration
- Each framework ships its own adapter — only the one you use is bundled

**[Vue Setup](#vue-setup) · [React Setup](#react-setup) · [Hydration Modes](#hydration-modes) · [SSR Caching](#ssr-caching) · [Manual Hydration](#manual-hydration) · [How It Works](#how-it-works)**

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

### 3. Use a component as an island

Add `?island` to the import — no need to rename or modify the component file:

```vue
<!-- pages/index/+Page.vue -->
<script setup lang="ts">
import Counter from '@/components/Counter.vue?island'
</script>

<template>
  <div>
    <h1>My page</h1>
    <Counter client:load :initial-count="0" label="My island" />
  </div>
</template>
```

TypeScript types for `?island` imports are included automatically — no `env.d.ts` needed.

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

### 3. Use a component as an island

Same `?island` import — the plugin transforms JSX automatically:

```tsx
// pages/index/+Page.tsx
import Counter from '@/components/Counter?island'

export default function Page() {
  return (
    <div>
      <h1>My page</h1>
      <Counter client:load initialCount={0} label="My island" />
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

### Vue

```vue
<Counter client:load />
<Counter client:visible />
<Counter client:idle />
<Counter client:interaction />
<Counter client:never />
```

### React

```tsx
<Counter client:load />
<Counter client:visible />
<Counter client:interaction />
<Counter client:never />
```

---

## SSR Caching

Cache the SSR HTML of an island on the first render and serve it from cache on subsequent requests. The cache key is derived from the island name and its props.

Useful for expensive SSR sections that rarely change — product lists, article bodies, navigation trees.

### Setup

Install the LMDB adapter (or bring your own):

```bash
pnpm add lmdb
```

```ts
// vite.config.ts
import { vikeIslands } from 'vike-islands/vue' // or 'vike-islands/react'
import { createLmdbCache } from 'vike-islands/cache/lmdb'

export default defineConfig({
  plugins: [
    vikeIslands({ cache: createLmdbCache() }),
    // ...
  ],
})
```

### Vue

`server:cache-key` is required when using `server:cache` — it defines the cache key explicitly, avoiding expensive serialization of large props.

```vue
<!-- SSR-only, cached 9999 seconds -->
<ProductList client:never server:cache="9999" server:cache-key="products-spain" />

<!-- hydrated on load, cached 60 seconds -->
<ProductCard client:load server:cache="60" server:cache-key="card-42" :product="product" />
```

### React

```tsx
<ProductList client:never server:cache={9999} server:cache-key="products-spain" />
<ProductCard client:load server:cache={60} server:cache-key="card-42" product={product} />
```

### Custom adapter

```ts
import type { IslandCacheAdapter } from 'vike-islands/cache/lmdb'

const myAdapter: IslandCacheAdapter = {
  async get(key) {
    return redis.get(key)
  },
  async set(key, html, ttl) {
    await redis.set(key, html, { EX: ttl })
  },
}

vikeIslands({ cache: myAdapter })
```

---

## Manual Hydration

For `hydrate: 'manual'` islands, trigger hydration from your own code:

```ts
// Vue
import { hydrateIslandById } from 'vike-islands/vue'
await hydrateIslandById('i1')

// React
import { hydrateIslandById } from 'vike-islands/react'
await hydrateIslandById('i1')
```

The island id is assigned automatically by the transform (`i1`, `i2`, …).

---

## Examples

- [examples/vue](./examples/vue) — Vue + vike-vue
- [examples/react](./examples/react) — React + vike-react

```bash
pnpm run example:vue
pnpm run example:react
```

---

## How It Works

1. The Vite plugin scans the project for `?island` imports at build time.
2. Each island gets its own bundle entry — loaded only if the page uses it.
3. The framework runtime (Vue / React) gets a separate bundle — shared across islands.
4. On SSR, `onRenderHtml` detects which islands appear in the rendered HTML.
5. If any islands are present, a small inline `<script type="module">` is injected that:
   - Reads the island map from `window.__VIKE_ISLANDS__`
   - Imports the framework runtime lazily
   - Schedules each island for hydration according to its strategy
6. Islands hydrate independently — no coordination with a page-level app.
